// ===== Nodo "Barrido" (n8n Code) — insiste a cada encargado hasta tener los datos =====
// Corre cada 2 h, pero solo escribe en horario laboral (8:00 a 20:00, hora de Florida)
// y como mucho una vez cada 4 h por pendiente.
// Escalamiento: desde el 3er aviso sin respuesta se le avisa a su Manager de Venta (1 vez al día);
// desde el 6º, a Admin/CEO con un resumen (1 vez al día).
// Con BARRIDO_SEND != 'true' solo SIMULA y devuelve los mensajes.
{ const i0 = $input.first().json; if (i0.body || i0.event) return []; } // viene del webhook, no del Schedule
const SEND = E.BARRIDO_SEND === 'true';
const H = 3600 * 1000, CADA = 4 * H, DIA = 24 * H;
const horaFL = Number(new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false })) % 24;
if (!E.BARRIDO_SIEMPRE && (horaFL < 8 || horaFL >= 20)) return [{ json: { resultado: `Fuera de horario laboral (${horaFL}h en Florida): no se envían recordatorios` } }];

sd.cnt = sd.cnt || {}; // veces que ya se recordó cada pendiente
const ahora = Date.now();
const reciente = (k, ventana) => sd.reg[k] && ahora - Date.parse(sd.reg[k]) < ventana;
const ctx = await cargarCtx();

// 1) Pendientes de todos, agrupados por persona (solo clientes que le corresponden)
const porUsuario = {}; // userId -> { u, items: [{k, line}] }
const vivos = new Set();
const add = (u, key, line) => {
  const k = `${u.id}|${key}`;
  vivos.add(k);
  if (reciente(k, CADA)) return; // ya se le recordó hace poco
  (porUsuario[u.id] = porUsuario[u.id] || { u, items: [] }).items.push({ k, line });
};

const pros = await sel('clientes_maestro', 'select=id,nombre,departamento,departamentos_activos,vendedor_asignado_id&macro_estado=eq.Prospecto');
for (const c of pros.filter(esWaterCli)) {
  const u = ctx.users.find((x) => x.id === c.vendedor_asignado_id && !x.is_suspended);
  if (u) add(u, 'prospecto:' + c.id, `🆕 *${c.nombre}*: ¿la Aplicación de Crédito fue *aceptada* o *rechazada*? (si fue rechazada, dime el motivo)`);
}
const ps = (await sel('proyectos_dinamicos', 'select=id,cliente_id,fase_id,responsable_id,tecnico_id,fecha_cierre&pipeline_id=eq.pip_water&fase_id=not.is.null'))
  .filter((p) => sigueAbierto(p, ctx));
if (ps.length) {
  await nombresClientes(ctx, ps.map((p) => p.cliente_id));
  const resp = await sel('respuestas_dinamicas', `select=proyecto_id,campo_id,valor&proyecto_id=${inList(ps.map((p) => p.id))}`);
  for (const p of ps) {
    const linea = lineaPendiente(p, ctx, resp);
    if (linea) encargadosAutorizados(ctx.F[p.fase_id], p, ctx).forEach((u) => add(u, `proy:${p.id}:${p.fase_id}`, linea));
  }
}
// Lo que ya se resolvió deja de contar
Object.keys(sd.cnt).forEach((k) => { if (!vivos.has(k)) { delete sd.cnt[k]; delete sd.reg[k]; } });

// 2) Recordatorio a cada persona, cada vez más firme
const out = [];
const escalarMgr = {}, escalarAdm = {}; // destinatario -> líneas
for (const { u, items } of Object.values(porUsuario)) {
  const veces = Math.max(...items.map((x) => sd.cnt[x.k] || 0));
  const text = `${encabezadoRecordatorio(u.nombre.trim(), veces)}\n\n${listaCorta(items.map((x) => x.line))}\n\n${veces >= 2 ? 'Si ya lo hiciste en la app, avísame por aquí para actualizarlo. ' : ''}Respóndeme por aquí con texto o fotos (escribe el nombre del cliente en cada mensaje).`;
  let enviado = false;
  if (SEND) enviado = await sendSafe(norm(u.telefono), text);
  if (enviado) items.forEach((x) => { sd.cnt[x.k] = (sd.cnt[x.k] || 0) + 1; sd.reg[x.k] = new Date().toISOString(); });
  out.push({ json: { para: u.nombre.trim(), telefono: norm(u.telefono), avisos: veces + 1, enviado, simulacion: !SEND, mensaje: text } });

  // Escalamiento (los managers y admins solo reciben clientes que pueden ver)
  const atrasados = items.filter((x) => (sd.cnt[x.k] || 0) + (SEND ? 0 : 1) >= 3);
  if (!atrasados.length) continue;
  const quien = `${u.nombre.trim()} ${(u.apellido || '').trim()}`.trim();
  ctx.users.filter((m) => !m.is_suspended && m.id !== u.id && alcanceDe(m).manager && alcanceDe(m).equipo.includes(String(u.id)))
    .forEach((m) => { (escalarMgr[m.id] = escalarMgr[m.id] || { m, lines: [] }).lines.push(`• *${quien}* (${atrasados.length}): ${atrasados.map((x) => x.line.replace(/^\S+\s*/, '').split(':')[0]).join(', ')}`); });
  const muyAtrasados = items.filter((x) => (sd.cnt[x.k] || 0) + (SEND ? 0 : 1) >= 6);
  if (muyAtrasados.length) ctx.users.filter((a) => !a.is_suspended && a.id !== u.id && alcanceDe(a).admin)
    .forEach((a) => { (escalarAdm[a.id] = escalarAdm[a.id] || { a, lines: [] }).lines.push(`• ${quien}: ${muyAtrasados.length} pendiente(s) con 6+ avisos`); });
}

for (const { m, lines } of Object.values(escalarMgr)) {
  const k = `esc_mgr|${m.id}`;
  if (reciente(k, DIA)) continue;
  const text = `Hola ${m.nombre.trim()} 👋, te aviso como Manager de Venta: estas personas de tu equipo llevan 3 o más recordatorios sin pasarme los datos:\n\n${listaCorta(lines, 10)}\n\n¿Me ayudas a que me los manden hoy? 🙏`;
  const enviado = SEND && (await sendSafe(norm(m.telefono), text));
  if (enviado) sd.reg[k] = new Date().toISOString();
  out.push({ json: { para: m.nombre.trim(), escalamiento: 'manager', enviado, simulacion: !SEND, mensaje: text } });
}
for (const { a, lines } of Object.values(escalarAdm)) {
  const k = `esc_adm|${a.id}`;
  if (reciente(k, DIA)) continue;
  const text = `Hola ${a.nombre.trim()} 👋, resumen de pendientes atrasados en Renew Water:\n\n${listaCorta(lines, 15)}\n\nEl detalle está en la app.`;
  const enviado = SEND && (await sendSafe(norm(a.telefono), text));
  if (enviado) sd.reg[k] = new Date().toISOString();
  out.push({ json: { para: a.nombre.trim(), escalamiento: 'admin', enviado, simulacion: !SEND, mensaje: text } });
}
return out.length ? out : [{ json: { resultado: 'Nada pendiente (o ya se recordó en las últimas 4 h)' } }];

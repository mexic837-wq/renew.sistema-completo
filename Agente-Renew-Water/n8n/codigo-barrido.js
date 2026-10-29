// ===== Nodo "Barrido" (n8n Code) — skill 02, cada 12 h =====
// Con BARRIDO_SEND != 'true' solo SIMULA y devuelve los mensajes.
{ const i0 = $input.first().json; if (i0.body || i0.event) return []; } // viene del webhook, no del Schedule
const SEND = E.BARRIDO_SEND === 'true';
const H12 = 12 * 3600 * 1000;
const ctx = await cargarCtx();
const items = {}; // userId -> [{key, line}]
const add = (u, key, line) => {
  const k = `${u.id}|${key}`;
  if (sd.reg[k] && Date.now() - Date.parse(sd.reg[k]) < H12) return; // anti-spam 12h
  (items[u.id] = items[u.id] || []).push({ key: k, line, u });
};

// Paso 0: prospectos sin decisión
const pros = await sel('clientes_maestro', 'select=id,nombre,departamento,departamentos_activos,vendedor_asignado_id&macro_estado=eq.Prospecto');
for (const c of pros.filter((c) => /water/i.test(JSON.stringify([c.departamento, c.departamentos_activos])))) {
  const u = ctx.users.find((x) => x.id === c.vendedor_asignado_id && !x.is_suspended);
  if (u) add(u, 'prospecto:' + c.id, `🆕 ${c.nombre}: ¿la Aplicación de Crédito fue *aceptada* o *rechazada*? (si fue rechazada, dime el motivo)`);
}

// Proyectos activos: preguntar lo propio de la fase en la que está cada uno
const ps = (await sel('proyectos_dinamicos', 'select=id,cliente_id,fase_id,responsable_id,tecnico_id,fecha_cierre&pipeline_id=eq.pip_water&fase_id=not.is.null')).filter((p) => sigueAbierto(p, ctx));
if (ps.length) {
  await nombresClientes(ctx, ps.map((p) => p.cliente_id));
  const resp = await sel('respuestas_dinamicas', `select=proyecto_id,campo_id,valor&proyecto_id=${inList(ps.map((p) => p.id))}`);
  for (const p of ps) {
    const fase = ctx.F[p.fase_id]; if (!fase || p.fase_id === FASE_1) continue; // Estación 1: solo la decisión de crédito
    const cli = ctx.N[p.cliente_id] || p.cliente_id;
    const dest = encargadosAutorizados(fase, p, ctx); // solo a quien le corresponde ese cliente
    let linea = null;
    if (p.fase_id === FASE_OT) {
      const r = resp.find((x) => x.proyecto_id === p.id && x.campo_id === CAMPO_OT);
      if (faltaValor(r) || !/Completado/i.test(r.valor)) linea = sd.drafts[p.id] && sd.drafts[p.id]._firmaUrl
        ? `✍️ ${cli} (${fase.nombre}): la Orden de Trabajo espera la firma del cliente. Escríbeme *reenviar enlace ${cli}* si hace falta.`
        : `📋 ${cli} (${fase.nombre}): falta la Orden de Trabajo. Escríbeme *orden ${cli}* y te pido solo lo que falte.`;
    } else if (p.fase_id === FASE_TEC && !p.tecnico_id) {
      linea = `🛠 ${cli} (${fase.nombre}): ¿ya tienes el técnico? Respóndeme con el número y la fecha y hora:\n${listaTecnicos(ctx)}`;
    } else if (p.fase_id === FASE_CERT && sd.cert[p.id] && sd.cert[p.id]._firmaUrl) {
      linea = `✍️ ${cli} (${fase.nombre}): la Confirmación de Instalación espera la firma del cliente.`;
    } else {
      const pend = camposFase(p.fase_id, ctx.campos).filter((c) => faltaValor(resp.find((x) => x.proyecto_id === p.id && x.campo_id === c.id)));
      if (pend.length) linea = `📎 ${cli} (${fase.nombre}): ${pend.map((c) => preguntaCampo(c, ctx)).join('; ')}`;
    }
    if (linea) dest.forEach((u) => add(u, 'proy:' + p.id, linea));
  }
}

const out = [];
for (const list of Object.values(items)) {
  const u = list[0].u;
  const text = `Hola ${u.nombre.trim()} 👋, soy el asistente de Renew Water. Esto está pendiente:\n\n${list.map((x) => x.line).join('\n')}\n\nResponde por aquí con texto o fotos (escribe el nombre del cliente en cada mensaje).`;
  let enviado = false;
  if (SEND) { enviado = await sendSafe(norm(u.telefono), text); if (enviado) list.forEach((x) => (sd.reg[x.key] = new Date().toISOString())); }
  out.push({ json: { para: u.nombre.trim(), telefono: norm(u.telefono), enviado, simulacion: !SEND, mensaje: text } });
}
return out.length ? out : [{ json: { resultado: 'Nada pendiente (o ya notificado en las últimas 12 h)' } }];

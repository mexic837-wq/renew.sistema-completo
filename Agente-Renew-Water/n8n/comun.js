// ===== Código común (se antepone a "Agente" y "Barrido" al generar el workflow) =====
const E = $('Config').first().json; // credenciales: nodo 'Config'
const SB = E.SUPABASE_URL;
const SBH = { apikey: E.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + E.SUPABASE_SERVICE_ROLE_KEY };
const EVO = E.EVOLUTION_API_URL, INST = E.EVOLUTION_INSTANCE, EVH = { apikey: E.EVOLUTION_API_KEY };
const APP_URL = E.APP_URL || 'https://renewgroup.site';
const AUTO_ADVANCE = E.AUTO_ADVANCE === 'true';
const FASE_1 = 'fase_33_z8j9', FASE_OT = 'fase_35_nol4', CAMPO_OT = 'campo_19_0fpc';
const GATES = { campo_12_iq3s: 'si', campo_campo_241_8jov: 'si', campo_16_zhmp: 'si' }; // desplegables que deben ser "Si" para avanzar
const sd = $getWorkflowStaticData('global');
sd.seen = sd.seen || []; sd.drafts = sd.drafts || {}; sd.reg = sd.reg || {}; sd.active = sd.active || {}; sd.pendingText = sd.pendingText || {};

const http = async (o) => {
  try { return await this.helpers.httpRequest(o); }
  catch (e) { throw new Error(`HTTP ${e.httpCode || e.statusCode || ""} en ${o.method} ${String(o.url).split("?")[0]}: ${e.message}`); }
};
const digits = (t) => String(t || '').replace(/\D/g, '');
const norm = (t) => { let d = digits(t); if (d.startsWith('580')) d = '58' + d.slice(3); return d; }; // +58 0416.. -> 58416..
const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const sel = (table, q) => http({ method: 'GET', url: `${SB}/rest/v1/${table}?${q}`, headers: SBH, json: true });
const patch = (table, filter, body) => http({ method: 'PATCH', url: `${SB}/rest/v1/${table}?${filter}`, headers: { ...SBH, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body, json: true });
const insert = (table, body) => http({ method: 'POST', url: `${SB}/rest/v1/${table}`, headers: { ...SBH, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body, json: true });
const inList = (ids) => `in.(${[...new Set(ids)].join(',')})`;
const sendText = (number, text) => http({ method: 'POST', url: `${EVO}/message/sendText/${INST}`, headers: { ...EVH, 'Content-Type': 'application/json' }, body: { number, text }, json: true });
const sendSafe = async (number, text) => { try { await sendText(number, text); return true; } catch (e) { console.log('sendText falló', e.message); return false; } };

async function llm(system, user) {
  const r = await http({
    method: 'POST', url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: { Authorization: 'Bearer ' + E.OPENROUTER_API_KEY, 'Content-Type': 'application/json' },
    body: {
      model: E.OPENROUTER_MODEL || 'anthropic/claude-haiku-5.5',
      max_tokens: 2048,
      temperature: 0,
      messages: [
        { role: 'system', content: system + ' Responde UNICAMENTE con un objeto JSON válido, sin markdown ni explicaciones.' },
        { role: 'user', content: user },
      ],
    },
    json: true,
  });
  const raw = String((((r || {}).choices || [])[0] || {}).message?.content || '').replace(/```json|```/gi, '').trim();
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
  if (a < 0 || b <= a) return {};
  try { return JSON.parse(raw.slice(a, b + 1)); }
  catch (e) { console.log('JSON malformado de LLM:', raw); return {}; }
}

// ---------- Libreto de fases ----------
const rolesDe = (r) => { try { const j = JSON.parse(r); return Array.isArray(j) ? j : [String(r)]; } catch (e) { return [String(r || '')]; } };
const limpiaOpc = (s) => String(s || '').split('|META|')[0];
const opcionesDe = (c) => limpiaOpc(c.opciones).split(',').map((x) => x.trim()).filter(Boolean);
const ESPECIALES = ['Aplicación de Crédito', 'Orden de Trabajo'];
const faltaValor = (r) => !r || !r.valor || ['EMPTY', ''].includes(String(r.valor).trim());

// Campos "reales" de una fase: sin especiales, sin Test, sin duplicados por etiqueta. Estación 1 y 2 tienen su propio flujo.
function camposFase(faseId, campos) {
  if (faseId === FASE_1 || faseId === FASE_OT) return [];
  const vistos = new Set();
  return campos.filter((c) => c.fase_id === faseId && !ESPECIALES.includes(c.tipo) && !/test_probe/.test(c.id) && !vistos.has(c.etiqueta) && vistos.add(c.etiqueta));
}

function encargadosDe(fase, proy, users) {
  const activos = users.filter((u) => !u.is_suspended);
  const ids = new Set();
  const rol = fase.rol_encargado;
  if (rol === 'Encargado del Proyecto') { if (proy.responsable_id) ids.add(proy.responsable_id); (fase.usuarios_especificos || []).forEach((i) => ids.add(i)); }
  else if (rol === 'Asignación Específica') { (fase.usuarios_especificos || []).forEach((i) => ids.add(i)); if (fase.id === 'fase_39_uivk' && proy.tecnico_id) ids.add(proy.tecnico_id); }
  else activos.filter((u) => rolesDe(u.rol).some((r) => sinAcentos(r) === sinAcentos(rol))).forEach((u) => ids.add(u.id));
  return activos.filter((u) => ids.has(u.id));
}

async function cargarCtx() {
  const [users, fases] = await Promise.all([
    sel('usuarios', 'select=id,nombre,apellido,telefono,rol,is_suspended'),
    sel('admin_fases', 'select=id,nombre,orden,rol_encargado,usuarios_especificos&pipeline_id=eq.pip_water&order=orden.asc'),
  ]);
  const campos = await sel('admin_campos_formulario', `select=id,fase_id,etiqueta,tipo,opciones&fase_id=${inList(fases.map((f) => f.id))}`);
  const F = Object.fromEntries(fases.map((f) => [f.id, f]));
  const tecnicos = users.filter((u) => !u.is_suspended && rolesDe(u.rol).some((r) => sinAcentos(r) === 'tecnico'));
  return { users, fases, F, campos, tecnicos, N: {} };
}
async function nombresClientes(ctx, ids) {
  const falta = [...new Set(ids)].filter((i) => !ctx.N[i]);
  if (!falta.length) return;
  const cls = await sel('clientes_maestro', `select=id,nombre&id=${inList(falta)}`);
  cls.forEach((c) => (ctx.N[c.id] = c.nombre));
}

function preguntaCampo(c, ctx) {
  if (c.tipo === 'Técnico') return `${c.etiqueta} (elige: ${ctx.tecnicos.map((t) => t.nombre.trim()).join(' / ')})`;
  if (c.tipo === 'Desplegable') return `${c.etiqueta} (${opcionesDe(c).join(' / ')})`;
  if (c.tipo === 'Fecha') return `${c.etiqueta} (fecha)`;
  if (c.tipo === 'Archivo') return `${c.etiqueta} (envía foto o PDF)`;
  return c.etiqueta;
}

const OT_PREGUNTAS = [
  'Para la *Orden de Trabajo* necesito, por bloques (puedes mandarlo todo junto o por partes):',
  '',
  '👤 *Comprador:* nombre completo, segundo comprador (si hay), teléfono, email, dirección, ciudad, estado y zip.',
  '💧 *Equipos:* suavizador / ósmosis / alcalina / pozo / otro.',
  '🛠 *Instalación:* fecha estimada, personas en casa, piso (concreto o elevado), conexión al refrigerador (sí/no), horario (9am-2pm o 2pm-6pm), dureza del agua e instrucciones especiales.',
  '💵 *Finanzas:* precio de contado, costo de instalación, cuota inicial, monto a financiar, términos de pago y APR. Si no hay financiamiento, escribe "sin financiamiento".',
  '📷 Si tienes la foto del ID del comprador, envíala con el nombre del cliente.',
  '',
  'La tarjeta y las firmas las dejo en 0 / en blanco.',
].join('\n');

function cuerpoFase(faseId, ctx) {
  if (faseId === FASE_OT) return OT_PREGUNTAS;
  const cs = camposFase(faseId, ctx.campos);
  return cs.length ? cs.map((c) => '• ' + preguntaCampo(c, ctx)).join('\n') : '';
}

async function notificarFase(proy, faseId, ctx, excluirUserId) {
  const fase = ctx.F[faseId]; if (!fase) return { notificados: [], incluyeActual: false };
  await nombresClientes(ctx, [proy.cliente_id]);
  const cli = ctx.N[proy.cliente_id] || proy.cliente_id;
  const cuerpo = cuerpoFase(faseId, ctx);
  const encs = encargadosDe(fase, proy, ctx.users);
  const incluyeActual = encs.some((u) => u.id === excluirUserId);
  const otros = encs.filter((u) => u.id !== excluirUserId);
  for (const u of otros) {
    await sendSafe(norm(u.telefono), `Hola ${u.nombre.trim()} 👋, acabo de avanzar a *${cli}* a la fase *${fase.nombre}*.\n\nPor favor pásame estos datos cuando los tengas para proseguir:\n${cuerpo}\n\nQuedo pendiente por aquí para registrarlo y seguir avanzando.`);
  }
  return { notificados: otros.map((u) => u.nombre.trim()), incluyeActual, cuerpo };
}

async function avanzar(proy, ctx, quien, excluirUserId) {
  const fase = ctx.F[proy.fase_id];
  const sig = ctx.fases.filter((f) => f.orden > fase.orden).sort((a, b) => a.orden - b.orden)[0];
  if (!sig) return null;
  const [p] = await sel('proyectos_dinamicos', `select=actividad&id=eq.${proy.id}`);
  const act = [...((p && p.actividad) || []), { tipo: 'CAMBIO_FASE', label: `Avance automático: ${fase.nombre} → ${sig.nombre}`, de: fase.id, a: sig.id, timestamp: new Date().toISOString(), responsable_id: quien || 'agente-renew-water' }];
  await patch('proyectos_dinamicos', `id=eq.${proy.id}`, { fase_id: sig.id, actividad: act, ultima_actividad: `Avanzado a ${sig.nombre} por Agente` });
  const notif = await notificarFase({ ...proy, fase_id: sig.id }, sig.id, ctx, excluirUserId);
  return { ...sig, notif };
}

async function guardarRespuesta(pid, campoId, valor) {
  const ex = await sel('respuestas_dinamicas', `select=id&proyecto_id=eq.${pid}&campo_id=eq.${campoId}`);
  if (ex.length) await patch('respuestas_dinamicas', `id=eq.${ex[0].id}`, { valor });
  else await insert('respuestas_dinamicas', { id: `resp_resp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, proyecto_id: pid, campo_id: campoId, valor });
}

function textoAvance(sig, cli) {
  if (!sig) return '';
  const { notif } = sig;
  let t = `\n\n🚀 Avancé a *${cli}* a la fase *${sig.nombre}*.`;
  if (notif && notif.incluyeActual && notif.cuerpo) {
    t += `\n\nPor favor pásame estos datos cuando los tengas para proseguir:\n${notif.cuerpo}`;
  } else if (notif && notif.notificados && notif.notificados.length) {
    t += ` Ya le escribí a *${notif.notificados.join(', ')}* pidiéndole los datos de esta fase para proseguir.`;
  }
  return t;
}

// Revisa si la fase actual del proyecto quedó completa y, si procede, avanza.
async function revisarFase(proy, ctx, quien) {
  const resp = await sel('respuestas_dinamicas', `select=id,campo_id,valor&proyecto_id=eq.${proy.id}`);
  const cs = camposFase(proy.fase_id, ctx.campos);
  const pend = cs.filter((c) => faltaValor(resp.find((r) => r.campo_id === c.id)));
  if (pend.length) return { estado: 'faltan', pend };
  const bloqueo = cs.find((c) => GATES[c.id] && sinAcentos((resp.find((r) => r.campo_id === c.id) || {}).valor) !== GATES[c.id]);
  if (bloqueo) return { estado: 'bloqueada', campo: bloqueo };
  if (!AUTO_ADVANCE) return { estado: 'completa_sin_avance' };
  const sig = await avanzar(proy, ctx, quien, quien);
  return sig ? { estado: 'avanzo', sig } : { estado: 'ultima' };
}

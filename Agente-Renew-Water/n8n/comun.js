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
sd.inst = sd.inst || {}; sd.cert = sd.cert || {}; // borradores de instalación (E3) y confirmación (E4)

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
    sel('usuarios', 'select=id,nombre,apellido,telefono,rol,is_suspended,sede,unidades'),
    sel('admin_fases', 'select=id,nombre,orden,rol_encargado,usuarios_especificos&pipeline_id=eq.pip_water&order=orden.asc'),
  ]);
  const campos = await sel('admin_campos_formulario', `select=id,fase_id,etiqueta,tipo,opciones&fase_id=${inList(fases.map((f) => f.id))}`);
  const F = Object.fromEntries(fases.map((f) => [f.id, f]));
  // Técnicos activos de Water (si el usuario no tiene unidades cargadas, se incluye), en orden alfabético estable
  const tecnicos = users
    .filter((u) => !u.is_suspended && rolesDe(u.rol).some((r) => sinAcentos(r) === 'tecnico'))
    .filter((u) => !Array.isArray(u.unidades) || !u.unidades.length || u.unidades.some((x) => /water/i.test(x)))
    .sort((a, b) => `${a.nombre} ${a.apellido || ''}`.localeCompare(`${b.nombre} ${b.apellido || ''}`));
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

const TEC_PREGUNTA = (ctx) => `¿Ya tienes el técnico asignado? Respóndeme con el *número* del técnico y la *fecha y hora* de instalación (ej. "2, 15 de noviembre 10am"):

${listaTecnicos(ctx)}`;
const CERT_PREGUNTAS = [
  'Para la *Confirmación de Instalación* necesito:',
  '💧 *Equipos instalados* y su número de serie: sistema para toda la casa / ósmosis inversa / pozo.',
  '💵 *Costos adicionales* si hubo (instalación, millas, trabajo extra, otro). Si no hubo, escribe "sin costos".',
  '📦 *Inventario:* ¿de qué *sede* retiraste el material y qué usaste (con cantidades)?',
  '',
  'Con eso armo el documento y se lo mando al cliente para que lo firme.',
].join('\n');

function cuerpoFase(faseId, ctx) {
  if (faseId === FASE_OT) return '¿Quieres que genere la *Orden de Trabajo*? Responde *SI* y te pido solo los datos que no estén en el sistema.';
  if (faseId === FASE_TEC) return TEC_PREGUNTA(ctx);
  if (faseId === FASE_CERT) return CERT_PREGUNTAS;
  const cs = camposFase(faseId, ctx.campos);
  return cs.length ? cs.map((c) => '• ' + preguntaCampo(c, ctx)).join('\n') : '';
}

async function notificarFase(proy, faseId, ctx, excluirUserId) {
  const fase = ctx.F[faseId]; if (!fase) return { notificados: [], incluyeActual: false };
  await nombresClientes(ctx, [proy.cliente_id]);
  const cli = ctx.N[proy.cliente_id] || proy.cliente_id;
  const cuerpo = cuerpoFase(faseId, ctx);
  const encs = encargadosDe(fase, proy, ctx.users);
  const excl = [].concat(excluirUserId || []);
  const incluyeActual = encs.some((u) => excl.includes(u.id));
  const otros = encs.filter((u) => !excl.includes(u.id));
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

// ---------- Fases con flujo propio ----------
const FASE_TEC = 'fase_fase_4111_4ltv', FASE_CERT = 'fase_39_uivk';
const esSi = (t) => /^\s*(s[ií]|si+|ok|okay|confirmo|confirmado|correcto|dale|listo|perfecto|claro|de una|adelante|genera\w*|hazl[ao])\W*$/i.test(String(t || ''));
const esNo = (t) => /^\s*(no|todav[ií]a no|a[uú]n no|despu[eé]s|luego|m[aá]s tarde)\b/i.test(String(t || ''));

// Teléfono para WhatsApp: los de 10 dígitos son de EE. UU. (+1)
const waNum = (t) => { const d = norm(t); return d.length === 10 ? '1' + d : d; };

// ---------- Ficha del cliente (lo que ya existe en el sistema, para NO pedírselo al vendedor) ----------
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','PR','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const STATE_NAMES = { florida: 'FL', texas: 'TX', 'new york': 'NY', 'north carolina': 'NC', georgia: 'GA', california: 'CA', 'south carolina': 'SC', 'new jersey': 'NJ' };
const SUFIJOS_CALLE = new Set(['st','street','ave','av','avenue','rd','road','dr','drive','blvd','ln','lane','ct','court','cir','circle','way','pl','place','pkwy','hwy','ter','terrace','trl','trail','loop','run','path','cv','pt','sq','xing','row','walk','bnd','pass','pike','plz','cres','grv','hl','hts','rdg','trce']);
const UNIDAD = new Set(['apt','apartment','unit','ste','suite','lot','bldg','floor','rm','spc','trlr']);
const TITULO = (s) => String(s || '').toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).trim();

// "2111 Pennington dr Arlington tx 76014" -> { ciudad: 'Arlington', estado: 'TX', zip: '76014' }
function partesDireccion(addr) {
  let a = String(addr || '').replace(/\s+/g, ' ').replace(/\s*,?\s*(usa|u\.s\.a\.?|united states|ee\.?\s?uu\.?|estados unidos)\s*$/i, '').trim();
  const out = { ciudad: '', estado: '', zip: '' };
  if (!a) return out;
  let w = a.replace(/,/g, ' , ').split(' ').filter(Boolean);
  const pop = () => { while (w.length && w[w.length - 1] === ',') w.pop(); };
  pop();
  if (w.length && /^\d{5}(-\d{4})?$/.test(w[w.length - 1])) out.zip = w.pop().slice(0, 5);
  pop();
  const last = (w[w.length - 1] || '').replace(/\.$/, '').toUpperCase();
  if (US_STATES.includes(last)) { out.estado = last; w.pop(); }
  else {
    for (const [name, code] of Object.entries(STATE_NAMES)) {
      const n = name.split(' ').length;
      if (w.length > n && w.slice(-n).join(' ').toLowerCase() === name) { out.estado = code; w.splice(-n, n); break; }
    }
  }
  pop();
  const coma = w.lastIndexOf(',');
  if (coma >= 0) { const tail = w.slice(coma + 1); if (tail.length && !tail.some((x) => /\d/.test(x))) { out.ciudad = TITULO(tail.join(' ')); return out; } w = tail.length ? tail : w.slice(0, coma); }
  const lw = w.map((x) => x.toLowerCase().replace(/\.$/, ''));
  let ini = -1;
  for (let i = 0; i < lw.length; i++) {
    if (SUFIJOS_CALLE.has(lw[i]) && i > 0 && !(lw[i] === 'st' && /^(lucie|cloud|petersburg|augustine|johns|louis)$/.test(lw[i + 1] || ''))) ini = i + 1;
    else if (UNIDAD.has(lw[i]) || lw[i].startsWith('#')) { ini = i + 1; if (ini < lw.length && /\d/.test(lw[ini])) ini++; }
  }
  if (ini >= 0) { const c = w.slice(ini).filter((x) => !/\d/.test(x)); if (c.length && c.length <= 4) out.ciudad = TITULO(c.join(' ')); }
  return out;
}

async function fichaCliente(clienteId) {
  const [c] = await sel('clientes_maestro', `select=*&id=eq.${clienteId}`);
  if (!c) return {};
  const p = partesDireccion(c.direccion);
  const estado = [c.state_id, c.estado_geo, p.estado].find((x) => x && x !== '-' && String(x).length <= 3);
  return {
    id: c.id, nombre: c.nombre, telefono: c.telefono, email: c.email, direccion: c.direccion,
    ciudad: c.ciudad || p.ciudad || undefined, estado: estado ? String(estado).toUpperCase() : undefined,
    zipCode: c.zip || c.zip_code || p.zip || undefined,
    fotoIdUrl: c.adjunto_id_url || c.id_photo || undefined,
    coAplicanteIdUrl: (c.adjuntos_oficina && c.adjuntos_oficina.co_applicant_id_url) || undefined,
  };
}

// ---------- Firma virtual del cliente (página /firmar.html del sistema) ----------
async function crearFirma(tipo, proy, cliNombre, datos, creadoPor) {
  const r = await http({
    method: 'POST', url: `${APP_URL}/api/firmas/solicitud`,
    headers: { 'Content-Type': 'application/json', 'x-agente-token': E.WEBHOOK_TOKEN },
    body: { tipo, proyecto_id: proy.id, cliente_id: proy.cliente_id, cliente_nombre: cliNombre, datos, creado_por: creadoPor },
    json: true, timeout: 120000,
  });
  if (!r || !r.url) throw new Error('El sistema no devolvió el enlace de firma');
  return r;
}

// Manda el enlace al cliente y devuelve si se pudo
async function enviarFirmaCliente(telCliente, cliNombre, documento, url, quien) {
  if (!telCliente) return false;
  const nombre = String(cliNombre || '').split(' ')[0];
  return sendSafe(waNum(telCliente), `Hola ${nombre} 👋, te escribe el asistente de *Renew Water*.\n\n${quien} preparó tu *${documento}*. Revísala y fírmala desde tu teléfono aquí:\n${url}\n\nEl enlace es personal y vence en 7 días.`);
}

// ---------- Técnicos (lista numerada estable) ----------
const listaTecnicos = (ctx) => ctx.tecnicos.map((t, i) => `${i + 1}. ${`${t.nombre} ${t.apellido || ''}`.trim()}${t.sede ? ` (${String(t.sede).replace(/_/g, ' ')})` : ''}`).join('\n');

// ---------- Inventario ----------
const SEDES_INV = { orlando: 'Orlando', miami: 'Miami', dallas: 'Dallas', houston: 'Houston', austin: 'Austin', north_carolina: 'North Carolina', new_york: 'Nueva York', tampa: 'Tampa' };
const esItemWater = (i) => sinAcentos(i.category) === 'water' || /water|agua/i.test(i.ecosistema || '') || /economica|clasica|pozo/i.test(sinAcentos(i.ecosistema));

async function inventarioWater(sede) {
  const q = 'select=id,nombre_item,ecosistema,category,locacion,stock_actual' + (sede ? `&locacion=eq.${sede}` : '');
  return (await sel('inventario_global', q)).filter(esItemWater);
}

// Descuenta del stock y deja el movimiento en historial_inventario (ligado al proyecto)
async function descontarInventario(items, proy, cliNombre, tecnico, sede) {
  const hechos = [];
  let n = 0;
  for (const it of items) {
    const [row] = await sel('inventario_global', `select=id,nombre_item,stock_actual&id=eq.${encodeURIComponent(it.id)}`);
    if (!row) continue;
    const antes = Number(row.stock_actual) || 0;
    const despues = Math.max(0, antes - it.cantidad);
    await patch('inventario_global', `id=eq.${encodeURIComponent(it.id)}`, { stock_actual: despues });
    // historial_inventario usa "fecha" como clave: se separa cada movimiento por milisegundos
    await insert('historial_inventario', {
      fecha: new Date(Date.now() + n++).toISOString(),
      tecnico_nombre: `${tecnico.nombre} ${tecnico.apellido || ''}`.trim(), item_nombre: row.nombre_item, item_id: row.id,
      cantidad_retirada: it.cantidad, sede, ecosistema: 'water', proyecto_id: proy.id, cliente_nombre: cliNombre,
      tipo_movimiento: 'Salida (Proyecto)',
    });
    hechos.push({ nombre: row.nombre_item, cantidad: it.cantidad, antes, despues, sinStock: antes < it.cantidad });
  }
  return hechos;
}

// Proyectos que el agente sigue persiguiendo: con fase y, si ya tienen fecha de cierre,
// solo los Water que pasaron Certificado de Instalación (venta hecha, pipeline aún abierto)
function sigueAbierto(p, ctx) {
  if (!p.fase_id || !ctx.F[p.fase_id]) return false;
  if (!p.fecha_cierre) return true;
  const cert = ctx.F[FASE_CERT];
  return !!cert && ctx.F[p.fase_id].orden > cert.orden;
}

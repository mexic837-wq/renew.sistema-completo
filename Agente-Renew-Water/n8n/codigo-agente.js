// ===== Nodo "Agente" (n8n Code) — webhook de Evolution =====
// Flujo: usuario -> decisión de crédito -> (según la fase del proyecto) Orden de Trabajo completa / campos de fase / archivos.

// ---------- Entrada ----------
const item = $input.first().json;
if (!item.body && !item.event) return []; // viene del Schedule, no del webhook
const ev = item.body || item;
if (E.WEBHOOK_TOKEN && (item.headers || {})['x-agente-token'] !== E.WEBHOOK_TOKEN) return [{ json: { ignorado: 'token inválido' } }];
if (ev.event === 'firma.completada') return [{ json: await procesarFirma(ev) }];
const m = ev.data;
if (!/messages.upsert/i.test(ev.event || '') || !m || !m.key || m.key.fromMe) return [{ json: { ignorado: 'no es mensaje entrante' } }];
const jid = m.key.remoteJid || '';
if (!jid.endsWith('@s.whatsapp.net')) return [{ json: { ignorado: 'grupo o formato no soportado' } }];
if (sd.seen.includes(m.key.id)) return [{ json: { ignorado: 'duplicado' } }];
const from = digits(jid);
const msg = m.message || {};
const mediaNode = msg.imageMessage || msg.documentMessage || msg.documentWithCaptionMessage?.message?.documentMessage;
const text0 = (msg.conversation || msg.extendedTextMessage?.text || '').trim();
let text = text0;
if (!mediaNode && !text) return [{ json: { ignorado: 'tipo de mensaje no soportado' } }];

const ctx = await cargarCtx();
// Coincidencia por los últimos 10 dígitos (tolera +1, paréntesis, guiones y el 0 troncal)
const ult10 = (t) => digits(t).slice(-10);
const user = ctx.users.find((u) => !u.is_suspended && ult10(u.telefono).length >= 10 && ult10(u.telefono) === ult10(from));
if (!user) {
  // No es del equipo: si es un cliente solo ve su propio estado; si no, no se le responde nada
  sd.seen.push(m.key.id); if (sd.seen.length > 500) sd.seen = sd.seen.slice(-250);
  return [{ json: await atenderCliente(ctx, from, text, !!mediaNode) }];
}
const nombreUser = user.nombre.trim();
const say = (t) => sendText(from, t);

// ---------- Paso 0: aceptada / rechazada ----------
const esWater = (c) => /water/i.test(JSON.stringify([c.departamento, c.departamentos_activos]));
async function crearProyectoWater(cli) {
  const id = `proy_proy_11_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const actividad = [{ tipo: 'DECISION_CREDITO', label: 'Aplicación de Crédito ACEPTADA (confirmado por WhatsApp)', timestamp: now, responsable_id: user.id }];
  const app = cli.adjuntos_oficina && cli.adjuntos_oficina.app_url;
  if (app) actividad.push({ tipo: 'FORMULARIO_COMPLETADO', campo: 'Aplicación de Crédito', label: 'Aplicación de Crédito', archivo: app, timestamp: now, responsable_id: user.id });
  // El crédito aprobado es la aprobación: el proyecto pasa directo a Orden de Trabajo
  actividad.push({ tipo: 'CAMBIO_FASE', label: 'Avance automático: Aprobación → Orden de Trabajo (crédito aprobado)', de: FASE_1, a: FASE_OT, timestamp: now, responsable_id: 'agente-renew-water' });
  const fase = FASE_OT;
  await insert('proyectos_dinamicos', { id, cliente_id: cli.id, pipeline_id: 'pip_water', fase_id: fase, responsable_id: user.id, fecha: now.split('T')[0], colaboradores: [], discusion: [], actividad, ultima_actividad: 'Proyecto creado por Agente tras aceptación de crédito' });
  await patch('clientes_maestro', `id=eq.${cli.id}`, { estado: 'En Proceso', macro_estado: 'En Proceso', vendedor_asignado_id: user.id });
  return { id, fase };
}

async function handleDecisions() {
  const key = 'decl_' + user.id;
  if (sd.drafts[key]) {
    const cid = sd.drafts[key].cliente_id; delete sd.drafts[key];
    await patch('clientes_maestro', `id=eq.${cid}`, { macro_estado: 'Declinado', motivo_declinado: text.slice(0, 500) });
    await say(`Anotado, ${nombreUser}. Dejé al prospecto como Declinado (motivo: "${text.slice(0, 120)}").`);
    return 'rechazo_con_motivo';
  }
  const pend = (await sel('clientes_maestro', `select=id,nombre,departamento,departamentos_activos,adjuntos_oficina&macro_estado=eq.Prospecto&vendedor_asignado_id=eq.${user.id}`)).filter(esWater).filter(esDePrueba);
  if (!pend.length) return null;
  const ext = await llm(
    'Un vendedor responde por WhatsApp sobre prospectos cuya Aplicación de Crédito ya se envió. Detecta si informa que una aplicación fue ACEPTADA (aprobada) o RECHAZADA (negada). Responde SOLO JSON: {"decisiones":[{"cliente_id": string, "decision": "aceptada"|"rechazada", "motivo": string|null}]}. Lista vacía si el mensaje no habla de aprobación/rechazo. Si solo hay un prospecto y dice "aceptada/aprobada/sí" o "rechazada/negada/no", aplica a ese. NUNCA adivines.',
    `Prospectos:\n${pend.map((c) => `${c.id} = ${c.nombre}`).join('\n')}\n\nMensaje:\n${text}`);
  const decs = (ext.decisiones || []).filter((d) => pend.find((c) => c.id === d.cliente_id));
  if (!decs.length) return null;
  const out = [];
  for (const d of decs) {
    const cli = pend.find((c) => c.id === d.cliente_id);
    if (d.decision === 'aceptada') {
      const r = await crearProyectoWater(cli);
      if (r.fase === FASE_OT) {
        sd.active[user.id] = r.id;
        const dOT = sd.drafts[r.id] = { ...prefillOT(await fichaCliente(cli.id)), _preguntaGenerar: true, _owner: user.id };
        out.push(`✅ *${cli.nombre}*: crédito aceptado. Creé el proyecto y lo pasé a *Orden de Trabajo*.\n\n¿Quieres que genere la Orden de Trabajo? Del sistema ya tengo: ${tengoOT(dOT)}.\nResponde *SI* y te pido solo lo que falta.`);
      } else {
        out.push(`✅ *${cli.nombre}*: crédito aceptado. Creé el proyecto en *Aprobación*.`);
      }
    } else if (d.motivo) {
      await patch('clientes_maestro', `id=eq.${cli.id}`, { macro_estado: 'Declinado', motivo_declinado: d.motivo });
      out.push(`❌ ${cli.nombre}: marcado como Declinado (${d.motivo}).`);
    } else {
      sd.drafts[key] = { cliente_id: cli.id };
      out.push(`❌ ${cli.nombre}: entendido que fue rechazado. ¿Cuál fue el motivo?`);
      break;
    }
  }
  if (out.length) await say(out.join('\n'));
  return 'decision';
}

// ---------- Proyectos del usuario (según la fase en la que está cada uno) ----------
async function misProyectos() {
  const all = await sel('proyectos_dinamicos', 'select=id,cliente_id,fase_id,responsable_id,tecnico_id,fecha_cierre&pipeline_id=eq.pip_water&fase_id=not.is.null');
  const cand = all.filter((p) => sigueAbierto(p, ctx) && encargadosDe(ctx.F[p.fase_id], p, ctx.users).some((u) => u.id === user.id));
  await nombresClientes(ctx, cand.map((p) => p.cliente_id));
  // SEGURIDAD: un representante nunca ve proyectos de otros aunque comparta rol en la fase
  const mine = cand.filter((p) => proyDePrueba(p, ctx) && puedeTrabajar(user, p, ctx.CL[p.cliente_id], ctx.F[p.fase_id], ctx.users));
  if (mine.length < cand.length) await auditar({ tel: from, uid: user.id, nivel: nivelTexto(user), accion: 'proyectos_filtrados', detalle: `${cand.length - mine.length} proyectos fuera de su alcance` });
  return mine;
}

// ---------- Orden de Trabajo (Estación 2) ----------
const money = (v) => { const n = parseFloat(String(v === undefined || v === null ? '' : v).replace(/[^0-9.\-]/g, '')); return '$' + (isNaN(n) ? 0 : n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
const numv = (v) => { const n = parseFloat(String(v === undefined || v === null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };

// ---------- Orden de Trabajo: campos del PDF oficial (orden_trabajo_oficial.pdf → molde_orden_v4.pdf) ----------
const tieneEquipo = (d) => d.suavizador || d.osmosis || d.alcalina || d.aguaCiudad || d.pozo || d.otroEquipo;
const FORMAS_PAGO = { Cash: 'Efectivo', Financed: 'Financiado', 'Credit Card': 'Tarjeta de crédito' };
const OT_REQ = [
  ['Comprador', 'nombre', 'nombre completo del comprador'], ['Comprador', 'telefono', 'teléfono'], ['Comprador', 'email', 'email (o "no tiene")'],
  ['Comprador', 'direccion', 'dirección de instalación'], ['Comprador', 'ciudad', 'ciudad'], ['Comprador', 'estado', 'estado'], ['Comprador', 'zipCode', 'zip code'],
  ['Equipos', '_equipo', 'equipos (suavizador para toda la casa / ósmosis para la cocina / agua alcalina / agua de ciudad / agua de pozo / otro)'],
  ['Instalación', 'fechaEstimada', 'fecha estimada de instalación'], ['Instalación', 'horario', 'hora (9:00am-2:00pm o 2:00pm-6:00pm)'],
  ['Forma de pago', '_pago', 'forma de pago (efectivo / financiado / tarjeta de crédito / otro)'], ['Forma de pago', '_inicial', 'pago inicial (monto, o "no")'],
];
function faltantesOT(d) {
  return OT_REQ.filter(([, k]) => {
    if (k === '_equipo') return !tieneEquipo(d);
    if (k === '_pago') return !((d.formaPago || []).length || d.otroMetodoTexto);
    if (k === '_inicial') return d.cuotaInicialMarcada === undefined;
    return d[k] === undefined || d[k] === null || String(d[k]).trim() === '';
  });
}
function preguntasOT(falt) {
  const g = {};
  falt.forEach(([b, , txt]) => (g[b] = g[b] || []).push(txt));
  return Object.entries(g).map(([b, l]) => `*${b}:* ${l.join(', ')}`).join('\n');
}
function resumenOT(d, cli) {
  const eq = [d.terminosPrevios && 'Términos de instalación previos', d.suavizador && 'Suavizador para toda la casa', d.osmosis && 'Ósmosis inversa (cocina)', d.alcalina && 'Agua alcalina',
    d.aguaCiudad && `Agua de ciudad${d.tipoLinea ? ` (línea ${d.tipoLinea})` : ''}`, d.productoEspecifico && `Producto: ${d.productoEspecifico}`, d.pozo && 'Agua de pozo', d.otroEquipo && `Otro: ${d.otroEquipo}`].filter(Boolean).join(', ');
  const pago = [...(d.formaPago || []).map((f) => FORMAS_PAGO[f] || f), d.otroMetodoTexto && `Otro: ${d.otroMetodoTexto}`].filter(Boolean).join(' + ');
  return [`📋 *Resumen de la Orden de Trabajo de ${cli}*`, '',
    `👤 ${d.nombre}${d.segundoNombre ? ' / ' + d.segundoNombre : ''} · ${d.telefono} · ${d.email}`, `📍 ${d.direccion}, ${d.ciudad}, ${d.estado} ${d.zipCode}`,
    `💧 ${eq}`, `🛠 ${d.fechaEstimada} · ${d.horario}${d.instruccionesEspeciales ? ` · ${d.instruccionesEspeciales}` : ''}`,
    `💵 ${pago}${d.cuotaInicialMarcada ? ` · Pago inicial ${money(d.cuotaInicial)}` : ' · Sin pago inicial'}`,
    `📷 Foto ID: ${d.fotoId || d.fotoIdUrl ? 'sí' : 'no'}`, '', 'El cliente firma desde un enlace en su teléfono.',
    'Responde *SI* para generar la orden y enviársela al cliente para que la firme, o dime qué corregir.'].join('\n');
}

// Lo que el sistema ya sabe del cliente, en las claves del borrador de la Orden de Trabajo
const prefillOT = (f) => Object.fromEntries(Object.entries({ nombre: f.nombre, telefono: f.telefono, email: f.email, direccion: f.direccion, ciudad: f.ciudad, estado: f.estado, zipCode: f.zipCode, fotoIdUrl: f.fotoIdUrl }).filter(([, v]) => v));
const tengoOT = (d) => [d.nombre && 'nombre', d.telefono && 'teléfono', d.email && 'email', d.direccion && 'dirección', d.ciudad && 'ciudad', d.estado && 'estado', d.zipCode && 'zip', (d.fotoIdUrl || d.fotoId) && 'foto del ID'].filter(Boolean).join(', ') || 'nada todavía';

function armarDatosOT(proy, d) {
  const formas = Array.isArray(d.formaPago) ? d.formaPago.filter((f) => FORMAS_PAGO[f]) : [];
  return {
    fecha: hoyUS(),
    comprador: { nombre: d.nombre, segundoNombre: d.segundoNombre || '', telefono: d.telefono, email: /^no\b/i.test(String(d.email || '')) ? '' : d.email, direccion: d.direccion, ciudad: d.ciudad, estado: d.estado, zipCode: d.zipCode, fotoId: d.fotoId || '', fotoIdUrl: d.fotoIdUrl || '' },
    equipos: { terminosPrevios: !!d.terminosPrevios, suavizadorCasa: !!d.suavizador, osmosisReversa: !!d.osmosis, osmosisReverso: !!d.osmosis, aguaAlcalina: !!d.alcalina,
      aguaCiudad: !!d.aguaCiudad, tipoLinea: d.tipoLinea || '', productoEspecifico: d.productoEspecifico || '', aguaPozo: !!d.pozo, otro: !!d.otroEquipo, otro_texto: d.otroEquipo || '' },
    instalacion: { fechaEstimada: d.fechaEstimada, horario: d.horario, instruccionesEspeciales: d.instruccionesEspeciales || '' },
    finanzas: { formaPago: formas, cuotaInicialMarcada: !!d.cuotaInicialMarcada, cuotaInicial: d.cuotaInicialMarcada ? String(numv(d.cuotaInicial).toFixed(2)) : '', otroMetodo: !!d.otroMetodoTexto, otroMetodoTexto: d.otroMetodoTexto || '' },
    nombre_dealer: `${user.nombre} ${user.apellido || ''}`.replace(/\s+/g, ' ').trim(),
    negocio_procedencia: 'Renew Water',
    firmas: { comprador_1: '', comprador_2: '', representante: '' },
    _tipo: 'orden_trabajo', _timestamp: new Date().toISOString(), proyectoId: proy.id, clienteId: proy.cliente_id,
  };
}

// ---------- Dudas: el agente explica (solo con esta información, nunca inventa precios ni políticas) ----------
const GLOSARIO_OT = `
ORDEN DE TRABAJO RENEW WATER (orden_trabajo_oficial):
- Comprador / segundo comprador: quienes compran y firman. El teléfono, email y dirección son los del cliente donde se instala.
- Términos de instalación previos: se marca si el comprador ya dio condiciones de instalación antes; si cambian, el comprador paga la diferencia.
- Suavizador para toda la casa (Whole House Water Softener): sistema que trata el agua de toda la casa.
- Ósmosis inversa para la cocina (Reverse Osmosis): filtro de agua para beber, se instala en la cocina.
- Agua alcalina (add-on): complemento que se añade al sistema.
- Agua de ciudad / agua de pozo: de dónde viene el agua de la casa. Si es de ciudad, se indica el tipo de línea (la tubería de la casa, por ejemplo cobre, PEX o PVC) y se puede especificar el producto.
- Otro: cualquier otro equipo, se escribe cuál.
- Fecha estimada y hora de instalación: la fecha aproximada y el bloque horario, 9:00am-2:00pm o 2:00pm-6:00pm.
- Instrucciones especiales: acceso a la casa, mascotas, lugar preferido para el equipo, horarios, etc.
- El lugar exacto del equipo lo deciden el personal de instalación de Renew Water y el comprador, en la mejor ubicación posible.
- Nota de cancelación: una vez autorizada la instalación, si el cliente cancela debe pagar la instalación y la desinstalación, con un costo de $1,200.00; en caso de disputa el comprador cubre los gastos legales.
- Forma de pago: efectivo, financiado o tarjeta de crédito (se puede combinar), pago inicial (down payment) con su monto, u otro método.
- Al firmar, el cliente acepta los términos del contrato, que está aplicando a crédito y autoriza a obtener su reporte de crédito; si es financiado paga intereses mensuales además del precio.
- Términos de pago y APR: YA NO se piden en la Orden de Trabajo nueva. APR es la tasa de interés anual del financiamiento y los términos de pago son el plazo y las cuotas; los define la financiera en la aplicación de crédito.
- Firma: el cliente firma desde un enlace que le llega por WhatsApp (también puede firmar en el teléfono del vendedor).
PROCESO RENEW WATER: crédito aprobado → Orden de Trabajo (firma del cliente) → asignación de técnico con fecha y hora → instalación y Confirmación de Instalación firmada por el cliente (ahí se registra la venta) → llamada de Renew → firma de contrato → llamada de la financiera → fotos de instalación → comisión.`;
const esPregunta = (t) => /\?|^\s*¿|\b(qu[eé] es|qu[eé] son|qu[eé] significa|c[oó]mo (se|lo|la)|para qu[eé]|por qu[eé]|cu[aá]l es)\b/i.test(t);

async function handleDuda() {
  const r = await llm(`Eres el asistente de Renew Water y respondes dudas de vendedores y técnicos por WhatsApp. Usa ÚNICAMENTE esta información:${GLOSARIO_OT}
Si la respuesta no está ahí, responde que eso lo confirma su Manager de Venta o Administración. No inventes precios, comisiones ni políticas. Nunca des datos de clientes. Responde en español, breve (máximo 5 líneas). Devuelve JSON: {"respuesta": string}.`, `Pregunta:\n${text}`);
  if (!r.respuesta) return null;
  await say(`💡 ${r.respuesta}`);
  return 'duda_respondida';
}

async function handleOT(proy) {
  const cli = ctx.N[proy.cliente_id] || proy.cliente_id;
  let d = sd.drafts[proy.id];
  if (!d) d = sd.drafts[proy.id] = prefillOT(await fichaCliente(proy.cliente_id));
  d._owner = user.id;

  // Reenviar el enlace de firma si ya se generó
  if (d._firmaUrl && /reenv|enlace|link/i.test(text)) {
    const ok = await enviarFirmaCliente(d.telefono, d.nombre || cli, 'Orden de Trabajo', d._firmaUrl, nombreUser);
    await say(`${ok ? '📲 Le reenvié el enlace al cliente.' : '⚠️ No tengo un teléfono válido del cliente.'}\nEnlace de firma: ${d._firmaUrl}`);
    return 'ot_reenvio';
  }

  // Primera pregunta: ¿genero la Orden de Trabajo?
  if (d._preguntaGenerar) {
    if (esNo(text)) { await say(`Perfecto ${nombreUser}. Cuando quieras, escríbeme *orden ${cli}* y la armamos.`); return 'ot_pospuesta'; }
    d._preguntaGenerar = false;
    if (esSi(text) || /^\s*orden\b/i.test(text)) {
      const falt0 = faltantesOT(d);
      if (falt0.length) { await say(`Listo. Del sistema ya tengo: ${tengoOT(d)}.\n\nPara la Orden de Trabajo de *${cli}* solo me falta:\n\n${preguntasOT(falt0)}`); return 'ot_faltan_datos'; }
      d._confirmando = true; await say(resumenOT(d, cli)); return 'ot_confirmacion';
    }
  }

  if (d._confirmando && esSi(text) && !faltantesOT(d).length) {
    await say(`⏳ Preparando la Orden de Trabajo de *${cli}* para que el cliente la firme...`);
    const f = await crearFirma('orden_trabajo', proy, d.nombre || cli, armarDatosOT(proy, d), user.id);
    d._firmaUrl = f.url; d._confirmando = false;
    const okCli = await enviarFirmaCliente(d.telefono, d.nombre || cli, 'Orden de Trabajo', f.url, nombreUser);
    const [p] = await sel('proyectos_dinamicos', `select=actividad&id=eq.${proy.id}`);
    const act = [...((p && p.actividad) || []), { tipo: 'FIRMA_SOLICITADA', label: 'Orden de Trabajo enviada al cliente para firma (Agente WhatsApp)', archivo: f.preview_url || null, timestamp: new Date().toISOString(), responsable_id: user.id }];
    await patch('proyectos_dinamicos', `id=eq.${proy.id}`, { actividad: act, ultima_actividad: 'Orden de Trabajo enviada al cliente para firma' });
    await say([`📝 La Orden de Trabajo de *${cli}* está lista para firmar.`, '',
      okCli ? '✅ Le envié el enlace al cliente por WhatsApp.' : '⚠️ No tengo un teléfono válido del cliente: compártele tú el enlace.',
      'Si el cliente firma en tu teléfono, usa este enlace:', f.url, '', `👀 Borrador: ${f.preview_url}`, '',
      'Cuando firme, guardo la orden oficial en su proyecto y te pregunto por el técnico.'].join('\n'));
    return 'ot_enviada_firma';
  }
  const hoyISO = new Date().toISOString().slice(0, 10);
  const ext0 = await llm(
    `Extraes datos de la Orden de Trabajo de Renew Water desde el mensaje de un vendedor. Responde SOLO JSON: {"datos": {...}, "duda": string|null}.
"datos" incluye ÚNICAMENTE las claves que el mensaje menciona (NUNCA inventes ni supongas): nombre, segundoNombre, telefono, email ("no tiene" si dice que no tiene), direccion, ciudad, estado (2 letras, ej FL), zipCode, terminosPrevios (bool), suavizador (bool: suavizador o sistema para toda la casa), osmosis (bool: ósmosis inversa / cocina), alcalina (bool), aguaCiudad (bool), tipoLinea (texto), productoEspecifico (texto), pozo (bool: agua de pozo), otroEquipo (texto), fechaEstimada (MM/DD/YYYY; hoy es ${hoyISO}; si no dice el año, la próxima fecha futura), horario ("9:00am-2:00pm" si la hora es antes de las 2pm o dice "en la mañana"; "2:00pm-6:00pm" si es a las 2pm o más tarde), instruccionesEspeciales (texto), formaPago (lista con "Cash" = efectivo/contado, "Financed" = financiado/crédito/financiera, "Credit Card" = tarjeta), cuotaInicialMarcada (true si hay pago inicial/entrada/down payment, false si dice que no hay), cuotaInicial (número: el monto del pago inicial; "2k" = 2000), otroMetodoTexto (texto).
El precio total NO es un campo de la orden: no lo guardes en ninguna clave.
"duda": si el mensaje pregunta qué significa algo o cómo llenarlo, respóndelo en máximo 3 líneas usando SOLO esta información:${GLOSARIO_OT}
Si no hay pregunta, "duda" es null.`,
    `Mensaje del vendedor:\n${text}`);
  const ext = ext0 && ext0.datos && typeof ext0.datos === 'object' ? ext0.datos : (ext0 || {});
  const PERMITIDAS = ['nombre', 'segundoNombre', 'telefono', 'email', 'direccion', 'ciudad', 'estado', 'zipCode', 'terminosPrevios', 'suavizador', 'osmosis', 'alcalina', 'aguaCiudad', 'tipoLinea', 'productoEspecifico', 'pozo', 'otroEquipo', 'fechaEstimada', 'horario', 'instruccionesEspeciales', 'formaPago', 'cuotaInicialMarcada', 'cuotaInicial', 'otroMetodoTexto'];
  for (const [k, v] of Object.entries(ext)) {
    if (!PERMITIDAS.includes(k) || v === null || v === '' || v === undefined) continue;
    if (k === 'formaPago') { const l = [].concat(v).filter((f) => FORMAS_PAGO[f]); if (l.length) d.formaPago = [...new Set([...(d.formaPago || []), ...l])]; continue; }
    if (k === 'horario' && !['9:00am-2:00pm', '2:00pm-6:00pm'].includes(v)) continue;
    d[k] = v;
  }
  if (d.cuotaInicial !== undefined && d.cuotaInicialMarcada === undefined && numv(d.cuotaInicial) > 0) d.cuotaInicialMarcada = true;
  const duda = ext0 && typeof ext0.duda === 'string' && ext0.duda.trim() ? `💡 ${ext0.duda.trim()}\n\n` : '';
  d._confirmando = false;
  const falt = faltantesOT(d);
  if (falt.length) {
    await say(`${duda}Gracias ${nombreUser}. Para la Orden de Trabajo de *${cli}* aún me falta:\n\n${preguntasOT(falt)}`);
    return 'ot_faltan_datos';
  }
  d._confirmando = true;
  await say(duda + resumenOT(d, cli));
  return 'ot_confirmacion';
}

// ---------- Campos de las demás fases ----------
async function handleCampos(proy) {
  const fase = ctx.F[proy.fase_id], cli = ctx.N[proy.cliente_id] || proy.cliente_id;
  const resp = await sel('respuestas_dinamicas', `select=id,campo_id,valor&proyecto_id=eq.${proy.id}`);
  const pend = camposFase(proy.fase_id, ctx.campos).filter((c) => faltaValor(resp.find((r) => r.campo_id === c.id)));
  const pedibles = pend.filter((c) => c.tipo !== 'Archivo');
  if (!pedibles.length) {
    if (!pend.length) { const r0 = await revisarFase(proy, ctx, user.id); return 'fase_' + r0.estado; }
    await say(`Para *${cli}* (${fase.nombre}) necesito: ${pend.map((c) => preguntaCampo(c, ctx)).join(', ')}.`);
    return 'espera_archivos';
  }
  const hoy = new Date().toISOString().slice(0, 10);
  const ext = await llm(
    `Extraes valores de campos de formulario desde un mensaje de WhatsApp. Responde SOLO JSON: {"valores":{"<campo_id>": string|null}}. Reglas: Desplegable => EXACTAMENTE una de las opciones. Fecha => YYYY-MM-DD (hoy es ${hoy}). Técnico => el id del técnico de la lista. Texto => el texto. null si no se menciona. NUNCA inventes.`,
    `Campos:\n${pedibles.map((c) => `${c.id} | ${c.etiqueta} | ${c.tipo}${c.tipo === 'Desplegable' ? ' | opciones: ' + opcionesDe(c).join(' / ') : ''}`).join('\n')}\n\nTécnicos:\n${ctx.tecnicos.map((t) => `${t.id} = ${t.nombre.trim()}`).join('\n')}\n\nMensaje:\n${text}`);
  const guardados = [];
  for (const c of pedibles) {
    let v = (ext.valores || {})[c.id];
    if (v === null || v === undefined || String(v).trim() === '') continue;
    v = String(v).trim();
    if (c.tipo === 'Desplegable') { const o = opcionesDe(c).find((x) => sinAcentos(x) === sinAcentos(v)); if (!o) continue; v = o; }
    if (c.tipo === 'Técnico') { const t = ctx.tecnicos.find((x) => x.id === v); if (!t) continue; await patch('proyectos_dinamicos', `id=eq.${proy.id}`, { tecnico_id: t.id }); proy.tecnico_id = t.id; }
    if (c.tipo === 'Fecha' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) continue;
    await guardarRespuesta(proy.id, c.id, v);
    guardados.push(c.etiqueta);
  }
  if (!guardados.length) { await say(`No logré identificar datos para *${cli}* (${fase.nombre}) en tu mensaje. Para avanzar necesito:\n${pedibles.map((c) => '• ' + preguntaCampo(c, ctx)).join('\n')}\n\nEscríbeme *hola* para ver todo lo que tienes pendiente.`); return 'no_entendido'; }
  const res = await revisarFase(proy, ctx, user.id);
  let out = `✅ Guardé ${guardados.join(', ')} de *${cli}*.`;
  if (res.estado === 'faltan') out += `\n\nAún me falta que me pases estos datos para poder avanzar de fase:\n${res.pend.map((c) => '• ' + preguntaCampo(c, ctx)).join('\n')}`;
  else if (res.estado === 'bloqueada') out += `\nQueda en *${fase.nombre}* porque "${res.campo.etiqueta}" no es afirmativo. Avísame apenas cambie para proseguir.`;
  else if (res.estado === 'avanzo') out += textoAvance(res.sig, cli);
  else if (res.estado === 'ultima') out += '\n🎉 ¡Completamos la última fase del pipeline!';
  else out += '\nFase completa (el avance automático está desactivado).';
  await say(out);
  return 'campos_' + res.estado;
}

// ---------- Texto ----------
async function handleTexto() {
  const proyectos = await misProyectos();
  if (!proyectos.length) return 'sin_pendientes';
  let proy = esSi(text) ? proyectos.find((p) => [sd.drafts[p.id], sd.cert[p.id]].some((x) => x && x._owner === user.id && (x._confirmando || x._preguntaGenerar))) : null;
  if (!proy && proyectos.length === 1) proy = proyectos[0];
  if (!proy) {
    // 1. Coincidencia directa por nombre del cliente en el mensaje
    const msgNorm = sinAcentos(text);
    proy = proyectos.find((p) => { const n = sinAcentos(ctx.N[p.cliente_id] || ''); return n.length >= 3 && msgNorm.includes(n); });
  }
  if (!proy) {
    // 2. Consultar al LLM si menciona un cliente diferente; si no menciona cliente, mantener el proyecto activo de la conversación
    const r = await llm('Identificas si el mensaje de un vendedor menciona explícitamente a cuál cliente/proyecto se refiere. Responde SOLO JSON: {"proyecto_id": string|null}. Si el mensaje solo trae datos (dirección, equipos, fecha, precios, respuestas) sin nombrar otro cliente, devuelve null.',
      `Proyectos:\n${proyectos.map((p) => `${p.id} = ${ctx.N[p.cliente_id]} (fase ${ctx.F[p.fase_id].nombre})`).join('\n')}\n\nMensaje:\n${text}`);
    proy = proyectos.find((p) => p.id === r.proyecto_id);
  }
  if (!proy && sd.active[user.id]) {
    proy = proyectos.find((p) => p.id === sd.active[user.id]);
  }
  if (!proy) {
    const conBorrador = proyectos.filter((p) => sd.drafts[p.id]);
    if (conBorrador.length === 1) proy = conBorrador[0];
  }
  if (!proy) {
    sd.pendingText[user.id] = text;
    await say(`Hola ${nombreUser}, ¿de cuál cliente hablas?\n` + proyectos.map((p) => `• ${ctx.N[p.cliente_id]} (${ctx.F[p.fase_id].nombre})`).join('\n'));
    return 'pregunta_cliente';
  }
  sd.active[user.id] = proy.id;
  // Si acaba de elegir el cliente y tenía un mensaje con datos guardado, combinarlo para no perderlo
  if (sd.pendingText[user.id] && sd.pendingText[user.id] !== text) {
    const prev = sd.pendingText[user.id];
    delete sd.pendingText[user.id];
    const n = sinAcentos(ctx.N[proy.cliente_id] || '');
    if (sinAcentos(text).replace(n, '').replace(/\(.*?\)/g, '').trim().length < 5) {
      text = prev;
    }
  } else {
    delete sd.pendingText[user.id];
  }
  if (proy.fase_id === FASE_1) await subirAOT(proy, user.id); // crédito aprobado: sigue con la Orden de Trabajo
  if (proy.fase_id === FASE_OT) return handleOT(proy);
  if (proy.fase_id === FASE_TEC) return handleTecnico(proy);
  if (proy.fase_id === FASE_CERT && proy.tecnico_id) return handleCert(proy);
  return handleCampos(proy);
}

// ---------- Técnico e instalación (Estación 3) ----------
const fechaBonita = (iso) => { const [y, mo, da] = String(iso || '').split('-').map(Number); if (!y) return iso || ''; return new Date(y, mo - 1, da).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); };
const fechaUS = (iso) => { const [y, mo, da] = String(iso || '').split('-'); return y && mo && da ? `${mo}/${da}/${y}` : (iso || ''); };
const hoyUS = () => { const n = new Date(); return `${String(n.getMonth() + 1).padStart(2, '0')}/${String(n.getDate()).padStart(2, '0')}/${n.getFullYear()}`; };

// Datos de la Orden de Trabajo ya firmada (para contarle al técnico qué equipos instala)
async function datosOTFirmada(proyId) {
  try {
    const [s] = await sel('solicitudes_firma', `select=datos&proyecto_id=eq.${proyId}&tipo=eq.orden_trabajo&estado=eq.firmado&order=firmado_en.desc&limit=1`);
    return (s && s.datos) || null;
  } catch (e) { return null; }
}
const equiposDeOT = (ot) => {
  const e = (ot && ot.equipos) || {};
  return [e.suavizadorCasa && 'Suavizador', (e.osmosisReversa || e.osmosisReverso) && 'Ósmosis inversa', e.aguaAlcalina && 'Agua alcalina', e.aguaPozo && 'Pozo', e.otro_texto].filter(Boolean).join(', ');
};

async function handleTecnico(proy) {
  const cli = ctx.N[proy.cliente_id] || proy.cliente_id;
  const cs = camposFase(FASE_TEC, ctx.campos);
  const cTec = cs.find((c) => c.tipo === 'Técnico');
  const cFecha = cs.find((c) => c.tipo === 'Fecha');
  if (!cTec) return handleCampos(proy); // la fase cambió en el admin: flujo genérico

  const st = (sd.inst[proy.id] = sd.inst[proy.id] || {});
  st._owner = user.id;
  if (proy.tecnico_id && !st.tecnicoId) st.tecnicoId = proy.tecnico_id;

  const hoy = new Date().toISOString().slice(0, 10);
  const soloNumero = text.trim().match(/^#?\s*(\d{1,2})\s*$/);
  const ext = soloNumero ? { numero: Number(soloNumero[1]) } : await llm(
    `Un vendedor asigna por WhatsApp el técnico de una instalación de agua. Responde SOLO JSON: {"numero": number|null, "tecnico_id": string|null, "fecha": "YYYY-MM-DD"|null, "hora": string|null}. "numero" = número de la lista si responde con un número. "tecnico_id" = id de la lista si nombra al técnico. Fecha en YYYY-MM-DD (hoy es ${hoy}; si no dice el año, la próxima fecha futura). Hora como "10:00 AM". null si no se menciona. NUNCA inventes.`,
    `Técnicos:\n${ctx.tecnicos.map((t, i) => `${i + 1}. ${t.id} = ${t.nombre} ${t.apellido || ''}`).join('\n')}\n\nMensaje:\n${text}`);

  let t = null;
  if (ext.numero && ctx.tecnicos[ext.numero - 1]) t = ctx.tecnicos[ext.numero - 1];
  else if (ext.tecnico_id) t = ctx.tecnicos.find((x) => x.id === ext.tecnico_id);
  if (t) st.tecnicoId = t.id;
  if (ext.fecha && /^\d{4}-\d{2}-\d{2}$/.test(ext.fecha)) st.fecha = ext.fecha;
  if (ext.hora) st.hora = String(ext.hora).slice(0, 20);

  const tec = ctx.users.find((u) => u.id === st.tecnicoId);
  const falta = [];
  if (!tec) falta.push(`el *número* del técnico:\n${listaTecnicos(ctx)}`);
  if (!st.fecha) falta.push('la *fecha* de instalación');
  if (!st.hora) falta.push('la *hora* de instalación');
  if (falta.length) {
    await say(`${tec ? `👍 Técnico: *${tec.nombre.trim()}*.` : ''}${st.fecha ? ` Fecha: *${fechaBonita(st.fecha)}*.` : ''}\nPara programar la instalación de *${cli}* me falta ${falta.join(', ')}.`.trim());
    return 'tec_faltan';
  }

  // Guardar en el proyecto (los mismos campos que llena la app)
  await patch('proyectos_dinamicos', `id=eq.${proy.id}`, { tecnico_id: tec.id });
  proy.tecnico_id = tec.id;
  await guardarRespuesta(proy.id, cTec.id, tec.id);
  if (cFecha) await guardarRespuesta(proy.id, cFecha.id, st.fecha);
  const cuando = `${fechaBonita(st.fecha)} a las ${st.hora}`;
  const [p0] = await sel('proyectos_dinamicos', `select=actividad&id=eq.${proy.id}`);
  await patch('proyectos_dinamicos', `id=eq.${proy.id}`, {
    actividad: [...((p0 && p0.actividad) || []), { tipo: 'INSTALACION_PROGRAMADA', label: `Instalación programada: ${cuando} con ${tec.nombre.trim()}`, fecha: st.fecha, hora: st.hora, tecnico_id: tec.id, timestamp: new Date().toISOString(), responsable_id: user.id }],
    ultima_actividad: `Instalación programada ${st.fecha} ${st.hora}`,
  });

  // Aviso al técnico con todo lo que necesita (y lo que le pediré al terminar)
  const ficha = await fichaCliente(proy.cliente_id);
  const equipos = equiposDeOT(await datosOTFirmada(proy.id));
  const okTec = await sendSafe(norm(tec.telefono), [
    `Hola ${tec.nombre.trim()} 👋, te asignaron una instalación de *Renew Water*:`, '',
    `👤 ${cli}`, `📞 ${ficha.telefono || '—'}`, `📍 ${ficha.direccion || '—'}`, `📅 ${cuando}`,
    `💧 ${equipos || 'Equipos según la Orden de Trabajo'}`, `🧑‍💼 Representante: ${nombreUser}`, '',
    'El día de la instalación te lo recuerdo, y al terminar te voy a pedir:', CERT_PREGUNTAS,
  ].join('\n'));

  // Avanzar a Certificado de Instalación si la fase quedó completa (sin repetirle el mensaje al técnico)
  const resp = await sel('respuestas_dinamicas', `select=campo_id,valor&proyecto_id=eq.${proy.id}`);
  const pend = cs.filter((c) => faltaValor(resp.find((r) => r.campo_id === c.id)));
  let out = `✅ Instalación de *${cli}* programada para el *${cuando}* con *${tec.nombre.trim()}*.` + (okTec ? '\n📲 Ya le escribí al técnico con los datos.' : '\n⚠️ No pude escribirle al técnico (revisa su teléfono en el sistema).');
  if (pend.length) out += `\n\nPara cerrar esta fase aún me falta:\n${pend.map((c) => '• ' + preguntaCampo(c, ctx)).join('\n')}`;
  else if (AUTO_ADVANCE) { const sig = await avanzar(proy, ctx, user.id, [user.id, tec.id]); if (sig) out += `\n\n🚀 Avancé a *${cli}* a *${sig.nombre}*. Cuando el técnico termine, le pido los equipos, el inventario usado y armo la confirmación para que firme el cliente.`; }
  delete sd.inst[proy.id];
  await say(out);
  return 'instalacion_programada';
}

// ---------- Confirmación de Instalación + inventario (Estación 4) ----------
const CERT_EQUIPOS = [['casa', 'water_treatment', 'serial_water', 'Sistema para toda la casa'], ['osmosis', 'reverse_osmosis', 'serial_ro', 'Ósmosis inversa'], ['pozo', 'well_water', 'serial_well', 'Sistema de pozo']];
const numC = (v) => { const n = parseFloat(String(v === undefined || v === null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };

function faltantesCert(st) {
  const f = [];
  if (!CERT_EQUIPOS.some(([k]) => st.equipos[k])) f.push('💧 los *equipos instalados* (toda la casa / ósmosis / pozo) con su número de serie');
  CERT_EQUIPOS.forEach(([k, , , nom]) => { if (st.equipos[k] && !st.equipos['serial_' + k]) f.push(`🔢 el *número de serie* de ${nom}`); });
  if (!st.sinMateriales && !st.sede) f.push(`📦 la *sede* de donde retiraste el material (${Object.values(SEDES_INV).join(' / ')})`);
  if (!st.sinMateriales && st.sede && !(st.materiales || []).length) f.push('📦 *qué material usaste* y cuántas unidades (o "ninguno")');
  return f;
}

function resumenCert(st, cli) {
  const eq = CERT_EQUIPOS.filter(([k]) => st.equipos[k]).map(([k, , , nom]) => `${nom} (serie ${st.equipos['serial_' + k]})`).join(', ');
  const c = st.costos || {};
  const total = numC(c.instalacion) + numC(c.millas) + numC(c.extra) + numC(c.otro);
  const mat = st.sinMateriales ? 'No se usó material del inventario' : `De *${SEDES_INV[st.sede] || st.sede}*: ${st.materiales.map((m) => `${m.cantidad} × ${m.nombre}`).join(', ')}`;
  return [`📋 *Confirmación de Instalación de ${cli}*`, '', `💧 ${eq}`,
    `💵 ${total ? `Costos adicionales: $${total.toFixed(2)}` : 'Sin costos adicionales'}`, `📦 ${mat}`,
    st.noEncontrados && st.noEncontrados.length ? `⚠️ No encontré en el inventario: ${st.noEncontrados.join(', ')} (no se descuenta)` : '', '',
    'Responde *SI* para descontar el inventario y enviarle el documento al cliente para que lo firme, o dime qué corregir.'].filter((x) => x !== '').join('\n');
}

async function handleCert(proy) {
  const cli = ctx.N[proy.cliente_id] || proy.cliente_id;
  const st = (sd.cert[proy.id] = sd.cert[proy.id] || { equipos: {}, costos: {}, materiales: [] });
  st._owner = user.id;

  if (st._firmaUrl && /reenv|enlace|link/i.test(text)) {
    const ficha = await fichaCliente(proy.cliente_id);
    const ok = await enviarFirmaCliente(ficha.telefono, ficha.nombre || cli, 'Confirmación de Instalación', st._firmaUrl, nombreUser);
    await say(`${ok ? '📲 Le reenvié el enlace al cliente.' : '⚠️ No tengo un teléfono válido del cliente.'}\nEnlace de firma: ${st._firmaUrl}`);
    return 'cert_reenvio';
  }
  if (st._confirmando && esSi(text) && !faltantesCert(st).length) return confirmarCert(proy, st, cli);

  const ext = await llm(
    'Un técnico o vendedor reporta por WhatsApp una instalación de agua terminada. Responde SOLO JSON con UNICAMENTE lo que se mencione: {"casa": bool, "serial_casa": string, "osmosis": bool, "serial_osmosis": string, "pozo": bool, "serial_pozo": string, "costo_instalacion": number, "costo_millas": number, "costo_extra": number, "costo_otro": number, "sin_costos": bool, "sede": string, "materiales_texto": string, "sin_materiales": bool}. "casa" = sistema de tratamiento/suavizador para toda la casa. "sede" = una de las claves: ' + Object.keys(SEDES_INV).join(', ') + '. "materiales_texto" = el texto literal de lo que dice que usó del inventario, con cantidades. "sin_materiales" = true si dice que no usó nada del inventario. NUNCA inventes.',
    `Mensaje:\n${text}`);
  for (const [k] of CERT_EQUIPOS) {
    if (ext[k] === true) st.equipos[k] = true;
    if (ext['serial_' + k]) { st.equipos[k] = true; st.equipos['serial_' + k] = String(ext['serial_' + k]).slice(0, 40); }
  }
  if (ext.sin_costos) st.costos = {};
  ['instalacion', 'millas', 'extra', 'otro'].forEach((k) => { if (ext['costo_' + k] !== undefined && ext['costo_' + k] !== null) st.costos[k] = numC(ext['costo_' + k]); });
  if (ext.sede && SEDES_INV[ext.sede]) { if (st.sede !== ext.sede) st.materiales = []; st.sede = ext.sede; }
  if (ext.sin_materiales) { st.sinMateriales = true; st.materiales = []; }
  if (ext.materiales_texto) { st.sinMateriales = false; st._materialesTexto = ext.materiales_texto; }

  // Cruzar lo que dijo contra el inventario Water de esa sede
  if (st.sede && st._materialesTexto) {
    const inv = await inventarioWater(st.sede);
    if (!inv.length) {
      await say(`No encontré inventario de Water en *${SEDES_INV[st.sede]}*. ¿De qué otra sede lo retiraste?`);
      st.sede = null; return 'cert_sede_sin_inventario';
    }
    const m = await llm(
      'Relacionas lo que un técnico dice que usó con los artículos del inventario. Responde SOLO JSON: {"items":[{"id": string, "cantidad": number}], "no_encontrados":[string]}. Usa SOLO ids de la lista. Si no dice cantidad, usa 1. NUNCA inventes artículos.',
      `Inventario (${SEDES_INV[st.sede]}):\n${inv.map((i) => `${i.id} | ${i.nombre_item} | ${i.ecosistema || ''} | stock ${i.stock_actual}`).join('\n')}\n\nLo que usó:\n${st._materialesTexto}`);
    st.materiales = (m.items || []).map((x) => { const it = inv.find((i) => i.id === x.id); return it && { id: it.id, nombre: it.nombre_item, cantidad: Math.max(1, Math.round(numC(x.cantidad) || 1)), stock: Number(it.stock_actual) || 0 }; }).filter(Boolean);
    st.noEncontrados = (m.no_encontrados || []).slice(0, 5);
    delete st._materialesTexto;
  }

  st._confirmando = false;
  const falt = faltantesCert(st);
  if (falt.length) { await say(`Gracias ${nombreUser}. Para la Confirmación de Instalación de *${cli}* me falta:\n\n${falt.join('\n')}`); return 'cert_faltan'; }
  st._confirmando = true;
  await say(resumenCert(st, cli));
  return 'cert_confirmacion';
}

async function confirmarCert(proy, st, cli) {
  await say(`⏳ Descontando inventario y preparando la confirmación de *${cli}*...`);
  const tec = ctx.users.find((u) => u.id === proy.tecnico_id) || user;
  const vend = ctx.users.find((u) => u.id === proy.responsable_id);

  // 1) Inventario
  let invTxt = '📦 No se descontó inventario.';
  if (!st.sinMateriales && st.materiales.length) {
    const hechos = await descontarInventario(st.materiales.map((m) => ({ id: m.id, cantidad: m.cantidad })), proy, cli, tec, st.sede);
    invTxt = `📦 Descontado del inventario de *${SEDES_INV[st.sede]}*:\n` + hechos.map((h) => `• ${h.cantidad} × ${h.nombre} (quedan ${h.despues})${h.sinStock ? ' ⚠️ el stock no alcanzaba' : ''}`).join('\n');
  }

  // 2) Documento para firmar (todo lo que ya está en el sistema)
  const ficha = await fichaCliente(proy.cliente_id);
  const resp = await sel('respuestas_dinamicas', `select=campo_id,valor&proyecto_id=eq.${proy.id}`);
  const cFecha = camposFase(FASE_TEC, ctx.campos).find((c) => c.tipo === 'Fecha');
  const fInst = cFecha && (resp.find((r) => r.campo_id === cFecha.id) || {}).valor;
  const c = st.costos || {};
  const total = numC(c.instalacion) + numC(c.millas) + numC(c.extra) + numC(c.otro);
  const datos = {
    proyectoId: proy.id, clienteId: proy.cliente_id, fecha: hoyUS(), fecha_firma: hoyUS(),
    comprador: ficha.nombre || cli, telefono: ficha.telefono || '', email: ficha.email || '', direccion: ficha.direccion || '',
    ciudad: ficha.ciudad || '', estado: ficha.estado || '', zip: ficha.zipCode || '',
    fecha_instalacion: fInst && !faltaValor({ valor: fInst }) ? fechaUS(fInst) : hoyUS(),
    instalador: `${tec.nombre} ${tec.apellido || ''}`.trim(), representante_ventas: vend ? `${vend.nombre} ${vend.apellido || ''}`.trim() : '',
    water_treatment: !!st.equipos.casa, serial_water: st.equipos.serial_casa || '',
    reverse_osmosis: !!st.equipos.osmosis, serial_ro: st.equipos.serial_osmosis || '',
    well_water: !!st.equipos.pozo, serial_well: st.equipos.serial_pozo || '',
    costo_instalacion: c.instalacion ? numC(c.instalacion).toFixed(2) : '', costo_millas: c.millas ? numC(c.millas).toFixed(2) : '',
    costo_extra: c.extra ? numC(c.extra).toFixed(2) : '', costo_otro: c.otro ? numC(c.otro).toFixed(2) : '', costo_total: total ? total.toFixed(2) : '',
  };
  const f = await crearFirma('confirmacion_instalacion', proy, ficha.nombre || cli, datos, user.id);
  st._firmaUrl = f.url; st._confirmando = false;
  const okCli = await enviarFirmaCliente(ficha.telefono, ficha.nombre || cli, 'Confirmación de Instalación', f.url, `${tec.nombre.trim()} (técnico de Renew Water)`);

  const [p0] = await sel('proyectos_dinamicos', `select=actividad&id=eq.${proy.id}`);
  await patch('proyectos_dinamicos', `id=eq.${proy.id}`, {
    actividad: [...((p0 && p0.actividad) || []), { tipo: 'FIRMA_SOLICITADA', label: 'Confirmación de Instalación enviada al cliente para firma', archivo: f.preview_url, timestamp: new Date().toISOString(), responsable_id: user.id }],
    ultima_actividad: 'Confirmación de Instalación enviada al cliente',
  });

  const msg = `${invTxt}\n\n📝 La *Confirmación de Instalación* de *${cli}* está lista para firmar.\n${okCli ? '✅ Le envié el enlace al cliente por WhatsApp.' : '⚠️ No tengo un teléfono válido del cliente: compártele el enlace.'}\nSi firma en tu teléfono, usa este enlace:\n${f.url}\n\nCuando firme, registro la venta y sigo con el resto del pipeline.`;
  await say(msg);
  // El reporte le llega a los dos: técnico y vendedor
  const otro = [tec, vend].find((u) => u && u.id !== user.id);
  if (otro) await sendSafe(norm(otro.telefono), `Hola ${otro.nombre.trim()} 👋, actualización de *${cli}*:\n\n${msg}`);
  return 'cert_enviada_firma';
}

// ---------- El cliente firmó (aviso del sistema) ----------
async function procesarFirma(evf) {
  const c2 = await cargarCtx();
  const [proy] = await sel('proyectos_dinamicos', `select=id,cliente_id,fase_id,responsable_id,tecnico_id,actividad&id=eq.${evf.proyecto_id}`);
  if (!proy) return { ignorado: 'proyecto no encontrado' };
  await nombresClientes(c2, [proy.cliente_id]);
  const cli = c2.N[proy.cliente_id] || proy.cliente_id;
  const vend = c2.users.find((u) => u.id === proy.responsable_id);
  const tec = c2.users.find((u) => u.id === proy.tecnico_id);
  const doc = evf.tipo === 'orden_trabajo' ? 'Orden de Trabajo' : 'Confirmación de Instalación';
  const act = [...(proy.actividad || []), { tipo: 'FORMULARIO_COMPLETADO', campo: doc, label: `${doc} firmada por el cliente`, archivo: evf.pdf_url, timestamp: evf.firmado_en || new Date().toISOString(), responsable_id: 'cliente' }];

  if (evf.tipo === 'orden_trabajo') {
    await guardarRespuesta(proy.id, CAMPO_OT, 'Completado en Formulario Externo');
    await patch('proyectos_dinamicos', `id=eq.${proy.id}`, { actividad: act, ultima_actividad: 'Orden de Trabajo firmada por el cliente' });
    delete sd.drafts[proy.id];
    let out = `✍️ *${cli}* firmó la *Orden de Trabajo*. La guardé en su proyecto y se envió al grupo de aplicaciones.\n📄 ${evf.pdf_url}`;
    if (AUTO_ADVANCE && proy.fase_id === FASE_OT) {
      const sig = await avanzar(proy, c2, 'cliente', vend ? [vend.id] : []);
      out += textoAvance(sig, cli);
      if (vend) sd.active[vend.id] = proy.id;
    }
    if (vend) await sendSafe(norm(vend.telefono), out);
    return { firma: evf.tipo, proyecto: proy.id };
  }

  // Confirmación de Instalación: queda como el certificado y la venta se registra
  const campoCert = camposFase(FASE_CERT, c2.campos).find((c) => c.tipo === 'Archivo');
  if (campoCert) await guardarRespuesta(proy.id, campoCert.id, evf.pdf_url);
  await patch('proyectos_dinamicos', `id=eq.${proy.id}`, { actividad: act, ultima_actividad: 'Confirmación de Instalación firmada: venta registrada', fecha_cierre: new Date().toISOString().slice(0, 10) });
  await patch('clientes_maestro', `id=eq.${proy.cliente_id}`, { macro_estado: 'Cliente' });
  delete sd.cert[proy.id];
  let out = `🎉 *${cli}* firmó la *Confirmación de Instalación*. ¡La venta quedó registrada!\n📄 ${evf.pdf_url}`;
  if (proy.fase_id === FASE_CERT) {
    const r = await revisarFase(proy, c2, 'cliente');
    if (r.estado === 'avanzo') out += textoAvance(r.sig, cli) + '\nSigo con el resto del pipeline hasta terminar.';
    else if (r.estado === 'faltan') out += `\n\nPara cerrar *Certificado de Instalación* aún falta:\n${r.pend.map((c) => '• ' + preguntaCampo(c, c2)).join('\n')}`;
  }
  for (const u of [vend, tec].filter((x, i, a) => x && a.findIndex((y) => y && y.id === x.id) === i)) await sendSafe(norm(u.telefono), out);
  return { firma: evf.tipo, proyecto: proy.id };
}

// ---------- Saludo: responde con TODO lo que la persona tiene pendiente ----------
async function handleSaludo() {
  const todos = await pendientesDe(user, ctx);
  const items = todos.filter((x) => !x.line.startsWith('📅')); // lo que debe hacer ahora
  const proximas = todos.filter((x) => x.line.startsWith('📅')); // instalaciones que aún no llegan
  const prox = proximas.length ? `\n\n*Próximas instalaciones:*\n${listaCorta(proximas.map((x) => x.line), 10)}` : '';
  if (!items.length) { await say(`Hola ${nombreUser} 👋. No tienes nada pendiente conmigo por ahora. ¡Buen trabajo! 💪${prox}`); return proximas.length ? 'saludo_proximas' : 'saludo_sin_pendientes'; }
  await say(`Hola ${nombreUser} 👋. Tienes *${items.length}* pendiente${items.length === 1 ? '' : 's'} que necesito para avanzar:\n\n${listaCorta(items.map((x) => x.line), 25)}${prox}\n\nPásamelos por aquí (escribe el nombre del cliente en cada mensaje) y yo sigo con el resto.`);
  return 'saludo_pendientes';
}

// ---------- Medios ----------
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
async function handleMedia() {
  const proyectos = await misProyectos();
  const resp = proyectos.length ? await sel('respuestas_dinamicas', `select=id,proyecto_id,campo_id,valor&proyecto_id=${inList(proyectos.map((p) => p.id))}`) : [];
  const pend = [];
  for (const p of proyectos) {
    const cli = ctx.N[p.cliente_id] || p.cliente_id;
    if (p.fase_id === FASE_OT) { pend.push({ p, cli, id: 'fotoId', etiqueta: 'Foto del ID del comprador (Orden de Trabajo)' }); continue; }
    for (const c of camposFase(p.fase_id, ctx.campos).filter((c) => c.tipo === 'Archivo')) {
      if (faltaValor(resp.find((r) => r.proyecto_id === p.id && r.campo_id === c.id))) pend.push({ p, cli, id: c.id, etiqueta: c.etiqueta });
    }
  }
  if (!pend.length) { await say(`Hola ${nombreUser}, recibí tu archivo pero no tienes clientes esperando archivos en este momento.`); return 'sin_pendientes'; }

  let b64 = msg.base64 || m.base64, mime = mediaNode.mimetype, name = mediaNode.fileName;
  if (!b64) {
    const j = await http({ method: 'POST', url: `${EVO}/chat/getBase64FromMediaMessage/${INST}`, headers: { ...EVH, 'Content-Type': 'application/json' }, body: { message: { key: m.key }, convertToMp4: false }, json: true });
    b64 = j.base64; mime = mime || j.mimetype; name = name || j.fileName;
  }
  b64 = String(b64).replace(/^data:[^;]+;base64,/, '');
  mime = (mime || 'application/octet-stream').split(';')[0];
  if (!EXT[mime]) { await say('Solo puedo recibir imágenes (JPG/PNG/WEBP) o PDF.'); return 'tipo_no_soportado'; }
  name = name || `archivo.${EXT[mime]}`;
  const caption = mediaNode.caption || '';

  let t = pend.length === 1 ? pend[0] : null;
  if (!t) {
    const s = await llm('Decides a qué pendiente corresponde un archivo enviado por WhatsApp. Responde SOLO JSON: {"indice": number|null}. Usa el texto del mensaje y el nombre del archivo. Si es ambiguo, null.',
      `Pendientes:\n${pend.map((x, i) => `${i}: cliente "${x.cli}", ${x.etiqueta} (fase ${ctx.F[x.p.fase_id].nombre})`).join('\n')}\n\nTexto: "${caption}"\nNombre de archivo: "${name}"`);
    t = pend[s.indice];
  }
  if (!t && sd.active[user.id]) {
    const delActivo = pend.filter((x) => x.p.id === sd.active[user.id]);
    if (delActivo.length === 1) t = delActivo[0];
  }
  if (!t) { await say(`Recibí tu archivo, ${nombreUser}. ¿Para cuál cliente y qué documento es?\n` + pend.map((x) => `• ${x.cli} — ${x.etiqueta}`).join('\n') + '\n\nReenvíalo con el nombre del cliente en el texto de la foto.'); return 'ambiguo'; }

  if (t.id === 'fotoId') {
    if (!/^image\//.test(mime)) { await say('Para el ID necesito una imagen (foto).'); return 'id_no_imagen'; }
    const d = (sd.drafts[t.p.id] = sd.drafts[t.p.id] || {});
    d.fotoId = `data:${mime};base64,${b64}`; d._confirmando = false;
    const falt = faltantesOT(d);
    await say(`📷 Guardé la foto del ID de *${t.cli}*.` + (falt.length ? `\n\nPara la Orden de Trabajo aún me falta:\n\n${preguntasOT(falt)}` : '\n\nEscribe *orden* para ver el resumen y confirmar.'));
    return 'foto_id_guardada';
  }

  const rel = `project_files/${t.p.id}/${Date.now()}_${name.replace(/[^\w.\-]/g, '_')}`;
  await http({ method: 'POST', url: `${SB}/storage/v1/object/archivos_renew/${rel}`, headers: { ...SBH, 'Content-Type': mime }, body: Buffer.from(b64, 'base64'), json: false });
  const valor = `/api/storage-proxy/archivos_renew/${rel}`;
  await guardarRespuesta(t.p.id, t.id, valor);
  const [p] = await sel('proyectos_dinamicos', `select=actividad&id=eq.${t.p.id}`);
  const act = [...((p && p.actividad) || []), { tipo: 'FORMULARIO_COMPLETADO', campo: t.etiqueta, label: t.etiqueta, archivo: valor, timestamp: new Date().toISOString(), responsable_id: user.id }];
  await patch('proyectos_dinamicos', `id=eq.${t.p.id}`, { actividad: act, ultima_actividad: `${t.etiqueta} recibido por WhatsApp` });
  const res = await revisarFase(t.p, ctx, user.id);
  let out = `✅ Listo ${nombreUser}, guardé "${t.etiqueta}" de *${t.cli}*.`;
  if (res.estado === 'faltan') out += `\n\nAún me falta que me pases para proseguir:\n${res.pend.map((c) => '• ' + preguntaCampo(c, ctx)).join('\n')}`;
  else if (res.estado === 'avanzo') out += textoAvance(res.sig, t.cli);
  else if (res.estado === 'bloqueada') out += `\nQueda en esta fase porque "${res.campo.etiqueta}" no es afirmativo.`;
  await say(out);
  return 'archivo_' + res.estado;
}

// ---------- Enrutamiento ----------
let accion;
try {
  if (mediaNode) accion = await handleMedia();
  else {
    const esperaSi = esSi(text) && [...Object.values(sd.drafts), ...Object.values(sd.cert)].some((x) => x && x._owner === user.id && (x._confirmando || x._preguntaGenerar));
    if (!esperaSi && RE_SALUDO.test(text) && text.length <= 40) accion = await handleSaludo();
    if (!accion && !esperaSi) accion = await consultar(user, text, ctx, from);
    const conBorrador = [...Object.values(sd.drafts), ...Object.values(sd.cert)].some((x) => x && x._owner === user.id);
    if (!accion && !esperaSi && !conBorrador && esPregunta(text)) accion = await handleDuda();
    if (!accion && !esperaSi) accion = await handleDecisions();
    if (!accion) accion = await handleTexto();
  }
  sd.seen.push(m.key.id); if (sd.seen.length > 500) sd.seen = sd.seen.slice(-250);
} catch (e) {
  await sendSafe(from, 'Tuve un problema procesando tu mensaje 🙏 Intenta de nuevo en un momento.');
  throw e;
}
return [{ json: { usuario: nombreUser, accion } }];

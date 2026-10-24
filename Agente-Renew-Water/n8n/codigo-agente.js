// ===== Nodo "Agente" (n8n Code) — webhook de Evolution =====
// Flujo: usuario -> decisión de crédito -> (según la fase del proyecto) Orden de Trabajo completa / campos de fase / archivos.

// ---------- Entrada ----------
const item = $input.first().json;
if (!item.body && !item.event) return []; // viene del Schedule, no del webhook
const ev = item.body || item;
if (E.WEBHOOK_TOKEN && (item.headers || {})['x-agente-token'] !== E.WEBHOOK_TOKEN) return [{ json: { ignorado: 'token inválido' } }];
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
const user = ctx.users.find((u) => !u.is_suspended && norm(u.telefono) === from);
if (!user) return [{ json: { ignorado: 'número desconocido ' + from } }];
const nombreUser = user.nombre.trim();
const say = (t) => sendText(from, t);

// ---------- Paso 0: aceptada / rechazada ----------
const esWater = (c) => /water/i.test(JSON.stringify([c.departamento, c.departamentos_activos]));
async function crearProyectoWater(cli) {
  const id = `proy_proy_11_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const actividad = [{ tipo: 'DECISION_CREDITO', label: 'Aplicación de Crédito ACEPTADA (confirmado por WhatsApp)', timestamp: now, responsable_id: user.id }];
  const app = cli.adjuntos_oficina && cli.adjuntos_oficina.app_url;
  let fase = FASE_1;
  if (app) {
    actividad.push({ tipo: 'FORMULARIO_COMPLETADO', campo: 'Aplicación de Crédito', label: 'Aplicación de Crédito', archivo: app, timestamp: now, responsable_id: user.id });
    actividad.push({ tipo: 'CAMBIO_FASE', label: 'Avance automático: Aprobación → Orden de Trabajo (Aplicación de Crédito completada)', de: FASE_1, a: FASE_OT, timestamp: now, responsable_id: 'agente-renew-water' });
    fase = FASE_OT;
  }
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
  const pend = (await sel('clientes_maestro', `select=id,nombre,departamento,departamentos_activos,adjuntos_oficina&macro_estado=eq.Prospecto&vendedor_asignado_id=eq.${user.id}`)).filter(esWater);
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
        out.push(`✅ *${cli.nombre}*: crédito aceptado. Creé el proyecto y ya lo avancé a *Orden de Trabajo*.\n\nPor favor pásame estos datos cuando los tengas para proseguir:\n\n${cuerpoFase(FASE_OT, ctx)}`);
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
  const all = await sel('proyectos_dinamicos', 'select=id,cliente_id,fase_id,responsable_id,tecnico_id&pipeline_id=eq.pip_water&fecha_cierre=is.null&fase_id=not.is.null');
  const mine = all.filter((p) => p.fase_id !== FASE_1 && ctx.F[p.fase_id] && encargadosDe(ctx.F[p.fase_id], p, ctx.users).some((u) => u.id === user.id));
  await nombresClientes(ctx, mine.map((p) => p.cliente_id));
  return mine;
}

// ---------- Orden de Trabajo (Estación 2) ----------
const money = (v) => { const n = parseFloat(String(v === undefined || v === null ? '' : v).replace(/[^0-9.\-]/g, '')); return '$' + (isNaN(n) ? 0 : n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
const numv = (v) => { const n = parseFloat(String(v === undefined || v === null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
const tieneEquipo = (d) => d.suavizador || d.osmosis || d.alcalina || d.pozo || d.otroEquipo;
const OT_REQ = [
  ['Comprador', 'nombre', 'nombre completo del comprador'], ['Comprador', 'telefono', 'teléfono'], ['Comprador', 'email', 'email'],
  ['Comprador', 'direccion', 'dirección de instalación'], ['Comprador', 'ciudad', 'ciudad'], ['Comprador', 'estado', 'estado'], ['Comprador', 'zipCode', 'zip code'],
  ['Equipos', '_equipo', 'equipos (suavizador / ósmosis / alcalina / pozo / otro)'],
  ['Instalación', 'fechaEstimada', 'fecha estimada de instalación'], ['Instalación', 'personasEnCasa', 'personas en casa'],
  ['Instalación', 'tipoPiso', 'tipo de piso (concreto o elevado)'], ['Instalación', 'conexionRefrigerador', 'conexión al refrigerador (sí/no)'], ['Instalación', 'horario', 'horario (9am-2pm o 2pm-6pm)'],
  ['Finanzas', 'precioContado', 'precio de contado'],
  ['Finanzas', 'cuotaInicial', 'cuota inicial', 'fin'], ['Finanzas', 'terminosPago', 'términos de pago', 'fin'], ['Finanzas', 'apr', 'APR', 'fin'],
];
function faltantesOT(d) {
  return OT_REQ.filter(([, k, , fin]) => {
    if (fin && d.sinFinanciamiento) return false;
    if (k === '_equipo') return !tieneEquipo(d);
    return d[k] === undefined || d[k] === null || String(d[k]).trim() === '';
  });
}
function preguntasOT(falt) {
  const g = {};
  falt.forEach(([b, , txt]) => (g[b] = g[b] || []).push(txt));
  return Object.entries(g).map(([b, l]) => `*${b}:* ${l.join(', ')}`).join('\n');
}
function resumenOT(d, cli) {
  const eq = [d.suavizador && 'Suavizador', d.osmosis && 'Ósmosis', d.alcalina && 'Alcalina', d.pozo && 'Pozo', d.otroEquipo].filter(Boolean).join(', ');
  const fin = d.sinFinanciamiento ? 'Sin financiamiento (todo en ceros)' : `Cuota inicial ${money(d.cuotaInicial)} · Financiar ${money(d.cantidadFinanciar)} · Términos ${d.terminosPago} · APR ${d.apr}`;
  return [`📋 *Resumen de la Orden de Trabajo de ${cli}*`, '',
    `👤 ${d.nombre}${d.segundoNombre ? ' / ' + d.segundoNombre : ''} · ${d.telefono} · ${d.email}`, `📍 ${d.direccion}, ${d.ciudad}, ${d.estado} ${d.zipCode}`,
    `💧 ${eq}`, `🛠 ${d.fechaEstimada} · ${d.personasEnCasa} personas · piso ${d.tipoPiso} · refrigerador ${d.conexionRefrigerador} · ${d.horario}`,
    `💵 Contado ${money(d.precioContado)} · ${fin}`, `📷 Foto ID: ${d.fotoId ? 'sí' : 'no'}`, '', 'Tarjeta en 0 y firmas en blanco.',
    'Responde *SI* para generar la orden, o dime qué corregir.'].join('\n');
}

async function generarOrden(proy, d, cli) {
  const precio = numv(d.precioContado), inst = numv(d.instalacionCosto), cuota = numv(d.cuotaInicial);
  const sinFin = !!d.sinFinanciamiento;
  const saldo = sinFin ? 0 : (d.saldoFinanciado !== undefined ? numv(d.saldoFinanciado) : precio + inst - cuota);
  const cant = sinFin ? 0 : (d.cantidadFinanciar !== undefined ? numv(d.cantidadFinanciar) : saldo);
  const cargos = sinFin ? 0 : numv(d.cargosFinancieros);
  const total = sinFin ? 0 : (d.totalPagos !== undefined ? numv(d.totalPagos) : cant + cargos);
  const datos = {
    comprador: { nombre: d.nombre, segundoNombre: d.segundoNombre || '', telefono: d.telefono, email: d.email, direccion: d.direccion, ciudad: d.ciudad, estado: d.estado, zipCode: d.zipCode, fotoId: d.fotoId || '' },
    equipos: { suavizadorCasa: !!d.suavizador, osmosisReversa: !!d.osmosis, osmosisReverso: !!d.osmosis, aguaAlcalina: !!d.alcalina, aguaPozo: !!d.pozo, otro_texto: d.otroEquipo || '' },
    instalacion: { fechaEstimada: d.fechaEstimada, personasEnCasa: String(d.personasEnCasa), tipoPiso: d.tipoPiso, conexionRefrigerador: d.conexionRefrigerador, horario: d.horario, granossDureza: String(d.granossDureza || 0), instruccionesEspeciales: d.instruccionesEspeciales || '' },
    finanzas: { precioContado: money(precio), instalacion: money(inst), cuotaInicial: money(sinFin ? 0 : cuota), saldo_financiado: money(saldo), cantidad_financiar: money(cant), terminos_pago: sinFin ? '0' : String(d.terminosPago), apr: sinFin ? '0' : String(d.apr), cargosFinancieros: money(cargos), totalPagos: money(total), tarjetaMonto: money(d.tarjetaMonto || 0) },
    tarjeta: { numero: '0', expiracion: '0', cvv: '0' },
    nombre_dealer: `${user.nombre} ${user.apellido || ''}`.replace(/\s+/g, ' ').trim(),
    negocio_procedencia: 'Renew Water',
    firmas: { comprador_1: '', comprador_2: '', representante: '' },
    _tipo: 'orden_trabajo', _timestamp: new Date().toISOString(), proyectoId: proy.id, clienteId: proy.cliente_id,
  };
  const r = await http({ method: 'POST', url: `${APP_URL}/api/generar-orden`, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datos }), json: false, returnFullResponse: true, encoding: 'arraybuffer', timeout: 90000 });
  let url = (r.headers || {})['x-document-url'];
  if (!url) { const [p] = await sel('proyectos_dinamicos', `select=orden_trabajo_url&id=eq.${proy.id}`); url = p && p.orden_trabajo_url; }
  return url;
}

async function handleOT(proy) {
  const cli = ctx.N[proy.cliente_id] || proy.cliente_id;
  let d = sd.drafts[proy.id];
  if (!d) {
    const [c] = await sel('clientes_maestro', `select=nombre,telefono,email,direccion,zip,state_id&id=eq.${proy.cliente_id}`);
    d = sd.drafts[proy.id] = { nombre: c && c.nombre, telefono: c && c.telefono, email: c && c.email, direccion: c && c.direccion, zipCode: c && c.zip, estado: c && c.state_id && c.state_id !== '-' ? c.state_id : undefined };
  }
  const confirma = /^\s*(s[ií]|ok|okay|confirmo|confirmado|correcto|dale|listo|perfecto|genera\w*)\W*$/i.test(text);
  if (d._confirmando && confirma && !faltantesOT(d).length) {
    await say(`⏳ Generando la Orden de Trabajo de ${cli}...`);
    const url = await generarOrden(proy, d, cli);
    await guardarRespuesta(proy.id, CAMPO_OT, 'Completado en Formulario Externo');
    const [p] = await sel('proyectos_dinamicos', `select=actividad&id=eq.${proy.id}`);
    const act = [...((p && p.actividad) || []), { tipo: 'FORMULARIO_COMPLETADO', campo: 'Orden de Trabajo', label: 'Orden de Trabajo generada por Agente (WhatsApp)', archivo: url || null, timestamp: new Date().toISOString(), responsable_id: user.id }];
    await patch('proyectos_dinamicos', `id=eq.${proy.id}`, { actividad: act, ultima_actividad: 'Orden de Trabajo generada por Agente' });
    delete sd.drafts[proy.id];
    let out = `✅ Orden de Trabajo de *${cli}* generada y enviada al grupo de aplicaciones.${url ? '\n📄 ' + url : ''}`;
    if (AUTO_ADVANCE) {
      const sig = await avanzar(proy, ctx, user.id, user.id);
      out += textoAvance(sig, cli);
    }
    await say(out);
    return 'orden_generada';
  }
  const ext = await llm(
    `Extraes datos de una Orden de Trabajo de instalación de agua desde el mensaje de un vendedor. Devuelve SOLO un objeto JSON incluyendo UNICAMENTE las claves que aparezcan en el mensaje (omite las que no se mencionen, NUNCA inventes). Claves posibles: nombre, segundoNombre, telefono, email, direccion, ciudad, estado (2 letras, ej FL), zipCode, suavizador (bool), osmosis (bool), alcalina (bool), pozo (bool), otroEquipo (texto), fechaEstimada (MM/DD/YYYY; hoy es ${new Date().toISOString().slice(0, 10)}), personasEnCasa (número), tipoPiso ("Concrete-slab" para concreto o "Raised" para elevado), conexionRefrigerador ("Yes" o "No"), horario ("9:00am-2:00pm" o "2:00pm-6:00pm"), granossDureza (número), instruccionesEspeciales (texto), sinFinanciamiento (bool: true si dice sin financiamiento o de contado), precioContado, instalacionCosto, cuotaInicial, saldoFinanciado, cantidadFinanciar, terminosPago, apr, cargosFinancieros, totalPagos, tarjetaMonto. Nota: si el vendedor envía 4 números seguidos en la línea de finanzas (ej. "10000, 400, 700, 70"), corresponden en orden a: precioContado, cuotaInicial, terminosPago, apr. Si solo pide ver qué falta, devuelve {}.`,
    `Mensaje del vendedor:\n${text}`);
  for (const [k, v] of Object.entries(ext)) { if (v === null || v === '' || v === undefined) continue; d[k] = v; }
  d._confirmando = false;
  const falt = faltantesOT(d);
  if (falt.length) {
    await say(`Gracias ${nombreUser}. Para la Orden de Trabajo de *${cli}* aún me falta:\n\n${preguntasOT(falt)}`);
    return 'ot_faltan_datos';
  }
  d._confirmando = true;
  await say(resumenOT(d, cli));
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
  if (!guardados.length) { await say(`No logré identificar los datos para *${cli}* (${fase.nombre}). Necesito:\n${pedibles.map((c) => '• ' + preguntaCampo(c, ctx)).join('\n')}`); return 'no_entendido'; }
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
  let proy = proyectos.find((p) => sd.drafts[p.id] && sd.drafts[p.id]._confirmando && /^\s*(s[ií]|ok|okay|confirmo|correcto|dale|listo|perfecto)\W*$/i.test(text));
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
  return proy.fase_id === FASE_OT ? handleOT(proy) : handleCampos(proy);
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
  else { accion = await handleDecisions(); if (!accion) accion = await handleTexto(); }
  sd.seen.push(m.key.id); if (sd.seen.length > 500) sd.seen = sd.seen.slice(-250);
} catch (e) {
  await sendSafe(from, 'Tuve un problema procesando tu mensaje 🙏 Intenta de nuevo en un momento.');
  throw e;
}
return [{ json: { usuario: nombreUser, accion } }];

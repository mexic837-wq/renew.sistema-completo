// Receptor de webhooks de Evolution API para el Agente Renew Water (skill 03).
// Uso: node receptor.js   (ver README.md)
const http = require('http');
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const l of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const i = l.indexOf('=');
    if (i > 0 && !(l.slice(0, i) in process.env)) process.env[l.slice(0, i)] = l.slice(i + 1);
  }
}
const E = process.env;
const PORT = E.PORT || 3100;
const MODEL = E.ANTHROPIC_MODEL || 'anthropic/claude-haiku-5.5';
const AUTO_ADVANCE = E.AUTO_ADVANCE === 'true';
const FASE_OT = 'fase_35_nol4';
const CAMPO_OT = 'campo_19_0fpc';
const SIGUIENTE = 'fase_fase_4111_4ltv'; // Estación 3
const DRAFTS = path.join(__dirname, '..', 'proyectos', 'borradores_ot.json');
const SEEN = new Set();

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(E.SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY);

const digits = t => String(t || '').replace(/\D/g, '');
const readDrafts = () => (fs.existsSync(DRAFTS) ? JSON.parse(fs.readFileSync(DRAFTS, 'utf8')) : {});
const writeDrafts = d => fs.writeFileSync(DRAFTS, JSON.stringify(d, null, 1));

async function sendText(number, text) {
  const r = await fetch(`${E.EVOLUTION_API_URL}/message/sendText/${E.EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: { apikey: E.EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number, text }),
  });
  if (!r.ok) console.error('sendText falló', r.status, await r.text());
}

async function claude(system, user) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': E.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 800, system, messages: [{ role: 'user', content: user }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  const t = j.content[0].text;
  return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
}

const REQUERIDOS = {
  nombre: 'nombre completo del comprador',
  telefono: 'teléfono del cliente',
  direccion: 'dirección de instalación',
  ciudad: 'ciudad',
  estado: 'estado',
  zipCode: 'zip code',
  equipos: 'equipos (suavizador, ósmosis, alcalina, pozo u otro)',
  fechaEstimada: 'fecha estimada de instalación',
};

const FASE_1 = 'fase_33_z8j9';
const esWater = c => /water/i.test(JSON.stringify([c.departamento, c.departamentos_activos]));

// ───────── Paso 0: ¿Aceptada o rechazada la Aplicación de Crédito? ─────────
async function prospectosPendientes(userId) {
  const { data } = await sb.from('clientes_maestro')
    .select('id,nombre,departamento,departamentos_activos,adjuntos_oficina')
    .eq('macro_estado', 'Prospecto').eq('vendedor_asignado_id', userId);
  return (data || []).filter(esWater);
}

async function crearProyectoWater(cli, userId) {
  const id = `proy_proy_11_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const actividad = [{ tipo: 'DECISION_CREDITO', label: 'Aplicación de Crédito ACEPTADA (confirmado por WhatsApp)', timestamp: now, responsable_id: userId }];
  const tieneApp = !!(cli.adjuntos_oficina && cli.adjuntos_oficina.app_url);
  let fase = FASE_1;
  if (tieneApp) {
    actividad.push({ tipo: 'FORMULARIO_COMPLETADO', campo: 'Aplicación de Crédito', label: 'Aplicación de Crédito', archivo: cli.adjuntos_oficina.app_url, timestamp: now, responsable_id: userId });
    actividad.push({ tipo: 'CAMBIO_FASE', label: 'Avance automático: Aprobación → Orden de Trabajo (Aplicación de Crédito completada)', de: FASE_1, a: FASE_OT, timestamp: now, responsable_id: 'agente-renew-water' });
    fase = FASE_OT;
  }
  const ins = await sb.from('proyectos_dinamicos').insert({
    id, cliente_id: cli.id, pipeline_id: 'pip_water', fase_id: fase, responsable_id: userId,
    fecha: now.split('T')[0], colaboradores: [], discusion: [], actividad,
    ultima_actividad: 'Proyecto creado por Agente tras aceptación de crédito',
  });
  if (ins.error) throw ins.error;
  await sb.from('clientes_maestro').update({ estado: 'En Proceso', macro_estado: 'En Proceso', vendedor_asignado_id: userId }).eq('id', cli.id);
  return { id, fase };
}

async function handleDecisions(from, user, text) {
  const pend = await prospectosPendientes(user.id);
  const drafts = readDrafts();
  const key = `decl_${user.id}`;

  // ¿Estamos esperando el motivo de un rechazo?
  if (drafts[key]) {
    const cid = drafts[key].cliente_id;
    delete drafts[key]; writeDrafts(drafts);
    await sb.from('clientes_maestro').update({ macro_estado: 'Declinado', motivo_declinado: text.slice(0, 500) }).eq('id', cid);
    await sendText(from, `Anotado, ${user.nombre}. Dejé al prospecto como Declinado (motivo: "${text.slice(0, 120)}").`);
    return true;
  }
  if (!pend.length) return false;

  const ext = await claude(
    'Un vendedor responde por WhatsApp sobre prospectos cuya Aplicación de Crédito ya se envió. Detecta si informa que una aplicación fue ACEPTADA (aprobada) o RECHAZADA (negada). Responde SOLO JSON: {"decisiones":[{"cliente_id": string, "decision": "aceptada"|"rechazada", "motivo": string|null}]}. Lista vacía si el mensaje no habla de aprobación/rechazo. Si solo hay un prospecto y dice "aceptada/aprobada/sí" o "rechazada/negada/no", aplica a ese. NUNCA adivines.',
    `Prospectos:\n${pend.map(c => `${c.id} = ${c.nombre}`).join('\n')}\n\nMensaje:\n${text}`);
  const decs = (ext.decisiones || []).filter(d => pend.find(c => c.id === d.cliente_id));
  if (!decs.length) return false;

  const out = [];
  for (const d of decs) {
    const cli = pend.find(c => c.id === d.cliente_id);
    if (d.decision === 'aceptada') {
      const r = await crearProyectoWater(cli, user.id);
      out.push(r.fase === FASE_OT
        ? `✅ ${cli.nombre}: crédito aceptado. Creé el proyecto y ya está en *Orden de Trabajo*. Envíame: dirección de instalación, equipos, fecha deseada y notas.`
        : `✅ ${cli.nombre}: crédito aceptado. Creé el proyecto en *Aprobación*.`);
    } else if (d.motivo) {
      await sb.from('clientes_maestro').update({ macro_estado: 'Declinado', motivo_declinado: d.motivo }).eq('id', cli.id);
      out.push(`❌ ${cli.nombre}: marcado como Declinado (${d.motivo}).`);
    } else {
      drafts[key] = { cliente_id: cli.id }; writeDrafts(drafts);
      out.push(`❌ ${cli.nombre}: entendido que fue rechazado. ¿Cuál fue el motivo?`);
      break;
    }
  }
  await sendText(from, out.join('\n'));
  return true;
}

async function handleMessage(from, text) {
  const { data: users } = await sb.from('usuarios').select('id,nombre,telefono,is_suspended');
  const user = (users || []).find(u => !u.is_suspended && digits(u.telefono) === from);
  if (!user) return console.log('Número desconocido ignorado:', from);

  if (await handleDecisions(from, user, text)) return;

  const { data: proys } = await sb.from('proyectos_dinamicos').select('id,cliente_id,actividad')
    .eq('pipeline_id', 'pip_water').eq('fase_id', FASE_OT).eq('responsable_id', user.id).is('fecha_cierre', null);
  if (!proys || !proys.length) return; // nada pendiente: no responder (evita ruido)

  const { data: cls } = await sb.from('clientes_maestro').select('id,nombre').in('id', proys.map(p => p.cliente_id));
  const nombres = Object.fromEntries(cls.map(c => [c.id, c.nombre]));
  const lista = proys.map(p => `${p.id} = ${nombres[p.cliente_id] || p.cliente_id}`).join('\n');

  const ext = await claude(
    'Extraes datos de una Orden de Trabajo de instalación de agua a partir de mensajes de WhatsApp de un vendedor. Responde SOLO JSON: {"proyecto_id": string|null, "datos": {nombre, telefono, direccion, ciudad, estado, zipCode, equipos: string[] con valores de [suavizador, osmosis, alcalina, pozo, otro], fechaEstimada, notas}}. Usa null para lo que no se mencione. NUNCA inventes datos. proyecto_id debe ser uno de la lista si el mensaje identifica al cliente (o si solo hay uno).',
    `Proyectos pendientes del vendedor:\n${lista}\n\nMensaje:\n${text}`);

  const pid = ext.proyecto_id && proys.find(p => p.id === ext.proyecto_id) ? ext.proyecto_id : (proys.length === 1 ? proys[0].id : null);
  if (!pid) return sendText(from, `Hola ${user.nombre}, ¿para cuál cliente son estos datos?\n` + proys.map(p => `• ${nombres[p.cliente_id]}`).join('\n'));

  const drafts = readDrafts();
  const d = (drafts[pid] = drafts[pid] || {});
  for (const [k, v] of Object.entries(ext.datos || {})) {
    if (v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    d[k] = v;
  }
  writeDrafts(drafts);

  const faltan = Object.keys(REQUERIDOS).filter(k => !d[k] || (Array.isArray(d[k]) && !d[k].length));
  const cliente = nombres[proys.find(p => p.id === pid).cliente_id];
  if (faltan.length) {
    return sendText(from, `Gracias ${user.nombre}. Para la Orden de Trabajo de ${cliente} aún me falta:\n` + faltan.map(k => `• ${REQUERIDOS[k]}`).join('\n'));
  }

  // Completo: registrar en Supabase
  const proy = proys.find(p => p.id === pid);
  const now = new Date().toISOString();
  const evento = { tipo: 'DATOS_ORDEN_TRABAJO', label: 'Datos de Orden de Trabajo recibidos por WhatsApp', datos: d, timestamp: now, responsable_id: 'agente-renew-water' };
  const act = [...(proy.actividad || []), evento];
  await sb.from('respuestas_dinamicas').update({ valor: 'Completado en Formulario Externo' }).eq('proyecto_id', pid).eq('campo_id', CAMPO_OT);
  const upd = { actividad: act, ultima_actividad: 'Datos de Orden de Trabajo recibidos por WhatsApp' };
  if (AUTO_ADVANCE) {
    upd.fase_id = SIGUIENTE;
    act.push({ tipo: 'CAMBIO_FASE', label: 'Avance automático: Orden de Trabajo → Asignación de Técnicos', de: FASE_OT, a: SIGUIENTE, timestamp: now, responsable_id: 'agente-renew-water' });
  }
  await sb.from('proyectos_dinamicos').update(upd).eq('id', pid);
  delete drafts[pid]; writeDrafts(drafts);
  await sendText(from, AUTO_ADVANCE
    ? `¡Listo! Ya completé los datos de ${cliente} y lo avancé a la fase Asignación de Técnicos.`
    : `¡Listo! Ya registré los datos de ${cliente}. Queda en revisión para generar la Orden de Trabajo.`);
}

// ───────── Medios (imágenes / documentos) ─────────
const BUCKET = 'archivos_renew';
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

async function getMedia(m) {
  const inline = m.message?.base64 || m.base64;
  const msg = m.message || {};
  const node = msg.imageMessage || msg.documentMessage || msg.documentWithCaptionMessage?.message?.documentMessage;
  let b64 = inline, mime = node?.mimetype, name = node?.fileName;
  if (!b64) {
    const r = await fetch(`${E.EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${E.EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { apikey: E.EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { key: m.key }, convertToMp4: false }),
    });
    if (!r.ok) throw new Error('No se pudo descargar el medio: ' + r.status);
    const j = await r.json();
    b64 = j.base64; mime = mime || j.mimetype; name = name || j.fileName;
  }
  b64 = String(b64).replace(/^data:[^;]+;base64,/, '');
  mime = (mime || 'application/octet-stream').split(';')[0];
  return { buf: Buffer.from(b64, 'base64'), mime, name: name || `archivo.${EXT[mime] || 'bin'}`, caption: node?.caption || '' };
}

async function handleMedia(from, m) {
  const { data: users } = await sb.from('usuarios').select('id,nombre,telefono,is_suspended');
  const user = (users || []).find(u => !u.is_suspended && digits(u.telefono) === from);
  if (!user) return console.log('Número desconocido ignorado:', from);

  // Proyectos activos donde este usuario es el encargado
  const { data: fases } = await sb.from('admin_fases').select('id,nombre,orden,usuarios_especificos').eq('pipeline_id', 'pip_water');
  const F = Object.fromEntries(fases.map(f => [f.id, f]));
  const { data: all } = await sb.from('proyectos_dinamicos').select('id,cliente_id,fase_id,responsable_id,tecnico_id,actividad')
    .eq('pipeline_id', 'pip_water').is('fecha_cierre', null).not('fase_id', 'is', null);
  const mine = all.filter(p => p.responsable_id === user.id || p.tecnico_id === user.id || (F[p.fase_id]?.usuarios_especificos || []).includes(user.id));
  if (!mine.length) return;

  // Campos de archivo faltantes por proyecto
  const { data: campos } = await sb.from('admin_campos_formulario').select('id,fase_id,etiqueta,tipo').eq('tipo', 'Archivo');
  const { data: resp } = await sb.from('respuestas_dinamicas').select('id,proyecto_id,campo_id,valor').in('proyecto_id', mine.map(p => p.id));
  const { data: cls } = await sb.from('clientes_maestro').select('id,nombre').in('id', mine.map(p => p.cliente_id));
  const nom = Object.fromEntries(cls.map(c => [c.id, c.nombre]));
  const pend = [];
  for (const p of mine) {
    for (const c of campos.filter(c => c.fase_id === p.fase_id)) {
      const r = resp.find(x => x.proyecto_id === p.id && x.campo_id === c.id);
      if (!r || !r.valor || ['EMPTY', ''].includes(r.valor)) pend.push({ p, c, r, cliente: nom[p.cliente_id] || p.cliente_id });
    }
  }
  if (!pend.length) return sendText(from, `Hola ${user.nombre}, recibí tu archivo pero no tienes clientes esperando archivos en este momento.`);

  const media = await getMedia(m);
  if (!EXT[media.mime]) return sendText(from, 'Solo puedo recibir imágenes (JPG/PNG/WEBP) o PDF.');

  const lista = pend.map((x, i) => `${i}: cliente "${x.cliente}", campo "${x.c.etiqueta}" (fase ${F[x.p.fase_id]?.nombre})`).join('\n');
  const sel = await claude(
    'Decides a qué pendiente corresponde un archivo enviado por WhatsApp. Responde SOLO JSON: {"indice": number|null}. Usa el texto del mensaje y el nombre del archivo. Si solo hay un pendiente, elígelo. Si es ambiguo, null.',
    `Pendientes:\n${lista}\n\nTexto: "${media.caption}"\nNombre de archivo: "${media.name}"`);
  const t = pend[sel.indice];
  if (!t) return sendText(from, `Recibí tu archivo, ${user.nombre}. ¿Para cuál cliente y qué documento es?\n` + pend.map(x => `• ${x.cliente} — ${x.c.etiqueta}`).join('\n') + '\n\nReenvíalo escribiendo el nombre del cliente en el texto de la foto.');

  const safe = media.name.replace(/[^\w.\-]/g, '_');
  const rel = `project_files/${t.p.id}/${Date.now()}_${safe}`;
  const up = await sb.storage.from(BUCKET).upload(rel, media.buf, { contentType: media.mime, upsert: false });
  if (up.error) { console.error(up.error); return sendText(from, 'No pude guardar el archivo, intenta de nuevo en un momento.'); }
  const valor = `/api/storage-proxy/${BUCKET}/${rel}`;
  const w = t.r
    ? await sb.from('respuestas_dinamicas').update({ valor }).eq('id', t.r.id)
    : await sb.from('respuestas_dinamicas').insert({ id: `resp_resp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, proyecto_id: t.p.id, campo_id: t.c.id, valor });
  if (w.error) { console.error(w.error); return sendText(from, 'Guardé el archivo pero no pude registrarlo. Avisaré al equipo.'); }

  const now = new Date().toISOString();
  const act = [...(t.p.actividad || []), { tipo: 'FORMULARIO_COMPLETADO', campo: t.c.etiqueta, label: t.c.etiqueta, archivo: valor, timestamp: now, responsable_id: user.id }];
  const upd = { actividad: act, ultima_actividad: `${t.c.etiqueta} recibido por WhatsApp` };

  // ¿Quedan archivos pendientes en esta fase?
  const quedan = pend.filter(x => x.p.id === t.p.id && x.c.id !== t.c.id);
  let msg = `✅ Listo ${user.nombre}, guardé "${t.c.etiqueta}" de ${t.cliente}.`;
  if (quedan.length) msg += `\nAún falta: ${quedan.map(x => x.c.etiqueta).join(', ')}.`;
  else if (AUTO_ADVANCE) {
    const sig = fases.filter(f => f.orden > F[t.p.fase_id].orden).sort((a, b) => a.orden - b.orden)[0];
    if (sig) {
      upd.fase_id = sig.id;
      act.push({ tipo: 'CAMBIO_FASE', label: `Avance automático: ${F[t.p.fase_id].nombre} → ${sig.nombre}`, de: t.p.fase_id, a: sig.id, timestamp: now, responsable_id: 'agente-renew-water' });
      msg += `\nLo avancé a la fase ${sig.nombre}.`;
    }
  }
  await sb.from('proyectos_dinamicos').update(upd).eq('id', t.p.id);
  await sendText(from, msg);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method !== 'POST' || url.pathname !== '/webhook' || url.searchParams.get('token') !== E.WEBHOOK_TOKEN) {
    res.writeHead(404); return res.end();
  }
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    res.writeHead(200); res.end('ok'); // responder rápido a Evolution
    try {
      const ev = JSON.parse(body);
      const m = ev.data;
      if (!/messages.upsert/i.test(ev.event || '') || !m || m.key?.fromMe) return;
      const jid = m.key.remoteJid || '';
      if (!jid.endsWith('@s.whatsapp.net') || SEEN.has(m.key.id)) return;
      SEEN.add(m.key.id);
      const msg = m.message || {};
      if (msg.imageMessage || msg.documentMessage || msg.documentWithCaptionMessage) {
        return handleMedia(digits(jid), m).catch(e => console.error('Error con medio:', e));
      }
      const text = msg.conversation || msg.extendedTextMessage?.text;
      if (!text) return;
      handleMessage(digits(jid), text).catch(e => console.error('Error procesando:', e));
    } catch (e) { console.error('Webhook inválido', e.message); }
  });
}).listen(PORT, () => console.log('Receptor escuchando en', PORT));

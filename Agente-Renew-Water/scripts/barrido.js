// Barrido (skill 02). Uso: node barrido.js [--send]   (sin --send solo simula)
// Paso 0: prospectos Water con crédito pendiente de decisión -> "¿aceptada o rechazada?"
// Luego: proyectos activos con datos/archivos faltantes en su estación actual.
const fs = require('fs');
const path = require('path');
for (const l of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !(l.slice(0, i) in process.env)) process.env[l.slice(0, i)] = l.slice(i + 1);
}
const E = process.env;
const SEND = process.argv.includes('--send');
const REG = path.join(__dirname, '..', 'proyectos', 'registro_notificaciones.json');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(E.SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY);
const digits = t => String(t || '').replace(/\D/g, '');
const H12 = 12 * 3600 * 1000;

(async () => {
  const reg = fs.existsSync(REG) ? JSON.parse(fs.readFileSync(REG, 'utf8')) : {};
  const { data: users } = await sb.from('usuarios').select('id,nombre,telefono,is_suspended');
  const U = Object.fromEntries(users.map(u => [u.id, u]));
  const items = {}; // userId -> líneas

  const add = (uid, key, line) => {
    if (!uid || !U[uid] || U[uid].is_suspended) return;
    if (reg[key] && Date.now() - Date.parse(reg[key]) < H12) return; // anti-spam 12h
    (items[uid] = items[uid] || []).push({ key, line });
  };

  // Paso 0: prospectos
  const { data: pros } = await sb.from('clientes_maestro').select('id,nombre,departamento,departamentos_activos,vendedor_asignado_id').eq('macro_estado', 'Prospecto');
  for (const c of pros.filter(c => /water/i.test(JSON.stringify([c.departamento, c.departamentos_activos])))) {
    add(c.vendedor_asignado_id, `prospecto:${c.id}`, `🆕 ${c.nombre}: ¿la Aplicación de Crédito fue *aceptada* o *rechazada*? (si fue rechazada, dime el motivo)`);
  }

  // Proyectos activos
  const { data: fases } = await sb.from('admin_fases').select('id,nombre').eq('pipeline_id', 'pip_water');
  const F = Object.fromEntries(fases.map(f => [f.id, f.nombre]));
  const { data: ps } = await sb.from('proyectos_dinamicos').select('id,cliente_id,fase_id,responsable_id,tecnico_id').eq('pipeline_id', 'pip_water').is('fecha_cierre', null).not('fase_id', 'is', null);
  const { data: cls } = await sb.from('clientes_maestro').select('id,nombre').in('id', [...new Set(ps.map(p => p.cliente_id))]);
  const N = Object.fromEntries(cls.map(c => [c.id, c.nombre]));
  const { data: campos } = await sb.from('admin_campos_formulario').select('id,fase_id,etiqueta,tipo').eq('tipo', 'Archivo');
  const { data: resp } = await sb.from('respuestas_dinamicas').select('proyecto_id,campo_id,valor').in('proyecto_id', ps.map(p => p.id));
  for (const p of ps) {
    if (p.fase_id === 'fase_35_nol4') {
      const r = resp.find(x => x.proyecto_id === p.id && x.campo_id === 'campo_19_0fpc');
      if (!r || !r.valor || r.valor === 'EMPTY') add(p.responsable_id, `proy:${p.id}`, `📋 ${N[p.cliente_id]}: datos de Orden de Trabajo (dirección, equipos, fecha, notas)`);
    }
    if (p.fase_id === 'fase_33_z8j9') continue; // Estación 1: solo importa la Aplicación de Crédito (ignorar comprobantes duplicados)
    for (const c of campos.filter(c => c.fase_id === p.fase_id)) {
      const r = resp.find(x => x.proyecto_id === p.id && x.campo_id === c.id);
      if (!r || !r.valor || r.valor === 'EMPTY') add(p.tecnico_id || p.responsable_id, `proy:${p.id}:${c.id}`, `📎 ${N[p.cliente_id]} (${F[p.fase_id]}): ${c.etiqueta}`);
    }
  }

  for (const [uid, list] of Object.entries(items)) {
    const u = U[uid];
    const text = `Hola ${u.nombre} 👋, soy el asistente de Renew Water. Esto está pendiente:\n\n${list.map(x => x.line).join('\n')}\n\nResponde por aquí con texto o fotos (escribe el nombre del cliente en cada foto).`;
    console.log(`--- ${u.nombre} (${digits(u.telefono)}) ---\n${text}\n`);
    if (!SEND) continue;
    const r = await fetch(`${E.EVOLUTION_API_URL}/message/sendText/${E.EVOLUTION_INSTANCE}`, {
      method: 'POST', headers: { apikey: E.EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: digits(u.telefono), text }),
    });
    if (r.ok) list.forEach(x => (reg[x.key] = new Date().toISOString()));
    else console.error('Fallo envío', u.nombre, r.status);
  }
  if (SEND) fs.writeFileSync(REG, JSON.stringify(reg, null, 1));
  console.log(SEND ? 'Enviado.' : 'SIMULACIÓN: nada enviado (usa --send).');
})();

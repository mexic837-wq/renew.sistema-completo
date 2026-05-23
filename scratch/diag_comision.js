// Diagnostic script - node scratch/diag_comision.js
const fs = require('fs');
const server = fs.readFileSync('server.js', 'utf8');

// Extract key from server.js
const keyMatch = server.match(/SUPABASE[_]?ANON[_]?KEY\s*[=:]\s*['"]([^'"]{30,})['"]/i)
               || server.match(/supabaseKey\s*=\s*['"]([^'"]{30,})['"]/i)
               || server.match(/anon.*?['"]([eyJ][^'"]{30,})['"]/i);

const GATEWAY = 'https://gateway.renewgroup.site';
const KEY = keyMatch ? keyMatch[1] : '';

console.log('KEY found?', !!KEY, KEY ? KEY.substring(0,30)+'...' : 'NO KEY');

const headers = {
  'apikey': KEY,
  'Authorization': `Bearer ${KEY}`,
  'Content-Type': 'application/json'
};

async function query(table, select, filter) {
  const url = `${GATEWAY}/rest/v1/${table}?select=${select||'*'}${filter ? '&' + filter : ''}&limit=50`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error(`Error ${res.status} en ${table}:`, await res.text());
    return [];
  }
  return res.json();
}

async function main() {
  console.log('\n=== DIAGNÓSTICO FASE COMISIÓN ===\n');

  // 1. Get ALL phases (to find "Comision")
  const todasFases = await query('admin_fases', 'id,nombre,pipeline_id');
  const fases = todasFases.filter(f => f.nombre && f.nombre.toLowerCase().includes('comisi'));
  console.log('1. TODAS LAS FASES (total):', todasFases.length);
  console.log('   FASES COMISION:', JSON.stringify(fases, null, 2));

  if (!fases.length) {
    console.log('❌ No hay fase de Comisión. Todas las fases:');
    todasFases.forEach(f => console.log(' -', f.id, ':', f.nombre));
    return;
  }

  // 2. Fields in comision phase
  for (const fase of fases) {
    const campos = await query('admin_campos_formulario', 'id,etiqueta,tipo,fase_id', `fase_id=eq.${fase.id}`);
    console.log(`\n2. CAMPOS EN FASE "${fase.nombre}" (id=${fase.id}):`, JSON.stringify(campos, null, 2));
  }

  // 3. Project schema - check what vendor/tech fields exist
  const proyectos = await query('proyectos_dinamicos', 'id,nombre,cliente_id,tecnico_id,responsable_id,vendedor_asignado_id,fase_id,estado');
  console.log('\n3. MUESTRA PROYECTOS (3):');
  proyectos.slice(0,3).forEach(p => {
    console.log('  -', p.nombre, '| cliente_id:', p.cliente_id, '| tecnico_id:', p.tecnico_id, '| responsable_id:', p.responsable_id, '| vendedor_asignado_id:', p.vendedor_asignado_id);
  });

  // 4. Last file upload responses
  const respuestas = await query('respuestas_dinamicas', 'id,proyecto_id,campo_id,valor', 'valor=ilike.http*&order=id.desc');
  console.log('\n4. ÚLTIMAS RESPUESTAS CON URL (últimas 10):');
  respuestas.slice(0,10).forEach(r => console.log('  campo_id:', r.campo_id, '| proyecto_id:', r.proyecto_id, '| url:', (r.valor||'').substring(0,80)));

  // 5. recibos_pagos table
  const recibos = await query('recibos_pagos', '*', 'order=id.desc');
  console.log('\n5. TABLA recibos_pagos (últimos 5):');
  if (recibos.length === 0) console.log('  ⚠️  TABLA VACÍA');
  else recibos.slice(0,5).forEach(r => console.log('  -', JSON.stringify(r)));

  // 6. clients - check adjuntos_oficina
  const clientes = await query('clientes_maestro', 'id,nombre,adjuntos_oficina', 'adjuntos_oficina=not.is.null&limit=5');
  console.log('\n6. CLIENTES CON adjuntos_oficina:');
  if (!clientes.length) console.log('  ⚠️  Ningún cliente tiene adjuntos_oficina');
  else clientes.forEach(c => console.log('  -', c.nombre, ':', JSON.stringify(c.adjuntos_oficina)));
}

main().catch(e => console.error('FATAL:', e.message));

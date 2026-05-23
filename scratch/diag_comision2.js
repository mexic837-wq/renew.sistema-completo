// Deep diagnostic - node scratch/diag_comision2.js
const fs = require('fs');
const server = fs.readFileSync('server.js', 'utf8');

const GATEWAY = 'https://gateway.renewgroup.site';

// Extract key differently - find JWT tokens
const jwtMatches = server.match(/eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g);
const KEY = jwtMatches ? jwtMatches[0] : '';
console.log('JWT KEY found:', !!KEY);

const headers = {
  'apikey': KEY,
  'Authorization': `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function query(table, select, filter) {
  const url = `${GATEWAY}/rest/v1/${table}?select=${select||'*'}${filter ? '&' + filter : ''}&limit=20`;
  const res = await fetch(url, { headers });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Error ${res.status} en ${table}:`, body.substring(0, 200));
    return [];
  }
  try { return JSON.parse(body); } catch(e) { console.error('JSON parse error:', e.message); return []; }
}

async function main() {
  console.log('\n=== DIAGNÓSTICO PROFUNDO ===\n');

  // 1. Check real columns of proyectos_dinamicos
  const proy1 = await query('proyectos_dinamicos', '*', 'limit=1');
  if (proy1.length > 0) {
    console.log('1. COLUMNAS DE proyectos_dinamicos:');
    console.log(Object.keys(proy1[0]).join(', '));
    console.log('\nSAMPLE:', JSON.stringify(proy1[0], null, 2).substring(0, 600));
  }

  // 2. Check columns of respuestas_dinamicas
  const resp1 = await query('respuestas_dinamicas', '*', 'limit=1');
  if (resp1.length > 0) {
    console.log('\n2. COLUMNAS DE respuestas_dinamicas:');
    console.log(Object.keys(resp1[0]).join(', '));
    console.log('\nSAMPLE:', JSON.stringify(resp1[0], null, 2));
  }

  // 3. Get respuestas for comision campos specifically
  const comisionCampoIds = ['campo_campo_241_vohi', 'campo_campo_2411_zxtv'];
  for (const campoId of comisionCampoIds) {
    const respuestas = await query('respuestas_dinamicas', '*', `campo_id=eq.${campoId}&limit=10`);
    console.log(`\n3. RESPUESTAS PARA campo ${campoId}:`, respuestas.length ? JSON.stringify(respuestas, null, 2) : '⚠️ VACÍAS');
  }

  // 4. Check columns of recibos_pagos
  const reciboSample = await query('recibos_pagos', '*', 'limit=1');
  if (reciboSample.length > 0) {
    console.log('\n4. COLUMNAS DE recibos_pagos:', Object.keys(reciboSample[0]).join(', '));
  } else {
    // Try to get table info via OPTIONS or introspect
    console.log('\n4. recibos_pagos VACÍA. Intentando introspección...');
    const schemaRes = await fetch(`${GATEWAY}/rest/v1/recibos_pagos?limit=0`, { headers });
    const ct = schemaRes.headers.get('content-type');
    console.log('   Status:', schemaRes.status, '| Content-Type:', ct);
  }

  // 5. Check if there's an endpoint for /api/db to understand the live data
  console.log('\n5. Verificando API local en servidor...');
  try {
    const local = await fetch('http://localhost:3010/api/fases?pipeline=pip_water');
    const body = await local.json();
    console.log('   Fases water:', JSON.stringify(body).substring(0, 300));
  } catch(e) {
    console.log('   ⚠️ Servidor local no disponible:', e.message);
  }
}

main().catch(e => console.error('FATAL:', e));

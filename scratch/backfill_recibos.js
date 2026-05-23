// Backfill receipts - node scratch/backfill_recibos.js
// Sincroniza los recibos que ya están en respuestas_dinamicas hacia recibos_pagos y adjuntos_oficina

const fs = require('fs');
const server = fs.readFileSync('server.js', 'utf8');
const jwtMatches = server.match(/eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g);
const KEY = jwtMatches ? jwtMatches[0] : '';
const GATEWAY = 'https://gateway.renewgroup.site';

const headers = {
  'apikey': KEY,
  'Authorization': `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function query(table, select, filter) {
  const url = `${GATEWAY}/rest/v1/${table}?select=${select||'*'}${filter ? '&' + filter : ''}`;
  const res = await fetch(url, { headers });
  const body = await res.text();
  if (!res.ok) { console.error(`Error ${res.status} en ${table}:`, body.substring(0, 300)); return []; }
  return JSON.parse(body);
}

async function upsert(table, records) {
  const res = await fetch(`${GATEWAY}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(records)
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Error upserting ${table}:`, body.substring(0, 300));
    return false;
  }
  return true;
}

async function main() {
  console.log('\n=== BACKFILL RECIBOS DE COMISIÓN ===\n');

  // Los dos campos de la fase de Comisión
  const COMISION_CAMPOS = {
    'campo_campo_241_vohi': 'tecnico',   // "Recibo de Instalación Técnico"
    'campo_campo_2411_zxtv': 'vendedor'  // "Recibo de Comisión Vendedor"
  };

  // Fetch all needed data
  const [proyectos, clientes, usuarios, existingRecibos] = await Promise.all([
    query('proyectos_dinamicos', 'id,cliente_id,responsable_id,tecnico_id'),
    query('clientes_maestro', 'id,nombre,direccion,adjuntos_oficina'),
    query('usuarios', 'id,nombre,apellido'),
    query('recibos_pagos', 'id')
  ]);

  const existingIds = new Set(existingRecibos.map(r => r.id));
  const proyMap = Object.fromEntries(proyectos.map(p => [p.id, p]));
  const cliMap = Object.fromEntries(clientes.map(c => [c.id, c]));
  const userMap = Object.fromEntries(usuarios.map(u => [u.id, u]));

  let reciboCreados = 0;
  let clientesActualizados = 0;

  for (const [campoId, tipo] of Object.entries(COMISION_CAMPOS)) {
    const respuestas = await query('respuestas_dinamicas', 'id,proyecto_id,campo_id,valor', `campo_id=eq.${campoId}`);
    console.log(`\nCampo ${campoId} (${tipo}): ${respuestas.length} respuestas encontradas`);

    for (const r of respuestas) {
      if (!r.valor || !r.proyecto_id) { console.log('  ⚠️ Skipping - sin valor o proyecto_id'); continue; }

      const proy = proyMap[r.proyecto_id];
      if (!proy) { console.log('  ⚠️ Proyecto no encontrado:', r.proyecto_id); continue; }

      const cli = cliMap[proy.cliente_id];
      if (!cli) { console.log('  ⚠️ Cliente no encontrado:', proy.cliente_id); continue; }

      const isVendedor = tipo === 'vendedor';
      const trabajadorId = isVendedor ? proy.responsable_id : (proy.tecnico_id || proy.responsable_id);
      const user = trabajadorId ? userMap[trabajadorId] : null;
      const trabajadorNom = user ? `${user.nombre || ''} ${user.apellido || ''}`.trim() : 'Staff';
      const clienteNom = cli.nombre || `Cliente ${cli.id}`;

      // 1. Create/update recibo_pago
      const reciboId = `rec_up_${r.proyecto_id}_${isVendedor ? 'v' : 't'}`;
      if (!existingIds.has(reciboId)) {
        const recibo = {
          id: reciboId,
          proyecto_id: r.proyecto_id,
          tipo: tipo,
          trabajador_id: trabajadorId || null,
          trabajador_nombre: trabajadorNom,
          cliente_nombre: clienteNom,
          direccion: cli.direccion || null,
          fecha_recibo: new Date().toISOString().split('T')[0],
          pdf_url: r.valor,
          datos_json: { source: 'backfill', campo_id: campoId }
        };
        const ok = await upsert('recibos_pagos', [recibo]);
        if (ok) {
          console.log(`  ✅ Recibo creado: ${reciboId} → ${clienteNom} (${trabajadorNom})`);
          reciboCreados++;
        }
      } else {
        console.log(`  ℹ️ Recibo ya existe: ${reciboId}`);
      }

      // 2. Update client adjuntos_oficina
      let adjuntos = cli.adjuntos_oficina;
      if (!adjuntos || typeof adjuntos !== 'object' || Array.isArray(adjuntos)) adjuntos = {};
      adjuntos.recibo_url = r.valor;
      if (isVendedor) {
        adjuntos.recibo_vendedor_url = r.valor;
        adjuntos.ultima_comision_fecha = adjuntos.ultima_comision_fecha || new Date().toISOString();
      } else {
        adjuntos.recibo_tecnico_url = r.valor;
        adjuntos.ultima_instalacion_fecha = adjuntos.ultima_instalacion_fecha || new Date().toISOString();
      }

      const res2 = await fetch(`${GATEWAY}/rest/v1/clientes_maestro?id=eq.${cli.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ adjuntos_oficina: adjuntos })
      });
      if (res2.ok) {
        console.log(`  ✅ Cliente actualizado: ${clienteNom} → adjuntos_oficina`);
        clientesActualizados++;
      } else {
        console.error('  ❌ Error actualizando cliente:', await res2.text());
      }
    }
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`✅ Recibos creados: ${reciboCreados}`);
  console.log(`✅ Clientes actualizados: ${clientesActualizados}`);
}

main().catch(console.error);

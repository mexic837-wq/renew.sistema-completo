const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// PON TUS CREDENCIALES REALES AQUÍ
const SUPABASE_URL = 'https://api-renew.0f2zfh.easypanel.host';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.LgwaO10yxM6SN8mDx5uxYyUhx_0jjA3CkfcVMY-AOB0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  global: {
    fetch: (url, options) => {
      const fixedUrl = url.replace('/rest/v1/', '/');
      return fetch(fixedUrl, options);
    }
  }
});

const db = JSON.parse(fs.readFileSync('./db.json', 'utf8'));

async function migrateTable(tableName, data, mapFn) {
  if (!data || data.length === 0) {
    console.log(`⚠️ No hay datos para la tabla ${tableName}`);
    return;
  }

  const mappedData = data.map(mapFn);
  
  try {
    let successCount = 0;
    for (const record of mappedData) {
      const response = await supabase
        .from(tableName)
        .upsert(record, { onConflict: 'id' });

      if (response.error) {
        console.error(`❌ Error en fila de ${tableName} (ID: ${record.id}):`, response.error.message);
      } else {
        successCount++;
      }
    }
    console.log(`✅ ${successCount}/${mappedData.length} registros migrados a ${tableName}`);
  } catch (err) {
    console.error(`❌ Excepción inesperada migrando ${tableName}:`, err);
  }
}

async function runMigration() {
  console.log('🚀 Iniciando migración a Supabase...\n');

  await migrateTable('admin_pipelines', db.Admin_Pipelines, (item) => ({
    id: item.id,
    nombre: item.nombre || null,
    icono: item.icono || null,
    color: item.color || null,
    rolesConAcceso: item.rolesConAcceso || null
  }));

  await migrateTable('admin_fases', db.Admin_Fases, (item) => ({
    id: item.id,
    pipeline_id: item.pipeline_id || null,
    orden: item.orden || null,
    nombre: item.nombre || null,
    rol_encargado: item.rol_encargado || null
  }));

  await migrateTable('admin_campos_formulario', db.Admin_Campos_Formulario, (item) => ({
    id: item.id,
    fase_id: item.fase_id || null,
    etiqueta: item.etiqueta || null,
    tipo: item.tipo || null,
    opciones: item.opciones || null
  }));

  await migrateTable('usuarios', db.Usuarios, (item) => ({
    id: item.id,
    nombre: item.nombre || null,
    apellido: item.apellido || null,
    email: item.email || null,
    dob: item.dob || null,
    rol: item.rol || null,
    department: item.department || null
  }));

  await migrateTable('clientes_maestro', db.Clientes_Maestro, (item) => ({
    id: item.id,
    nombre: item.nombre || null,
    email: item.email || null,
    telefono: item.telefono || null,
    direccion: item.direccion || null,
    zip: item.zip || null,
    state_id: item.state_id || null,
    dob: item.dob || null,
    empresa: item.empresa || null,
    estado: item.estado || null,
    foto: item.foto || null,
    licencia: item.licencia || null,
    notas: item.notas || null,
    fecha: item.fecha || null,
    foto_id: item.foto_id || null,
    archivos_adjuntos: item.archivos_adjuntos || null
  }));

  await migrateTable('proyectos_dinamicos', db.Proyectos_Dinamicos, (item) => ({
    id: item.id,
    cliente_id: item.cliente_id || null,
    pipeline_id: item.pipeline_id || null,
    fase_id: item.fase_id || null,
    responsable_id: item.responsable_id || null,
    fecha: item.fecha || null
  }));

  await migrateTable('respuestas_dinamicas', db.Respuestas_Dinamicas, (item) => ({
    id: item.id,
    proyecto_id: item.proyecto_id || null,
    campo_id: item.campo_id || null,
    valor: item.valor || null
  }));

  console.log('\n🎉 ¡Migración completada!');
}

runMigration();

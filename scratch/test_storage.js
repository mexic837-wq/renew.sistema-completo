const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyY2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjQwNTIyODAwMH0.LgwaO10yxM6SN8mDx5uxYyUhx_0jjA3CkfcVMY-AOB0';
const BASIC_AUTH = 'Basic YWRtaW46UmVuZXcxMjMl';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  global: {
    fetch: (url, options) => {
      options.headers = {
        ...options.headers,
        'Authorization': BASIC_AUTH,
        'apikey': SUPABASE_KEY
      };
      return fetch(url, options);
    }
  }
});

async function testStorage() {
    console.log('Probando acceso a Storage (Bucket: archivos_renew)...');
    
    // 1. Listar buckets para ver si existe
    const { data: buckets, error: bError } = await supabase.storage.listBuckets();
    if (bError) {
        console.error('❌ Error al listar buckets:', bError.message);
        return;
    }
    
    console.log('Buckets encontrados:', buckets.map(b => b.name));
    const exists = buckets.find(b => b.name === 'archivos_renew');
    
    if (!exists) {
        console.error('❌ EL BUCKET "archivos_renew" NO EXISTE EN ESTA INSTANCIA.');
        console.log('Intentando crearlo...');
        const { error: cErr } = await supabase.storage.createBucket('archivos_renew', { public: true });
        if (cErr) console.error('❌ No se pudo crear el bucket:', cErr.message);
        else console.log('✅ Bucket creado con éxito.');
    } else {
        console.log('✅ El bucket "archivos_renew" ya existe.');
    }

    // 2. Intentar subir un archivo de prueba
    console.log('Subiendo archivo de prueba...');
    const { error: uErr } = await supabase.storage
        .from('archivos_renew')
        .upload('test.txt', 'Hola Mundo', { contentType: 'text/plain', upsert: true });

    if (uErr) {
        console.error('❌ Error al subir archivo:', uErr.message);
    } else {
        console.log('✅ ARCHIVO SUBIDO CON ÉXITO.');
    }
}

testStorage();

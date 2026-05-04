const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTQwMDAwMDAsImV4cCI6MjAyODQxNjAwMH0.LgwaO10yxM6SN8mDx5uxYyUhx_0jjA3CkfcVMY-AOB0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function testFinal() {
    console.log('Probando conexión FINAL con llaves nuevas...');
    
    // 1. Probar base de datos
    const { count, error: dErr } = await supabase.from('usuarios').select('*', { count: 'exact', head: true });
    if (dErr) console.error('❌ Error DB:', dErr.message);
    else console.log('✅ Base de datos OK. Usuarios:', count);

    // 2. Probar Storage
    const { data: buckets, error: sErr } = await supabase.storage.listBuckets();
    if (sErr) console.error('❌ Error Storage:', sErr.message);
    else {
        console.log('✅ Storage OK. Buckets:', buckets.map(b => b.name));
        
        // Intentar subir archivo de prueba
        const { error: uErr } = await supabase.storage.from('archivos_renew').upload('test_final.txt', 'Prueba final exitosa', { upsert: true });
        if (uErr) console.error('❌ Error subiendo archivo:', uErr.message);
        else console.log('✅ ¡SUBIDA DE ARCHIVOS FUNCIONA PERFECTAMENTE!');
    }
}
testFinal();

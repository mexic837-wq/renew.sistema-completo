const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MDQ4MDAwMDAsImV4cCI6MjUyODQ4MDAwMH0.KvxyKyMOZPu4RBhI_TKMsearLjskqC08kRj-krd6ZqI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function testFinal() {
    console.log('Probando acceso con la llave GENERADA...');
    
    const { count, error: dErr } = await supabase.from('usuarios').select('*', { count: 'exact', head: true });
    if (dErr) {
        console.error('❌ Falló con la llave generada:', dErr.message);
    } else {
        console.log('✅ ¡ACCESO CONCEDIDO! Usuarios en DB:', count);
        
        const { data: buckets, error: sErr } = await supabase.storage.listBuckets();
        if (sErr) console.error('❌ Error Storage:', sErr.message);
        else console.log('✅ STORAGE ACCESIBLE. Buckets:', buckets.map(b => b.name));
    }
}
testFinal();

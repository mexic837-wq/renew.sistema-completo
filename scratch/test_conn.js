const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://supabase.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyY2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjQwNTIyODAwMH0.LgwaO10yxM6SN8mDx5uxYyUhx_0jjA3CkfcVMY-AOB0';
const BASIC_AUTH = 'Basic YWRtaW46UmVuZXcxMjMl';

async function test() {
    console.log('Probando conexión con headers combinados...');
    
    // Intentamos una petición manual primero para ver el status real
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=count`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': BASIC_AUTH
            }
        });
        
        console.log('Status de respuesta:', response.status);
        const text = await response.text();
        console.log('Inicio de la respuesta:', text.substring(0, 200));
        
        if (response.ok) {
            console.log('✅ ¡ÉXITO! La combinación de apikey + Basic Auth funciona.');
        } else {
            console.log('❌ Falló con status:', response.status);
        }
    } catch (err) {
        console.error('Error en fetch:', err);
    }
}

test();

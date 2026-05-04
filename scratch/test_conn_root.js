const SUPABASE_URL = 'https://supabase.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyY2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjQwNTIyODAwMH0.LgwaO10yxM6SN8mDx5uxYyUhx_0jjA3CkfcVMY-AOB0';
const BASIC_AUTH = 'Basic YWRtaW46UmVuZXcxMjMl';

async function test() {
    console.log('Probando conexión en la raíz (sin /rest/v1/)...');
    
    try {
        const response = await fetch(`${SUPABASE_URL}/usuarios?select=count`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': BASIC_AUTH
            }
        });
        
        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Respuesta:', text.substring(0, 100));
        
        if (response.ok) console.log('✅ ¡CONECTADO EN LA RAÍZ!');
    } catch (err) {
        console.error('Error:', err);
    }
}
test();

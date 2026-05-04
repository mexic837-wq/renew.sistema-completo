const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyY2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjQwNTIyODAwMH0.LgwaO10yxM6SN8mDx5uxYyUhx_0jjA3CkfcVMY-AOB0';

async function test() {
    console.log('Probando base de datos SIN contraseña de Nginx...');
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=count`, {
            headers: { 'apikey': SUPABASE_KEY }
        });
        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Respuesta:', text);
        
        if (response.ok) console.log('✅ ¡FUNCIONA SIN CONTRASEÑA DE NGINX!');
        else console.log('❌ Requiere autenticación.');
    } catch (err) {
        console.error('Error:', err.message);
    }
}
test();

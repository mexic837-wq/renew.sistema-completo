const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyY2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjQwNTIyODAwMH0.LgwaO10yxM6SN8mDx5uxYyUhx_0jjA3CkfcVMY-AOB0';

async function test() {
    console.log('Probando listar buckets SIN contraseña...');
    try {
        const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
            headers: { 
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}` // Usamos el token como Bearer
            }
        });
        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Respuesta:', data);
        
        if (response.ok) console.log('✅ STORAGE FUNCIONA CORRECTAMENTE.');
    } catch (err) {
        console.error('Error:', err.message);
    }
}
test();

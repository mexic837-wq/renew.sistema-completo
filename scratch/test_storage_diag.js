const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyY2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjQwNTIyODAwMH0.LgwaO10yxM6SN8mDx5uxYyUhx_0jjA3CkfcVMY-AOB0';
const BASIC_AUTH = 'Basic YWRtaW46UmVuZXcxMjMl';

async function test() {
    console.log('1. Probando Storage con apikey solamente (¿Nginx nos deja pasar?)...');
    try {
        const res1 = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
            headers: { 'apikey': SUPABASE_KEY }
        });
        console.log('Resultado 1 (Sin Basic Auth):', res1.status);
    } catch (e) { console.log('Error 1:', e.message); }

    console.log('\n2. Probando Storage con apikey + Basic Auth...');
    try {
        const res2 = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
            headers: { 
                'apikey': SUPABASE_KEY,
                'Authorization': BASIC_AUTH
            }
        });
        console.log('Resultado 2 (Con Basic Auth):', res2.status);
        const text = await res2.text();
        console.log('Mensaje:', text);
    } catch (e) { console.log('Error 2:', e.message); }
}
test();

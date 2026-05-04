const SUPABASE_URL = 'https://gateway.renewgroup.site';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzA0ODAwMDAwLCJleHAiOjI1Mjg0ODAwMDB9.QJ7fQoOUjZQzVuDcEn6lZGRKjHNQuEm6ikya2eBNfLo';

async function test() {
    console.log('Probando ANON_KEY...');
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=count`, {
            headers: { 'apikey': ANON_KEY }
        });
        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Respuesta:', text);
    } catch (err) {
        console.error('Error:', err.message);
    }
}
test();

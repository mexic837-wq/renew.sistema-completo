
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://31.97.102.243:8001';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.JlrSkGO6ZyAaaToY0xTLajbLsNuL8kn2QwCI3jrCeFs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
    console.log('Testing connection to mensajes_internos...');
    try {
        const { data, error } = await supabase.from('mensajes_internos').select('*');
        if (error) {
            console.error('Error fetching mensajes_internos:', error);
        } else {
            console.log('Success! Messages count:', data.length);
            console.log('Messages:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error('Connection error:', e);
    }
}

test();

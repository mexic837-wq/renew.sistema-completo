const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'http://31.97.102.243:8001'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.JlrSkGO6ZyAaaToY0xTLajbLsNuL8kn2QwCI3jrCeFs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
    const payload = {
        id: 'ev-test-123',
        nombre: 'Test Event',
        fecha_inicio: new Date().toISOString(),
        fecha_fin: null,
        direccion: '123 Test',
        descripcion: 'Test Desc',
        color: 'Verde',
        colaboradores: [JSON.stringify({id: 'u1', nombre: 'Test'})],
        attendees: [],
        adjunto_url: null,
        created_at: new Date().toISOString()
    };
    
    console.log("Upserting:", payload);
    
    const { data, error } = await supabase.from('calendario_eventos').upsert([payload]);
    
    if (error) {
        console.error("UPSERT ERROR:", error);
    } else {
        console.log("UPSERT SUCCESS:", data);
    }
}

test();

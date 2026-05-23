const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.JlrSkGO6ZyAaaToY0xTLajbLsNuL8kn2QwCI3jrCeFs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function testInsert() {
    const { error } = await supabase.from('clientes_maestro').upsert({
        id: 'cli_test_123',
        nombre: 'Test',
        departamentos_activos: ["Water"]
    });
    console.log("Upsert 1 (Array) error:", error);

    const { error: error2 } = await supabase.from('clientes_maestro').upsert({
        id: 'cli_test_456',
        nombre: 'Test',
        fecha_creacion: new Date().toISOString()
    });
    console.log("Upsert 2 (fecha_creacion) error:", error2);
}
testInsert();

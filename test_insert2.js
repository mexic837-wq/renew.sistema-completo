const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.JlrSkGO6ZyAaaToY0xTLajbLsNuL8kn2QwCI3jrCeFs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function testInsert() {
    const mapped = {
        id: 'cli_test_999', 
        nombre: 'Jane Doe', 
        email: 'jane@example.com', 
        telefono: '1234567890',
        direccion: '123 Test St', 
        zip: 'Pendiente', 
        state_id: 'FL', 
        dob: '1990-01-01',
        empresa: 'Renew Water', 
        estado: 'Lead', 
        foto: null, 
        licencia: null,
        notas: null, 
        fecha: null, 
        archivos_adjuntos: null,
        origen_tipo: null,
        origen_nombre: null,
        origen_id: null,
        vendedor_asignado_id: null,
        vendedor_asignado_nombre: null,
        departamento: 'Water',
        adjunto_id_url: null,
        adjunto_bill_url: null,
        adjunto_seguro_url: null,
        macro_estado: 'Prospecto',
        departamentos_activos: ['Water'],
        fecha_inicio: null,
        google_place_id: null,
    };

    const { error } = await supabase.from('clientes_maestro').upsert([mapped], { onConflict: 'id' });
    console.log("Upsert mapped object error:", error);
}
testInsert();

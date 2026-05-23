const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.JlrSkGO6ZyAaaToY0xTLajbLsNuL8kn2QwCI3jrCeFs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function testSync() {
    // 1. Fetch from Supabase directly to simulate GET /api/db mapping
    const { data: clients } = await supabase.from('clientes_maestro').select('*');
    
    // Simulate mapping from GET /api/db
    const mappedClients = clients.map(c => ({
        ...c,
        origen_id: c.origen_id || null,
        creador_id: c.origen_id || null,
        departamentos_activos: c.departamentos_activos || []
    }));

    // Add new client
    mappedClients.push({
        id: 'cli_9999',
        nombre: 'TEST PROSPECT',
        estado: 'Lead',
        fecha_creacion: new Date().toISOString(),
        departamentos_activos: [],
        departamento: null
    });

    // 2. Map like POST /api/db does
    const cli = mappedClients.map(item => {
        return {
            id: item.id, 
            nombre: item.nombre || null, 
            email: item.email || null, 
            telefono: item.telefono || null,
            direccion: item.direccion || null, 
            zip: item.zip || null, 
            state_id: item.state_id || null, 
            dob: item.dob || null,
            empresa: item.empresa || null, 
            estado: item.estado || null, 
            foto: item.foto || null, 
            licencia: item.licencia || null,
            notas: item.notas || null, 
            fecha: item.fecha || null, 
            archivos_adjuntos: item.archivos_adjuntos || null,
            origen_tipo:              item.origen_tipo              || null,
            origen_nombre:            item.origen_nombre            || null,
            origen_id:                item.origen_id                || item.creador_id || null,
            vendedor_asignado_id:     item.vendedor_asignado_id     || item.responsable_id || null,
            vendedor_asignado_nombre: item.vendedor_asignado_nombre || null,
            departamento:       item.departamento       || null,
            adjunto_id_url:     item.adjunto_id_url     || null,
            adjunto_bill_url:   item.adjunto_bill_url   || null,
            adjunto_seguro_url: item.adjunto_seguro_url || null,
            macro_estado:       item.macro_estado       || null,
            departamentos_activos: item.departamentos_activos || [],
            fecha_inicio:       item.fecha_inicio       || null,
            google_place_id:    item.google_place_id    || null,
        };
    });

    console.log("Upserting " + cli.length + " clients");
    const { error } = await supabase.from('clientes_maestro').upsert(cli, { onConflict: 'id' });
    console.log("Error:", error);
}

testSync();

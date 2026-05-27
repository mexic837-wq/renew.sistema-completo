const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.JlrSkGO6ZyAaaToY0xTLajbLsNuL8kn2QwCI3jrCeFs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function fixVendedorAsignado() {
    const { data: clients } = await supabase.from('clientes_maestro').select('*');
    
    let updated = clients.map(c => {
        let changed = false;
        let newClient = { ...c };
        
        if (newClient.origen_id && !newClient.vendedor_asignado_id) {
            newClient.vendedor_asignado_id = newClient.origen_id;
            changed = true;
        }
        
        if (newClient.origen_id && !newClient.creador_id) {
            newClient.creador_id = newClient.origen_id;
            changed = true;
        }
        
        if (changed) return newClient;
        return null;
    }).filter(Boolean);

    if (updated.length > 0) {
        console.log('Updating vendedor_asignado_id for', updated.length, 'clients...');
        await supabase.from('clientes_maestro').upsert(updated, { onConflict: 'id' });
        console.log('Done!');
    } else {
        console.log('No clients to update');
    }
}
fixVendedorAsignado();

const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.JlrSkGO6ZyAaaToY0xTLajbLsNuL8kn2QwCI3jrCeFs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function fixOrigins() {
    const { data: users } = await supabase.from('usuarios').select('id, nombre, apellido');
    const { data: clients } = await supabase.from('clientes_maestro').select('*');
    
    let updated = clients.map(c => {
        if (!c.origen_tipo && c.vendedor_asignado_id) {
            const user = users.find(u => u.id === c.vendedor_asignado_id);
            if (user) {
                return {
                    ...c,
                    origen_tipo: 'vendedor',
                    origen_id: user.id,
                    origen_nombre: `${user.nombre || ''} ${user.apellido || ''}`.trim()
                };
            }
        }
        return null;
    }).filter(Boolean);

    if (updated.length > 0) {
        console.log('Updating origins for', updated.length, 'clients...');
        await supabase.from('clientes_maestro').upsert(updated, { onConflict: 'id' });
        console.log('Done!');
    } else {
        console.log('No clients to update');
    }
}
fixOrigins();

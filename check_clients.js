const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.JlrSkGO6ZyAaaToY0xTLajbLsNuL8kn2QwCI3jrCeFs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function checkClients() {
    const { data, error } = await supabase.from('clientes_maestro').select('*');
    if (error) console.log("Error:", error);
    else {
        console.log("Total clients in Supabase:", data.length);
        console.log(data.map(d => ({ id: d.id, nombre: d.nombre })));
    }
}
checkClients();

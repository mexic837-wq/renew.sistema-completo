const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.JlrSkGO6ZyAaaToY0xTLajbLsNuL8kn2QwCI3jrCeFs';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkHistory() {
    const { data } = await supabase.from('call_center_prospectos').select('id, telefono, historial_llamadas');
    console.log(JSON.stringify(data.filter(l => l.historial_llamadas && l.historial_llamadas.length > 0), null, 2));
}

checkHistory();

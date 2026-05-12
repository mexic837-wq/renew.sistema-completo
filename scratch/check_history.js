const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://31.97.102.243:8001';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.JlrSkGO6ZyAaaToY0xTLajbLsNuL8kn2QwCI3jrCeFs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkHistorySchema() {
    const { data, error } = await supabase.from('historial_inventario').select('*').limit(1);
    if (error) {
        console.error("Error:", error.message);
    } else if (data && data.length > 0) {
        console.log("Historial columns:", Object.keys(data[0]));
    } else {
        console.log("No records found in historial_inventario");
    }
}

checkHistorySchema();

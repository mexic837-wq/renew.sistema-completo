const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MDQ4MDAwMDAsImV4cCI6MjUyODQ4MDAwMH0.KvxyKyMOZPu4RBhI_TKMsearLjskqC08kRj-krd6ZqI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function cleanup() {
    console.log("Deleting all records from 'water_productos' to start fresh...");
    
    // Deleting with a filter that matches everything (e.g. id != '')
    const { error } = await supabase.from('water_productos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error) {
        console.error("Error deleting data:", error.message);
        return;
    }
    
    console.log("Success! Table cleared. Now run the injection script.");
}

cleanup();

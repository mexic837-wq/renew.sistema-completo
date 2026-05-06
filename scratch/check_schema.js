const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    console.log("Checking columns of 'water_productos'...");
    
    // Fetch one row to see keys
    const { data, error } = await supabase.from('water_productos').select('*').limit(1);
    
    if (error) {
        console.error("Error fetching data:", error.message);
        return;
    }
    
    if (data.length > 0) {
        console.log("Columns found in database row:", Object.keys(data[0]));
    } else {
        console.log("No data in table to check columns.");
    }
}

checkColumns();

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.JlrSkGO6ZyAaaToY0xTLajbLsNuL8kn2QwCI3jrCeFs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function cleanup() {
    console.log('Iniciando limpieza de leads importados con errores...');
    
    const { data, error, count } = await supabase
        .from('call_center_prospectos')
        .delete({ count: 'exact' })
        .eq('fuente', 'importacion_csv');

    if (error) {
        console.error('Error al eliminar leads:', error);
    } else {
        console.log(`✅ Se eliminaron ${count} leads con la fuente "importacion_csv".`);
    }
}

cleanup();

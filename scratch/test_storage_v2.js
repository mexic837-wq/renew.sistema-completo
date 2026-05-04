const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gateway.renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MDQ4MDAwMDAsImV4cCI6MjUyODQ4MDAwMH0.KvxyKyMOZPu4RBhI_TKMsearLjskqC08kRj-krd6ZqI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testUpload() {
    console.log('--- TEST STORAGE V2 ---');
    const bucket = 'archivos_renew';
    const filePath = 'test-' + Date.now() + '.txt';
    const content = Buffer.from('Hello Supabase');

    console.log(`Subiendo a bucket "${bucket}" ruta "${filePath}"...`);
    
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(filePath, content, {
                contentType: 'text/plain',
                upsert: true
            });

        if (error) {
            console.error('❌ ERROR AL SUBIR:', JSON.stringify(error, null, 2));
            return;
        }

        console.log('✅ SUBIDA EXITOSA:', data);

        const { data: publicUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);
        
        console.log('🔗 URL PÚBLICA:', publicUrlData.publicUrl);

    } catch (err) {
        console.error('❌ ERROR CRÍTICO:', err);
    }
}

testUpload();

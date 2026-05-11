const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://31.97.102.243:8001';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MDQ4MDAwMDAsImV4cCI6MjUyODQ4MDAwMH0.KvxyKyMOZPu4RBhI_TKMsearLjskqC08kRj-krd6ZqI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
    console.log('Testing upload to Supabase Storage...');
    // ...
    const buffer = Buffer.from('dummy-profile-photo');
    const { data, error } = await supabase.storage
        .from('archivos_renew')
        .upload('profiles/test-' + Date.now() + '.png', buffer, {
            contentType: 'image/png',
            upsert: true
        });

    if (error) {
        console.error('Upload failed:', error);
    } else {
        console.log('Upload success:', data);
        
        // Test GET
        console.log('Testing GET with auth...');
        const { data: fileData, error: getError } = await supabase.storage
            .from('archivos_renew')
            .download(data.path);
            
        if (getError) {
            console.error('GET failed:', getError);
        } else {
            console.log('GET success, size:', fileData.size);
        }
    }
}

test();

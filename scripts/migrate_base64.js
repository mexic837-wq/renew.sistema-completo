const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://api-renew.0f2zfh.easypanel.host';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.LgwaO10yxM6SN8mDx5uxYyUhx_0jjA3CkfcVMY-AOB0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    fetch: (url, options) => {
      let fixedUrl = url;
      if (url.includes('/rest/v1/')) {
          fixedUrl = url.replace('/rest/v1/', '/');
      } else if (url.includes('/storage/v1/')) {
          fixedUrl = url.replace('api-renew', 'files-renew').replace('/storage/v1/', '/');
      }
      return fetch(fixedUrl, options);
    }
  }
});

async function migrate() {
    console.log('Starting migration of Base64 blobs to Storage...');

    // 1. Clientes_Maestro
    console.log('Fetching Clientes_Maestro...');
    const { data: clients, error: cliError } = await supabase.from('clientes_maestro').select('*');
    if (cliError) return console.error('Error fetching clients:', cliError);

    for (const cli of clients) {
        let updated = false;
        const updates = {};

        const fields = ['foto_id', 'id_photo', 'adjunto_id_url', 'adjunto_bill_url', 'adjunto_seguro_url', 'contrato_water_url'];
        
        for (const field of fields) {
            const val = cli[field];
            if (val && val.startsWith('data:')) {
                console.log(`Migrating client ${cli.id} field ${field}...`);
                const match = val.match(/^data:(.+);base64,(.+)$/);
                if (!match) continue;
                const contentType = match[1];
                const base64Data = match[2];
                const buffer = Buffer.from(base64Data, 'base64');
                const ext = contentType.split('/')[1] || 'bin';
                const fileName = `migration/${cli.id}_${field}_${Date.now()}.${ext}`;

                const { error: uploadError } = await supabase.storage
                    .from('archivos_renew')
                    .upload(fileName, buffer, { contentType, upsert: true });

                if (uploadError) {
                    console.error(`Upload error for client ${cli.id}:`, uploadError);
                } else {
                    const { data: { publicUrl } } = supabase.storage.from('archivos_renew').getPublicUrl(fileName);
                    const finalUrl = publicUrl.replace('api-renew', 'files-renew').replace('/storage/v1/', '/');
                    updates[field] = finalUrl;
                    updated = true;
                }
            }
        }

        if (updated) {
            console.log(`Updating client ${cli.id} in DB...`);
            const { error: upError } = await supabase.from('clientes_maestro').update(updates).eq('id', cli.id);
            if (upError) console.error('Error updating DB:', upError);
        }
    }

    // 2. Respuestas_Dinamicas
    console.log('Fetching Respuestas_Dinamicas...');
    const { data: resps, error: resError } = await supabase.from('respuestas_dinamicas').select('*');
    if (resError) return console.error('Error fetching resps:', resError);

    for (const r of resps) {
        if (r.valor && r.valor.startsWith('data:')) {
            console.log(`Migrating response ${r.id}...`);
            const match = r.valor.match(/^data:(.+);base64,(.+)$/);
            if (!match) continue;
            const contentType = match[1];
            const base64Data = match[2];
            const buffer = Buffer.from(base64Data, 'base64');
            const ext = contentType.split('/')[1] || 'bin';
            const fileName = `migration/resp_${r.id}_${Date.now()}.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from('archivos_renew')
                .upload(fileName, buffer, { contentType, upsert: true });

            if (uploadError) {
                console.error(`Upload error for resp ${r.id}:`, uploadError);
            } else {
                const { data: { publicUrl } } = supabase.storage.from('archivos_renew').getPublicUrl(fileName);
                const finalUrl = publicUrl.replace('api-renew', 'files-renew').replace('/storage/v1/', '/');
                const { error: upError } = await supabase.from('respuestas_dinamicas').update({ valor: finalUrl }).eq('id', r.id);
                if (upError) console.error('Error updating DB:', upError);
            }
        }
    }

    console.log('Migration finished!');
}

migrate();

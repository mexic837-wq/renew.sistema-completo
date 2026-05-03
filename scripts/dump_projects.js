const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://api-renew.0f2zfh.easypanel.host';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.LgwaO10yxM6SN8mDx5uxYyUhx_0jjA3CkfcVMY-AOB0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    fetch: (url, options) => {
      let fixedUrl = url;
      if (url.includes('/rest/v1/')) fixedUrl = url.replace('/rest/v1/', '/');
      return fetch(fixedUrl, options);
    }
  }
});

async function dumpProjects() {
  const { data, error } = await supabase.from('proyectos_dinamicos').select('*');
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  console.log('ALL projects in Supabase:');
  console.table(data.map(p => ({ id: p.id, cliente_id: p.cliente_id })));
}

dumpProjects();

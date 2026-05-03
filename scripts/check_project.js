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

async function checkProject() {
  const proyId = 'PROY-33-4M9Y'; // From user screenshot
  console.log(`Checking project: ${proyId}`);
  
  const { data: proy, error } = await supabase.from('proyectos_dinamicos').select('*').eq('id', proyId).single();
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log('Project Found:', JSON.stringify(proy, null, 2));
}

checkProject();

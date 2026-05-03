const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://api-renew.0f2zfh.easypanel.host';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.LgwaO10yxM6SN8mDx5uxYyUhx_0jjA3CkfcVMY-AOB0';

// Note: The server has a custom fetch to fix URLs, but for schema check we can try direct or proxy
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    fetch: (url, options) => {
      let fixedUrl = url;
      if (url.includes('/rest/v1/')) {
          fixedUrl = url.replace('/rest/v1/', '/');
      }
      return fetch(fixedUrl, options);
    }
  }
});

async function checkSchema() {
  console.log('--- CHECKING SUPABASE SCHEMA ---');
  
  const tables = ['clientes_maestro', 'proyectos_dinamicos', 'respuestas_dinamicas'];
  
  for (const table of tables) {
    console.log(`\nTable: ${table}`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    
    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
      continue;
    }
    
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]).join(', '));
    } else {
      console.log('No data found to infer columns.');
    }
  }
}

checkSchema();

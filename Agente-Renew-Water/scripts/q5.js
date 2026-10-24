const fs=require('fs');
const env=Object.fromEntries(fs.readFileSync('../.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.split('=')[0],l.slice(l.indexOf('=')+1)]));
const {createClient}=require('@supabase/supabase-js');
const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
const c=await sb.from('admin_campos_formulario').select('*').eq('fase_id','fase_35_nol4');
console.log(JSON.stringify(c.error||c.data,null,0));
const f=await sb.from('admin_fases').select('id,rol_encargado,usuarios_especificos');console.log(JSON.stringify(f.data));
})();

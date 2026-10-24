const fs=require('fs');
const env=Object.fromEntries(fs.readFileSync('../.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.split('=')[0],l.slice(l.indexOf('=')+1)]));
const {createClient}=require('@supabase/supabase-js');
const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
const r=await sb.from('respuestas_dinamicas').select('proyecto_id,valor').eq('campo_id','campo_19_0fpc').limit(40);
const ok=(r.data||[]).filter(x=>x.valor&&x.valor!=='EMPTY'&&x.valor.length>20);
console.log(r.error||ok.length, JSON.stringify(ok[0]||null).slice(0,3000));
})();

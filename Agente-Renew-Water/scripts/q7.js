const fs=require('fs');
const env=Object.fromEntries(fs.readFileSync('../.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.split('=')[0],l.slice(l.indexOf('=')+1)]));
const {createClient}=require('@supabase/supabase-js');
const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
const c=await sb.from('clientes_maestro').select('*').limit(400);
if(c.error)return console.log(c.error);
console.log(Object.keys(c.data[0]).join(','));
for(const k of ['estado','status','tipo','unidad','categoria','origen']){ if(k in c.data[0]){const t={};c.data.forEach(x=>t[x[k]]=(t[x[k]]||0)+1);console.log(k,JSON.stringify(t));}}
const p=c.data.find(x=>/prospecto/i.test(JSON.stringify(x)));console.log(JSON.stringify(p).slice(0,900));
})();

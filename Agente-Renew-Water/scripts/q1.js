const fs=require('fs'),path=require('path');
const env=Object.fromEntries(fs.readFileSync('../.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.split('=')[0],l.slice(l.indexOf('=')+1)]));
const {createClient}=require('@supabase/supabase-js');
const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
const s=require('./snapshot.json');
const c=await sb.from('admin_campos_formulario').select('*').eq('fase_id','fase_33_z8j9');
console.log(JSON.stringify(c.error||c.data.map(x=>({id:x.id,n:x.nombre,t:x.tipo,req:x.requerido})),null,0));
const ids=s.proyectos.filter(p=>p.fase_id=='fase_33_z8j9').map(p=>p.id);
const r=await sb.from('respuestas_dinamicas').select('proyecto_id,campo_id,valor').in('proyecto_id',ids);
fs.writeFileSync('resp33.json',JSON.stringify(r.data));
const cnt={};r.data.forEach(x=>{if(/appcred|aplic/i.test(x.campo_id)){const k=x.campo_id+'='+String(x.valor).slice(0,40);cnt[k]=(cnt[k]||0)+1}});console.log(cnt);
})();

const fs=require('fs');
const env=Object.fromEntries(fs.readFileSync('../.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.split('=')[0],l.slice(l.indexOf('=')+1)]));
const {createClient}=require('@supabase/supabase-js');
const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
const s=require('./snapshot.json');
const ids=s.proyectos.filter(p=>p.fase_id=='fase_33_z8j9').map(p=>p.id);
const r=await sb.from('proyectos_dinamicos').select('id,cliente_id,actividad').in('id',ids);
const t={};r.data.forEach(p=>(p.actividad||[]).forEach(a=>t[a.tipo]=(t[a.tipo]||0)+1));console.log(t);
const w=r.data.filter(p=>(p.actividad||[]).some(a=>a.tipo=='FORMULARIO_COMPLETADO'));console.log(w.length);
console.log(JSON.stringify(w[0]&&w[0].actividad).slice(0,600));
fs.writeFileSync('act33.json',JSON.stringify(r.data));
})();

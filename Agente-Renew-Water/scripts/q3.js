const fs=require('fs');
const env=Object.fromEntries(fs.readFileSync('../.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.split('=')[0],l.slice(l.indexOf('=')+1)]));
const {createClient}=require('@supabase/supabase-js');
const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
const rows=require('./act33.json').filter(p=>(p.actividad||[]).some(a=>a.tipo=='FORMULARIO_COMPLETADO'));
const now=new Date().toISOString(),log=[];
for(const p of rows){
 const act=[...(p.actividad||[]),{tipo:'CAMBIO_FASE',label:'Avance automático: Aprobación ? Orden de Trabajo (Aplicación de Crédito completada)',de:'fase_33_z8j9',a:'fase_35_nol4',timestamp:now,responsable_id:'agente-renew-water'}];
 const r=await sb.from('proyectos_dinamicos').update({fase_id:'fase_35_nol4',actividad:act,ultima_actividad:'Avanzado a Orden de Trabajo por Agente'}).eq('id',p.id).eq('fase_id','fase_33_z8j9');
 log.push({id:p.id,cliente:p.cliente_id,ok:!r.error,err:r.error&&r.error.message});
}
fs.writeFileSync('avance_log.json',JSON.stringify(log,null,1));console.log(log.map(l=>l.id+' '+(l.ok?'OK':l.err)).join('\n'));
})();

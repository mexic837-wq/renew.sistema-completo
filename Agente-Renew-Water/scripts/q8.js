const fs=require('fs');
const env=Object.fromEntries(fs.readFileSync('../.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.split('=')[0],l.slice(l.indexOf('=')+1)]));
const {createClient}=require('@supabase/supabase-js');
const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
const c=(await sb.from('clientes_maestro').select('id,nombre,estado,macro_estado,departamento,departamentos_activos,motivo_declinado,vendedor_asignado_id').limit(1000)).data;
const t=(k)=>{const o={};c.forEach(x=>{const v=JSON.stringify(x[k]);o[v]=(o[v]||0)+1});return o};
console.log('macro',t('macro_estado'));console.log('depto',t('departamento'));console.log('deptos_act',t('departamentos_activos'));
console.log('estado x macro',(()=>{const o={};c.forEach(x=>{const k=x.estado+'|'+x.macro_estado;o[k]=(o[k]||0)+1});return o})());
console.log('declinados',c.filter(x=>x.motivo_declinado).length);
const pr=(await sb.from('proyectos_dinamicos').select('cliente_id').eq('pipeline_id','pip_water').is('fecha_cierre',null)).data.map(p=>p.cliente_id);
const set=new Set(pr);console.log('leads water sin proyecto activo',c.filter(x=>x.estado==='Lead'&&!set.has(x.id)).length,'leads con proyecto',c.filter(x=>x.estado==='Lead'&&set.has(x.id)).length);
})();

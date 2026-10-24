const fs=require('fs');
const env=Object.fromEntries(fs.readFileSync('../.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.split('=')[0],l.slice(l.indexOf('=')+1)]));
const {createClient}=require('@supabase/supabase-js');
const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
const c=(await sb.from('clientes_maestro').select('id,nombre,macro_estado,estado,departamento,departamentos_activos,vendedor_asignado_id,vendedor_asignado_nombre,adjuntos_oficina,credit_app_url').ilike('nombre','%prueba de agente%')).data;
console.log(JSON.stringify(c,null,1));
for(const x of c){const u=(await sb.from('usuarios').select('id,nombre,apellido,telefono,is_suspended').eq('id',x.vendedor_asignado_id)).data;console.log(JSON.stringify(u));}
})();

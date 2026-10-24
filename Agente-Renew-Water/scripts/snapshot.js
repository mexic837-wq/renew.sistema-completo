const fs=require('fs'),path=require('path');
const env=Object.fromEntries(fs.readFileSync(path.join(__dirname,'..','.env'),'utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.split('=')[0],l.slice(l.indexOf('=')+1)]));
const {createClient}=require(path.join(__dirname,'..','..','node_modules','@supabase','supabase-js'));
const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
const out={};
const f=await sb.from('admin_fases').select('*').eq('pipeline_id','pip_water');out.fases=f.error?f.error.message:f.data;
const p=await sb.from('proyectos_dinamicos').select('id,cliente_id,fase_id,responsable_id,tecnico_id,fecha_cierre,ultima_actividad').eq('pipeline_id','pip_water');out.proyectos=p.error?p.error.message:p.data;
const u=await sb.from('usuarios').select('id,nombre,apellido,telefono,rol,unidades,is_suspended');out.usuarios=u.error?u.error.message:u.data;
fs.writeFileSync(path.join(__dirname,'snapshot.json'),JSON.stringify(out,null,1));
console.log(Object.keys(out).map(k=>k+':'+(Array.isArray(out[k])?out[k].length:out[k])).join(' | '));
})();

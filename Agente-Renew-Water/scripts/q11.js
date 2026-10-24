const fs=require('fs');
const env=Object.fromEntries(fs.readFileSync('../.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.split('=')[0],l.slice(l.indexOf('=')+1)]));
const {createClient}=require('@supabase/supabase-js');
const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
const f=(await sb.from('admin_fases').select('id,nombre,orden,rol_encargado,usuarios_especificos').eq('pipeline_id','pip_water').order('orden')).data;
const c=(await sb.from('admin_campos_formulario').select('*').in('fase_id',f.map(x=>x.id))).data;
for(const x of f){console.log(`\n#${x.orden} ${x.nombre} [${x.id}] enc=${x.rol_encargado} esp=${JSON.stringify(x.usuarios_especificos)}`);
 c.filter(k=>k.fase_id===x.id).forEach(k=>console.log('   -',k.id,'|',k.etiqueta,'|',k.tipo,'|',JSON.stringify(k.opciones),'|req',k.requerido,k.obligatorio));}
console.log('\ncols campos:',Object.keys(c[0]).join(','));
const u=(await sb.from('usuarios').select('id,nombre,rol,unidades,is_suspended')).data;
const roles={};u.filter(x=>!x.is_suspended).forEach(x=>{const k=String(x.rol);roles[k]=(roles[k]||0)+1});console.log('roles',roles);
const tech=u.filter(x=>/t[eé]cnico/i.test(String(x.rol))&&!x.is_suspended).map(x=>x.id+':'+x.nombre);console.log('tecnicos',tech.join(', '));
})();

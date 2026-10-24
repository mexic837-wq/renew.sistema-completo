const fs=require('fs');
const env=Object.fromEntries(fs.readFileSync('../.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.split('=')[0],l.slice(l.indexOf('=')+1)]));
const {createClient}=require('@supabase/supabase-js');
const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
const clean=t=>String(t||'').replace(/\D/g,'');
(async()=>{
const us=(await sb.from('usuarios').select('id,nombre,apellido,telefono,rol,unidades,is_suspended')).data;
const U=Object.fromEntries(us.map(u=>[u.id,u]));
const ps=(await sb.from('proyectos_dinamicos').select('id,cliente_id,fase_id,responsable_id').eq('pipeline_id','pip_water').eq('fase_id','fase_35_nol4').is('fecha_cierre',null)).data;
const cl=(await sb.from('clientes_maestro').select('id,nombre').in('id',ps.map(p=>p.cliente_id))).data;
const C=Object.fromEntries(cl.map(c=>[c.id,c.nombre]));
const g={};ps.forEach(p=>{(g[p.responsable_id||'SIN']=g[p.responsable_id||'SIN']||[]).push(C[p.cliente_id]||p.cliente_id)});
let out='# Simulación skill 02 (NO enviados)\n\n';
for(const [id,list] of Object.entries(g)){const u=U[id];
 const name=u?u.nombre:'(sin responsable)';const tel=u?clean(u.telefono):'';
 out+=`## Para: ${name} ${u?u.apellido||'':''} — ${tel||'SIN TELÉFONO'}${u&&u.is_suspended?' (SUSPENDIDO, omitir)':''}\n\n`+
 `Hola ${name} ??, soy el asistente de Renew Water. Tienes ${list.length} cliente(s) listos para la *Orden de Trabajo*:\n`+
 list.map((c,i)=>`${i+1}. ${c}`).join('\n')+
 `\n\nPor favor envíame por cada uno: dirección de instalación, equipos/modelo, fecha deseada y notas. Puedes escribirlo en un solo mensaje. ¡Gracias!\n\n`;}
fs.writeFileSync('../proyectos/simulacion_mensajes.md',out);console.log(out);
const bad=us.filter(u=>u.telefono&&!/^\d+$/.test(u.telefono));
const dup=Object.entries(us.reduce((a,u)=>{const k=clean(u.telefono);if(k)(a[k]=a[k]||[]).push(u.nombre);return a},{})).filter(e=>e[1].length>1);
fs.writeFileSync('../proyectos/diagnostico_optimizacion_db.md',`# Diagnóstico DB pip_water (${new Date().toISOString()})\n\n## Campos duplicados en Estación 1 (fase_33_z8j9)\n- Aplicación de Crédito (3): cf_appcred_1785343618103, cf_appcred_1785343615460, cf_appcred_1785343617812\n- Archivo/Comprobante (3): cf_comp_1785255501872, cf_comp_1783111786340, cf_comp_1783111786410\n- Basura: test_probe_field_1788488664246, campo_11_my9v\n- No se borró nada (limpieza destructiva requiere aprobación).\n\n## Proyectos\n- Total pip_water: 140; 72 con fase_id NULL y cerrados (no huérfanos activos); 1 cerrado en fase_37_t6bg.\n- Avance Estación 1?2 ejecutado en 9 proyectos (ver scripts/avance_log.json).\n\n## Usuarios (${us.length})\n- Teléfonos con formato no E.164: ${bad.length}\n- Roles en formato JSON ("[...]"): ${us.filter(u=>String(u.rol).startsWith('[')).length}\n- Teléfonos duplicados: ${dup.length}\n\n## Nota\nEl estado "Completado en Formulario Externo" no existe en respuestas_dinamicas; se detecta por evento FORMULARIO_COMPLETADO en proyectos_dinamicos.actividad.\n`);
})();

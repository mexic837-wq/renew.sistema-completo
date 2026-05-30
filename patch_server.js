const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

const old1 = `                // 1. Buscar en call_center_prospectos
                const { data: leads } = await supabase.from('call_center_prospectos').select('id, telefono, historial_llamadas');
                let foundTarget = false;
                
                if (leads) {
                    const lead = leads.find(l => (l.telefono || '').replace(/\\D/g, '').slice(-10) === cleanPhone);
                    if (lead) {
                        foundTarget = true;
                        const history = lead.historial_llamadas || [];
                        history.push({
                            call_id: call_id_with_rec || null,
                            fecha: new Date().toISOString(),
                            duracion: duration || 0,
                            grabacion_url: null,
                            tipo: (event === 'NOTIFY_END' || event === 'NOTIFY_INTERNAL') ? 'Entrante' : 'Saliente'
                        });
                        await supabase.from('call_center_prospectos').update({ historial_llamadas: history }).eq('id', lead.id);
                        console.log(\`[ZADARMA] Historial guardado para el lead \${lead.id}\`);
                    }
                }
                
                // 2. Si no es un lead, buscar en clientes_maestro
                if (!foundTarget) {
                    const { data: clientes } = await supabase.from('clientes_maestro').select('id, telefono, historial_llamadas');
                    if (clientes) {
                        const cliente = clientes.find(c => (c.telefono || '').replace(/\\D/g, '').slice(-10) === cleanPhone);
                        if (cliente) {
                            const history = cliente.historial_llamadas || [];
                            history.push({
                                call_id: call_id_with_rec || null,
                                fecha: new Date().toISOString(),
                                duracion: duration || 0,
                                grabacion_url: null,
                                tipo: (event === 'NOTIFY_END' || event === 'NOTIFY_INTERNAL') ? 'Entrante' : 'Saliente'
                            });
                            await supabase.from('clientes_maestro').update({ historial_llamadas: history }).eq('id', cliente.id);
                            console.log(\`[ZADARMA] Historial guardado para el CLIENTE \${cliente.id}\`);
                        }
                    }
                }`;

const new1 = `                // 1. Buscar en call_center_prospectos
                const { data: leads } = await supabase.from('call_center_prospectos').select('id, telefono, historial_llamadas');
                
                if (leads) {
                    const matchingLeads = leads.filter(l => (l.telefono || '').replace(/\\D/g, '').slice(-10) === cleanPhone);
                    for (const lead of matchingLeads) {
                        const history = lead.historial_llamadas || [];
                        history.push({
                            call_id: call_id_with_rec || null,
                            fecha: new Date().toISOString(),
                            duracion: duration || 0,
                            grabacion_url: null,
                            tipo: (event === 'NOTIFY_END' || event === 'NOTIFY_INTERNAL') ? 'Entrante' : 'Saliente'
                        });
                        await supabase.from('call_center_prospectos').update({ historial_llamadas: history }).eq('id', lead.id);
                        console.log(\`[ZADARMA] Historial guardado para el lead \${lead.id}\`);
                    }
                }
                
                // 2. Buscar en clientes_maestro
                const { data: clientes } = await supabase.from('clientes_maestro').select('id, telefono, historial_llamadas');
                if (clientes) {
                    const matchingClientes = clientes.filter(c => (c.telefono || '').replace(/\\D/g, '').slice(-10) === cleanPhone);
                    for (const cliente of matchingClientes) {
                        const history = cliente.historial_llamadas || [];
                        history.push({
                            call_id: call_id_with_rec || null,
                            fecha: new Date().toISOString(),
                            duracion: duration || 0,
                            grabacion_url: null,
                            tipo: (event === 'NOTIFY_END' || event === 'NOTIFY_INTERNAL') ? 'Entrante' : 'Saliente'
                        });
                        await supabase.from('clientes_maestro').update({ historial_llamadas: history }).eq('id', cliente.id);
                        console.log(\`[ZADARMA] Historial guardado para el CLIENTE \${cliente.id}\`);
                    }
                }`;

const old2 = `                        // 1. Intentar guardar en leads
                        const { data: leads } = await supabase.from('call_center_prospectos').select('id, historial_llamadas');
                        if (leads) {
                            for (const lead of leads) {
                                if (!lead.historial_llamadas) continue;
                                const callIndex = lead.historial_llamadas.findIndex(h => h.call_id === call_id_with_rec || h.call_id === pbx_call_id);
                                if (callIndex !== -1) {
                                    lead.historial_llamadas[callIndex].grabacion_url = call_record_link;
                                    await supabase.from('call_center_prospectos').update({ historial_llamadas: lead.historial_llamadas }).eq('id', lead.id);
                                    console.log(\`[ZADARMA] Grabación vinculada exitosamente al lead \${lead.id}\`);
                                    recordSaved = true;
                                    break;
                                }
                            }
                        }
                        
                        // 2. Intentar guardar en clientes_maestro
                        if (!recordSaved) {
                            const { data: clientes } = await supabase.from('clientes_maestro').select('id, historial_llamadas');
                            if (clientes) {
                                for (const cliente of clientes) {
                                    if (!cliente.historial_llamadas) continue;
                                    const callIndex = cliente.historial_llamadas.findIndex(h => h.call_id === call_id_with_rec || h.call_id === pbx_call_id);
                                    if (callIndex !== -1) {
                                        cliente.historial_llamadas[callIndex].grabacion_url = call_record_link;
                                        await supabase.from('clientes_maestro').update({ historial_llamadas: cliente.historial_llamadas }).eq('id', cliente.id);
                                        console.log(\`[ZADARMA] Grabación vinculada exitosamente al CLIENTE \${cliente.id}\`);
                                        recordSaved = true;
                                        break;
                                    }
                                }
                            }
                        }`;

const new2 = `                        // 1. Intentar guardar en leads
                        const { data: leads } = await supabase.from('call_center_prospectos').select('id, historial_llamadas');
                        if (leads) {
                            for (const lead of leads) {
                                if (!lead.historial_llamadas) continue;
                                const callIndex = lead.historial_llamadas.findIndex(h => h.call_id === call_id_with_rec || h.call_id === pbx_call_id);
                                if (callIndex !== -1) {
                                    lead.historial_llamadas[callIndex].grabacion_url = call_record_link;
                                    await supabase.from('call_center_prospectos').update({ historial_llamadas: lead.historial_llamadas }).eq('id', lead.id);
                                    console.log(\`[ZADARMA] Grabación vinculada exitosamente al lead \${lead.id}\`);
                                }
                            }
                        }
                        
                        // 2. Intentar guardar en clientes_maestro
                        const { data: clientes } = await supabase.from('clientes_maestro').select('id, historial_llamadas');
                        if (clientes) {
                            for (const cliente of clientes) {
                                if (!cliente.historial_llamadas) continue;
                                const callIndex = cliente.historial_llamadas.findIndex(h => h.call_id === call_id_with_rec || h.call_id === pbx_call_id);
                                if (callIndex !== -1) {
                                    cliente.historial_llamadas[callIndex].grabacion_url = call_record_link;
                                    await supabase.from('clientes_maestro').update({ historial_llamadas: cliente.historial_llamadas }).eq('id', cliente.id);
                                    console.log(\`[ZADARMA] Grabación vinculada exitosamente al CLIENTE \${cliente.id}\`);
                                }
                            }
                        }`;

if (code.includes(old1)) {
    code = code.replace(old1, new1);
    console.log("Replaced 1");
} else {
    console.log("Failed 1");
}

if (code.includes(old2)) {
    code = code.replace(old2, new2);
    console.log("Replaced 2");
} else {
    console.log("Failed 2");
}

fs.writeFileSync('server.js', code, 'utf8');

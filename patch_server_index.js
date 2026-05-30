const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// Replace Block 1: NOTIFY_END logic
const start1 = "// 1. Buscar en call_center_prospectos";
const end1 = "if (event === 'NOTIFY_RECORD') {";

const block1Index1 = code.indexOf(start1);
const block1Index2 = code.indexOf(end1, block1Index1);

if (block1Index1 !== -1 && block1Index2 !== -1) {
    const newBlock1 = `// 1. Buscar en call_center_prospectos
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
                }
            }
        }
        
        // 2. Cuando la grabación está lista, pedimos el link usando la API de Zadarma
        `;
    
    code = code.substring(0, block1Index1) + newBlock1 + code.substring(block1Index2);
    console.log('Replaced block 1');
} else {
    console.log('Could not find bounds for block 1');
}

// Replace Block 2: NOTIFY_RECORD logic
const start2 = "// 1. Intentar guardar en leads";
const end2 = "                    }\n                } catch (e) {";

const block2Index1 = code.indexOf(start2);
const block2Index2 = code.indexOf(end2, block2Index1);

if (block2Index1 !== -1 && block2Index2 !== -1) {
    const newBlock2 = `// 1. Intentar guardar en leads
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
                        }
`;
    
    code = code.substring(0, block2Index1) + newBlock2 + code.substring(block2Index2);
    console.log('Replaced block 2');
} else {
    console.log('Could not find bounds for block 2');
}

fs.writeFileSync('server.js', code, 'utf8');

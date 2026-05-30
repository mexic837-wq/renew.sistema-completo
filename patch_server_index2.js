const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// Replace Block 2: NOTIFY_RECORD logic
const start2 = "                        let recordSaved = false;";
const end2 = "                    } catch(err) {";

const block2Index1 = code.indexOf(start2);
const block2Index2 = code.indexOf(end2, block2Index1);

if (block2Index1 !== -1 && block2Index2 !== -1) {
    const newBlock2 = `                        // 1. Intentar guardar en leads
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

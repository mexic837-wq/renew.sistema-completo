const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const oldStr = `                        let recordSaved = false;
                        
                        // 1. Intentar guardar en leads
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

const newStr = `                        // 1. Intentar guardar en leads
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

// Normalize line endings to avoid issues
const normalizedOld = oldStr.replace(/\\r\\n/g, '\\n');
code = code.replace(/\\r\\n/g, '\\n');

if (code.includes(normalizedOld)) {
    code = code.replace(normalizedOld, newStr.replace(/\\r\\n/g, '\\n'));
    console.log('Replaced via exact match');
} else {
    console.log('Did not find exact match. Try regex fallback...');
    
    // Fallback: Just remove \`recordSaved = true;\` and \`break;\` and \`if (!recordSaved) {\` etc using split/join or small regex
    code = code.replace(/recordSaved = true;\\s+break;/g, '');
    code = code.replace(/if \\(!recordSaved\\) \\{/, '');
    code = code.replace(/let recordSaved = false;/, '');
    // Need to remove the closing bracket of if(!recordSaved) which is tricky with regex.
    console.log('Regex fallback applied - WARNING: check syntax');
}

fs.writeFileSync('server.js', code, 'utf8');

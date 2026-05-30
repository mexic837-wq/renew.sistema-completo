const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const targetRegex = /        if \(db\.Clientes_Maestro\?\.length\) \{[\s\S]*?const clientIds = db\.Clientes_Maestro\.map\(c => c\.id\);[\s\S]*?if \(existingClients\) \{[\s\S]*?existingClients\.forEach\(c => existingMap\[c\.id\] = c\);[\s\S]*?\}/;

const replacementStr = `        if (db.Clientes_Maestro?.length) {
            // Pre-fetch existing clients to merge server-side background data safely (like grabacion_url)
            const clientIds = db.Clientes_Maestro.map(c => c.id);
            const { data: existingClients } = await supabase.from('clientes_maestro').select('id, historial_llamadas').in('id', clientIds);
            const existingMap = {};
            if (existingClients) {
                existingClients.forEach(c => existingMap[c.id] = c);
            }
            
            // Pre-fetch origin Leads for new clients to guarantee we don't lose webhooks that hit the lead before conversion
            const newClientsFromLeads = db.Clientes_Maestro.filter(c => !existingMap[c.id] && c.origen_tipo === 'call_center' && c.origen_id);
            const leadIds = newClientsFromLeads.map(c => c.origen_id);
            const leadMap = {};
            if (leadIds.length > 0) {
                const { data: leadsData } = await supabase.from('call_center_prospectos').select('id, historial_llamadas').in('id', leadIds);
                if (leadsData) {
                    leadsData.forEach(l => leadMap[l.id] = l);
                }
            }`;

if (targetRegex.test(code)) {
    code = code.replace(targetRegex, replacementStr);
    console.log("Replaced block 1");
} else {
    console.log("Failed block 1");
}

const target2Regex = /                \/\/ MERGE historial_llamadas[\s\S]*?if \(item\.historial_llamadas\) \{[\s\S]*?const existing = existingMap\[item\.id\];[\s\S]*?if \(existing && existing\.historial_llamadas\) \{/;

const replacement2Str = `                // MERGE historial_llamadas
                if (item.historial_llamadas) {
                    const existing = existingMap[item.id] || (item.origen_tipo === 'call_center' && leadMap[item.origen_id] ? leadMap[item.origen_id] : null);
                    if (existing && existing.historial_llamadas) {`;

if (target2Regex.test(code)) {
    code = code.replace(target2Regex, replacement2Str);
    console.log("Replaced block 2");
} else {
    console.log("Failed block 2");
}

fs.writeFileSync('server.js', code, 'utf8');

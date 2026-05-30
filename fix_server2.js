const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const anchor = "syncTasks.push(supabase.from('rrhh_adelantos').upsert(cleanAdelantos, { onConflict: 'id' }));";

const block = `
        }

        if (db.Admin_Roles?.length) {
            const cleanRoles = db.Admin_Roles.map(r => ({
                id: r.id,
                nombre: r.nombre || null,
                permisos: r.permisos || {},
                is_base: !!r.is_base,
                created_at: r.created_at || new Date().toISOString()
            }));
            syncTasks.push(supabase.from('admin_roles').upsert(cleanRoles, { onConflict: 'id' }));`;

if (content.includes(anchor) && !content.includes("db.Admin_Roles?.length")) {
    content = content.replace(anchor + "\\n        }", anchor + block);
    // If different formatting
    content = content.replace(anchor + "\\r\\n        }", anchor + block);
    console.log('Appended admin_roles upsert to server.js');
} else {
    console.log('Anchor not found or already has Admin_Roles');
    const idx = content.indexOf(anchor);
    if (idx !== -1) {
        console.log('Anchor found, trying a slice approach...');
        const endBrace = content.indexOf('}', idx);
        if (endBrace !== -1) {
            content = content.slice(0, endBrace + 1) + block.substring(block.indexOf('if')) + content.slice(endBrace + 1);
        }
    }
}

fs.writeFileSync('server.js', content, 'utf8');

const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

const rrhhUpsertStr = "syncTasks.push(supabase.from('rrhh_adelantos').upsert(cleanAdelantos, { onConflict: 'id' }));\n        }";
const adminRolesUpsertStr = `
        if (db.Admin_Roles?.length) {
            const cleanRoles = db.Admin_Roles.map(r => ({
                id: r.id,
                nombre: r.nombre || null,
                permisos: r.permisos || {},
                is_base: !!r.is_base,
                created_at: r.created_at || new Date().toISOString()
            }));
            syncTasks.push(supabase.from('admin_roles').upsert(cleanRoles, { onConflict: 'id' }));
        }`;

if (content.includes(rrhhUpsertStr) && !content.includes("db.Admin_Roles?.length")) {
    content = content.replace(rrhhUpsertStr, rrhhUpsertStr + adminRolesUpsertStr);
    console.log('Appended admin_roles upsert to server.js');
}

// I also need to make sure GET /api/db has admin_roles mapped since I undid it with checkout
content = content.replace("'rrhh_adelantos'", "'rrhh_adelantos', 'admin_roles'");

const adminRolesMapStr = "Admin_Roles:             results[20].data || [],";
const rrhhStr = "rrhh_adelantos:          results[19].data || [],";
if (content.includes(rrhhStr) && !content.includes(adminRolesMapStr)) {
    content = content.replace(rrhhStr, rrhhStr + "\n            " + adminRolesMapStr);
    console.log('Appended admin_roles fetch to server.js');
}

fs.writeFileSync('server.js', content, 'utf8');
console.log('Fixed server.js');

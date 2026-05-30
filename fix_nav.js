const fs = require('fs');
let content = fs.readFileSync('js/admin-app.js', 'utf8');

const targetStr = `    // Role-based visibility for HRHub and Call Center
    const usr = JSON.parse(localStorage.getItem('rs_user') || '{}');
    const rol = (usr.rol || '').toLowerCase();
    
    if (['project manager', 'manager de ventas', 'account manager'].includes(rol)) {
        document.querySelectorAll('#admin-nav a[data-view="hrhub"]').forEach(el => {
            el.style.display = 'none';
        });
    }

    if (!['admin', 'administrador', 'ceo'].includes(rol)) {
        document.querySelectorAll('#admin-nav a[data-view="callcenter"], #admin-nav a[data-view="call_center"], #admin-nav a[data-view="call-center"]').forEach(el => {
            el.style.display = 'none';
        });
    }`;

const newStr = `    // Dynamic Role-based visibility
    const usr = JSON.parse(localStorage.getItem('rs_user') || '{}');
    const db = typeof getDB === 'function' ? getDB() : {};
    
    // Si tenemos la tabla de roles cargada, aplicamos la configuración dinámica
    if (db && db.Admin_Roles && db.Admin_Roles.length > 0) {
        const userRole = db.Admin_Roles.find(r => r.nombre.toLowerCase() === (usr.rol || '').toLowerCase());
        if (userRole && userRole.permisos) {
            const p = userRole.permisos;
            const linkMap = {
                'dashboard': 'constructor', // Dashboard root tab
                'mapa': 'mapa-admin',
                'crm': 'crm',
                'call_center': 'call-center',
                'hrhub': 'hrhub',
                'inventario': 'btn-toggle-inv',
                'lista_precios': 'lista-precios',
                'kanban': 'kanban',
                'academia': 'academia',
                'anuncios': 'anuncios',
                'admin_config': 'roles' // Roles tab
            };
            
            Object.entries(linkMap).forEach(([permKey, dataView]) => {
                const elements = document.querySelectorAll(\`#admin-nav [data-view="\${dataView}"], #admin-nav #\${dataView}\`);
                elements.forEach(el => {
                    if (p[permKey]) {
                        el.style.display = '';
                    } else {
                        el.style.display = 'none';
                    }
                });
            });
        }
    } else {
        // Fallback a lógica fija mientras cargan los roles
        const rol = (usr.rol || '').toLowerCase();
        if (['project manager', 'manager de ventas', 'account manager'].includes(rol)) {
            document.querySelectorAll('#admin-nav a[data-view="hrhub"]').forEach(el => { el.style.display = 'none'; });
        }
        if (!['admin', 'administrador', 'ceo'].includes(rol)) {
            document.querySelectorAll('#admin-nav a[data-view="callcenter"], #admin-nav a[data-view="call_center"], #admin-nav a[data-view="call-center"]').forEach(el => { el.style.display = 'none'; });
        }
    }`;

content = content.replace(targetStr, newStr);
fs.writeFileSync('js/admin-app.js', content, 'utf8');
console.log('Fixed js/admin-app.js navigation visibility');

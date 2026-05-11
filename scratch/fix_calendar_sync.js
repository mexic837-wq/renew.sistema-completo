const fs = require('fs');

const filepath = 'c:\\Users\\LENOVO\\Downloads\\renew-sistema-completo-main\\renew.sistema-completo-main\\js\\admin-app.js';

let content = fs.readFileSync(filepath, 'utf8');

// Match from the start marker until the end of the catch block
const regex = /\/\/ ── SYNC WITH GOOGLE CALENDAR VIA N8N ──[\s\S]*?console\.error\('\[RENEW-GCAL\] Error communicating with sync server:', syncErr\);[\s\S]*?\}/;

if (regex.test(content)) {
    const newLogic = `// ── SYNC WITH GOOGLE CALENDAR VIA N8N ──
    try {
        const currentUser = JSON.parse(localStorage.getItem('rs_user')) || {};
        fetch('https://n8n.renewgroup.site/webhook/calendario-eventos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'create_event',
                source: 'admin_panel',
                user: {
                    id: currentUser.id || 'admin',
                    nombre: \`\${currentUser.nombre || ''} \${currentUser.apellido || ''}\`.trim() || 'Admin',
                    email: currentUser.email || ''
                },
                event: {
                    id: nuevoEvento.id,
                    summary: nombre,
                    location: direccion,
                    description: descripcion,
                    telefono: telefono,
                    start: fecha_inicio,
                    end: fecha_fin || new Date(new Date(fecha_inicio).getTime() + 3600000).toISOString(),
                    color: color,
                    colaboradores: colaboradores,
                    recordatorio: recordatorio
                }
            })
        }).catch(e => console.error('[N8N-SYNC-ERR]', e));
    } catch (n8nErr) {
        console.error('[N8N-ERR]', n8nErr);
    }`;

    const newContent = content.replace(regex, newLogic);
    fs.writeFileSync(filepath, newContent);
    console.log('Success');
} else {
    console.log('Regex did not match');
}

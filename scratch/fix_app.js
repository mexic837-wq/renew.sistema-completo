const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js/app.js');
let content = fs.readFileSync(filePath, 'utf8');

const targetContent = `    // Hide 'Nuevo' for call_center or tecnico
    if (item.classList.contains('nav-item-plus')) {
        item.style.display = (isCallCenter || isTecnico) ? 'none' : 'flex';
    }`;

const replacementContent = `    // Hide 'Nuevo' for call_center or tecnico
    if (item.classList.contains('nav-item-plus')) {
        item.style.display = (isCallCenter || isTecnico) ? 'none' : '';
    }

    // Check permissions for specific static nav items
    if (sc === 'mi-calendario') {
        const canCalendario = (user && user.permisos && 'app_calendario' in user.permisos) ? user.permisos.app_calendario : true;
        if (!canCalendario) {
            item.style.display = 'none';
        } else if (item.style.display === 'none') {
            item.style.display = '';
        }
    }`;

content = content.replace(targetContent, replacementContent);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed app.js');

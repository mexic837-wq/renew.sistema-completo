const fs = require('fs');

function removeTelefono(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    // Remove hide/show/readonly logic
    content = content.replace(/document\.getElementById\('ev-telefono'\)\.classList\.add\('hidden'\);\r?\n\s*/g, '');
    content = content.replace(/document\.getElementById\('ev-telefono'\)\.classList\.remove\('hidden'\);\r?\n\s*/g, '');
    content = content.replace(/document\.getElementById\('ev-telefono'\)\.classList\.add\('nuclear-hidden'\);\r?\n\s*/g, '');
    content = content.replace(/document\.getElementById\('ev-telefono'\)\.classList\.remove\('nuclear-hidden'\);\r?\n\s*/g, '');
    
    content = content.replace(/const linkTel = document\.getElementById\('ev-telefono-link'\);\r?\n\s*linkTel\.classList\.remove\('(hidden|nuclear-hidden)'\);\r?\n\s*linkTel\.href = `tel:\$\{props\.telefono\}`;\r?\n\s*document\.getElementById\('ev-telefono-txt'\)\.textContent = props\.telefono;\r?\n\s*/g, '');
    
    content = content.replace(/document\.getElementById\('ev-telefono'\)\.value = '';\r?\n\s*/g, '');
    content = content.replace(/document\.getElementById\('ev-telefono'\)\.readOnly = true;\r?\n\s*/g, '');
    content = content.replace(/document\.getElementById\('ev-telefono'\)\.readOnly = false;\r?\n\s*/g, '');
    
    content = content.replace(/document\.getElementById\('ev-telefono-link'\)\.classList\.add\('(hidden|nuclear-hidden)'\);\r?\n\s*/g, '');
    content = content.replace(/document\.getElementById\('ev-telefono-link'\)\.classList\.remove\('(hidden|nuclear-hidden)'\);\r?\n\s*/g, '');

    // Replace if (props.telefono) blocks completely
    content = content.replace(/if \(props\.telefono\) \{[\s\S]*?\} else \{[\s\S]*?\}/g, function(match) {
        if(match.includes('ev-telefono-txt')) return '';
        return match;
    });

    // Remove reading the value
    content = content.replace(/const telefono = document\.getElementById\('ev-telefono'\)\.value;\r?\n\s*/g, '');

    // Remove from object properties (this one might need manual checking, but since it's ES6 shorthand `telefono,`)
    content = content.replace(/telefono,\s*/g, '');
    content = content.replace(/telefono: telefono,\s*/g, '');

    // Remove from extendedProps
    content = content.replace(/telefono: ev\.telefono,\r?\n\s*/g, '');

    fs.writeFileSync(filepath, content);
}

removeTelefono('c:\\Users\\LENOVO\\Downloads\\renew-sistema-completo-main\\renew.sistema-completo-main\\js\\admin-app.js');
removeTelefono('c:\\Users\\LENOVO\\Downloads\\renew-sistema-completo-main\\renew.sistema-completo-main\\js\\screens\\calendar.js');

console.log('Telefono logic removed');

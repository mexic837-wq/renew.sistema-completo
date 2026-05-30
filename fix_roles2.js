const fs = require('fs');
let content = fs.readFileSync('js/admin-app.js', 'utf8');

// Remove the wrongly inserted block from inside openKanbanDrawer
const wrongBlock = `  window.populateRolesDropdowns = function() {\n    const db = getDB();\n    const roles = db.Admin_Roles || [];\n    if (!roles.length) return; // Wait for sync or defaults\n\n    const optionsHtml = roles.map(r => \`<option value="\${r.nombre}">\${r.nombre}</option>\`).join('');\n    \n    const inpRol = document.getElementById('inp-usr-rol');\n    if (inpRol) {\n        const val = inpRol.value;\n        inpRol.innerHTML = optionsHtml;\n        if(val) inpRol.value = val;\n    }\n    \n    const detRol = document.getElementById('det-edit-rol');\n    if (detRol) {\n        const val = detRol.value;\n        detRol.innerHTML = optionsHtml;\n        if(val) detRol.value = val;\n    }\n};\n\nwindow.openKanbanDrawer = openKanbanDrawer;\n`;

const correctPlacement = `window.openKanbanDrawer = openKanbanDrawer;\n`;

// Fix: remove the wrongly nested block + duplicate openKanbanDrawer assignment
if (content.includes(wrongBlock + correctPlacement)) {
    content = content.replace(wrongBlock + correctPlacement, correctPlacement);
    console.log('Removed wrong block successfully');
} else {
    // Try a more targeted approach
    const startMarker = '  window.populateRolesDropdowns = function() {\n';
    const endMarker = '\nwindow.openKanbanDrawer = openKanbanDrawer;\n';
    
    const startIdx = content.indexOf(startMarker);
    const endIdx = content.indexOf(endMarker, startIdx);
    
    if (startIdx !== -1 && endIdx !== -1) {
        content = content.slice(0, startIdx) + content.slice(endIdx);
        console.log(`Removed block from index ${startIdx} to ${endIdx}`);
    } else {
        console.log('Pattern not found, trying line-based approach...');
    }
}

// Now add the function AFTER the closing of the file, before the last line
const anchor = 'window.openKanbanDrawer = openKanbanDrawer;';
const lastIdx = content.lastIndexOf(anchor);
if (lastIdx !== -1) {
    const insertPos = lastIdx + anchor.length;
    const newFunc = `

window.populateRolesDropdowns = function() {
    const db = getDB();
    const roles = db.Admin_Roles || [];
    if (!roles.length) return;

    const optionsHtml = roles.map(r => \`<option value="\${r.nombre}">\${r.nombre}</option>\`).join('');
    
    const inpRol = document.getElementById('inp-usr-rol');
    if (inpRol) {
        const val = inpRol.value;
        inpRol.innerHTML = optionsHtml;
        if(val) inpRol.value = val;
    }
    
    const detRol = document.getElementById('det-edit-rol');
    if (detRol) {
        const val = detRol.value;
        detRol.innerHTML = optionsHtml;
        if(val) detRol.value = val;
    }
};`;
    content = content.slice(0, insertPos) + newFunc + content.slice(insertPos);
    console.log('Added populateRolesDropdowns after openKanbanDrawer export');
}

fs.writeFileSync('js/admin-app.js', content, 'utf8');
console.log('Done! admin-app.js fixed.');

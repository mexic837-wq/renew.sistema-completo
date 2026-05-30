const fs = require('fs');
let content = fs.readFileSync('js/admin-app.js', 'utf8');

const badBlock = `function openKanbanDrawer(projectId, targetPhaseId = null) {
    const db = getDB();
    const roles = db.Admin_Roles || [];
    if (!roles.length) return; // Wait for sync or defaults

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
};

window.openKanbanDrawer = openKanbanDrawer;
  const db = getDB();`;

const goodBlock = `function openKanbanDrawer(projectId, targetPhaseId = null) {
  const db = getDB();`;

// The exact text in the file right now (with carriage returns! \r\n vs \n):
let startIdx = content.indexOf('function openKanbanDrawer(projectId, targetPhaseId = null) {');
let endIdx = content.indexOf('  const db = getDB();', startIdx + 50);

if (startIdx !== -1 && endIdx !== -1) {
    let replaced = content.substring(0, startIdx) + "function openKanbanDrawer(projectId, targetPhaseId = null) {\r\n" + content.substring(endIdx);
    fs.writeFileSync('js/admin-app.js', replaced, 'utf8');
    console.log('Fixed js/admin-app.js block manually');
} else {
    console.log('Could not find indices');
}

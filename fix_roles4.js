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

content = content.replace(badBlock, goodBlock);
fs.writeFileSync('js/admin-app.js', content, 'utf8');
console.log('Fixed js/admin-app.js block');

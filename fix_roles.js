const fs = require('fs');
let content = fs.readFileSync('js/admin-app.js', 'utf8');

// Replacements for populating the roles dropdown
content = content.replace(
    `      if(UI.placeholderUsrFoto) UI.placeholderUsrFoto.classList.remove('hidden');

      // Re-init date pickers for the modal`,
    `      if(UI.placeholderUsrFoto) UI.placeholderUsrFoto.classList.remove('hidden');

      if (typeof window.populateRolesDropdowns === 'function') window.populateRolesDropdowns();

      // Re-init date pickers for the modal`
);

content = content.replace(
    `        // Re-init date pickers to apply flatpickr to modal fields
        if(window.initDatePickers) window.initDatePickers();
        
        state.currentUsrFoto = usr.foto;`,
    `        // Re-init date pickers to apply flatpickr to modal fields
        if(window.initDatePickers) window.initDatePickers();
        if (typeof window.populateRolesDropdowns === 'function') {
            window.populateRolesDropdowns();
            UI.inpUsrRol.value = usr.rol || '';
        }
        
        state.currentUsrFoto = usr.foto;`
);

content = content.replace(
    `window.openKanbanDrawer = openKanbanDrawer;`,
    `window.populateRolesDropdowns = function() {
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

window.openKanbanDrawer = openKanbanDrawer;`
);

fs.writeFileSync('js/admin-app.js', content, 'utf8');
console.log('Fixed js/admin-app.js');

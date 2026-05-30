const fs = require('fs');
const lines = fs.readFileSync('js/admin-app.js', 'utf8').split('\n');

const out = [];
let i = 0;
while (i < lines.length) {
    if (lines[i].includes('function openKanbanDrawer(projectId, targetPhaseId = null) {') && 
        lines[i+1].includes('window.populateRolesDropdowns = function() {')) {
        
        out.push(lines[i]); // Keep openKanbanDrawer
        i += 1;
        // Skip until we see the first line of the original openKanbanDrawer body
        while (i < lines.length && !lines[i].includes('  const db = getDB();')) {
            i++;
        }
    } else {
        out.push(lines[i]);
        i++;
    }
}

fs.writeFileSync('js/admin-app.js', out.join('\n'), 'utf8');
console.log('Fixed js/admin-app.js');

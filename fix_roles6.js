const fs = require('fs');
let lines = fs.readFileSync('js/admin-app.js', 'utf8').split('\\n');

// Clean carriage returns
lines = lines.map(l => l.replace('\\r', ''));

let out = [];
let i = 0;
while (i < lines.length) {
    if (lines[i].includes('function openKanbanDrawer(projectId, targetPhaseId = null) {')) {
        out.push('function openKanbanDrawer(projectId, targetPhaseId = null) {');
        i++;
        // Skip until we find the real body of openKanbanDrawer
        while (i < lines.length && !lines[i].includes('const p = (db.Proyectos_Dinamicos')) {
            i++;
        }
        // Add the db line back
        out.push('  const db = getDB();');
        // Continue pushing the rest normally
    } else {
        out.push(lines[i]);
        i++;
    }
}

fs.writeFileSync('js/admin-app.js', out.join('\\n'), 'utf8');
console.log('Cleaned openKanbanDrawer completely');

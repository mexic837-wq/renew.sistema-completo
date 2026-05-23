const fs = require('fs');
const file = 'c:/Users/LENOVO/Downloads/renew-sistema-completo-main/renew.sistema-completo-main/js/admin-app.js';
const drawerCodeFile = 'c:/Users/LENOVO/Downloads/renew-sistema-completo-main/renew.sistema-completo-main/js/drawer_code_v3.js';

const lines = fs.readFileSync(file, 'utf8').split('\n');
const drawerCode = fs.readFileSync(drawerCodeFile, 'utf8');

let start = -1, end = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function openKanbanDrawer(projectId, targetPhaseId = null) {')) start = i;
  if (start > -1 && i > start && lines[i].includes('function openFilePreview(campoId, label, directData) {')) {
    end = i - 1;
    break;
  }
}

if (start === -1 || end === -1) {
    console.error('Could not find bounds');
    process.exit(1);
}

lines.splice(start, end - start + 1, drawerCode);
fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Injected v3 successfully');

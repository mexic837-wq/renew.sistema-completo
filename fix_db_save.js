const fs = require('fs');

let calJs = fs.readFileSync('js/screens/calendar.js', 'utf8');

const anchor1 = "const color = colorNode ? colorNode.value : 'Cita';";
const replacement1 = `let color = colorNode ? colorNode.value : 'Cita';
        const newToLegacy = { 'Cita': 'Verde', 'Hold': 'Amarillo', 'Reagendar': 'Azul', 'Cancelado': 'Rojo' };
        color = newToLegacy[color] || color;`;

calJs = calJs.replace(anchor1, replacement1);
fs.writeFileSync('js/screens/calendar.js', calJs);

let adminJs = fs.readFileSync('js/admin-app.js', 'utf8');
const anchor2 = "const color = document.querySelector('input[name=\"ev-color\"]:checked')?.value || 'Cita';";
const replacement2 = `let color = document.querySelector('input[name="ev-color"]:checked')?.value || 'Cita';
        const newToLegacy = { 'Cita': 'Verde', 'Hold': 'Amarillo', 'Reagendar': 'Azul', 'Cancelado': 'Rojo' };
        color = newToLegacy[color] || color;`;

adminJs = adminJs.replace(anchor2, replacement2);
fs.writeFileSync('js/admin-app.js', adminJs);

console.log("Fixed DB save logic");

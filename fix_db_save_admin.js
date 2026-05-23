const fs = require('fs');
let adminJs = fs.readFileSync('js/admin-app.js', 'utf8');

const anchor2 = "const color = colorNode ? colorNode.value : 'Verde';";
const replacement2 = `let color = colorNode ? colorNode.value : 'Verde';
    const newToLegacy = { 'Cita': 'Verde', 'Hold': 'Amarillo', 'Reagendar': 'Azul', 'Cancelado': 'Rojo' };
    color = newToLegacy[color] || color;`;

adminJs = adminJs.replace(anchor2, replacement2);
fs.writeFileSync('js/admin-app.js', adminJs);

console.log("Fixed DB save logic admin");

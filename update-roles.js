const fs = require('fs');
let f = fs.readFileSync('js/admin-app.js', 'utf8');

// Replace Procesador with Project Manager
f = f.replace(/Procesador/g, 'Project Manager');

// Remove 'Finanzas' from array lists
f = f.replace(/, 'Finanzas'/g, '');

// Remove the Finanzas icon mapping line: 'Finanzas': 'fa-coins',
f = f.replace(/'Finanzas': 'fa-coins',/g, '');

// Remove the Finanzas option tag
f = f.replace(/<option value="Finanzas".*?<\/option>/g, '');

fs.writeFileSync('js/admin-app.js', f);
console.log('admin-app.js updated');

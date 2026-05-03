const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'js', 'screens', 'projectDetail.js');
let c = fs.readFileSync(filePath, 'utf8');

// Buscamos la repetición exacta y la dejamos en una sola
const target = '${field(\'Customer Name\',\'rec-customer-name\',\'text\',\'Nombre del cliente\', clienteNom)}\n    ${field(\'Customer Name\',\'rec-customer-name\',\'text\',\'Nombre del cliente\', clienteNom)}';
const replacement = '${field(\'Customer Name\',\'rec-customer-name\',\'text\',\'Nombre del cliente\', clienteNom)}';

if (c.includes(target)) {
    c = c.replace(target, replacement);
} else {
    // Intento alternativo por si hay espacios diferentes
    c = c.replace(/\$\{field\('Customer Name'.+?\}\n\s+\$\{field\('Customer Name'.+?\}/s, replacement);
}

fs.writeFileSync(filePath, c, 'utf8');
console.log('Duplicado eliminado.');

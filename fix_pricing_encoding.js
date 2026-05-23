const fs = require('fs');
let adminJs = fs.readFileSync('js/admin-app.js', 'utf8');

adminJs = adminJs.replace(/Gestiona los productos, categor.*?as y precios por rango para Renew Water\./g, 'Gestiona los productos, categorías y precios por rango para Renew Water.');
adminJs = adminJs.replace(/Centro de RRHH - Gesti.*?n de Talento y Onboarding/g, 'Centro de RRHH - Gestión de Talento y Onboarding');
adminJs = adminJs.replace(/Gesti.*?n y sincronizaci.*?n en tiempo real con Google Calendar\./g, 'Gestión y sincronización en tiempo real con Google Calendar.');
adminJs = adminJs.replace(/Gesti.*?n de Precios/g, 'Gestión de Precios');
adminJs = adminJs.replace(/CATEGOR.*?A<\/th>/g, 'CATEGORÍA</th>');
adminJs = adminJs.replace(/Sistema de Gesti.*?n de Contratos.*?Renew/g, 'Sistema de Gestión de Contratos - Renew');

fs.writeFileSync('js/admin-app.js', adminJs);

console.log("Encoding Fixed in pricing list");

const fs = require('fs');

// 1. dashboard.js
let dash = fs.readFileSync('js/screens/dashboard.js', 'utf8');

dash = dash.replace(/name: isStrictTecnico \? t\('nav_clients_tech'\) : \(allRoles\.some\(r => r\.includes\('call'\)\) \? 'Mis Llamadas' : 'Mis Clientes'\), tag: 'Renew Water',/g,
`name: (isVendedor && isTecnico) ? 'Clientes / Citas' : (isStrictTecnico ? t('nav_clients_tech') : (allRoles.some(r => r.includes('call')) ? 'Mis Llamadas' : 'Mis Clientes')), tag: 'Renew Water',`);

dash = dash.replace(/name: isStrictTecnico \? t\('nav_clients_tech'\) : \(userRole\.includes\('call'\) \? 'Mis Llamadas' : 'Mis Clientes'\), tag: 'Renew Solar',/g,
`name: (isVendedor && isTecnico) ? 'Clientes / Citas' : (isStrictTecnico ? t('nav_clients_tech') : (userRole.includes('call') ? 'Mis Llamadas' : 'Mis Clientes')), tag: 'Renew Solar',`);

dash = dash.replace(/name: isStrictTecnico \? t\('nav_clients_tech'\) : \(userRole\.includes\('call'\) \? 'Mis Llamadas' : 'Mis Clientes'\), tag: 'Renew Home',/g,
`name: (isVendedor && isTecnico) ? 'Clientes / Citas' : (isStrictTecnico ? t('nav_clients_tech') : (userRole.includes('call') ? 'Mis Llamadas' : 'Mis Clientes')), tag: 'Renew Home',`);

fs.writeFileSync('js/screens/dashboard.js', dash, 'utf8');

// 2. app.js
let app = fs.readFileSync('js/app.js', 'utf8');

app = app.replace(/'clients':\s*isStrictTecnico \? t\('nav_clients_tech'\) : \(isCallCenter \? 'Mis Llamadas' : t\('nav_clients'\)\),/g,
`'clients':      (isVendedor && isTecnico) ? 'Clientes / Citas' : (isStrictTecnico ? t('nav_clients_tech') : (isCallCenter ? 'Mis Llamadas' : t('nav_clients'))),`);

fs.writeFileSync('js/app.js', app, 'utf8');

console.log('Fixed labels for hybrid!');

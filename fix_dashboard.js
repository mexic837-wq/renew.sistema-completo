const fs = require('fs');

function replaceAll(file, rules) {
  let content = fs.readFileSync(file, 'utf8');
  for (const rule of rules) {
    content = content.replace(rule.search, rule.replace);
  }
  fs.writeFileSync(file, content, 'utf8');
}

// 1. catalogo.js
replaceAll('js/screens/catalogo.js', [
  {
    search: /const isAdmin = window\.getUserRoles\(user\)\.some\(r => \['admin','administrador','ceo','desarrollador'\]\.includes\(r\)\);/,
    replace: `const isAdmin = window.getUserRoles(user).some(r => ['admin','administrador','ceo','desarrollador'].includes(r)); 
  const isVentas = window.getUserRoles(user).some(r => ['vendedor','representante de ventas','asesor','analista','manager de ventas', 'supervisor', 'supervisi\u00F3n', 'project manager'].includes(r));`
  },
  {
    search: /if \(\!isAdmin\) \{/,
    replace: "if (!isAdmin && !isVentas && user.ver_catalogo !== true && user.ver_catalogo !== 'true') {"
  }
]);

// 2. listadeprecios.js
replaceAll('js/screens/listadeprecios.js', [
  {
    search: /const isAdmin = window\.getUserRoles\(user\)\.some\(r => \['admin','administrador','ceo','desarrollador'\]\.includes\(r\)\);/,
    replace: `const isAdmin = window.getUserRoles(user).some(r => ['admin','administrador','ceo','desarrollador'].includes(r)); 
  const isVentas = window.getUserRoles(user).some(r => ['vendedor','representante de ventas','asesor','analista','manager de ventas', 'supervisor', 'supervisi\u00F3n', 'project manager'].includes(r));`
  },
  {
    search: /if \(\!isAdmin\) \{/,
    replace: "if (!isAdmin && !isVentas) {"
  }
]);

// 3. app.js
replaceAll('js/app.js', [
  {
    search: /const isTecnico = user && window\.getUserRoles\(user\)\.some\(r => \/t\[e.*\]cn\[io\]co\/i\.test\(r\)\);/,
    replace: `const isTecnico = user && window.getUserRoles(user).some(r => /t[e\u00E9\u00C9]cn[io]co/i.test(r));
  const isVendedor = user && window.getUserRoles(user).some(r => ['vendedor', 'representante de ventas', 'manager de ventas', 'supervisor', 'supervisi\u00F3n', 'project manager'].includes(r));
  const isStrictTecnico = isTecnico && !isVendedor;`
  },
  { search: /document\.body\.classList\.toggle\('is-tecnico', !!isTecnico\);/g, replace: "document.body.classList.toggle('is-tecnico', !!isStrictTecnico);" },
  { search: /isTecnico \? t\('nav_clients_tech'\)/g, replace: "isStrictTecnico ? t('nav_clients_tech')" },
  { search: /\(isCallCenter \|\| isTecnico\) \? 'none' : 'flex'/g, replace: "(isCallCenter || isStrictTecnico) ? 'none' : 'flex'" },
  { search: /dashboard\.js\?v=2/g, replace: "dashboard.js?v=5" }
]);

// 4. dashboard.js
replaceAll('js/screens/dashboard.js', [
  {
    search: /const isTecnico\s*= allRoles\.some\(r => \/t\[e.*\]cn\[io\]co\/i\.test\(r\) \|\| r === 'tecnico' \|\| r === 't.*cnico'\);/,
    replace: `const isTecnico   = allRoles.some(r => /t[e\u00E9\u00C9]cn[io]co/i.test(r) || r === 'tecnico' || r === 't\u00E9cnico');
  const isVendedor  = allRoles.some(r => ['vendedor', 'representante de ventas', 'asesor', 'manager de ventas', 'supervisor', 'supervisi\u00F3n', 'project manager'].includes(r));
  const isStrictTecnico = isTecnico && !isVendedor;`
  },
  {
    search: /const isTecnico = user && window\.getUserRoles\(user\)\.some\(r => \/t\[e.*\]cn\[io\]co\/i\.test\(r\)\);/g,
    replace: `const isTecnico = user && window.getUserRoles(user).some(r => /t[e\u00E9\u00C9]cn[io]co/i.test(r));
  const isVendedor = user && window.getUserRoles(user).some(r => ['vendedor', 'representante de ventas', 'asesor', 'manager de ventas', 'supervisor', 'supervisi\u00F3n', 'project manager'].includes(r));
  const isStrictTecnico = isTecnico && !isVendedor;`
  },
  { search: /if \(\!isCallCenter && \!isTecnico\)/g, replace: "if (!isCallCenter && !isStrictTecnico)" },
  { search: /\(\(isAdmin \|\| \(\!isCallCenter && \!isTecnico\)\)\)/g, replace: "((isAdmin || (!isCallCenter && !isStrictTecnico)))" },
  { search: /name: isTecnico \? t\('nav_clients_tech'\)/g, replace: "name: isStrictTecnico ? t('nav_clients_tech')" },
  { search: /\!isTecnico \? \{/g, replace: "!isStrictTecnico ? {" },
  { search: /if \(isTecnico \|\| isCallCenter\) \{/g, replace: "if (isStrictTecnico || isCallCenter) {" },
  { search: /labels: \[isTecnico \?/g, replace: "labels: [isStrictTecnico ?" },
  { search: /isTecnico \? 'Pendientes'/g, replace: "isStrictTecnico ? 'Pendientes'" },
  { search: /if \(isTecnico\) \{/g, replace: "if (isStrictTecnico) {" },
  { search: /const salesLabel = isTecnico \?/g, replace: "const salesLabel = isStrictTecnico ?" },
  { search: /const hiddenLabel = isTecnico \?/g, replace: "const hiddenLabel = isStrictTecnico ?" },
  { search: /isTecnico \? 'Tabla de Posiciones'/g, replace: "isStrictTecnico ? 'Tabla de Posiciones'" },
  { search: /isTecnico \? 'MEJORES T.*CNICOS'/g, replace: "isStrictTecnico ? 'MEJORES T\u00C9CNICOS'" }
]);

// 5. index.html
replaceAll('index.html', [
  { search: /app\.js\?v=[0-9]+/g, replace: "app.js?v=1001" }
]);

console.log('All files processed!');

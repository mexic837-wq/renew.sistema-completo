const fs = require('fs');

// 1. dashboard.js
let dash = fs.readFileSync('js/screens/dashboard.js', 'utf8');

dash = dash.replace(/'Mis Clientes':          'var\(--bg-tool-clientes\)',/g,
`'Mis Clientes':          'var(--bg-tool-clientes)',
      'Clientes / Citas':      'var(--bg-tool-clientes)',`);

dash = dash.replace(/'Mis Clientes': '<i class="fa-solid fa-users"><\/i>',/g,
`'Mis Clientes': '<i class="fa-solid fa-users"></i>',
      'Clientes / Citas': '<i class="fa-solid fa-users"></i>',`);

fs.writeFileSync('js/screens/dashboard.js', dash, 'utf8');

console.log('Fixed sidebar mappings!');

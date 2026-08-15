const fs = require('fs');
let dash = fs.readFileSync('js/screens/dashboard.js', 'utf8');

dash = dash.replace(/const isTecnico\s*=\s*allRoles\.some\(r => \/t\[e[^\]]*\]cn\[io\]co\/i\.test\(r\) \|\| r === 'tecnico' \|\| r === 't[^c]*cnico'\);/,
`const isTecnico   = allRoles.some(r => /t[e\u00E9\u00C9]cn[io]co/i.test(r) || r === 'tecnico' || r === 't\u00E9cnico');`);

dash = dash.replace(/const isTecnico\s*=\s*user && window\.getUserRoles\(user\)\.some\(r => \/t\[e[^\]]*\]cn\[io\]co\/i\.test\(r\)\);/g,
`const isTecnico = user && window.getUserRoles(user).some(r => /t[e\u00E9\u00C9]cn[io]co/i.test(r));`);

fs.writeFileSync('js/screens/dashboard.js', dash, 'utf8');

let app = fs.readFileSync('js/app.js', 'utf8');
app = app.replace(/const isTecnico\s*=\s*user && window\.getUserRoles\(user\)\.some\(r => \/t\[e[^\]]*\]cn\[io\]co\/i\.test\(r\)\);/g,
`const isTecnico = user && window.getUserRoles(user).some(r => /t[e\u00E9\u00C9]cn[io]co/i.test(r));`);
fs.writeFileSync('js/app.js', app, 'utf8');

console.log('Fixed regexes!');

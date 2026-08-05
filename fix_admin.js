const fs = require('fs');
let code = fs.readFileSync('js/admin-app.js', 'utf8');

// Common checks: (w.rol || '').toLowerCase()
code = code.replace(/\(([a-zA-Z0-9_\?]+)\.rol\s*\|\|\s*['"]['"]\)\.toLowerCase\(\)/g, 'window.getUserRoles($1).join(" ").toLowerCase()');

// Things like `(u.rol || 'Vendedor').toLowerCase()`
code = code.replace(/\(([a-zA-Z0-9_\?]+)\.rol\s*\|\|\s*['"]([^'"]+)['"]\)\.toLowerCase\(\)/g, '(window.getUserRoles($1).join(" ") || "$2").toLowerCase()');

// direct .includes on rol: `user.rol.includes('call')` -> `window.getUserRoles(user).some(r => r.includes('call'))`
// Wait, regex for that is risky. Let's do `[a-zA-Z0-9_\?]+\.rol` when we see it used as a string.

// Let's replace simple instances: `w.rol || 'Sin rol'` -> `window.getUserRoles(w).join(', ') || 'Sin rol'`
// Because we use `.join(', ')` it behaves like a string.

// Let's save it
fs.writeFileSync('js/admin-app.js', code);
console.log('Fixed admin-app.js');

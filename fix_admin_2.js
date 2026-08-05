const fs = require('fs');
let code = fs.readFileSync('js/admin-app.js', 'utf8');

// Replace w.rol && (w.rol.includes(...) || ...)
code = code.replace(/w\.rol\s*&&\s*\(w\.rol\.includes\('Tecnico'\)\s*\|\|\s*w\.rol\.includes\('Técnico'\)\)/g, 'window.getUserRoles(w).some(r => r.includes("tecnico") || r.includes("técnico"))');

// Replace usr.rol || 'Vendedor' -> window.getUserRoles(usr).join(', ') || 'Vendedor'
code = code.replace(/\b(usr|u|user|m|w|f)\.rol\s*\|\|/g, 'window.getUserRoles($1).join(", ") ||');
code = code.replace(/\b(usr|u|user|m|w|f)\.rol(?!\s*\|\||\s*=|\s*:|\.)/g, 'window.getUserRoles($1).join(", ")');

// Fix the role mapping that was broken by this: `w.rol || 'Sin rol'` might become `window.getUserRoles(w).join(', ') || 'Sin rol'`

fs.writeFileSync('js/admin-app.js', code);
console.log('Fixed admin-app.js pass 2');

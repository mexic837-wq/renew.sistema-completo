const fs = require('fs');
let code = fs.readFileSync('js/admin-app.js', 'utf8');

// Replace `rol: UI.inpUsrRol.value,` with `rol: Array.from(UI.inpUsrRol.selectedOptions || []).map(o => o.value),`
code = code.replace(/rol:\s*UI\.inpUsrRol\.value,/g, 'rol: Array.from(UI.inpUsrRol.selectedOptions || []).map(o => o.value),');

// Line 12438: const rol = detEditRol.value; -> we might need Array.from(detEditRol.selectedOptions || []).map(o => o.value) if it's a multiple select.
// Let's replace detEditRol.value if detEditRol is multiple.
code = code.replace(/const rol = detEditRol\.value;/g, 'const rolArray = Array.from(detEditRol.selectedOptions || []).map(o => o.value); const rol = rolArray.join(", ");');

// Same for line 11211 and 11317 (these are element references).
// Line 12019: const role = user.rol || ''; -> const role = window.getUserRoles(user).join(', ') || '';
code = code.replace(/const role = user\.rol\s*\|\|\s*'';/g, 'const role = window.getUserRoles(user).join(", ") || "";');

// Line 8019: const rol = rolEl ? rolEl.value : (window.getUserRoles(usr).join(", ") || 'Vendedor');
// If rolEl is multiple select, rolEl.value will only give one.
code = code.replace(/const rol = rolEl \? rolEl\.value :/g, 'const rol = rolEl ? Array.from(rolEl.selectedOptions || []).map(o => o.value).join(", ") :');

fs.writeFileSync('js/admin-app.js', code);
console.log('Fixed DB save assignments');

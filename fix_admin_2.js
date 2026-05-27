const fs = require('fs');
let html = fs.readFileSync('admin.html', 'utf8');

// The file has encoding garbage. We'll do targeted replacements using regex to catch the weird characters.
html = html.replace(/<input type="checkbox" name="chk-cli-dept" value="Water"[^>]*>\s*[^<]*Water/g, 
    '<input type="checkbox" name="chk-cli-dept" value="Water" class="w-4 h-4 rounded border-gray-300 text-tealAccent focus:ring-tealAccent"> <i class="fa-solid fa-water"></i> Water');
html = html.replace(/<input type="checkbox" name="chk-cli-dept" value="Solar"[^>]*>\s*[^<]*Solar/g, 
    '<input type="checkbox" name="chk-cli-dept" value="Solar" class="w-4 h-4 rounded border-gray-300 text-tealAccent focus:ring-tealAccent"> ☀️ Solar');
html = html.replace(/<input type="checkbox" name="chk-cli-dept" value="Home"[^>]*>\s*[^<]*Home/g, 
    '<input type="checkbox" name="chk-cli-dept" value="Home" class="w-4 h-4 rounded border-gray-300 text-tealAccent focus:ring-tealAccent"> 🏠 Home');

html = html.replace(/<input type="checkbox" name="det-chk-dept" value="Water"[^>]*>\s*[^<]*Water/g, 
    '<input type="checkbox" name="det-chk-dept" value="Water" class="w-4 h-4 rounded border-gray-300 text-tealAccent focus:ring-tealAccent"> <i class="fa-solid fa-water"></i> Water');
html = html.replace(/<input type="checkbox" name="det-chk-dept" value="Solar"[^>]*>\s*[^<]*Solar/g, 
    '<input type="checkbox" name="det-chk-dept" value="Solar" class="w-4 h-4 rounded border-gray-300 text-tealAccent focus:ring-tealAccent"> ☀️ Solar');
html = html.replace(/<input type="checkbox" name="det-chk-dept" value="Home"[^>]*>\s*[^<]*Home/g, 
    '<input type="checkbox" name="det-chk-dept" value="Home" class="w-4 h-4 rounded border-gray-300 text-tealAccent focus:ring-tealAccent"> 🏠 Home');

html = html.replace(/<option value="Prospecto">[^<]*Prospecto<\/option>/g, '<option value="Prospecto">📥 Prospecto</option>');
html = html.replace(/<option value="En Proceso">[^<]*En Proceso \(Pipeline Activo\)<\/option>/g, '<option value="En Proceso"><i class="fa-solid fa-shield"></i>️ En Proceso (Pipeline Activo)</option>');
html = html.replace(/<option value="En Proceso">[^<]*En Proceso<\/option>/g, '<option value="En Proceso"><i class="fa-solid fa-shield"></i>️ En Proceso</option>');
html = html.replace(/<option value="Cliente">[^<]*Cliente \(Completado\)<\/option>/g, '<option value="Cliente">🏆 Cliente (Completado)</option>');
html = html.replace(/<option value="Cliente">[^<]*Cliente<\/option>/g, '<option value="Cliente">🏆 Cliente</option>');
html = html.replace(/<option value="Cancelado">[^<]*Cancelado \/ No Molestar<\/option>/g, '<option value="Cancelado">🚫 Cancelado / No Molestar</option>');

html = html.replace(/Hoja Aplicacin/g, 'Hoja Aplicación');
html = html.replace(/Pliza Seguro/g, 'Póliza Seguro');
// In case they were captured differently in Windows console output vs actual file:
html = html.replace(/Hoja Aplicaci.n/g, 'Hoja Aplicación');
html = html.replace(/P.liza Seguro/g, 'Póliza Seguro');

fs.writeFileSync('admin.html', html, 'utf8');
console.log("Done");

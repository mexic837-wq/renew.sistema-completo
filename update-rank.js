const fs = require('fs');
let html = fs.readFileSync('admin.html', 'utf8');

// Wrap the view rank container
html = html.replace(
  '<div><label class="block text-[10px] text-gray-400 font-medium mb-1 uppercase tracking-widest">Rank</label><p id="det-usr-rank" class="text-sm font-bold text-tealAccent uppercase">-</p></div>',
  '<div id="det-view-rank-container"><label class="block text-[10px] text-gray-400 font-medium mb-1 uppercase tracking-widest">Rank</label><p id="det-usr-rank" class="text-sm font-bold text-tealAccent uppercase">-</p></div>'
);

// Wrap the edit rank container
html = html.replace(
  '<div><label class="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Rango</label><select id="det-edit-rank" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#333] bg-white">',
  '<div id="det-edit-rank-container"><label class="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Rango</label><select id="det-edit-rank" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#333] bg-white">'
);

fs.writeFileSync('admin.html', html);

let js = fs.readFileSync('js/admin-app.js', 'utf8');

// In updateWorkerRankVisibility, we also need to handle the detail modal
// Actually we can create a new function `updateDetailRankVisibility(rol, dept)` or just do it inline.
const inlineLogic = `
    document.getElementById('det-usr-rank').textContent = usr.rango || 'novato';
    
    // Hide rank if not (Vendedor/Representante de Ventas + Water)
    const viewRankContainer = document.getElementById('det-view-rank-container');
    const editRankContainer = document.getElementById('det-edit-rank-container');
    const isVendedor = usr.rol === 'Vendedor' || usr.rol === 'Representante de Ventas';
    const isWater = usr.departamento && usr.departamento.toLowerCase().includes('water');
    if (viewRankContainer) {
        viewRankContainer.style.display = (isVendedor && isWater) ? 'block' : 'none';
    }
    if (editRankContainer) {
        editRankContainer.style.display = (isVendedor && isWater) ? 'block' : 'none';
    }
`;

js = js.replace("document.getElementById('det-usr-rank').textContent = usr.rango || 'novato';", inlineLogic);

// Wait, the edit rol dropdown change should also trigger the visibility check
// In admin-app.js, there is an event listener for `det-edit-rol`?
const eventListener = `
  const detEditRol = document.getElementById('det-edit-rol');
  const detEditDept = document.getElementById('det-edit-dept');
  if (detEditRol) {
      detEditRol.addEventListener('change', () => {
          const rol = detEditRol.value;
          const dept = detEditDept ? detEditDept.value : '';
          const isVendedor = rol === 'Vendedor' || rol === 'Representante de Ventas';
          const isWater = dept && dept.toLowerCase().includes('water');
          const editRankContainer = document.getElementById('det-edit-rank-container');
          if (editRankContainer) {
              editRankContainer.style.display = (isVendedor && isWater) ? 'block' : 'none';
          }
      });
  }
  if (detEditDept) {
      detEditDept.addEventListener('input', () => {
          if (detEditRol) {
              const evt = new Event('change');
              detEditRol.dispatchEvent(evt);
          }
      });
  }
`;

// Insert the event listeners at the end of the script
js = js + "\\n" + eventListener;

fs.writeFileSync('js/admin-app.js', js);
console.log('Update complete');

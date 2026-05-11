const fs = require('fs');
const file = 'js/admin-app.js';
let content = fs.readFileSync(file, 'utf8');

const startStr = "  else if (state.activeView === 'anuncios') {";
const endStr = "// Ventana global para visualizar reporte de lectura";

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
    let block = content.substring(startIdx, endIdx);
    
    // We split block into anuncios block and meetings block
    const meetStartStr = "  else if (state.activeView === 'meetings') {";
    const meetIdx = block.indexOf(meetStartStr);
    
    if (meetIdx !== -1) {
        let anunciosBlock = block.substring(startStr.length, meetIdx).trim();
        // remove the trailing "  }" from anunciosBlock
        if (anunciosBlock.endsWith('}')) {
            anunciosBlock = anunciosBlock.substring(0, anunciosBlock.lastIndexOf('}')).trim();
        }
        
        let meetingsBlock = block.substring(meetIdx + meetStartStr.length).trim();
        // remove the trailing "  }\n}" from meetingsBlock
        if (meetingsBlock.endsWith('}')) {
            meetingsBlock = meetingsBlock.substring(0, meetingsBlock.lastIndexOf('}')).trim();
            if (meetingsBlock.endsWith('}')) {
                meetingsBlock = meetingsBlock.substring(0, meetingsBlock.lastIndexOf('}')).trim();
            }
        }
        
        anunciosBlock = anunciosBlock.replace(/UI\.canvas\.innerHTML = `/g, 'UI.canvas.innerHTML = tabsHtml + `');
        meetingsBlock = meetingsBlock.replace(/UI\.canvas\.innerHTML = `/g, 'UI.canvas.innerHTML = tabsHtml + `');
        
        const newBlock = `  else if (state.activeView === 'anuncios') {
    state.anunciosTabActive = state.anunciosTabActive || 'anuncios';
    
    const tabsHtml = \`
      <div class="flex items-center gap-2 mb-5 mt-2" id="anu-view-tabs">
        <button class="anu-sub-tab px-4 py-2 rounded-xl text-xs font-bold border transition-all \${state.anunciosTabActive === 'anuncios' ? 'bg-tealAccent/10 text-tealAccent border-tealAccent/30' : 'bg-gray-100 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10 hover:text-tealAccent'}" data-anu-tab="anuncios">
          <i class="fa-solid fa-bullhorn mr-1"></i> Anuncios Globales
        </button>
        <button class="anu-sub-tab px-4 py-2 rounded-xl text-xs font-bold border transition-all \${state.anunciosTabActive === 'meetings' ? 'bg-blue-400/10 text-blue-400 border-blue-400/30' : 'bg-gray-100 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10 hover:text-blue-400'}" data-anu-tab="meetings">
          <i class="fa-solid fa-video mr-1"></i> Coordinar Llamada
        </button>
      </div>
    \`;

    if (state.anunciosTabActive === 'anuncios') {
${anunciosBlock}
    } else {
${meetingsBlock}
    }
  }
}

`;
        content = content.substring(0, startIdx) + newBlock + content.substring(endIdx);
        fs.writeFileSync(file, content, 'utf8');
        console.log("Patched successfully");
    } else {
        console.log("Could not find meetings block");
    }
} else {
    console.log("Could not find start or end");
}

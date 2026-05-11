const fs = require('fs');
const file = 'js/admin-app.js';
let content = fs.readFileSync(file, 'utf8');

const startAnuncios = "  else if (state.activeView === 'anuncios') {";
const startMeetings = "  else if (state.activeView === 'meetings') {";
const endMeetings = "    }, 100);\n  }\n}";

const idxAnuncios = content.indexOf(startAnuncios);
const idxMeetings = content.indexOf(startMeetings);
const idxEnd = content.indexOf(endMeetings, idxMeetings) + endMeetings.length - 2; // Keep the last "}"

if (idxAnuncios === -1 || idxMeetings === -1 || idxEnd === -1) {
  console.error('Could not find the blocks');
  process.exit(1);
}

const anunciosBlock = content.substring(idxAnuncios + startAnuncios.length, idxMeetings).trim();
// Remove the trailing "  }" of the anuncios block
let cleanAnunciosBlock = anunciosBlock;
if (cleanAnunciosBlock.endsWith('}')) {
    let lastBraceIdx = cleanAnunciosBlock.lastIndexOf('}');
    cleanAnunciosBlock = cleanAnunciosBlock.substring(0, lastBraceIdx).trim();
}

const meetingsBlock = content.substring(idxMeetings + startMeetings.length, idxEnd).trim();

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
${cleanAnunciosBlock.replace(/UI\.canvas\.innerHTML = \`/g, 'UI.canvas.innerHTML = tabsHtml + `')}
    } else {
${meetingsBlock.replace(/UI\.canvas\.innerHTML = \`/g, 'UI.canvas.innerHTML = tabsHtml + `')}
    }
`;

const before = content.substring(0, idxAnuncios);
const after = content.substring(idxEnd);

const finalContent = before + newBlock + after;
fs.writeFileSync(file, finalContent, 'utf8');
console.log('Replaced successfully');

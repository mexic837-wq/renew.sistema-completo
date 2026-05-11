const fs = require('fs');
const file = 'js/admin-app.js';
let lines = fs.readFileSync(file, 'utf8').split('\n');

let startAnunIdx = -1;
let startMeetIdx = -1;
let endMeetIdx = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("else if (state.activeView === 'anuncios') {")) startAnunIdx = i;
  if (lines[i].includes("else if (state.activeView === 'meetings') {")) startMeetIdx = i;
}

if (startMeetIdx !== -1) {
  for (let i = startMeetIdx; i < lines.length; i++) {
    if (lines[i] === "    }, 100);" && lines[i+1] === "  }" && lines[i+2] === "}") {
      endMeetIdx = i + 1; // "  }"
      break;
    }
  }
}

if (startAnunIdx !== -1 && startMeetIdx !== -1 && endMeetIdx !== -1) {
  let anunciosBlock = lines.slice(startAnunIdx + 1, startMeetIdx - 1).join('\n');
  let meetingsBlock = lines.slice(startMeetIdx + 1, endMeetIdx).join('\n');

  anunciosBlock = anunciosBlock.replace(/UI\.canvas\.innerHTML = `/g, 'UI.canvas.innerHTML = tabsHtml + `');
  meetingsBlock = meetingsBlock.replace(/UI\.canvas\.innerHTML = `/g, 'UI.canvas.innerHTML = tabsHtml + `');

  const newCode = `  else if (state.activeView === 'anuncios') {
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
`;

  lines.splice(startAnunIdx, endMeetIdx - startAnunIdx + 1, newCode);
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  console.log("Patched successfully");
} else {
  console.log("Could not find ranges", startAnunIdx, startMeetIdx, endMeetIdx);
}

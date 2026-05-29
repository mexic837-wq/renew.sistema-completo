const fs = require('fs');
const file = 'js/admin-app.js';
let lines = fs.readFileSync(file, 'utf8').split('\n');

lines[3822] = '            servicioHtml = `<span class="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-blue-500/20"><i class="fa-solid fa-house"></i> ${t(\'partner_cat_roofing\')}</span>`;\r';
lines[3830] = '            servicioHtml = `<span class="px-2 py-0.5 bg-gray-500/10 text-gray-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-gray-500/20"><i class="fa-solid fa-toolbox"></i> ${t(\'partner_cat_remodelacion\')}</span>`;\r';
lines[3832] = '            servicioHtml = `<span class="px-2 py-0.5 bg-red-500/10 text-red-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-red-500/20"><i class="fa-solid fa-trash"></i> ${t(\'partner_cat_dumpsters\')}</span>`;\r';
lines[3834] = '            servicioHtml = `<span class="px-2 py-0.5 bg-sky-500/10 text-sky-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-sky-500/20"><i class="fa-solid fa-cloud-showers-water"></i> ${t(\'partner_cat_gutters\')}</span>`;\r';
lines[7614] = '                        <button type="button" class="chat-emoji-btn hover:bg-gray-100 rounded p-1 transition-colors text-lg"><i class="fa-solid fa-thumbs-up"></i></button>\r';

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Lines replaced exactly by index.');

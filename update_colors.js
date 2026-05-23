const fs = require('fs');

const adminHtml = fs.readFileSync('admin.html', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');

const newAdminColors = `
                    <div class="flex gap-4">
                        <label class="cursor-pointer relative group flex flex-col items-center">
                            <input type="radio" name="ev-color" value="Cita" class="peer sr-only" checked>
                            <div class="w-8 h-8 rounded-full bg-[#4caf50] border-2 border-transparent peer-checked:border-white peer-checked:scale-110 shadow-lg transition-all opacity-70 peer-checked:opacity-100" title="Cita"></div>
                            <span class="text-[9px] font-bold mt-1 text-gray-500 uppercase">Cita</span>
                        </label>
                        <label class="cursor-pointer relative group flex flex-col items-center">
                            <input type="radio" name="ev-color" value="Hold" class="peer sr-only">
                            <div class="w-8 h-8 rounded-full bg-[#ffb300] border-2 border-transparent peer-checked:border-white peer-checked:scale-110 shadow-lg transition-all opacity-70 peer-checked:opacity-100" title="Hold (Seguimiento)"></div>
                            <span class="text-[9px] font-bold mt-1 text-gray-500 uppercase">Hold</span>
                        </label>
                        <label class="cursor-pointer relative group flex flex-col items-center">
                            <input type="radio" name="ev-color" value="Reagendar" class="peer sr-only">
                            <div class="w-8 h-8 rounded-full bg-[#1e88e5] border-2 border-transparent peer-checked:border-white peer-checked:scale-110 shadow-lg transition-all opacity-70 peer-checked:opacity-100" title="Reagendar"></div>
                            <span class="text-[9px] font-bold mt-1 text-gray-500 uppercase">Reagendar</span>
                        </label>
                        <label class="cursor-pointer relative group flex flex-col items-center">
                            <input type="radio" name="ev-color" value="Cancelado" class="peer sr-only">
                            <div class="w-8 h-8 rounded-full bg-[#d32f2f] border-2 border-transparent peer-checked:border-white peer-checked:scale-110 shadow-lg transition-all opacity-70 peer-checked:opacity-100" title="Cancelado"></div>
                            <span class="text-[9px] font-bold mt-1 text-gray-500 uppercase">Cancelar</span>
                        </label>
                    </div>`;

const newIndexColors = `
                    <div class="flex gap-4">
                        <label class="relative cursor-pointer group flex flex-col items-center">
                            <input type="radio" name="ev-color" value="Cita" checked class="peer sr-only">
                            <div class="w-10 h-10 rounded-full bg-[#4caf50] border-4 border-transparent peer-checked:border-white dark:peer-checked:border-[#121212] peer-checked:scale-110 shadow-lg transition-all opacity-70 peer-checked:opacity-100" title="Cita"></div>
                            <span class="text-[9px] font-bold mt-1 text-gray-500 uppercase">Cita</span>
                        </label>
                        <label class="relative cursor-pointer group flex flex-col items-center">
                            <input type="radio" name="ev-color" value="Hold" class="peer sr-only">
                            <div class="w-10 h-10 rounded-full bg-[#ffb300] border-4 border-transparent peer-checked:border-white dark:peer-checked:border-[#121212] peer-checked:scale-110 shadow-lg transition-all opacity-70 peer-checked:opacity-100" title="Hold (Seguimiento)"></div>
                            <span class="text-[9px] font-bold mt-1 text-gray-500 uppercase">Hold</span>
                        </label>
                        <label class="relative cursor-pointer group flex flex-col items-center">
                            <input type="radio" name="ev-color" value="Reagendar" class="peer sr-only">
                            <div class="w-10 h-10 rounded-full bg-[#1e88e5] border-4 border-transparent peer-checked:border-white dark:peer-checked:border-[#121212] peer-checked:scale-110 shadow-lg transition-all opacity-70 peer-checked:opacity-100" title="Reagendar"></div>
                            <span class="text-[9px] font-bold mt-1 text-gray-500 uppercase">Reagendar</span>
                        </label>
                        <label class="relative cursor-pointer group flex flex-col items-center">
                            <input type="radio" name="ev-color" value="Cancelado" class="peer sr-only">
                            <div class="w-10 h-10 rounded-full bg-[#d32f2f] border-4 border-transparent peer-checked:border-white dark:peer-checked:border-[#121212] peer-checked:scale-110 shadow-lg transition-all opacity-70 peer-checked:opacity-100" title="Cancelado"></div>
                            <span class="text-[9px] font-bold mt-1 text-gray-500 uppercase">Cancelar</span>
                        </label>
                    </div>`;

const adminRegex = /<div class="flex gap-4">\s*<label class="cursor-pointer relative">[\s\S]*?<\/label>\s*<\/div>/;
const indexRegex = /<div class="flex gap-4">\s*<label class="relative cursor-pointer group">[\s\S]*?<\/label>\s*<\/div>/;

fs.writeFileSync('admin.html', adminHtml.replace(adminRegex, newAdminColors));
fs.writeFileSync('index.html', indexHtml.replace(indexRegex, newIndexColors));

// Now update calendar.js
let calJs = fs.readFileSync('js/screens/calendar.js', 'utf8');
const newColorMap = `const colorMap = {
            'Cita': '#4caf50', 'Hold': '#ffb300', 'Cancelado': '#d32f2f', 'Reagendar': '#1e88e5',
            'Verde': '#4caf50', 'Amarillo': '#ffb300', 'Rojo': '#d32f2f', 'Azul': '#1e88e5', 'Naranja': '#ffb300'
          };`;
calJs = calJs.replace(/const colorMap = \{[\s\S]*?\};/, newColorMap);
fs.writeFileSync('js/screens/calendar.js', calJs);

// Also need to update the color text fallback in calendar.js
// 'const textColor = (ev.color === 'Azul' || ev.color === 'Verde' || ev.color === 'Amarillo') ? '#000' : '#fff';'
// Since Hold and Amarillo are light, let's use black text for them.
calJs = calJs.replace(/const textColor = .*;/g, "const textColor = (ev.color === 'Amarillo' || ev.color === 'Hold') ? '#000' : '#fff';");
fs.writeFileSync('js/screens/calendar.js', calJs);

// Find what happens when editing in calendar.js:
// const color = colorNode ? colorNode.value : 'Verde'; -> 'Cita'
calJs = calJs.replace(/const colorNode \? colorNode\.value \: 'Verde';/g, "const colorNode ? colorNode.value : 'Cita';");
fs.writeFileSync('js/screens/calendar.js', calJs);

console.log("Done updating colors");

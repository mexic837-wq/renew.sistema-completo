const fs = require('fs');

let calJs = fs.readFileSync('js/screens/calendar.js', 'utf8');

// 1. Add getAdminWorkers to import
calJs = calJs.replace(
    "import { getDB, saveGranular, deleteRecord } from '../api.js';",
    "import { getDB, saveGranular, deleteRecord, getAdminWorkers } from '../api.js';"
);

// 2. Modify `mostrarDetalleEventoCalendario` UI logic
const oldWrapperHide = "document.getElementById('ev-colaboradores-wrapper').classList.add('nuclear-hidden');";
const newWrapperLogic = `
        const colabWrapper = document.getElementById('ev-colaboradores-wrapper');
        if(colabWrapper) {
            colabWrapper.classList.remove('hidden', 'nuclear-hidden');
            const container = document.getElementById('ev-colaboradores-list');
            if (container) {
                container.innerHTML = '<p class="text-xs text-gray-400 italic">Cargando equipo...</p>';
                getAdminWorkers().then(workers => {
                    if (!workers || workers.length === 0) {
                        container.innerHTML = '<p class="text-xs text-gray-400 italic">No hay colaboradores registrados.</p>';
                    } else {
                        container.innerHTML = workers.map(w => {
                            const fullName = \`\${w.nombre || ''} \${w.apellido || ''}\`.trim();
                            const rol = w.rol || 'Sin rol';
                            const email = w.email || '';
                            const workerData = JSON.stringify({ id: w.id, nombre: fullName, email }).replace(/"/g, '&quot;');
                            
                            let isChecked = false;
                            if (props && props.attendees && Array.isArray(props.attendees)) {
                                isChecked = props.attendees.some(a => String(a.id) === String(w.id) || a.email === email);
                            }
                            
                            return \`
                            <label class="flex items-center gap-3 cursor-pointer group py-1.5 rounded-lg hover:bg-tealAccent/5 px-2 transition-all">
                                <input type="checkbox" 
                                    class="ev-colab-chk w-4 h-4 rounded accent-teal-500 cursor-pointer flex-shrink-0" 
                                    data-worker="\${workerData}" \${isChecked ? 'checked' : ''} \${event && event.title ? 'disabled' : ''}>
                                <div class="flex items-center gap-2 min-w-0">
                                    <div class="w-6 h-6 rounded-full bg-tealAccent/20 border border-tealAccent/30 flex items-center justify-center flex-shrink-0">
                                        <span class="text-[9px] font-black text-tealAccent">\${fullName.charAt(0).toUpperCase()}</span>
                                    </div>
                                    <div class="min-w-0">
                                        <p class="text-xs font-bold text-gray-800 dark:text-white truncate">\${fullName} <span class="font-normal text-gray-400">(\${rol})</span></p>
                                        \${email ? \`<p class="text-[9px] text-tealAccent/70 truncate">\${email}</p>\` : ''}
                                    </div>
                                </div>
                            </label>\`;
                        }).join('');
                    }
                }).catch(err => {
                    container.innerHTML = '<p class="text-xs text-red-400 italic">Error cargando colaboradores.</p>';
                    console.error('[CALENDAR] Error loading workers:', err);
                });
            }
        }`;
calJs = calJs.replace(oldWrapperHide, newWrapperLogic);

// 3. Modify submit logic to grab attendees
const oldDept = "const departamentos = Array.from(document.querySelectorAll('input[name=\"ev-depto\"]:checked')).map(el => el.value);";
const newDept = `const departamentos = Array.from(document.querySelectorAll('input[name="ev-depto"]:checked')).map(el => el.value);
        
        const attendees = Array.from(document.querySelectorAll('.ev-colab-chk:checked')).map(chk => {
            try { return JSON.parse(chk.getAttribute('data-worker')); } catch(e) { return null; }
        }).filter(Boolean);`;
calJs = calJs.replace(oldDept, newDept);

// 4. Also inject attendees into newEvent object
const oldColorProp = "color: color,\n            departamentos: departamentos,";
const newColorProp = "color: color,\n            departamentos: departamentos,\n            attendees: attendees,";
calJs = calJs.replace(oldColorProp, newColorProp);

fs.writeFileSync('js/screens/calendar.js', calJs);
console.log('Fixed calendar script');

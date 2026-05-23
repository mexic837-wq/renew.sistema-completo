const fs = require('fs');
const file = 'c:/Users/LENOVO/Downloads/renew-sistema-completo-main/renew.sistema-completo-main/js/admin-app.js';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
const start = 8086;
const end = 8160;
const newCode = `        // Build Projects view (replaces legacy gallery)
        const db2 = getDB();
        const pipelines = db2.Admin_Pipelines || [];
        const fasesAll = db2.Admin_Fases || [];
        const proyectos = (db2.Proyectos_Dinamicos || []).filter(p => p.cliente_id === cli.id);

        if (proyectos.length > 0) {
            badge.textContent = \\\`\${proyectos.length} PROYECTOS\\\`;
            
            // Build general client documents panel
            let generalDocsHtml = '';
            const generalDocs = [];
            if (cli.id_photo) generalDocs.push({ src: cli.id_photo, label: 'Foto ID' });
            if (cli.adjunto_bill_url) generalDocs.push({ src: cli.adjunto_bill_url, label: 'Bill Eléctrico' });
            if (cli.adjunto_seguro_url) generalDocs.push({ src: cli.adjunto_seguro_url, label: 'Póliza Seguro' });
            (cli.archivos_adjuntos || []).forEach((src, i) => generalDocs.push({ src, label: \\\`Evidencia #\${i+1}\\\` }));

            if (generalDocs.length > 0) {
                generalDocsHtml = \\\`
                <div class="mb-6 bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <h4 class="text-[11px] font-black uppercase text-gray-500 mb-3 flex items-center gap-2"><i class="fa-solid fa-folder"></i> Documentos Generales</h4>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                        \${generalDocs.map((doc, idx) => {
                            const isImage = doc.src.startsWith('data:image') || doc.src.match(/\\.(jpg|jpeg|png|gif|webp)/i);
                            return \\\`
                            <div class="group relative bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                <div class="relative aspect-video">
                                    \${isImage 
                                      ? \\\`<img src="\${doc.src}" class="w-full h-full object-cover group-hover:scale-105 transition-transform">\\\`
                                      : \\\`<div class="w-full h-full flex flex-col items-center justify-center bg-gray-50"><i class="fas fa-file-pdf text-2xl text-red-400"></i></div>\\\`
                                    }
                                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button onclick="window.openFilePreview('gen_\${idx}','\${doc.label}',{valor:'\${doc.src}'})" class="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center"><i class="fas fa-expand text-[10px]"></i></button>
                                        <a href="\${doc.src}" download="\${doc.label}" class="w-8 h-8 rounded-full bg-tealAccent/80 text-white flex items-center justify-center"><i class="fas fa-download text-[10px]"></i></a>
                                    </div>
                                </div>
                                <p class="text-[9px] font-bold text-center py-2 text-gray-600 truncate px-2">\${doc.label}</p>
                            </div>\\\`;
                        }).join('')}
                    </div>
                </div>\\\`;
            }

            const proyectosHtml = proyectos.map(p => {
                const pip = pipelines.find(pl => pl.id === p.pipeline_id) || { nombre: 'Pipeline', color: '#0d9488' };
                const isCompleted = p.estado === 'Completado' || p.fase_id === 'Completado';
                let faseNom = 'Completado';
                if (!isCompleted && p.fase_id) {
                    const f = fasesAll.find(x => x.id === p.fase_id);
                    if (f) faseNom = f.nombre;
                }

                // Gather files for this project
                const pFiles = [];
                const respuestas = (db2.Respuestas_Dinamicas || []).filter(r => r.proyecto_id === p.id);
                const campos = db2.Admin_Campos_Formulario || [];
                respuestas.forEach(r => {
                    const c = campos.find(x => x.id === r.campo_id);
                    if (c && c.tipo === 'Archivo' && r.valor && r.valor.startsWith('http')) {
                        pFiles.push({ src: r.valor, label: c.etiqueta, id: r.campo_id });
                    }
                });

                // Office attachments matching pipeline
                const adj = cli.adjuntos_oficina || {};
                const pNameLower = pip.nombre.toLowerCase();
                if (pNameLower.includes('solar') && adj.contrato_solar_url) pFiles.push({ src: adj.contrato_solar_url, label: 'Contrato Solar' });
                else if (pNameLower.includes('water') && adj.contrato_water_url) pFiles.push({ src: adj.contrato_water_url, label: 'Contrato Water' });
                else if (pNameLower.includes('home') && adj.contrato_home_url) pFiles.push({ src: adj.contrato_home_url, label: 'Contrato Home' });
                else if (adj.contrato_url) pFiles.push({ src: adj.contrato_url, label: 'Contrato (General)' });

                if (adj.app_url) pFiles.push({ src: adj.app_url, label: 'Hoja de Aplicación' });
                if (adj.orden_trabajo_url) pFiles.push({ src: adj.orden_trabajo_url, label: 'Orden de Trabajo' });
                const rUrl = adj.recibo_url || adj.recibo_vendedor_url || adj.recibo_tecnico_url;
                if (rUrl) pFiles.push({ src: rUrl, label: 'Recibo de Pago' });

                const filesGrid = pFiles.length > 0 ? pFiles.map((f, i) => {
                    const isImage = f.src.startsWith('data:image') || f.src.match(/\\.(jpg|jpeg|png|gif|webp)/i);
                    return \\\`
                    <div class="group relative bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all">
                        <div class="relative aspect-[4/3]">
                            \${isImage 
                              ? \\\`<img src="\${f.src}" class="w-full h-full object-cover group-hover:scale-105 transition-transform">\\\`
                              : \\\`<div class="w-full h-full flex flex-col items-center justify-center bg-gray-50"><i class="fas fa-file-pdf text-3xl text-red-400"></i></div>\\\`
                            }
                            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button onclick="window.openFilePreview('\${p.id}_\${i}','\${f.label}',{valor:'\${f.src}'})" class="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center"><i class="fas fa-expand text-[10px]"></i></button>
                                <a href="\${f.src}" download="\${f.label}" class="w-8 h-8 rounded-full bg-tealAccent/80 text-white flex items-center justify-center"><i class="fas fa-download text-[10px]"></i></a>
                            </div>
                        </div>
                        <div class="px-2 py-2 flex items-center justify-between border-t border-gray-100">
                            <p class="text-[9px] font-bold text-gray-700 truncate">\${f.label}</p>
                        </div>
                    </div>\\\`;
                }).join('') : \\\`<p class="col-span-full text-[10px] text-gray-400 font-bold uppercase italic text-center py-4">Sin archivos en este proyecto</p>\\\`;

                return \\\`
                <div class="mb-4 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div class="flex items-center justify-between p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors" style="border-left: 4px solid \${pip.color}" onclick="this.nextElementSibling.classList.toggle('hidden'); const i = this.querySelector('.fa-chevron-down'); if(i) { i.style.transform = this.nextElementSibling.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)'; i.style.transition = 'transform 0.2s'; }">
                        <div class="flex items-center gap-3">
                            <span class="text-xs font-black uppercase text-gray-800 tracking-wider">\${pip.nombre}</span>
                            <span class="px-2 py-0.5 rounded bg-gray-100 text-[9px] font-bold text-gray-500 uppercase">\${p.id.substring(0,8)}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-[9px] font-bold text-gray-400 uppercase">Fase:</span>
                            <span class="px-2 py-1 rounded-full text-[10px] font-black uppercase" style="background:\${isCompleted ? '#10b98115' : pip.color+'15'}; color:\${isCompleted ? '#10b981' : pip.color};">\${faseNom}</span>
                            <button class="ml-2 text-gray-400 hover:text-tealAccent transition-colors">
                                <i class="fa-solid fa-chevron-down" style="transform: rotate(180deg);"></i>
                            </button>
                        </div>
                    </div>
                    <div class="p-4 bg-gray-50/50">
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            \${filesGrid}
                        </div>
                    </div>
                </div>\\\`;
            }).join('');

            galleryCont.innerHTML = generalDocsHtml + proyectosHtml;

        } else {
            badge.textContent = \\\`0 PROYECTOS\\\`;
            galleryCont.innerHTML = \\\`
                <div class="col-span-full py-20 text-center opacity-30">
                    <i class="fa-solid fa-folder-open text-4xl mb-3"></i>
                    <p class="text-[10px] font-black uppercase tracking-[0.2em]">El cliente no tiene proyectos</p>
                </div>
            \\\`;
        }`;
content = content.replace(/\\\\\`/g, '`');
const result = [...lines.slice(0, start), newCode.replace(/\\\\\`/g, '`'), ...lines.slice(end)].join('\n');
fs.writeFileSync(file, result, 'utf8');
console.log('done');

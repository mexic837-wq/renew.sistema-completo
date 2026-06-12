import sys

file_path = 'js/screens/projectDetail.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """       let firstVal = (fileAnswers[c.id] || val);
       let valCount = 1;
       if (firstVal && firstVal.includes(',')) {
           const parts = firstVal.split(',').map(s=>s.trim()).filter(s=>s);
           if (parts.length > 0) {
               firstVal = parts[0];
               valCount = parts.length;
           }
       }

       const isImage = firstVal && (firstVal.startsWith('data:image') || firstVal.match(/\\.(jpg|jpeg|png|gif|webp|svg)/i));
       const donePhotoSrc = isDone && isImage ? firstVal : (deal.id_photo?.startsWith('data:image') ? deal.id_photo : null);

       if (isDone) {
         // LOCKED: field already has a value — show as completed, no re-upload allowed
         html = `
          <div class="upload-area has-file" id="ubox_${c.id}"
               style="margin-bottom:16px;cursor:default;display:block;border-color:${pipeline.color};background:${pipeline.color}15;padding:12px 16px;position:relative;">
            <div style="display:flex;align-items:center;gap:12px;">
              ${donePhotoSrc
                ? `<img src="${donePhotoSrc}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;border:2px solid ${pipeline.color}40;flex-shrink:0;">`
                : `<div style="width:36px;height:36px;border-radius:50%;background:${pipeline.color}20;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${pipeline.color}" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                   </div>`
              }
              <div style="flex:1;min-width:0;">
                <p style="font-size:0.7rem;font-weight:800;text-transform:uppercase;color:${pipeline.color};letter-spacing:0.05em;margin:0;">${valCount > 1 ? valCount + ' Archivos Cargados' : 'Archivo Cargado'}</p>
                <p style="font-size:0.7rem;color:var(--text-muted);margin:0;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.etiqueta}</p>
              </div>
              <div style="background:${pipeline.color}20;border-radius:50%;width:28px;height:28px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${pipeline.color}" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              ${val ? `<button onclick="event.preventDefault(); event.stopPropagation(); window.deleteProjectDetailFile('${deal.id}', '${c.id}', '${val}');" style="position:absolute; top:-6px; right:-6px; background:#ef4444; color:white; border:none; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.2);"><i class="fas fa-times" style="font-size:10px;"></i></button>` : ''}
            </div>
          </div>
         `;"""

replacement = """       let firstVal = (fileAnswers[c.id] || val);
       let valCount = 1;
       if (firstVal && firstVal.includes(',')) {
           const parts = firstVal.split(',').map(s=>s.trim()).filter(s=>s);
           if (parts.length > 0) {
               firstVal = parts[0];
               valCount = parts.length;
           }
       }

       const isImage = firstVal && (firstVal.startsWith('data:image') || firstVal.match(/\\.(jpg|jpeg|png|gif|webp|svg)/i));
       const donePhotoSrc = isDone && isImage ? firstVal : (deal.id_photo?.startsWith('data:image') ? deal.id_photo : null);

       if (isDone) {
         // Render gallery of thumbnails and allow adding more
         const parts = (fileAnswers[c.id] || val || '').split(',').map(s=>s.trim()).filter(s=>s && s !== 'No subido' && s !== 'No provisto');
         
         const thumbnailsHtml = parts.map((fUrl, i) => {
             const isImg = fUrl.startsWith('data:image') || fUrl.match(/\\.(jpg|jpeg|png|gif|webp|svg)/i);
             const safeLabel = (c.etiqueta || '').replace(/'/g, "\\\\'");
             return `
               <div class="group relative rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center" style="width: 48px; height: 48px; flex-shrink: 0;">
                 ${isImg
                   ? `<img src="${fUrl}" class="w-full h-full object-cover" />`
                   : `<i class="fas fa-file-pdf text-red-400 text-xl"></i>`
                 }
                 <button onclick="event.preventDefault(); event.stopPropagation(); if(typeof window.openFilePreview === 'function') { window.openFilePreview('${c.id}', '${safeLabel}', { valor: '${fUrl}' }); } else { window.open('${fUrl}', '_blank'); }" class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                   <i class="fas ${isImg ? 'fa-eye' : 'fa-download'} text-white text-xs"></i>
                 </button>
                 <button onclick="event.preventDefault(); event.stopPropagation(); window.deleteProjectDetailFile('${deal.id}', '${c.id}', '${fUrl}');" style="position:absolute; top:-2px; right:-2px; background:#ef4444; color:white; border:none; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.2);"><i class="fas fa-times" style="font-size:8px;"></i></button>
               </div>
             `;
         }).join('');

         html = `
          <div class="upload-area has-file" id="ubox_${c.id}"
               style="margin-bottom:16px;display:block;border-color:${pipeline.color};background:${pipeline.color}15;padding:12px 16px;position:relative;border-radius:12px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
              <div style="flex:1;min-width:0;">
                <p style="font-size:0.7rem;font-weight:800;text-transform:uppercase;color:${pipeline.color};letter-spacing:0.05em;margin:0;">${parts.length > 1 ? parts.length + ' Archivos Cargados' : 'Archivo Cargado'}</p>
                <p style="font-size:0.7rem;color:var(--text-muted);margin:0;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.etiqueta}</p>
              </div>
              ${!isLocked ? `
              <label for="df_${c.id}" style="background:${pipeline.color}; color:white; padding:6px 12px; border-radius:8px; font-size:0.7rem; font-weight:800; cursor:pointer; text-transform:uppercase; display:flex; align-items:center; gap:6px;">
                <i class="fas fa-plus"></i> Añadir
              </label>
              <input type="file" id="df_${c.id}" accept="image/*,.pdf" multiple style="display:none" ${disabledAttr}/>
              ` : ''}
            </div>
            
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
               ${thumbnailsHtml}
            </div>
            <p id="ulbl_${c.id}" style="display:none;"></p>
          </div>
         `;"""

# Normalize line endings
content = content.replace('\\r\\n', '\\n')
target = target.replace('\\r\\n', '\\n')
replacement = replacement.replace('\\r\\n', '\\n')

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS: Python string replacement applied.')
else:
    print('ERROR: Target string not found in content.')
    sys.exit(1)

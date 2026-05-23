const fs = require('fs');
const file = 'c:/Users/LENOVO/Downloads/renew-sistema-completo-main/renew.sistema-completo-main/js/admin-app.js';
let content = fs.readFileSync(file, 'utf8');

// Use regex to replace the entire window.handleDrawerFileUpload and window.saveDynamicFields definitions
const replaceRegex = /window\.handleDrawerFileUpload = async function.*?};[\s\S]*?window\.saveDynamicFields = async function.*?};\s*/s;

const newCode = `
window.handleDrawerFileUpload = async function(projectId, campoId, inputEl) {
    if (!inputEl.files || inputEl.files.length === 0) return;
    const file = inputEl.files[0];
    const label = inputEl.nextElementSibling;
    const originalText = label.innerText;
    
    try {
        label.innerText = 'Subiendo...';
        label.style.opacity = '0.7';
        
        let fileUrl = '';
        if (typeof uploadFile === 'function') {
            fileUrl = await uploadFile(file, 'documents');
        } else {
            fileUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
        
        if (!fileUrl) throw new Error("No URL generated");
        
        await window.saveDynamicFields(projectId, { [campoId]: fileUrl });
        showToast('Archivo subido con éxito', 'success');
        
        if (window.openKanbanDrawer && window._currentDrawerPhaseId !== undefined) {
             window.openKanbanDrawer(projectId, window._currentDrawerPhaseId);
        }
    } catch(e) {
        console.error("Upload error detallado:", e);
        alert('Error al subir: ' + e.message);
        showToast('Error al subir archivo', 'error');
        label.innerText = originalText;
        label.style.opacity = '1';
    }
};

window.saveDynamicFields = async function(dealId, respuestas) {
    const db = getDB();
    if (!db.Respuestas_Dinamicas) db.Respuestas_Dinamicas = [];
    Object.keys(respuestas).forEach(campoId => {
        const val = respuestas[campoId];
        if (val === undefined || val === null) return;
        const exist = db.Respuestas_Dinamicas.find(r => r.proyecto_id === dealId && r.campo_id === campoId);
        if (exist) {
            exist.valor = val;
        } else {
            db.Respuestas_Dinamicas.push({
                id: genId('resp', db),
                proyecto_id: dealId,
                campo_id: campoId,
                valor: val
            });
        }
    });
    const validCampoIds = new Set((db.Admin_Campos_Formulario || []).map(c => c.id));
    const misRespuestas = db.Respuestas_Dinamicas.filter(r => r.proyecto_id === dealId && validCampoIds.has(r.campo_id));
    if (misRespuestas.length > 0) {
        await saveGranular('respuestas_dinamicas', misRespuestas);
    }
};
`;

if (replaceRegex.test(content)) {
    content = content.replace(replaceRegex, newCode);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Successfully replaced functions.');
} else {
    console.log('Regex did not match.');
}

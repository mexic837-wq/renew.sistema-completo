const fs = require('fs');
const file = 'c:/Users/LENOVO/Downloads/renew-sistema-completo-main/renew.sistema-completo-main/js/admin-app.js';
let content = fs.readFileSync(file, 'utf8');

const uploadFunc = `
window.handleDrawerFileUpload = async function(projectId, campoId, inputEl) {
    if (!inputEl.files || inputEl.files.length === 0) return;
    const file = inputEl.files[0];
    const label = inputEl.nextElementSibling;
    const originalText = label.innerText;
    
    try {
        label.innerText = 'Subiendo...';
        label.style.opacity = '0.7';
        
        // Asumiendo que la funcion uploadFile de api.js esta disponible globalmente o exportada
        // En admin-app.js se suele importar o usar uploadFile
        let fileUrl = '';
        if (typeof uploadFile === 'function') {
            fileUrl = await uploadFile(file, 'documents');
        } else {
            // Fallback base64 temporal si uploadFile falla
            fileUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
        
        if (!fileUrl) throw new Error("No URL generated");
        
        await saveDynamicFields(projectId, { [campoId]: fileUrl });
        showToast('Archivo subido con éxito', 'success');
        
        if (window.openKanbanDrawer && window._currentDrawerPhaseId !== undefined) {
             window.openKanbanDrawer(projectId, window._currentDrawerPhaseId);
        }
    } catch(e) {
        console.error("Upload error:", e);
        showToast('Error al subir archivo', 'error');
        label.innerText = originalText;
        label.style.opacity = '1';
    }
};
`;

if (!content.includes('window.handleDrawerFileUpload =')) {
    content += '\n' + uploadFunc;
    fs.writeFileSync(file, content, 'utf8');
    console.log('Appended window.handleDrawerFileUpload');
} else {
    console.log('Already exists');
}

const fs = require('fs');
const file = 'c:/Users/LENOVO/Downloads/renew-sistema-completo-main/renew.sistema-completo-main/js/admin-app.js';
let content = fs.readFileSync(file, 'utf8');

const saveFunc = `
window.saveDynamicFields = async function(dealId, respuestas) {
    const db = getDB();
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
    const misRespuestas = (db.Respuestas_Dinamicas || []).filter(r => r.proyecto_id === dealId && validCampoIds.has(r.campo_id));
    if (misRespuestas.length > 0) {
        await saveGranular('respuestas_dinamicas', misRespuestas);
    }
};
`;

if (!content.includes('window.saveDynamicFields =')) {
    content += '\n' + saveFunc;
    fs.writeFileSync(file, content, 'utf8');
    console.log('Appended window.saveDynamicFields');
} else {
    console.log('Already exists');
}

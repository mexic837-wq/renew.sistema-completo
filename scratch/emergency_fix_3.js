const fs = require('fs');
const path = 'c:/Users/LENOVO/Downloads/renew-sistema-completo-main/renew.sistema-completo-main/js/admin-app.js';
let content = fs.readFileSync(path, 'utf8');

// Regex to match the mangled line 7692 regardless of exact whitespace
const badRegex = /const isWorkOrder = \(type === 'WORK_ORDER_SUBMITTED'\);window\._verRecibosWorker = async function\(workerId, workerName\) \{/;

const goodLines = `    const isWorkOrder = (type === 'WORK_ORDER_SUBMITTED');
    const { proyectoId, pdfUrl } = e.data;

    if (!pdfUrl) {
        console.warn('[ADMIN] No pdfUrl in message - skipping client profile update.');
        return;
    }

    try {
        // Resolve which client this project belongs to
        const db = getDB();
        let proy = (db.Proyectos_Dinamicos || []).find(p => p.id === proyectoId);
        
        // Fallback: normalize ID (handles RENEW- prefixes, dashes, etc.)
        if (!proy && proyectoId) {
            const norm = String(proyectoId).toLowerCase().replace('renew-', '').replace(/-/g, '_');
            proy = (db.Proyectos_Dinamicos || []).find(p => p.id === norm || p.id === \`proy_\${norm}\`);
        }

        if (!proy?.cliente_id) {
            console.warn(\`[ADMIN] Could not resolve project "\${proyectoId}" to a client - PDF URL not saved locally.\`);
            return;
        }

        const clientId = proy.cliente_id;
        const cli = (db.Clientes_Maestro || []).find(c => c.id === clientId);
        if (!cli) {
            console.warn(\`[ADMIN] Client "\${clientId}" not found in local DB.\`);
            return;
        }

        // Build the updated adjuntos_oficina object (preserve existing keys)
        if (!cli.adjuntos_oficina || Array.isArray(cli.adjuntos_oficina)) {
            cli.adjuntos_oficina = {};
        }

        if (isWorkOrder) {
            cli.adjuntos_oficina.orden_trabajo_url = pdfUrl;
            cli.adjuntos_oficina.ultima_orden_fecha = new Date().toISOString();
        } else {
            cli.adjuntos_oficina.app_url = pdfUrl;
            cli.adjuntos_oficina.ultima_credit_fecha = new Date().toISOString();
        }

        // Persist both locally (cachedDB) and to Supabase
        await updateClientMaestro(clientId, { adjuntos_oficina: cli.adjuntos_oficina });
        console.log(\`[ADMIN] Client "\${clientId}" updated with \${isWorkOrder ? 'Work Order' : 'Credit App'} PDF URL.\`);

        // If the client detail modal is open for this client, refresh it
        if (state.activeClientId === clientId) {
            await showClientDetail(clientId);
        }

        showToast(\`Documento vinculado al perfil del cliente correctamente.\`, 'success');
    } catch (err) {
        console.error('[ADMIN] Error saving PDF URL to client profile:', err);
    }
});

// -- RECIBOS DE PAGO: Popup en perfil del trabajador ----------
window._verRecibosWorker = async function(workerId, workerName) {`;

if (badRegex.test(content)) {
    content = content.replace(badRegex, goodLines);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Fixed line 7692 with regex');
} else {
    console.log('Could not find the mangled line with regex');
}

import { getDB, _syncReceiptToClient } from '../js/api.js';

async function testSync() {
    const db = getDB();
    console.log("DB Loaded. Proyectos:", db.Proyectos_Dinamicos.length);
    
    // Find Pedro Gonzales project
    const proy = db.Proyectos_Dinamicos.find(p => p.id === 'proy_proy_21_pfco' || p.nombre_cliente?.includes('Pedro'));
    if (!proy) {
        console.log("Project not found");
        return;
    }
    console.log("Found project:", proy.id, proy.nombre_cliente);
    
    try {
        // Test sync
        await _syncReceiptToClient(proy.id, 'http://example.com/test.pdf', 'Recibo de Comisión Vendedor', 'vendedor');
        console.log("Sync done.");
    } catch (e) {
        console.error("Sync error:", e);
    }
}
testSync();

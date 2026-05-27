const fs = require('fs');
const dbPath = './db.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

let added = 0;
const pipelines = db.Admin_Pipelines || [];

db.Clientes_Maestro.forEach(cli => {
    if (cli.macro_estado === 'Cliente') {
        const hasProject = (db.Proyectos_Dinamicos || []).some(p => p.cliente_id === cli.id);
        if (!hasProject) {
            // Determine pipeline
            let pipelineToUse = null;
            const depts = Array.isArray(cli.departamentos_activos) && cli.departamentos_activos.length ? cli.departamentos_activos : (cli.departamento ? [cli.departamento] : []);
            if (depts.length > 0) {
                const deptStr = depts[0].toLowerCase();
                pipelineToUse = pipelines.find(pip => pip.nombre.toLowerCase().includes(deptStr.replace('renew ', '').trim()));
            }
            if (!pipelineToUse) {
                pipelineToUse = pipelines.find(pip => pip.nombre.toLowerCase().includes('water')); // fallback
            }

            if (pipelineToUse) {
                const newProy = {
                    id: 'RENEW-PROY_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                    cliente_id: cli.id,
                    pipeline_id: pipelineToUse.id,
                    fase_id: 'Completado',
                    estado: 'Completado',
                    responsable_id: cli.vendedor_asignado_id || cli.creador_id,
                    creador_id: cli.creador_id || 'system',
                    created_at: new Date().toISOString(),
                    fecha: new Date().toISOString(),
                    fecha_cierre: new Date().toISOString()
                };
                db.Proyectos_Dinamicos = db.Proyectos_Dinamicos || [];
                db.Proyectos_Dinamicos.push(newProy);
                added++;
            }
        }
    }
});

if (added > 0) {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log(`Added ${added} missing projects.`);
} else {
    console.log('No missing projects found.');
}

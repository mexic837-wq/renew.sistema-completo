
import { getDB } from './js/api.js';
const db = getDB();
const waterPip = db.Admin_Pipelines.find(p => p.nombre.toLowerCase().includes('water'));
if (waterPip) {
    console.log('Water Pipeline ID:', waterPip.id);
    const phases = db.Admin_Fases.filter(f => f.pipeline_id === waterPip.id).sort((a,b) => a.orden - b.orden);
    phases.forEach(f => console.log(`Phase ${f.orden}: ${f.nombre} (ID: ${f.id})`));
} else {
    console.log('Water Pipeline not found');
}

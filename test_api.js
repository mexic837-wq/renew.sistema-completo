const fs = require('fs');
fetch('http://127.0.0.1:3010/api/db').then(r=>r.json()).then(async db => {
    db.Counters.cli = (db.Counters.cli || 0) + 1;
    const newId = 'cli_' + db.Counters.cli;
    console.log('New ID:', newId);
    db.Clientes_Maestro.push({
        id: newId,
        nombre: 'Test API DB 2',
        fecha_creacion: new Date().toISOString(),
        estado: 'Lead',
        macro_estado: 'Prospecto',
        departamentos_activos: ['Water'],
        departamento: 'Water'
    });
    
    const res = await fetch('http://127.0.0.1:3010/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(db)
    });
    const resJson = await res.json();
    console.log('POST result:', resJson);
}).catch(e => console.log('Err:', e.message));

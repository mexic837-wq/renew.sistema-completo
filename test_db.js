const fs = require('fs');
fetch('http://localhost:3010/api/db').then(r=>r.json()).then(async db => {
    db.Counters.cli = (db.Counters.cli || 0) + 1;
    const newId = 'cli_' + db.Counters.cli;
    db.Clientes_Maestro.push({
        id: newId,
        nombre: 'Test API DB',
        fecha_creacion: new Date().toISOString(),
        estado: 'Lead',
        macro_estado: 'Prospecto',
        departamentos_activos: ['Water'],
        departamento: 'Water'
    });
    
    const res = await fetch('http://localhost:3010/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(db)
    });
    const resJson = await res.json();
    console.log(resJson);
});

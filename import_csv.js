const fs = require('fs');
const http = require('http');

const CSV_PATH = require('path').join(require('os').homedir(), 'Downloads', 'contacts - contacts.csv');

function parseCSV(text) {
    const results = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (inQuotes) {
            if (char === '"') {
                if (nextChar === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                row.push(field);
                field = '';
            } else if (char === '\n' || char === '\r') {
                if (field !== '' || row.length > 0) {
                    row.push(field);
                    results.push(row);
                    row = [];
                    field = '';
                }
                if (char === '\r' && nextChar === '\n') {
                    i++;
                }
            } else {
                field += char;
            }
        }
    }
    if (field !== '' || row.length > 0) {
        row.push(field);
        results.push(row);
    }
    return results;
}

console.log('Buscando archivo en:', CSV_PATH);

if (!fs.existsSync(CSV_PATH)) {
    console.error('❌ No se encontró el archivo contacts - contacts.csv');
    process.exit(1);
}

const csvData = fs.readFileSync(CSV_PATH, 'utf8');
const rows = parseCSV(csvData);

if (rows.length < 2) {
    console.error('❌ El archivo está vacío o no tiene datos.');
    process.exit(1);
}

const headers = rows[0].map(h => h.trim());
console.log('Headers detectados:', headers.join(' | '));

const idxName = headers.findIndex(h => h.toLowerCase() === 'given name');
const idxEmail = headers.findIndex(h => h.toLowerCase() === 'e-mail 1 - value');
const idxPhone = headers.findIndex(h => h.toLowerCase() === 'phone 1 - value');
const idxDir = headers.findIndex(h => h.toLowerCase() === 'address 1 - formatted');
const idxCity = headers.findIndex(h => h.toLowerCase() === 'address 1 - city');
const idxState = headers.findIndex(h => h.toLowerCase() === 'address 1 - state');
const idxZip = headers.findIndex(h => h.toLowerCase() === 'custom field 1 - value');

const leads = [];

for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const nombre = cols[idxName] ? cols[idxName].trim() : '';
    if (!nombre) continue;

    const direccion = cols[idxDir] ? cols[idxDir].replace(/\n/g, ', ').trim() : '';

    leads.push({
        nombre,
        email: idxEmail !== -1 ? (cols[idxEmail] || '').trim() : '',
        telefono: idxPhone !== -1 ? (cols[idxPhone] || '').trim() : '',
        direccion,
        ciudad: idxCity !== -1 ? (cols[idxCity] || '').trim() : '',
        estado_geo: idxState !== -1 ? (cols[idxState] || '').trim() : '',
        zip_code: idxZip !== -1 ? (cols[idxZip] || '').trim() : '',
        fuente: 'importacion_csv'
    });
}

console.log(`✅ Se parsearon ${leads.length} leads. Ejemplo:`, leads[0]);

const sendLeads = async () => {
    const payload = JSON.stringify({ leads });
    const options = {
        hostname: 'localhost',
        port: 3010,
        path: '/api/cc-prospectos',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log('🚀 Inyección exitosa.');
            } else {
                console.error('❌ Error:', data);
            }
        });
    });

    req.on('error', e => console.error('❌ Error de conexión:', e.message));
    req.write(payload);
    req.end();
};

sendLeads();

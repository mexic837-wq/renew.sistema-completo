const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = '18fw_U53uO4HSZB1bzyC9re8Y9QsQztc4YYWA5Ri4RS4';
const RANGE = 'LISTA UNIFICADA!A1:N1000'; // Assuming data doesn't exceed 1000 rows

async function syncPreciosFromSheets(supabase) {
    try {
        console.log('[GoogleSheets Sync] Iniciando sincronización...');
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(__dirname, 'credenciales-calendario.json'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: RANGE
        });

        const rows = res.data.values;
        if (!rows || rows.length === 0) {
            console.log('[GoogleSheets Sync] No se encontraron datos en la hoja.');
            return { success: false, error: 'No data found' };
        }

        // Estructura de columnas basada en la imagen:
        // A: vacío
        // B: CODIGO (index 1)
        // C: PRODUCTO (index 2)
        // D: MEDIDA (index 3)
        // E: BOTON (index 4)
        // F: COLOR (index 5)
        // G: OFICINA (index 6)
        // H: ANALISTA (index 7)
        // I: VENDEDOR (index 8)
        // J: JUNIOR (index 9)
        // K: INICIANTE (index 10)
        // L: NOVATO (index 11)
        // M: PRECIO MIN (index 12)
        // N: PRECIO MAX (index 13)

        const productsToUpsert = [];
        let currentCategory = 'GENERAL';

        // La data real empieza después de los encabezados (fila 4 en Excel = index 3)
        for (let i = 3; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const codigo = row[1] ? row[1].trim() : '';
            
            // Detectar si es una fila de categoría (ej: "LINEA RENEW ECONÓMICA")
            // Usualmente el código está vacío y hay texto en otra celda, o el texto de categoría está en B
            if (codigo && !row[2] && !row[6]) {
                // Es un título de categoría en la columna B
                currentCategory = codigo;
                continue;
            }

            if (!codigo) continue; // Si no hay código, ignorar

            const parsePrice = (val) => {
                if (!val) return 0;
                if (typeof val === 'number') return val;
                const cleaned = val.toString().replace(/[$,]/g, '').trim();
                const num = parseFloat(cleaned);
                return isNaN(num) ? 0 : num;
            };

            const producto = {
                codigo: codigo,
                nombre: row[2] ? row[2].trim() : '',
                medida: row[3] ? row[3].trim() : '',
                boton: row[4] ? row[4].trim() : '',
                color: row[5] ? row[5].trim() : '',
                precio_oficina: parsePrice(row[6]),
                precio_analista: parsePrice(row[7]),
                precio_vendedor: parsePrice(row[8]),
                precio_junior: parsePrice(row[9]),
                precio_iniciante: parsePrice(row[10]),
                precio_subvende: parsePrice(row[11]),
                precio_minimo: parsePrice(row[12]),
                precio_maximo: parsePrice(row[13]),
                categoria: currentCategory,
                sede: 'todas',
                es_activo: true,
                precio_full: 0 // Placeholder
            };

            productsToUpsert.push(producto);
        }

        console.log(`[GoogleSheets Sync] Se parsearon ${productsToUpsert.length} productos.`);

        if (productsToUpsert.length > 0) {
            // Sincronizar con Supabase
            // Como upsert por defecto requiere matching en la Primary Key (id),
            // primero debemos obtener los productos actuales para mapear los ids por codigo,
            // o usar 'codigo' como constraint si está configurado en Supabase (difícil saberlo sin ver el schema).
            // Lo más seguro es buscar el ID si existe, o generar uno si no existe.

            const { data: existingProducts, error: fetchErr } = await supabase
                .from('water_productos')
                .select('id, codigo');

            if (fetchErr) {
                console.error('[GoogleSheets Sync] Error fetching existing products:', fetchErr);
                return { success: false, error: fetchErr.message };
            }

            const codeToIdMap = {};
            if (existingProducts) {
                existingProducts.forEach(p => {
                    if (p.codigo) codeToIdMap[p.codigo] = p.id;
                });
            }

            const finalPayload = productsToUpsert.map(p => {
                if (codeToIdMap[p.codigo]) {
                    p.id = codeToIdMap[p.codigo]; // Actualiza el existente
                } else {
                    p.id = 'prec_' + Date.now() + '_' + Math.floor(Math.random() * 10000); // Nuevo
                }
                return p;
            });

            const { error: upsertErr } = await supabase
                .from('water_productos')
                .upsert(finalPayload, { onConflict: 'id' });

            if (upsertErr) {
                console.error('[GoogleSheets Sync] Error upserting to Supabase:', upsertErr);
                return { success: false, error: upsertErr.message };
            }

            console.log('[GoogleSheets Sync] ¡Sincronización completada con éxito!');
            return { success: true, count: finalPayload.length };
        } else {
            return { success: true, count: 0, message: 'No valid products found' };
        }

    } catch (err) {
        console.error('[GoogleSheets Sync] Excepción:', err);
        return { success: false, error: err.message };
    }
}

module.exports = { syncPreciosFromSheets };

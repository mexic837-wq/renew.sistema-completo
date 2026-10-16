const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = '18fw_U53uO4HSZB1bzyC9re8Y9QsQztc4YYWA5Ri4RS4';
const RANGE = 'LISTA UNIFICADA!A1:O1000'; // Assuming data doesn't exceed 1000 rows

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

        // Estructura de columnas en LISTA UNIFICADA:
        // A: CODIGO (index 0)
        // B: PRODUCTO (index 1)
        // C: MEDIDA (index 2)
        // D: BOTON (index 3)
        // E: COLOR (index 4)
        // F: OFICINA (index 5)
        // G: ANALISTA (index 6)
        // H: VENDEDOR (index 7)
        // I: JUNIOR (index 8)
        // J: INICIANTE (index 9)
        // K: NOVATO (index 10)
        // L: DEALER (index 11)
        // M: PRECIO MIN (index 12)
        // N: PRECIO MAX (index 13)

        const productsToUpsert = [];
        let currentCategory = 'GENERAL';

        // La data real empieza después de los encabezados (fila 4 en Excel = index 3)
        for (let i = 3; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const codigo = row[0] ? row[0].trim() : '';
            
            // Detectar si es una fila de categoría (ej: "LÍNEA RENEW ECONÓMICA")
            // Ahora CODIGO es row[0], PRODUCTO es row[1], OFICINA es row[5]
            if (codigo && !row[1] && !row[5]) {
                currentCategory = codigo;
                continue;
            }

            if (!codigo || !row[1]) continue; // Si no hay código o producto, ignorar

            const parsePrice = (val) => {
                if (!val) return 0;
                if (typeof val === 'number') return val;
                const cleaned = val.toString().replace(/[$,]/g, '').trim();
                const num = parseFloat(cleaned);
                return isNaN(num) ? 0 : num;
            };

            const precioDealer = parsePrice(row[11]);

            const producto = {
                codigo: codigo,
                nombre: row[1] ? row[1].trim() : '',
                medida: row[2] ? row[2].trim() : '',
                boton: row[3] ? row[3].trim() : '',
                color: row[4] ? row[4].trim() : '',
                precio_oficina: parsePrice(row[5]),
                precio_analista: parsePrice(row[6]),
                precio_vendedor: parsePrice(row[7]),
                precio_junior: parsePrice(row[8]),
                precio_iniciante: parsePrice(row[9]),
                precio_subvende: parsePrice(row[10]),
                precio_dealer: precioDealer,
                solo_equipo_grande: precioDealer,
                precio_minimo: parsePrice(row[12]),
                precio_maximo: parsePrice(row[13]),
                categoria: currentCategory,
                sede: 'todas',
                es_activo: true,
                precio_full: 0 // Placeholder
            };

            productsToUpsert.push(producto);
        }

        // Deduplicar por código (tomando el último encontrado si hay duplicados, ej. filas ocultas)
        const uniqueProducts = {};
        productsToUpsert.forEach(p => {
            uniqueProducts[p.codigo] = p;
        });
        const finalUniqueProductsToUpsert = Object.values(uniqueProducts);

        console.log(`[GoogleSheets Sync] Se parsearon ${finalUniqueProductsToUpsert.length} productos únicos (de ${productsToUpsert.length} filas leídas).`);

        if (finalUniqueProductsToUpsert.length > 0) {
            const { data: existingProducts, error: fetchErr } = await supabase
                .from('water_productos')
                .select('id, codigo, foto_url');

            if (fetchErr) {
                console.error('[GoogleSheets Sync] Error fetching existing products:', fetchErr);
                return { success: false, error: fetchErr.message };
            }

            const codeToIdMap = {};
            const codeToFotoMap = {};
            if (existingProducts) {
                existingProducts.forEach(p => {
                    if (p.codigo) {
                        codeToIdMap[p.codigo] = p.id;
                        if (p.foto_url) codeToFotoMap[p.codigo] = p.foto_url;
                    }
                });
            }

            const finalPayload = finalUniqueProductsToUpsert.map(p => {
                if (codeToIdMap[p.codigo]) {
                    p.id = codeToIdMap[p.codigo]; // Actualiza el existente
                    if (codeToFotoMap[p.codigo]) p.foto_url = codeToFotoMap[p.codigo];
                } else {
                    p.id = 'wp_' + Date.now() + '_' + Math.floor(Math.random() * 10000); // Nuevo
                }
                return p;
            });

            let { error: upsertErr } = await supabase
                .from('water_productos')
                .upsert(finalPayload, { onConflict: 'id' });

            // Si la tabla en Supabase aún no tiene la columna precio_dealer, guardamos usando solo_equipo_grande como respaldo
            if (upsertErr && upsertErr.message && upsertErr.message.includes('precio_dealer')) {
                console.warn('[GoogleSheets Sync] Columna precio_dealer no existe en DB, usando solo_equipo_grande como respaldo...');
                const fallbackPayload = finalPayload.map(({ precio_dealer, ...rest }) => rest);
                const retryRes = await supabase
                    .from('water_productos')
                    .upsert(fallbackPayload, { onConflict: 'id' });
                upsertErr = retryRes.error;
            }

            if (upsertErr) {
                console.error('[GoogleSheets Sync] Error upserting to Supabase:', upsertErr);
                return { success: false, error: upsertErr.message };
            }

            // Cleanup de productos duplicados creados por el bug anterior (id: prec_...)
            await supabase.from('water_productos').delete().like('id', 'prec_%');

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

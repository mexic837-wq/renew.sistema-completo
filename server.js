const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

// ── CONFIGURACIÓN SUPABASE ───────────────
const SUPABASE_URL = 'http://31.97.102.243:8001';
// URL pública del servidor (para generar URLs de archivos accesibles desde internet)
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.JlrSkGO6ZyAaaToY0xTLajbLsNuL8kn2QwCI3jrCeFs'; // secret: RenewJWTSuperSecret2026Key32Chars

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

// Alias para no romper las funciones que ya actualicé
const supabaseStorage = supabase;

const app = express();
const port = 3010;

// Prevent process from crashing on unhandled errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
});

app.use(cors());
app.use(express.json({ limit: '500mb' })); 
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use(express.static(path.join(__dirname)));
// Servir archivos subidos localmente (fotos de clientes, anuncios, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Chunked Upload State
const os = require('os');
const CHUNK_DIR = path.join(os.tmpdir(), 'renew-uploads');
if (!fs.existsSync(CHUNK_DIR)) fs.mkdirSync(CHUNK_DIR, { recursive: true });

// Static files are served above via express.static(__dirname)
// Explicit routes ensure SPAs load correctly for any non-API route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});
app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ── 1. DATABASE ENDPOINTS (100% SUPABASE) ──

// GET: Reconstruye el objeto DB completo desde Supabase
// Helper: Supabase query with timeout to avoid hanging indefinitely
const fetchWithTimeout = (table, timeoutMs = 30000) => {
    return new Promise(async (resolve) => {
        const timer = setTimeout(() => {
            console.warn(`[SUPABASE TIMEOUT] Table '${table}' did not respond within ${timeoutMs}ms — returning empty.`);
            resolve({ data: [] });
        }, timeoutMs);
        try {
            const { data, error } = await supabase.from(table).select('*');
            clearTimeout(timer);
            if (error) {
                console.error(`[SUPABASE ERROR] table ${table}:`, error);
                resolve({ data: [] });
            } else {
                resolve({ data });
            }
        } catch (e) {
            clearTimeout(timer);
            console.error(`[NETWORK ERROR] table ${table}:`, e);
            resolve({ data: [] });
        }
    });
};

const fixUrl = (url) => {
    if (typeof url !== 'string' || !url) return url;
    // Si ya tiene el proxy o es una URL local, no tocar
    if (url.startsWith('/api/storage-proxy/') || url.startsWith('blob:') || url.startsWith('data:')) return url;
    
    // Forzar el uso del proxy para cualquier URL que contenga la IP de Supabase o el path de storage
    if (url.includes('31.97.') || url.includes('/storage/v1/object/public/')) {
        const parts = url.split('/storage/v1/object/public/');
        const filePath = parts[parts.length - 1];
        return `/api/storage-proxy/${filePath.replace(/^\//, '')}`;
    }
    return url;
};

app.get('/api/db', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
        const tables = [
            'admin_pipelines', 'admin_fases', 'admin_campos_formulario', 'clientes_maestro', 
            'proyectos_dinamicos', 'respuestas_dinamicas', 'usuarios', 'academia_content', 
            'inventario_global', 'historial_inventario', 'anuncios_corporativos', 'partners_directorio', 'calendario_eventos',
            'recibos_pagos', 'water_productos', 'admin_catalogos', 'admin_meetings', 'admin_meetings_reads', 'mensajes_internos'
        ];
        
        const results = await Promise.all(tables.map(t => fetchWithTimeout(t)));
        
        const maxId = (arr, prefix) => {
            if (!arr || !arr.length) return `${prefix}1`;
            const nums = arr.map(i => {
                if (!i.id || !i.id.startsWith(prefix)) return 0;
                return parseInt(i.id.replace(prefix, ''), 10) || 0;
            });
            return `${prefix}${Math.max(0, ...nums) + 1}`;
        };

        // Mapeo selectivo para reconstruir la estructura rs_admin_db
        const db = {
            Admin_Pipelines:         results[0].data || [],
            Admin_Fases:             results[1].data || [],
            Admin_Campos_Formulario: results[2].data || [],
            Clientes_Maestro:        (results[3].data || []).map(c => {
                let adjOficina = c.adjuntos_oficina || null;
                if (adjOficina && typeof adjOficina === 'object') {
                    Object.keys(adjOficina).forEach(k => {
                        if (typeof adjOficina[k] === 'string') adjOficina[k] = fixUrl(adjOficina[k]);
                    });
                }
                return {
                    ...c,
                    foto: fixUrl(c.foto),
                    id_photo: fixUrl(c.id_photo || c.foto_id),
                    origen_tipo: c.origen_tipo || null,
                    origen_nombre: c.origen_nombre || null,
                    origen_id: c.origen_id || null,
                    vendedor_asignado_id: c.vendedor_asignado_id || null,
                    vendedor_asignado_nombre: c.vendedor_asignado_nombre || null,
                    // ── NUEVAS COLUMNAS (Módulo Clientes v2) ──
                    departamento:       c.departamento       || null,
                    adjunto_id_url:     fixUrl(c.adjunto_id_url),
                    adjunto_bill_url:   fixUrl(c.adjunto_bill_url),
                    adjunto_seguro_url: fixUrl(c.adjunto_seguro_url),
                    adjuntos_oficina:   adjOficina,
                    contrato_water_url: fixUrl(c.contrato_water_url),
                    macro_estado:       c.macro_estado       || null,
                    departamentos_activos: c.departamentos_activos || [],
                    fecha_inicio:       c.fecha_inicio       || null,
                    notas:              c.notas              || null,
                    creador_id:         c.origen_id          || null,
                    responsable_id:     c.vendedor_asignado_id || null,
                };
            }),
            Proyectos_Dinamicos:     results[4].data || [],
            Respuestas_Dinamicas:    results[5].data || [],
            Usuarios:                (results[6].data || []).map(u => ({
                    ...u,
                    foto:       fixUrl(u.foto),
                    w9_url:     fixUrl(u.w9_url || u.w9Url),
                    carnet_url: fixUrl(u.carnet_url || u.carnetUrl),
                    contrato_url: fixUrl(u.contrato_url || u.contratoUrl)
            })),
            academiaContent:         (results[7].data || []).map(item => ({
                id:             item.id,
                titulo:         item.titulo         || null,
                tipo:           item.tipo           || null,
                enlace:         item.enlace         || null,
                miniaturaUrl:   fixUrl(item.miniatura_url  || item.miniaturaUrl),
                permisos:       item.permisos       || [],
                fecha_creacion: item.fecha_creacion || null
            })),
            inventarioGlobal:        (results[8].data || []).map(item => ({
                id:          item.id,
                nombreItem:  item.nombre_item  || item.nombreItem  || null,
                ecosistema:  item.ecosistema   || null,
                category:    item.category     || null,
                locacion:    item.locacion     || null,
                storage:     item.storage      || null,
                stockActual: item.stock_actual || item.stockActual || 0
            })),
            historialInventario:     results[9].data || [],
            anuncios_corporativos:   (results[10].data || []).map(an => ({
                ...an,
                foto_url: fixUrl(an.foto_url)
            })),
            Admin_Proveedores:       (results[11].data || []).map(p => ({
                id:          p.id,
                empresa:     p.empresa_nombre || null,
                contacto:    p.contacto_principal || null,
                servicio:    p.categoria_servicio || null,
                telefono:    p.telefono || null,
                area:        p.area_cobertura || null,
                email:       p.email || null,
                w9Url:       p.w9_url || null,
                seguroUrl:   p.seguro_url || null,
                created_at:  p.fecha_registro || null
            })),
            calendario_eventos:      (results[12].data || []).map(ev => {
                let parsedColab = [];
                if (Array.isArray(ev.colaboradores)) {
                    parsedColab = ev.colaboradores.map(c => {
                        try {
                            let parsed = typeof c === 'string' ? JSON.parse(c) : c;
                            if (typeof parsed === 'string') parsed = JSON.parse(parsed); // Double unwrap just in case
                            return parsed;
                        } catch(e) {
                            return c;
                        }
                    });
                }
                return { ...ev, colaboradores: parsedColab, adjunto_url: fixUrl(ev.adjunto_url) };
            }),
            Recibos_Pagos:           (results[13].data || []).map(r => ({
                id:               r.id,
                proyecto_id:      r.proyecto_id   || null,
                tipo:             r.tipo          || null,
                trabajador_id:    r.trabajador_id || null,
                trabajador_nombre:r.trabajador_nombre || null,
                cliente_nombre:   r.cliente_nombre || null,
                direccion:        r.direccion     || null,
                fecha_recibo:     r.fecha_recibo  || null,
                datos_json:       r.datos_json    || {},
                pdf_url:          fixUrl(r.pdf_url),
                created_at:       r.created_at    || null
            })),
            Water_Productos:         (results[14].data || []).map(p => ({
                id:              p.id,
                nombre:          p.nombre         || null,
                codigo:          p.codigo         || null,
                descripcion:     p.descripcion    || null,
                categoria:       p.categoria      || null,
                foto_url:        fixUrl(p.foto_url),
                sede:            p.sede           || 'todas',
                medida:          p.medida         || null,
                boton:           p.boton          || null,
                color:           p.color          || null,
                precio_junior:   p.precio_junior   ?? null,
                precio_subvende: p.precio_subvende  ?? null,
                precio_vendedor: p.precio_vendedor  ?? null,
                precio_analista: p.precio_analista  ?? null,
                precio_oficina:  p.precio_oficina   ?? null,
                precio_full:     p.precio_full      ?? null,
                solo_equipo_grande: p.solo_equipo_grande ?? null,
                precio_minimo:   p.precio_minimo    ?? null,
                precio_maximo:   p.precio_maximo    ?? null,
                unidad:          p.unidad         || null,
                garantia:        p.garantia       || null,
                es_activo:       p.es_activo !== false,
                orden:           p.orden          || 0,
                notas:           p.notas          || null,
                pdf_url:         fixUrl(p.pdf_url),
                created_at:      p.created_at     || null,
                updated_at:      p.updated_at     || null
            })),
            Admin_Catalogos:         results[15].data || [],
            admin_meetings:          results[16].data || [],
            admin_meetings_reads:    results[17].data || [],
            mensajes_internos:       (results[18].data || []).map(m => ({
                ...m,
                image_url: fixUrl(m.image_url)
            })),
            // Compute counters dynamically from real data — avoids collision bugs
            Counters: {
                cli:   maxId(results[3].data,  'cli_'),
                proy:  maxId(results[4].data,  'proy_'),
                resp:  maxId(results[5].data,  'resp_'),
                pip:   maxId(results[0].data,  'pip_'),
                fase:  maxId(results[1].data,  'fase_'),
                campo: maxId(results[2].data,  'campo_'),
                proveedores: maxId(results[11].data, 'prv_'),
                calendario: maxId(results[12].data, 'ev_'),
            }
        };

        // Debug log for Chat messages count
        console.log(`[API/DB] Syncing ${db.mensajes_internos.length} internal messages.`);
        
        res.json(db);

        // Final Global Fix: Stringify everything and replace internal URLs globally
        const jsonString = JSON.stringify(db);
        const fixedJson = jsonString
            .replace(/https?:\/\/31\.97\.\d+\.\d+:\d+\/storage\/v1\/object\/public\//g, '/api/storage-proxy/')
            .replace(/https?:\/\/31\.97\.\d+\.\d+:\d+\//g, '/api/storage-proxy/')
            .replace(/https?:\/\/(api-renew|files-renew)\.0f2zfh\.easypanel\.host(\/storage\/v1)?(\/object\/public)?\//g, '/api/storage-proxy/');
        
        res.setHeader('Content-Type', 'application/json');
        res.send(fixedJson);
    } catch (error) {
        console.error('[SUPABASE ERROR] getDB:', error.message);
        res.status(500).json({ error: 'Fallo al recuperar datos de Supabase', details: error.message });
    }
});

// GET: Obtener info de un proyecto y su cliente asociado para auto-relleno
app.get('/api/project-info', async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'ID de proyecto requerido' });

        console.log(`[API] Fetching project info for: ${id}`);
        
        // 1. Obtener el proyecto
        const { data: proyecto, error: pErr } = await supabase
            .from('proyectos_dinamicos')
            .select('*')
            .eq('id', id)
            .single();
            
        if (pErr || !proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

        // 2. Obtener el cliente asociado
        const { data: cliente, error: cErr } = await supabase
            .from('clientes_maestro')
            .select('*')
            .eq('id', proyecto.cliente_id)
            .single();

        // 3. Limpiar URLs si existen
        if (cliente) {
            // No cleaning needed for standard Supabase setup
        }

        res.json({ proyecto, cliente });
    } catch (error) {
        console.error('[API ERROR] project-info:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST: Generar PDF del recibo y subir a Supabase Storage
app.post('/api/generate-receipt-pdf', async (req, res) => {
    try {
        const { reciboId } = req.body;
        if (!reciboId) return res.status(400).json({ error: 'ID de recibo requerido' });

        console.log(`[PDF] Generating PDF for receipt: ${reciboId}`);

        // 1. Obtener datos del recibo
        const { data: recibo, error: rErr } = await supabase
            .from('recibos_pagos')
            .select('*')
            .eq('id', reciboId)
            .single();

        if (rErr || !recibo) {
            console.error('[PDF] Receipt not found:', rErr);
            return res.status(404).json({ error: 'Recibo no encontrado' });
        }

        const isVendedor = recibo.tipo === 'vendedor';
        const templatePath = path.join(__dirname, isVendedor ? 'RECIBO_PAGO_ANALISTA.pdf' : 'RECIBO_INSTALACION.pdf');

        if (!fs.existsSync(templatePath)) {
            console.error('[PDF] Template missing:', templatePath);
            return res.status(500).json({ error: 'Plantilla PDF no encontrada en el servidor' });
        }

        // 2. Cargar el PDF y configurar fuentes
        const existingPdfBytes = fs.readFileSync(templatePath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        const { width, height } = firstPage.getSize();
        console.log(`[PDF-DIM] Template Size: ${width}x${height}`);

        const drawText = (text, x, y, size = 10, isBold = true) => {
            if (text === undefined || text === null || text === '') return;
            console.log(`[PDF-DRAW] "${text}" at (x: ${x}, y_calc: ${height - y})`);
            firstPage.drawText(String(text), {
                x,
                y: height - y,
                size,
                font: isBold ? font : fontRegular,
                color: rgb(0, 0, 0),
            });
        };

        const d = recibo.datos_json || {};

        if (isVendedor) {
            // --- RECIBO PAGO ANALISTA (Landscape 842x595) ---
            // y=0 es arriba, y=595 es abajo.
            drawText(d.sales_representative, 375, 205);
            drawText(d.check_number, 550, 185, 9);
            drawText(d.transfer_date, 660, 205, 9);
            const customerName = d.customer_name || recibo.cliente_nombre || 'N/A';
            drawText(customerName, 375, 230);
            drawText(d.finance_company, 375, 255);

            // Montos
            drawText(`$${Number(d.sales_amount || 0).toLocaleString('en-US',{minimumFractionDigits:2})}`, 450, 285);
            drawText(`${d.aprobacion_pct}%`, 530, 310);
            drawText(`$${Number(d.monto_aprobacion || 0).toLocaleString('en-US',{minimumFractionDigits:2})}`, 450, 335);

            // Costos (Columna derecha)
            drawText(`$${Number(d.cost || 0).toLocaleString('en-US',{minimumFractionDigits:2})}`, 680, 285);
            drawText(`${d.costo_plan_pct}%`, 680, 310);
            drawText(`$${Number(d.total_costo || 0).toLocaleString('en-US',{minimumFractionDigits:2})}`, 680, 335);
            drawText(`$${Number(d.total_analista || 0).toLocaleString('en-US',{minimumFractionDigits:2})}`, 680, 420);
            
            drawText(d.linea_pozo, 375, 395, 8, false);

            // Extra Charges
            let ey = 460; 
            (d.extra_charges || []).forEach((ex, idx) => {
                if (idx > 2) return; 
                drawText(ex.concepto, 375, ey, 8, false);
                drawText(`$${Number(ex.monto).toLocaleString('en-US',{minimumFractionDigits:2})}`, 680, ey, 8, false);
                ey += 18;
            });

            drawText(d.instalador, 375, 535);
            drawText(`$${Number(d.grand_total || 0).toLocaleString('en-US',{minimumFractionDigits:2})}`, 680, 565, 14);

        } else {
            // --- RECIBO INSTALACIÓN (Landscape 842x595) ---
            // Bajamos todo unos 40-50 px más para que entre en los cuadros
            drawText(d.installer_name || recibo.trabajador_nombre, 375, 245);
            drawText(d.customer_name || recibo.cliente_nombre, 375, 275);
            drawText(d.address || recibo.direccion, 375, 305, 9, false);
            drawText(d.date, 175, 350); // Movido a la derecha para no tapar "DATE:"

            let iy = 415; // Los productos empiezan más abajo de la franja verde
            (d.items || []).forEach((item, idx) => {
                if (idx > 5) return;
                drawText(item.description, 375, iy, 9, false);
                drawText(item.qty, 680, iy, 9, false);
                drawText(item.model, 740, iy, 9, false);
                iy += 22;
            });
            drawText(`${d.discount_pct || 0}%`, 720, 530);
            drawText(`$${Number(d.total_price || 0).toLocaleString('en-US',{minimumFractionDigits:2})}`, 720, 555, 12);
        }

        // 3. Generar y subir
        const pdfBytes = await pdfDoc.save();
        const fileName = `recibo_${reciboId}.pdf`;
        const { data: sData, error: sErr } = await supabase.storage
            .from('archivos_renew')
            .upload(`recibos/${fileName}`, pdfBytes, { contentType: 'application/pdf', upsert: true });

        if (sErr) throw sErr;

        // 4. URL y Update
        const { data: { publicUrl } } = supabase.storage
            .from('archivos_renew')
            .getPublicUrl(`recibos/${fileName}`);

        const cleanUrl = publicUrl;

        await supabase
            .from('recibos_pagos')
            .update({ pdf_url: cleanUrl })
            .eq('id', reciboId);

        // ── SINCRONIZACIÓN CON EL PROYECTO Y CLIENTE ──
        if (recibo.proyecto_id && d.campo_id) {
            console.log(`[PDF-SYNC] Vinculando PDF de recibo al campo ${d.campo_id} del proyecto ${recibo.proyecto_id}`);
            
            // 1. Actualizar respuesta dinámica para que aparezca el botón "Ver PDF" en el Kanban
            const { data: respExist } = await supabase.from('respuestas_dinamicas')
                .select('id')
                .eq('proyecto_id', recibo.proyecto_id)
                .eq('campo_id', d.campo_id)
                .single();

            if (respExist) {
                await supabase.from('respuestas_dinamicas')
                    .update({ valor: cleanUrl })
                    .eq('id', respExist.id);
            } else {
                await supabase.from('respuestas_dinamicas')
                    .insert({ 
                        id: `resp_rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                        proyecto_id: recibo.proyecto_id, 
                        campo_id: d.campo_id, 
                        valor: cleanUrl 
                    });
            }
            
            // 2. Actualizar metadatos del cliente para que aparezca en el perfil (Adjuntos Oficina)
            const { data: proy } = await supabase.from('proyectos_dinamicos')
                .select('cliente_id')
                .eq('id', recibo.proyecto_id)
                .single();
                
            if (proy && proy.cliente_id) {
                const { data: cli } = await supabase.from('clientes_maestro')
                    .select('adjuntos_oficina')
                    .eq('id', proy.cliente_id)
                    .single();
                
                let adjuntos = cli?.adjuntos_oficina;
                if (!adjuntos || Array.isArray(adjuntos)) adjuntos = {};
                
                // Guardar en múltiples llaves para asegurar compatibilidad con la UI
                adjuntos.recibo_url = cleanUrl; 
                if (isVendedor) {
                    adjuntos.recibo_vendedor_url = cleanUrl;
                    adjuntos.ultima_comision_fecha = new Date().toISOString();
                } else {
                    adjuntos.recibo_tecnico_url = cleanUrl;
                    adjuntos.ultima_instalacion_fecha = new Date().toISOString();
                }
                
                await supabase.from('clientes_maestro')
                    .update({ adjuntos_oficina: adjuntos })
                    .eq('id', proy.cliente_id);
                
                console.log(`[PDF-SYNC] ✅ Perfil del cliente ${proy.cliente_id} actualizado con recibo_url y detalles.`);
            }
        }

        console.log(`[PDF] ✅ Generación exitosa: ${cleanUrl}`);
        res.json({ success: true, url: cleanUrl });

    } catch (error) {
        console.error('[PDF ERROR]:', error);
        res.status(500).json({ error: 'Fallo al generar el PDF', details: error.message });
    }
});

// POST: Sincronización masiva (Upsert) a Supabase
// ── GOOGLE CALENDAR SYNC (SERVICE ACCOUNT) ──
app.post('/api/calendar/sync', async (req, res) => {
    try {
        const { eventData, calendarId } = req.body;
        const KEY_PATH = path.join(__dirname, 'credenciales-calendario.json');
        
        if (!fs.existsSync(KEY_PATH)) {
            console.error('[CALENDAR] Missing credentials-calendario.json');
            return res.status(500).json({ error: 'Credenciales de Google no encontradas en el servidor.' });
        }

        const auth = new google.auth.GoogleAuth({
            keyFile: KEY_PATH,
            scopes: ['https://www.googleapis.com/auth/calendar.events'],
        });

        const calendar = google.calendar({ version: 'v3', auth });

        const response = await calendar.events.insert({
            calendarId: calendarId,
            requestBody: eventData,
        });

        console.log('[CALENDAR] Event synced successfully:', response.data.id);
        res.json({ success: true, eventId: response.data.id });
    } catch (error) {
        console.error('[CALENDAR] Sync Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/db', async (req, res) => {
    try {
        const db = req.body;
        console.log('[SUPABASE] Syncing local changes to cloud...');

        // Ejecutar upserts en paralelo para cada tabla
        const syncTasks = [];

        if (db.Usuarios?.length) {
            console.log('[SUPABASE] Preparing Usuarios for upsert:', db.Usuarios.length, 'records');
            // Map ONLY the columns that exist in Supabase's 'usuarios' table
            const usrs = db.Usuarios.map(u => {
                const mapped = {
                    id:         u.id         || null,
                    nombre:     u.nombre     || null,
                    apellido:   u.apellido   || null,
                    email:      u.email      || null,
                    password:   u.password   || null,
                    rol:        u.rol        || null,
                    department: u.department || null,
                    dob:        u.dob        || null,
                    foto:       u.foto       || null,
                    telefono:   u.telefono   || null,
                    w9_url:     u.w9_url     || u.w9Url || null,
                    carnet_url: u.carnet_url || u.carnetUrl || null,
                    contrato_url: u.contrato_url || u.contratoUrl || null,
                    estatus_rrhh: u.estatus_rrhh || null,
                    is_suspended: u.is_suspended || false,
                    unidades:   Array.isArray(u.unidades) ? u.unidades : [],
                    // --- NEW FIELDS ---
                    tel_emergencia: u.tel_emergencia || null,
                    contacto_emergencia_nombre: u.contacto_emergencia_nombre || null,
                    direccion:      u.direccion      || null,
                    zelle_nombre:   u.zelle_nombre   || null,
                    zelle_cuenta:   u.zelle_cuenta   || null,
                    zelle_tel:      u.zelle_tel      || null,
                    banco_nombre:   u.banco_nombre   || null,
                    banco_cuenta:   u.banco_cuenta   || null,
                    banco_ruta:     u.banco_ruta     || null
                };
                if (mapped.id === 'u1') console.log('[DEBUG-U1] Mapped Carlos:', JSON.stringify(mapped));
                return mapped;
            });
            syncTasks.push(supabase.from('usuarios').upsert(usrs, { onConflict: 'id' }));
        }
        if (db.Clientes_Maestro?.length) {
            // Mapeo para asegurar nombres de columnas correctos
            const cli = db.Clientes_Maestro.map(item => {
                const mapped = {
                    id: item.id, 
                    nombre: item.nombre || null, 
                    email: item.email || null, 
                    telefono: item.telefono || null,
                    direccion: item.direccion || null, 
                    zip: item.zip || null, 
                    state_id: item.state_id || null, 
                    dob: item.dob || null,
                    empresa: item.empresa || null, 
                    estado: item.estado || null, 
                    foto: item.foto || null, 
                    licencia: item.licencia || null,
                    notas: item.notas || null, 
                    fecha: item.fecha || null, 
                    archivos_adjuntos: item.archivos_adjuntos || null,
                    // ── ORIGEN (Call Center / Vendedor) ──
                    origen_tipo:              item.origen_tipo              || null,
                    origen_nombre:            item.origen_nombre            || null,
                    origen_id:                item.origen_id                || item.creador_id || null,
                    vendedor_asignado_id:     item.vendedor_asignado_id     || item.responsable_id || null,
                    vendedor_asignado_nombre: item.vendedor_asignado_nombre || null,
                    // ── NUEVAS COLUMNAS (Módulo Clientes v2) ──
                    departamento:       item.departamento       || null,
                    adjunto_id_url:     item.adjunto_id_url     || null,
                    adjunto_bill_url:   item.adjunto_bill_url   || null,
                    adjunto_seguro_url: item.adjunto_seguro_url || null,
                    macro_estado:       item.macro_estado       || null,
                    departamentos_activos: item.departamentos_activos || [],
                    fecha_inicio:       item.fecha_inicio       || null,
                    google_place_id:    item.google_place_id    || null,
                };
                // ⚠️ CRITICAL: Only include adjuntos_oficina and contrato_water_url if they
                // have a real value in the LOCAL cache. If they are null/empty locally, we
                // skip them (undefined) so Supabase does NOT overwrite values previously
                // written directly by the server (race condition prevention).
                if (item.adjuntos_oficina && !Array.isArray(item.adjuntos_oficina) && Object.keys(item.adjuntos_oficina).length > 0) {
                    mapped.adjuntos_oficina = item.adjuntos_oficina;
                }
                if (item.contrato_water_url) {
                    mapped.contrato_water_url = item.contrato_water_url;
                } else if (item.adjuntos_oficina?.contrato_url) {
                    mapped.contrato_water_url = item.adjuntos_oficina.contrato_url;
                }
                if (item.credit_app_url) {
                    mapped.credit_app_url = item.credit_app_url;
                }
                return mapped;
            });
            syncTasks.push(supabase.from('clientes_maestro').upsert(cli, { onConflict: 'id' }));
        }

        if (db.Proyectos_Dinamicos?.length) {
            // Strip fields that don't exist in the Supabase table (e.g. 'estado', 'asignado_a')
            // Sanitize fase_id so 'Completado' becomes null (to avoid invalid UUID error in Supabase)
            const proy = db.Proyectos_Dinamicos.map(({ asignado_a, direccion, nombre_cliente, telefono_cliente, email_cliente, email, telefono, etapa, fase_orden, total_fases, zip, licencia, id_photo, ...rest }) => ({
                ...rest,
                fase_id: rest.fase_id === 'Completado' ? null : rest.fase_id
            }));
            console.log("PROYECTOS TO UPSERT:", JSON.stringify(proy).substring(0, 500));
            syncTasks.push(supabase.from('proyectos_dinamicos').upsert(proy, { onConflict: 'id' }));
        }
        if (db.Respuestas_Dinamicas?.length) {
            // Filtrar respuestas con IDs inválidos o nulos que causan errores de FK
            const cleanResps = db.Respuestas_Dinamicas.filter(r => 
                r.id && r.proyecto_id && r.campo_id && 
                r.campo_id !== 'null' && r.proyecto_id !== 'null'
            );
            if (cleanResps.length > 0) {
                syncTasks.push(supabase.from('respuestas_dinamicas').upsert(cleanResps, { onConflict: 'id' }));
            }
        }
        if (db.Admin_Pipelines?.length) {
            syncTasks.push(supabase.from('admin_pipelines').upsert(db.Admin_Pipelines, { onConflict: 'id' }));
        }
        if (db.Admin_Fases?.length) {
            syncTasks.push(supabase.from('admin_fases').upsert(db.Admin_Fases, { onConflict: 'id' }));
        }
        if (db.Admin_Catalogos?.length) {
            syncTasks.push(supabase.from('admin_catalogos').upsert(db.Admin_Catalogos, { onConflict: 'id' }));
        }
        if (db.Admin_Campos_Formulario?.length) {
            syncTasks.push(supabase.from('admin_campos_formulario').upsert(db.Admin_Campos_Formulario, { onConflict: 'id' }));
        }
        if (db.academiaContent?.length) {
            const mappedAca = db.academiaContent.map(item => ({
                id:             item.id,
                titulo:         item.titulo         || null,
                tipo:           item.tipo           || null,
                enlace:         item.enlace         || null,
                miniaturaUrl:   item.miniaturaUrl   || null,
                permisos:       item.permisos       || [],
                fecha_creacion: item.fecha_creacion || null
            }));
            syncTasks.push(supabase.from('academia_content').upsert(mappedAca, { onConflict: 'id' }));
        }
        if (db.anuncios_corporativos?.length) {
            const mappedAnu = db.anuncios_corporativos.map(item => ({
                id:              item.id,
                titulo:          item.titulo          || null,
                mensaje:         item.mensaje         || null,
                audiencia:       item.audiencia       || null,
                foto_url:        item.foto_url        || null,
                fecha:           item.fecha           || null,
                estado_lecturas: item.estado_lecturas || []
            }));
            syncTasks.push(supabase.from('anuncios_corporativos').upsert(mappedAnu, { onConflict: 'id' }));
        }
        if (db.inventarioGlobal?.length) {
            const mappedInv = db.inventarioGlobal.map(item => ({
                id:           item.id,
                nombre_item:  item.nombreItem   || null,
                ecosistema:   item.ecosistema   || null,
                category:     item.category     || null,
                locacion:     item.locacion     || null,
                storage:      item.storage      || null,
                stock_actual: item.stockActual  || 0,
                medida:       item.medida       || null,
                boton:        item.boton        || null,
                color:        item.color        || null
            }));
            syncTasks.push(supabase.from('inventario_global').upsert(mappedInv, { onConflict: 'id' }));
        }
        if (db.historialInventario?.length) {
            const mappedHist = db.historialInventario.map(h => ({
                fecha:             h.fecha             || new Date().toISOString(),
                tecnico_nombre:    h.tecnico_nombre    || null,
                item_nombre:       h.item_nombre       || null,
                item_id:           h.item_id           || null,
                cantidad_retirada: h.cantidad_retirada || 0,
                sede:              h.sede              || 'orlando',
                ecosistema:        h.ecosistema        || 'solar',
                proyecto_id:       h.proyecto_id       || null,
                cliente_nombre:    h.cliente_nombre    || null,
                tipo_movimiento:   h.tipo_movimiento   || null
            }));
            console.log(`[SUPABASE] Upserting ${mappedHist.length} history records...`);
            const histTask = supabase.from('historial_inventario').upsert(mappedHist, { onConflict: 'fecha' }).then(({data, error}) => {
                if (error) {
                    console.error('[SUPABASE ERROR] table historial_inventario:', error.message, error.details);
                    return { error };
                }
                return { data };
            });
            syncTasks.push(histTask);
        }

        if (db.Admin_Proveedores?.length) {
            const mappedPrv = db.Admin_Proveedores.map(item => ({
                id:                 item.id,
                empresa_nombre:     item.empresa || null,
                contacto_principal: item.contacto || null,
                categoria_servicio: item.servicio || null,
                telefono:           item.telefono || null,
                area_cobertura:     item.area || null,
                email:              item.email || null,
                w9_url:             item.w9Url || null,
                seguro_url:         item.seguroUrl || null,
                fecha_registro:     item.created_at || new Date().toISOString()
            }));
            syncTasks.push(supabase.from('partners_directorio').upsert(mappedPrv, { onConflict: 'id' }));
        }
        if (db.calendario_eventos?.length) {
            const mappedEv = db.calendario_eventos.map(ev => ({
                id:            ev.id,
                nombre:        ev.nombre || null,
                fecha_inicio:  ev.fecha_inicio || null,
                fecha_fin:     ev.fecha_fin || null,
                direccion:     ev.direccion || null,
                descripcion:   ev.descripcion || null,
                color:         ev.color || null,
                colaboradores: Array.isArray(ev.colaboradores) ? ev.colaboradores.map(c => typeof c === 'string' ? c : JSON.stringify(c)) : [],
                departamentos: ev.departamentos || [],
                attendees:     ev.attendees || [],
                adjunto_url:   ev.adjunto_url || null,
                created_at:    ev.created_at || ev.fecha_creacion || new Date().toISOString()
            }));
            
            console.log('[DEBUG SUPABASE] Upserting calendario_eventos:', JSON.stringify(mappedEv[0]).substring(0, 200));
            
            const req = supabase.from('calendario_eventos').upsert(mappedEv, { onConflict: 'id' }).then(({data, error}) => {
                if (error) {
                    console.error('[CRITICAL] calendario_eventos Upsert Failed!', error);
                    throw error;
                }
                return data;
            });
            syncTasks.push(req);
        }
        if (db.Recibos_Pagos?.length) {
            const mappedRec = db.Recibos_Pagos.map(r => ({
                id:               r.id,
                proyecto_id:      r.proyecto_id      || null,
                tipo:             r.tipo             || null,
                trabajador_id:    r.trabajador_id    || null,
                trabajador_nombre:r.trabajador_nombre|| null,
                cliente_nombre:   r.cliente_nombre   || null,
                direccion:        r.direccion        || null,
                fecha_recibo:     r.fecha_recibo     || null,
                datos_json:       r.datos_json       || {},
                pdf_url:          r.pdf_url          || null
            }));
            syncTasks.push(supabase.from('recibos_pagos').upsert(mappedRec, { onConflict: 'id' }));
        }
        if (db.mensajes_internos?.length) {
            syncTasks.push(supabase.from('mensajes_internos').upsert(db.mensajes_internos, { onConflict: 'id' }));
        }
        // Counters are computed dynamically from real data — no table needed

        // Ejecutar upserts con manejo de errores individual para no tumbar el servidor
        const results = await Promise.allSettled(syncTasks);
        
        const errors = [];
        results.forEach((res, i) => {
            if (res.status === 'rejected') {
                console.error(`[CRITICAL SYNC REJECTION] Task ${i} failed:`, res.reason);
                errors.push(res.reason);
            } else if (res.value && res.value.error) {
                console.warn(`[SUPABASE SYNC WARNING] Table sync had issues:`, res.value.error.message);
                // No lo tratamos como error fatal para no bloquear el flujo del usuario
            }
        });

        if (errors.length > 0) {
            console.error('[SUPABASE SYNC ERROR SUMMARY]', errors);
            // Solo devolvemos 500 si el error es realmente crítico (opcional)
        }

        res.json({ success: true, warning: errors.length > 0 });
    } catch (error) {
        console.error('[CRITICAL ERROR] api/db post:', error);
        res.status(500).json({ error: 'Fallo crítico al sincronizar con Supabase' });
    }
});

// ── FAST GRANULAR UPSERT API ──
// Recibe { table: 'nombre_tabla', records: [ { id: '...', ... } ] }
app.post('/api/upsert', async (req, res) => {
    try {
        const { table, records } = req.body;
        if (!table || !records || !Array.isArray(records)) {
            return res.status(400).json({ error: 'Formato incorrecto. Se requiere "table" y un array "records".' });
        }
        
        console.log(`[SUPABASE GRANULAR] Upserting ${records.length} records into ${table}...`);
        
        // ── STRIP VIRTUAL FIELDS ──
        // Some tables have computed/virtual fields that only exist in memory, not in Supabase.
        let sanitizedRecords = records;
        if (table === 'proyectos_dinamicos') {
            sanitizedRecords = records.map(({ 
                asignado_a,
                direccion, nombre_cliente, telefono_cliente, email_cliente, email, telefono, etapa, fase_orden, total_fases, zip, licencia, id_photo, ...rest 
            }) => ({
                ...rest,
                // Sanitize fase_id: 'Completado' is not a valid UUID
                fase_id: rest.fase_id === 'Completado' ? null : rest.fase_id
            }));
        } else if (table === 'clientes_maestro') {
            // Strip fields that don't exist in Supabase schema
            sanitizedRecords = records.map(({ 
                creador_id, responsable_id, id_photo, is_locked, 
                foto_id, lat, lng, ...rest 
            }) => rest);
        } else if (table === 'calendario_eventos') {
            sanitizedRecords = records.map(ev => ({
                ...ev,
                colaboradores: Array.isArray(ev.colaboradores) ? ev.colaboradores.map(c => typeof c === 'string' ? c : JSON.stringify(c)) : [],
                attendees: ev.attendees || []
            }));
        }
        
        // El id es el identificador por defecto para el conflicto en la mayoría de tablas
        let conflictObj = { onConflict: 'id' };
        if (table === 'historial_inventario') conflictObj.onConflict = 'fecha';
        
        const { error, data } = await supabase.from(table).upsert(sanitizedRecords, conflictObj).select();
        
        if (error) {
            console.error(`[SUPABASE UPSERT ERROR] table ${table}:`, error.message);
            return res.status(500).json({ error: error.message, details: error });
        }
        
        res.json({ success: true, count: records.length, data });
    } catch (error) {
        console.error('[CRITICAL ERROR] api/upsert:', error);
        res.status(500).json({ error: 'Fallo crítico en upsert granular' });
    }
});

// ── PDF GENERATION HELPER ──
async function generarPDF(moldePath, datos) {
  const pdfBuffer  = fs.readFileSync(moldePath);
  const pdfDoc     = await PDFDocument.load(pdfBuffer);
  const form       = pdfDoc.getForm();

  // Helper to get value from nested or flat object
  const getValue = (key) => {
    if (datos[key] !== undefined) return datos[key];
    // Check nested cliente or firmas
    if (key.includes('fullname') || key.includes('nombre')) return datos.cliente?.nombre || datos.nombre;
    if (key.includes('address') || key.includes('direccion')) return datos.cliente?.direccion || datos.direccion;
    if (key.includes('date') || key.includes('fecha')) return datos.cliente?.fecha || datos.fecha;
    if (key.includes('rep_name')) return datos.firmas?.nombreRepresentante || datos.nombreRepresentante;
    if (key.includes('firma_cliente')) return datos.firmas?.cliente || datos.signature;
    if (key.includes('firma_rep')) return datos.firmas?.representante;
    return '';
  };

  const fields = form.getFields();
  for (const field of fields) {
    try {
      const type = field.constructor.name;
      const name = field.getName();
      const value = getValue(name);

      if (!value) {
        // console.log(`[PDF] Campo vacío o no mapeado: ${name}`);
        continue;
      }

      if (type === 'PDFTextField' || type === 'n') {
        try {
          const textField = form.getTextField(name);
          console.log(`[PDF] Rellenando campo: ${name} | Valor: ${String(value).substring(0, 20)}...`);
          
          if (typeof value === 'string' && value.startsWith('data:image/png;base64,')) {
            console.log(`[PDF] Insertando imagen en: ${name}`);
            const base64Data = value.split(',')[1];
            const imageBytes = Buffer.from(base64Data, 'base64');
            const pngImage   = await pdfDoc.embedPng(imageBytes);

            const widgets = textField.acroField.getWidgets();
            if (widgets && widgets.length > 0) {
              const widget  = widgets[0];
              const rect    = widget.getRectangle();
              const pages   = pdfDoc.getPages();
              let pageOfField = pages[0];
              for (const p of pages) {
                try { if (p.ref === widget.P()) { pageOfField = p; break; } } catch(_) {}
              }
              // ── FIX: Draw white background first so transparent PNG areas ──
              // don't render as dark/black in PDF viewers
              pageOfField.drawRectangle({
                x: rect.x, y: rect.y,
                width: rect.width, height: rect.height,
                color: rgb(1, 1, 1),
                borderWidth: 0,
              });
              pageOfField.drawImage(pngImage, { x: rect.x, y: rect.y, width: rect.width, height: rect.height });
              textField.setText('');
            }
          } else {
            textField.setText(String(value));
          }
        } catch (innerErr) {
          console.warn(`[PDF] Error al escribir en campo ${name}:`, innerErr.message);
        }
      }
    } catch (err) {
      console.error(`[PDF] Error crítico en bucle de campos para ${field.getName()}:`, err.message);
    }
  }

  console.log(`[PDF] Todos los campos procesados (${fields.length}). Preparando guardado final...`);
  
  // ── FLATTEN FORM ──
  // Without flattening, PDF viewers show form fields as empty even when values
  // are set in the AcroForm metadata. We flatten to bake values into the page.
  // Wrapped in try-catch to prevent crashes on complex templates.
  try {
    form.flatten();
    console.log('[PDF] form.flatten() completado correctamente.');
  } catch (flatErr) {
    console.warn('[PDF] form.flatten() falló, intentando updateFieldAppearances():', flatErr.message);
    try {
      form.updateFieldAppearances();
    } catch (appErr) {
      console.warn('[PDF] updateFieldAppearances() también falló. El PDF puede mostrar campos vacíos.', appErr.message);
    }
  }
  
  try {
    const savedBytes = await pdfDoc.save();
    console.log(`[PDF] Guardado de bytes completado. Tamaño: ${savedBytes.length} bytes.`);
    return savedBytes;
  } catch (saveErr) {
    console.error(`[PDF CRITICAL] Error al ejecutar pdfDoc.save():`, saveErr);
    throw saveErr;
  }
}

// ── CONTRATO PDF ENDPOINT ──
// ── CONTRATO PDF ENDPOINT ──
app.post('/api/generar-contrato', async (req, res) => {
    console.log('[/api/generar-contrato] Received request. Payload size:', JSON.stringify(req.body).length);
    try {
        const datos = req.body.datos || req.body;
        const moldePath = path.join(__dirname, 'CONTRATO-RENEW-WATER', 'molde_contrato.pdf');
        
        if (!fs.existsSync(moldePath)) {
            console.error('[PDF ERROR] Molde no encontrado en:', moldePath);
            return res.status(404).json({ error: 'No se encontró el molde del contrato' });
        }

        console.log('[PDF] Generando contrato con molde:', moldePath, 'para proyecto:', datos.proyectoId);
        const pdfBytes = await generarPDF(moldePath, datos);
        console.log('[PDF] Generado correctamente. Tamaño:', pdfBytes.length, 'bytes');

        // 1. Subir PDF a Supabase Storage
        const fileName = `contratos/contrato_water_${Date.now()}_${Math.round(Math.random() * 1E9)}.pdf`;
        console.log('[STORAGE] Subiendo archivo:', fileName);
        const { error: uploadError } = await supabase.storage
            .from('archivos_renew')
            .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });

        let finalUrl = null;
        if (uploadError) {
            console.error('[STORAGE ERROR] Failed to upload:', uploadError);
            return res.status(500).json({ error: 'Error al subir el PDF al almacenamiento', details: uploadError });
        } else {
            const { data: { publicUrl } } = supabase.storage.from('archivos_renew').getPublicUrl(fileName);
            finalUrl = publicUrl;
            console.log('[STORAGE] Subido con éxito. URL pública:', finalUrl);
            
            // 2. Actualizar el registro del cliente
            let clienteId = datos.clienteId;

            if (!clienteId && datos.proyectoId) {
                console.log('[DB] Buscando cliente para proyecto:', datos.proyectoId);
                const { data: proy, error: proyError } = await supabase.from('proyectos_dinamicos').select('cliente_id').eq('id', datos.proyectoId).single();
                
                if (proyError) {
                    console.error('[DB ERROR] Failed to find project:', proyError);
                }
                if (proy) clienteId = proy.cliente_id;
            }

            if (clienteId) {
                console.log('[DB] Actualizando URLs para cliente:', clienteId);
                const { data: cli } = await supabase.from('clientes_maestro').select('adjuntos_oficina').eq('id', clienteId).single();
                const adjuntos = cli?.adjuntos_oficina || {};
                adjuntos.contrato_url = finalUrl;
                
                const { error: updateError } = await supabase.from('clientes_maestro')
                    .update({ 
                        adjuntos_oficina: adjuntos,
                        contrato_water_url: finalUrl 
                    })
                    .eq('id', clienteId);
                
                if (updateError) {
                    console.error('[DB ERROR] Failed to update client:', updateError);
                } else {
                    console.log(`[SUPABASE] Cliente ${clienteId} actualizado con éxito.`);
                }
            } else {
                console.warn('[PDF WARNING] No se pudo determinar el clienteId para el guardado (proyectoId:', datos.proyectoId, ')');
            }
        }

        res.json({ success: true, url: finalUrl });
    } catch (error) {
        console.error('[/api/generar-contrato] Critical Error:', error);
        res.status(500).json({ error: 'Error en el servidor: ' + error.message });
    }
});

async function uploadBase64ToSupabase(base64Data, pathPrefix) {
  if (!base64Data || !base64Data.startsWith('data:image')) return null;
  
  try {
    const base64 = base64Data.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');
    const extension = base64Data.split(';')[0].split('/')[1];
    const fileName = `${pathPrefix}/id_${Date.now()}_${Math.round(Math.random() * 1E9)}.${extension}`;
    
    const { error: uploadError } = await supabase.storage
        .from('archivos_renew')
        .upload(fileName, buffer, { contentType: `image/${extension}`, upsert: true });

    if (uploadError) {
        console.error(`[STORAGE ERROR - ${pathPrefix}]`, uploadError);
        return null;
    }
    
    const { data: { publicUrl } } = supabase.storage.from('archivos_renew').getPublicUrl(fileName);
    return publicUrl;
  } catch (err) {
    console.error(`[UPLOAD ERROR - ${pathPrefix}]`, err);
    return null;
  }
}

// ── APLICACIÓN DE CRÉDITO PDF ENDPOINT ──
app.post('/api/generar-pdf', async (req, res) => {
  const rawData = req.body.datos || req.body;
  console.log(`[/api/generar-pdf] 🚀 Petición Recibida | Proyecto: ${rawData.proyectoId} | Cliente: ${rawData.aplicante?.nombreCompleto || 'Sin nombre'}`);
  try {
    const moldePath = path.join(__dirname, 'FORMULARIO-RENEW-WATER-main', 'molde_credito_v9.pdf');

    if (!fs.existsSync(moldePath)) {
        console.error('[PDF ERROR] Molde no encontrado en:', moldePath);
        return res.status(404).json({ error: 'No se encontró el molde de crédito' });
    }

    // ── MAPEO EXACTO SEGÚN REQUERIMIENTO DEL USUARIO ──
    const a = rawData.aplicante || {};
    const co = rawData.coAplicante || {};
    const ea = rawData.empleoAplicante || {};
    const eco = rawData.empleoCoAplicante || {};

    const datos = {
      // Información General
      "monto_credito": rawData.monto_credito || a.monto || '',
      "proyectoId": rawData.proyectoId || '',
      
      // Aplicante Principal
      "aplicante_nombre": a.nombreCompleto || '',
      "aplicante_dob": a.fechaNacimiento || '',
      "aplicante_ssn": a.seguroSocial || '',
      "aplicante_licencia": a.licencia || '',
      "aplicante_estado_lic": a.licenciaEstado || '',
      "aplicante_expedicion_lic": a.licenciaExpedicion || '',
      "aplicante_expiracion_lic": a.licenciaExpiracion || '',
      "aplicante_telefono": a.telefono || '',
      "aplicante_email": a.email || '',
      "aplicante_direccion": a.direccion || '',
      "aplicante_tiempo_casa": a.tiempoViviendo || '',
      "aplicante_pago_casa": a.pagoMensual || '',
      
      "aplicante_tipo_house": a.tipoVivienda === 'Casa' ? 'X' : '',
      "aplicante_tipo_dept": a.tipoVivienda === 'Departamento' ? 'X' : '',
      "aplicante_tipo_condo": a.tipoVivienda === 'Condo' ? 'X' : '',
      "aplicante_tipo_mobile": a.tipoVivienda === 'Mobile Home' ? 'X' : '',
      
      "aplicante_estatus_paid": a.estatusVivienda === 'Pagado' ? 'X' : '',
      "aplicante_estatus_mortgage": a.estatusVivienda === 'Hipotecado' ? 'X' : '',
      "aplicante_estatus_rent": a.estatusVivienda === 'Rentado' ? 'X' : '',

      // Empleo Aplicante
      "aplicante_empresa": ea.nombreEmpleo || '',
      "aplicante_tel_trabajo": ea.telefonoTrabajo || '',
      "aplicante_dir_trabajo": ea.direccionTrabajo || '',
      "aplicante_cargo": ea.posicion || '',
      "aplicante_tiempo_trabajo": ea.tiempoTrabajo || '',
      "aplicante_ingreso_monto": ea.pagoMensual || '',

      "aplicante_job_full": ea.tipoIngreso === 'Tiempo Completo' ? 'X' : '',
      "aplicante_job_part": ea.tipoIngreso === 'Medio Tiempo' ? 'X' : '',
      "aplicante_job_own": ea.tipoIngreso === 'Propio Negocio' ? 'X' : '',
      "aplicante_job_retired": ea.tipoIngreso === 'Pensionado' ? 'X' : '',
      
      "aplicante_check_monthly": ea.frecuenciaPago === 'Mensual' ? 'X' : '',
      "aplicante_check_yearly": ea.frecuenciaPago === 'Anual' ? 'X' : '',

      // Co-Aplicante
      "co_nombre": co.nombreCompleto || '',
      "co_dob": co.fechaNacimiento || '',
      "co_ssn": co.seguroSocial || '',
      "co_licencia": co.licencia || '',
      "co_estado_lic": co.licenciaEstado || '',
      "co_expedicion_lic": co.licenciaExpedicion || '',
      "co_expiracion_lic": co.licenciaExpiracion || '',
      "co_telefono": co.telefono || '',
      "co_email": co.email || '',
      "co_direccion": co.direccion || '',
      "co_tiempo_casa": co.tiempoViviendo || '',
      "co_pago_casa": co.pagoMensual || '',

      "co_tipo_house": co.tipoVivienda === 'Casa' ? 'X' : '',
      "co_tipo_dept": co.tipoVivienda === 'Departamento' ? 'X' : '',
      "co_tipo_condo": co.tipoVivienda === 'Condo' ? 'X' : '',
      "co_tipo_mobile": co.tipoVivienda === 'Mobile Home' ? 'X' : '',
      
      "co_estatus_paid": co.estatusVivienda === 'Pagado' ? 'X' : '',
      "co_estatus_mortgage": co.estatusVivienda === 'Hipotecado' ? 'X' : '',
      "co_estatus_rent": co.estatusVivienda === 'Rentado' ? 'X' : '',

      // Empleo Co-Aplicante
      "co_empresa": eco.nombreEmpleo || '',
      "co_tel_trabajo": eco.telefonoTrabajo || '',
      "co_dir_trabajo": eco.direccionTrabajo || '',
      "co_cargo": eco.posicion || '',
      "co_tiempo_trabajo": eco.tiempoTrabajo || '',
      "co_ingreso_monto": eco.pagoMensual || '',

      "co_job_full": eco.tipoIngreso === 'Tiempo Completo' ? 'X' : '',
      "co_job_part": eco.tipoIngreso === 'Medio Tiempo' ? 'X' : '',
      "co_job_own": eco.tipoIngreso === 'Propio Negocio' ? 'X' : '',
      "co_job_retired": eco.tipoIngreso === 'Pensionado' ? 'X' : '',
      
      "co_check_monthly": eco.frecuenciaPago === 'Mensual' ? 'X' : '',
      "co_check_yearly": eco.frecuenciaPago === 'Anual' ? 'X' : '',

      // Firmas y Otros
      "firma_aplicante": rawData.firma_aplicante || rawData.signature || '',
      "firma_co_aplicante": rawData.firma_co_aplicante || '',
      "fecha_firma_aplicante": new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      "fecha_firma_co": new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      "nombre_dealer": rawData.nombre_dealer || rawData.dealer_name || '',
      "fecha_firma_dealer": new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    };

    // Mantener compatibilidad con cualquier otro campo enviado directamente
    Object.keys(rawData).forEach(k => {
        if (!datos[k] && typeof rawData[k] !== 'object') {
            datos[k] = rawData[k];
        }
    });
    

    const pdfBytes = await generarPDF(moldePath, datos);

    // 1. Subir PDF a Supabase Storage
    const fileName = `creditos/app_credito_${Date.now()}_${Math.round(Math.random() * 1E9)}.pdf`;
    console.log(`[STORAGE] Iniciando subida de PDF: ${fileName}...`);
    
    const { error: uploadError } = await supabase.storage
        .from('archivos_renew')
        .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });

    let finalUrl = null;
    if (uploadError) {
        console.error('[STORAGE ERROR - CREDIT] Falló la subida al bucket:', uploadError);
    } else {
        console.log(`[STORAGE] PDF subido con éxito a ${fileName}. Generando URL pública...`);
        const { data: { publicUrl } } = supabase.storage.from('archivos_renew').getPublicUrl(fileName);
        finalUrl = publicUrl;
        console.log(`[STORAGE] URL Final para base de datos: ${finalUrl}`);
        
        // 2. Actualizar en Supabase (buscando el cliente_id primero)
        if (datos.proyectoId) {
            console.log(`[PDF-SYNC] 🔍 Buscando vinculación para Proyecto: "${datos.proyectoId}"`);
            try {
                // Búsqueda Flexible de Proyecto
                let { data: proy, error: pErr } = await supabase.from('proyectos_dinamicos').select('id, cliente_id').eq('id', datos.proyectoId).single();
                
                if (pErr || !proy) {
                   // Normalizar ID: quitar prefijos, pasar a minúsculas, cambiar - por _
                   const normalizedId = String(datos.proyectoId).replace('RENEW-', '').toLowerCase().replace(/-/g, '_');
                   console.log(`[PDF-SYNC] No hallado como "${datos.proyectoId}", probando normalizado: "${normalizedId}"...`);
                   const { data: p2 } = await supabase.from('proyectos_dinamicos').select('id, cliente_id').eq('id', normalizedId).single();
                   
                   if (p2) {
                       proy = p2;
                   } else {
                       // Un último intento con prefijo proy_ si no lo tiene
                       const prefixedId = normalizedId.startsWith('proy_') ? normalizedId : `proy_${normalizedId}`;
                       console.log(`[PDF-SYNC] Probando con prefijo: "${prefixedId}"...`);
                       const { data: p3 } = await supabase.from('proyectos_dinamicos').select('id, cliente_id').eq('id', prefixedId).single();
                       if (p3) proy = p3;
                       else {
                            // Intento final cambiando s por 5
                            const altId = normalizedId.replace(/s/g, '5');
                            if (altId !== normalizedId) {
                                console.log(`[PDF-SYNC] Probando alternativa s->5: "${altId}"...`);
                                const { data: p4 } = await supabase.from('proyectos_dinamicos').select('id, cliente_id').eq('id', altId).single();
                                if (p4) proy = p4;
                            }
                       }
                   }
                }

                if (proy && proy.cliente_id) {
                    const cliId = proy.cliente_id;
                    console.log(`[PDF-SYNC] ✅ Proyecto hallado: ${proy.id}. Cliente: ${cliId}. Actualizando...`);
                    
                    const { data: cli, error: cErr } = await supabase.from('clientes_maestro').select('adjuntos_oficina').eq('id', cliId).single();
                    if (cErr) {
                        console.error(`[PDF-SYNC] Error al obtener cliente ${cliId}:`, cErr.message);
                    }
                    
                    let adjuntos = cli?.adjuntos_oficina;
                    
                    // Si es null, undefined o un array [], convertir a objeto {}
                    if (!adjuntos || Array.isArray(adjuntos)) {
                        adjuntos = {};
                    }
                    
                    adjuntos.app_url = finalUrl;
                    adjuntos.ultima_credit_fecha = new Date().toISOString();

                    const { error: updateError } = await supabase.from('clientes_maestro')
                        .update({ 
                            adjuntos_oficina: adjuntos, 
                            credit_app_url: finalUrl 
                        })
                        .eq('id', cliId);
                    
                    if (updateError) {
                        console.error(`[PDF-SYNC ERROR] Falló actualización cliente ${cliId}:`, updateError.message);
                    } else {
                        console.log(`[SUCCESS] Base de datos actualizada para cliente ${cliId}.`);
                    }
                } else {
                    console.warn(`[PDF-SYNC] ⚠️ No se pudo vincular el documento. El ID "${datos.proyectoId}" no fue encontrado en Supabase.`);
                }
            } catch (syncErr) {
                console.error(`[CRITICAL SYNC ERROR]`, syncErr);
            }
        } else {
            console.warn('[PDF-SYNC] No se puede vincular: proyectoId no presente en los datos recibidos.');
        }
    }

    // 3. Procesar foto del ID si existe
    let idPhotoUrl = null;
    if (rawData.aplicante?.fotoId) {
        idPhotoUrl = await uploadBase64ToSupabase(rawData.aplicante.fotoId, 'creditos_ids');
        if (idPhotoUrl) rawData.aplicante.fotoIdUrl = idPhotoUrl;
    }

    // Webhook Trigger a n8n para Administración
    const WEBHOOK_URL = 'https://n8n.renewgroup.site/webhook/aplicacion-credito-o-trabajo';
    fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        evento: "aplicacion_credito_generada", 
        pdf_url: finalUrl, 
        id_photo_url: idPhotoUrl,
        datos: { ...rawData, aplicante: { ...rawData.aplicante, fotoId: "[BASE64_REMOVED]" } } 
      })
    }).catch(err => console.error("Error al disparar webhook crédito:", err));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="aplicacion_credito.pdf"');
    if (finalUrl) {
      res.setHeader('Access-Control-Expose-Headers', 'X-Document-Url');
      res.setHeader('X-Document-Url', finalUrl);
    }
    return res.status(200).send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('[/api/generar-pdf] Error:', error);
    return res.status(500).json({ error: 'Error al generar el PDF de crédito', detalle: error.message });
  }
});

// ── ORDEN DE TRABAJO PDF ENDPOINT ──
app.post('/api/generar-orden', async (req, res) => {
    console.log('[/api/generar-orden] Received request. Payload size:', JSON.stringify(req.body).length);
    try {
        const rawData = req.body.datos || req.body;
        const moldePath = path.join(__dirname, 'FORMULARIO-RENEW-WATER-main', 'molde_orden_v3.pdf');
        
        if (!fs.existsSync(moldePath)) {
            console.error('[PDF ERROR] Molde no encontrado en:', moldePath);
            return res.status(404).json({ error: 'No se encontró el molde de la orden de trabajo' });
        }

        const c = rawData.comprador || {};
        const e = rawData.equipos || {};
        const i = rawData.instalacion || {};
        const f = rawData.finanzas || {};
        const s = rawData.firmas || {};
        const t = rawData.tarjeta || {};

        const todayStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        
        const datos = {
            "fecha_orden": todayStr,
            "comprador_1": c.nombre || c.nombreCompleto || '',
            "comprador_2": c.segundoNombre || '',
            "telefono": c.telefono || '',
            "email": c.email || '',
            "direccion": c.direccion || '',
            "ciudad": c.ciudad || '',
            "estado": c.estado || '',
            "zip": c.zipCode || '',

            "equipo_softener": (e.suavizadorCasa_entera || e.suavizadorCasa) ? 'X' : '',
            "equipo_ro": e.osmosisReverso ? 'X' : '',
            "equipo_alkaline": e.aguaAlcalina ? 'X' : '',
            "equipo_well": e.aguaPozo ? 'X' : '',
            "equipo_otro_texto": e.otros || e.otro_texto || '',

            "fecha_inst": i.fechaEstimada || '',
            "num_personas": i.personasEnCasa || '',
            "piso_elevado": i.tipoPiso === 'Raised' ? 'X' : '',
            "piso_concreto": i.tipoPiso === 'Concrete-slab' ? 'X' : '',
            "icemaker_yes": i.conexionRefrigerador === 'Yes' ? 'X' : '',
            "icemaker_no": i.conexionRefrigerador === 'No' ? 'X' : '',
            "hora_9_2": i.horario === '9:00am-2:00pm' ? 'X' : '',
            "hora_2_6": i.horario === '2:00pm-6:00pm' ? 'X' : '',
            "dureza": i.granossDureza || '',
            "instrucciones": i.instruccionesEspeciales || '',

            "precio_contado": f.precioContado || '',
            "instalacion": f.instalacion || '',
            "total_contado": f.precioContado || '',
            "cuota_inicial": f.cuotaInicial || '',
            "saldo_financiado": f.saldo_financiado || '',
            "cantidad_financiar": f.cantidad_financiar || '',
            "terminos_pago": f.terminos_pago || '',
            "apr": f.apr || '',
            "cargos_financieros": f.cargosFinancieros || '',
            "total_pagos": f.totalPagos || '',

            "cc_monto": f.tarjetaMonto || '',
            "cc_num": f.tarjetaNumero || t.numero || '',
            "cc_exp": f.tarjetaExpiracion || t.expiracion || '',
            "cc_cvv": f.tarjetaCvv || t.cvv || '',

            "firma_comp1": s.comprador_1 || s.comprador || '',
            "firma_comp2": s.comprador_2 || '',
            "nombre_rep": rawData.nombre_dealer || '',
            "firma_rep": s.representante || '',

            "fecha_c1": todayStr,
            "fecha_c2": todayStr,
            "fecha_rep": todayStr,
            "proyectoId": rawData.proyectoId
        };

        console.log('[PDF] Generando orden con molde:', moldePath, 'para proyecto:', datos.proyectoId);
        const pdfBytes = await generarPDF(moldePath, datos);
        console.log('[PDF] Generado correctamente. Tamaño:', pdfBytes.length, 'bytes');

        // 1. Subir PDF a Supabase Storage
        const fileName = `ordenes/orden_trabajo_${Date.now()}_${Math.round(Math.random() * 1E9)}.pdf`;
        console.log('[STORAGE] Subiendo archivo:', fileName);
        const { error: uploadError } = await supabase.storage
            .from('archivos_renew')
            .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });

        let finalUrl = null;
        if (uploadError) {
            console.error('[STORAGE ERROR] Failed to upload:', uploadError);
        } else {
            const { data: { publicUrl } } = supabase.storage.from('archivos_renew').getPublicUrl(fileName);
            finalUrl = publicUrl;
            console.log('[STORAGE] Subido con éxito. URL pública:', finalUrl);
            
            // 2. Actualizar la base de datos (resolviendo cliente_id)
            const proyId = rawData.proyectoId;
            if (proyId) {
                console.log(`[PDF-SYNC-ORDEN] 🔍 Buscando vinculación para Proyecto: "${proyId}"`);
                try {
                    // Búsqueda Flexible
                    let { data: proy, error: pErr } = await supabase.from('proyectos_dinamicos').select('id, cliente_id').eq('id', proyId).single();
                    
                    if (pErr || !proy) {
                        const normalizedId = String(proyId).replace('RENEW-', '').toLowerCase().replace(/-/g, '_');
                        console.log(`[PDF-SYNC-ORDEN] No hallado como "${proyId}", probando normalizado: "${normalizedId}"...`);
                        const { data: p2 } = await supabase.from('proyectos_dinamicos').select('id, cliente_id').eq('id', normalizedId).single();
                        if (p2) {
                            proy = p2;
                        } else {
                            // Un último intento con prefijo proy_ si no lo tiene
                            const prefixedId = normalizedId.startsWith('proy_') ? normalizedId : `proy_${normalizedId}`;
                            console.log(`[PDF-SYNC-ORDEN] Probando con prefijo: "${prefixedId}"...`);
                            const { data: p3 } = await supabase.from('proyectos_dinamicos').select('id, cliente_id').eq('id', prefixedId).single();
                            if (p3) proy = p3;
                            else {
                                const altId = normalizedId.replace(/s/g, '5');
                                if (altId !== normalizedId) {
                                    console.log(`[PDF-SYNC-ORDEN] Probando alternativa s->5: "${altId}"...`);
                                    const { data: p4 } = await supabase.from('proyectos_dinamicos').select('id, cliente_id').eq('id', altId).single();
                                    if (p4) proy = p4;
                                }
                            }
                        }
                    }

                    if (proy && proy.cliente_id) {
                        const cliId = proy.cliente_id;
                        console.log(`[PDF-SYNC-ORDEN] Proyecto encontrado: ${proy.id}. Cliente asociado: ${cliId}.`);
                        
                        const { data: cli, error: cErr } = await supabase.from('clientes_maestro').select('adjuntos_oficina').eq('id', cliId).single();
                        if (cErr) {
                            console.error(`[DB ERROR] Error al obtener cliente ${cliId}:`, cErr.message);
                        }
                        
                        let adjuntos = cli?.adjuntos_oficina;
                        
                        if (!adjuntos || Array.isArray(adjuntos)) {
                            adjuntos = {};
                        }
                        
                        adjuntos.orden_trabajo_url = finalUrl;
                        adjuntos.ultima_orden_fecha = new Date().toISOString();
                        
                        const { error: uErr } = await supabase.from('clientes_maestro')
                            .update({ 
                                adjuntos_oficina: adjuntos,
                                contrato_water_url: finalUrl 
                            })
                            .eq('id', cliId);
                        
                        if (uErr) {
                            console.error(`[DB ERROR] Falló la actualización de la orden para el cliente ${cliId}:`, uErr.message);
                        } else {
                            console.log(`[SUCCESS] Cliente ${cliId} vinculado correctamente con Orden de Trabajo: ${finalUrl}`);
                        }
                    } else {
                        console.warn(`[PDF-SYNC-ORDEN] ⚠️ No se pudo vincular el documento. El ID "${proyId}" no fue encontrado en Supabase.`);
                    }
                } catch (syncErr) {
                    console.error(`[CRITICAL SYNC ERROR ORDEN]`, syncErr);
                }
            }
        }

        // 3. Procesar foto del ID si existe
        let idPhotoUrl = null;
        if (rawData.comprador?.fotoId) {
            idPhotoUrl = await uploadBase64ToSupabase(rawData.comprador.fotoId, 'ordenes_ids');
            if (idPhotoUrl) rawData.comprador.fotoIdUrl = idPhotoUrl;
        }

        // Webhook Trigger a n8n
        const WEBHOOK_URL = 'https://n8n.renewgroup.site/webhook/aplicacion-credito-o-trabajo';
        fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            evento: "orden_trabajo_generada", 
            orden_url: finalUrl, 
            id_photo_url: idPhotoUrl,
            datos: { ...rawData, comprador: { ...rawData.comprador, fotoId: "[BASE64_REMOVED]" } } 
          })
        }).catch(err => console.error("Error al disparar webhook:", err));

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="orden_trabajo.pdf"');
        if (finalUrl) {
          res.setHeader('Access-Control-Expose-Headers', 'X-Document-Url');
          res.setHeader('X-Document-Url', finalUrl);
        }
        return res.status(200).send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error('[/api/generar-orden] Critical Error:', error);
        res.status(500).json({ error: 'Error en el servidor: ' + error.message });
    }
});


// ── CALL CENTER PROSPECTOS API ──────────────────────────────
// Implementa el Algoritmo de Asignación Inteligente:
// • Capacidad máxima de 5 leads activos por agente
// • Ordenación por ultimaAsignacion (menos reciente primero)
// • Cola de espera con prioridades (Normal / Prioridad Alta)
// • Reasignación automática por timeout / rechazo

const CC_MAX_LEADS_POR_AGENTE = 5;

// ─── FUNCIÓN CENTRAL DE ASIGNACIÓN ──────────────────────────
async function asignarLeadAMejorAgente(lead, offset = 0) {
    // 1. Obtener agentes CC activos
    const { data: usuarios, error: usrErr } = await supabase
        .from('usuarios')
        .select('id, nombre, apellido, rol, ultima_asignacion_cc')
        .in('rol', ['Call Center', 'call_center', 'CALL_CENTER']);

    if (usrErr || !usuarios || usuarios.length === 0) return null;

    // 2. Contar leads ACTIVOS (pendiente + confirmacion_pendiente) por agente
    const { data: activosRows } = await supabase
        .from('call_center_prospectos')
        .select('operador_id')
        .in('estado', ['pendiente', 'confirmacion_pendiente']);

    const loadMap = {};
    usuarios.forEach(u => { loadMap[u.id] = 0; });
    (activosRows || []).forEach(row => {
        if (row.operador_id && loadMap[row.operador_id] !== undefined) {
            loadMap[row.operador_id]++;
        }
    });

    // 3. Filtrar agentes con capacidad disponible (< CC_MAX_LEADS_POR_AGENTE)
    const disponibles = usuarios.filter(u => (loadMap[u.id] || 0) < CC_MAX_LEADS_POR_AGENTE);

    if (disponibles.length === 0) return null; // Cola de espera

    // 4. Ordenar por última asignación ASC (el que recibió su último lead hace más tiempo primero)
    disponibles.sort((a, b) => {
        const tA = a.ultima_asignacion_cc ? new Date(a.ultima_asignacion_cc).getTime() : 0;
        const tB = b.ultima_asignacion_cc ? new Date(b.ultima_asignacion_cc).getTime() : 0;
        return tA - tB;
    });

    // Soporte para offset: saltarse agentes que ya rechazaron/timeout en este lead
    const agente = disponibles[offset % disponibles.length];
    return agente;
}

// GET: Listar prospectos — filtrado por operador_id o estado
app.get('/api/cc-prospectos', async (req, res) => {
    try {
        const { operador_id, estado } = req.query;
        let query = supabase
            .from('call_center_prospectos')
            .select('*')
            .order('prioridad', { ascending: false }) // Alta prioridad primero
            .order('fecha_creacion', { ascending: true });

        if (operador_id) query = query.eq('operador_id', operador_id);
        if (estado)      query = query.eq('estado', estado);

        const { data, error } = await query;
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        console.error('[CC-PROSPECTOS] GET error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST: Ingresar nuevos prospectos (scraper n8n / manual / referidos / cualquier fuente)
// Body: { nombre, telefono, direccion, email?, pipeline?, fuente? }
//  OR batch: { leads: [ { ... } ] }
app.post('/api/cc-prospectos', async (req, res) => {
    try {
        // 1. Normalizar entrada (lead único o batch)
        let leadsIn = [];
        if (Array.isArray(req.body.leads)) {
            leadsIn = req.body.leads;
        } else if (req.body.telefono) {
            leadsIn = [req.body];
        } else {
            return res.status(400).json({ error: 'Se requiere telefono o un array de leads' });
        }

        const resultados = [];
        const summary = { asignados: 0, en_espera: 0, distribution: {} };

        for (let idx = 0; idx < leadsIn.length; idx++) {
            const lead = leadsIn[idx];
            const leadId = 'cc_' + Date.now().toString(36) + '_' + idx;

            const agente = await asignarLeadAMejorAgente(lead, 0);

            let nuevoLead;
            if (agente) {
                // ── Asignar directamente al mejor agente ──
                nuevoLead = {
                    id:                    leadId,
                    nombre:               lead.nombre     || null,
                    telefono:             lead.telefono,
                    direccion:            lead.direccion  || null,
                    email:                lead.email      || null,
                    pipeline:             lead.pipeline   || lead.ecosistema || null,
                    fuente:               lead.fuente     || 'scraper',
                    estado:               'confirmacion_pendiente',
                    prioridad:            0,
                    intentos_reasignacion: 0,
                    operador_id:          agente.id,
                    operador_nombre:      `${agente.nombre || ''} ${agente.apellido || ''}`.trim(),
                    fecha_creacion:       new Date().toISOString(),
                    fecha_asignacion:     new Date().toISOString(),
                    fecha_expiracion:     new Date(Date.now() + 60 * 1000).toISOString() // 60s timeout
                };

                // Actualizar ultima_asignacion_cc del agente
                await supabase.from('usuarios')
                    .update({ ultima_asignacion_cc: new Date().toISOString() })
                    .eq('id', agente.id);

                summary.asignados++;
                summary.distribution[nuevoLead.operador_nombre] = (summary.distribution[nuevoLead.operador_nombre] || 0) + 1;
            } else {
                // ── Sin capacidad → Cola de espera ──
                nuevoLead = {
                    id:                    leadId,
                    nombre:               lead.nombre     || null,
                    telefono:             lead.telefono,
                    direccion:            lead.direccion  || null,
                    email:                lead.email      || null,
                    pipeline:             lead.pipeline   || lead.ecosistema || null,
                    fuente:               lead.fuente     || 'scraper',
                    estado:               'en_espera',
                    prioridad:            0,
                    intentos_reasignacion: 0,
                    operador_id:          null,
                    operador_nombre:      null,
                    fecha_creacion:       new Date().toISOString(),
                    fecha_asignacion:     null,
                    fecha_expiracion:     null
                };
                summary.en_espera++;
                console.log(`[CC-PROSPECTOS] Lead ${leadId} colocado en cola de espera — todos los agentes al límite.`);
            }

            resultados.push(nuevoLead);
        }

        // Batch insert
        const { data, error } = await supabase
            .from('call_center_prospectos')
            .insert(resultados)
            .select();

        if (error) throw error;

        console.log(`[CC-PROSPECTOS] ${leadsIn.length} leads procesados — Asignados: ${summary.asignados}, En espera: ${summary.en_espera}`, summary.distribution);
        res.json({ success: true, total: leadsIn.length, ...summary, data });

    } catch (e) {
        console.error('[CC-PROSPECTOS] POST error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// PATCH: Agente responde (acepta o rechaza) un prospecto asignado
// Body: { accion: 'aceptar' | 'rechazar', ...otros_campos }
app.patch('/api/cc-prospectos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { accion, ...extraFields } = req.body;
        const now = new Date().toISOString();

        if (accion === 'aceptar') {
            // ── El agente acepta el lead → pasa a 'pendiente' (activo) ──
            const updates = {
                ...extraFields,
                estado: 'pendiente',
                fecha_gestion: now
            };
            const { error } = await supabase.from('call_center_prospectos').update(updates).eq('id', id);
            if (error) throw error;
            return res.json({ success: true, accion: 'aceptado' });
        }

        if (accion === 'rechazar' || accion === 'timeout') {
            // ── Agente rechaza o expiró el tiempo → buscar siguiente agente ──
            const { data: lead, error: fetchErr } = await supabase
                .from('call_center_prospectos').select('*').eq('id', id).single();
            if (fetchErr || !lead) return res.status(404).json({ error: 'Lead no encontrado' });

            const intentos = (lead.intentos_reasignacion || 0) + 1;

            // Intentar asignar al siguiente agente disponible
            const siguienteAgente = await asignarLeadAMejorAgente(lead, intentos);

            if (siguienteAgente && siguienteAgente.id !== lead.operador_id) {
                // Reasignar al siguiente agente
                const { error } = await supabase.from('call_center_prospectos').update({
                    estado:               'confirmacion_pendiente',
                    operador_id:          siguienteAgente.id,
                    operador_nombre:      `${siguienteAgente.nombre || ''} ${siguienteAgente.apellido || ''}`.trim(),
                    intentos_reasignacion: intentos,
                    fecha_asignacion:     now,
                    fecha_expiracion:     new Date(Date.now() + 60 * 1000).toISOString(),
                    fecha_gestion:        now
                }).eq('id', id);
                if (error) throw error;

                await supabase.from('usuarios')
                    .update({ ultima_asignacion_cc: now })
                    .eq('id', siguienteAgente.id);

                console.log(`[CC-PROSPECTOS] Lead ${id} reasignado a ${siguienteAgente.nombre} (intento #${intentos})`);
                return res.json({ success: true, accion: 'reasignado', nuevo_agente: siguienteAgente.nombre });
            } else {
                // Nadie más disponible → Cola de Prioridad Alta (al frente de la cola)
                const { error } = await supabase.from('call_center_prospectos').update({
                    estado:               'en_espera',
                    prioridad:            1, // Alta prioridad
                    operador_id:          null,
                    operador_nombre:      null,
                    intentos_reasignacion: intentos,
                    fecha_asignacion:     null,
                    fecha_expiracion:     null,
                    fecha_gestion:        now
                }).eq('id', id);
                if (error) throw error;

                console.log(`[CC-PROSPECTOS] Lead ${id} pasó a Prioridad Alta en cola de espera (${intentos} intentos).`);
                return res.json({ success: true, accion: 'en_espera_prioridad_alta' });
            }
        }

        // Actualización genérica de otros campos (ecosistema, notas, etc.)
        const { error } = await supabase.from('call_center_prospectos')
            .update({ ...req.body, fecha_gestion: now })
            .eq('id', id);
        if (error) throw error;
        res.json({ success: true });

    } catch (e) {
        console.error('[CC-PROSPECTOS] PATCH error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST: Procesar cola de espera — reasigna leads pendientes cuando se libera capacidad
// Llamar desde n8n por cron (cada 2-5 min) o desde el cliente al completar/rechazar un lead
app.post('/api/cc-prospectos/procesar-cola', async (req, res) => {
    try {
        // Obtener leads en cola de espera ordenados: prioridad alta primero, luego por fecha
        const { data: cola, error: colaErr } = await supabase
            .from('call_center_prospectos')
            .select('*')
            .eq('estado', 'en_espera')
            .order('prioridad', { ascending: false })
            .order('fecha_creacion', { ascending: true });

        if (colaErr) throw colaErr;
        if (!cola || cola.length === 0) {
            return res.json({ success: true, procesados: 0, mensaje: 'Cola vacía' });
        }

        let procesados = 0;
        const now = new Date().toISOString();

        for (const lead of cola) {
            const agente = await asignarLeadAMejorAgente(lead, 0);
            if (!agente) break; // No hay más capacidad, detener

            await supabase.from('call_center_prospectos').update({
                estado:           'confirmacion_pendiente',
                operador_id:      agente.id,
                operador_nombre:  `${agente.nombre || ''} ${agente.apellido || ''}`.trim(),
                fecha_asignacion: now,
                fecha_expiracion: new Date(Date.now() + 60 * 1000).toISOString()
            }).eq('id', lead.id);

            await supabase.from('usuarios')
                .update({ ultima_asignacion_cc: now })
                .eq('id', agente.id);

            procesados++;
            console.log(`[CC-COLA] Lead ${lead.id} (prioridad ${lead.prioridad ? 'ALTA' : 'normal'}) asignado a ${agente.nombre}`);
        }

        res.json({ success: true, procesados, en_cola: cola.length - procesados });
    } catch (e) {
        console.error('[CC-COLA] Error procesando cola:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// DELETE: Eliminar un prospecto de la tabla
app.delete('/api/cc-prospectos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('call_center_prospectos').delete().eq('id', id);
        if (error) throw error;
        // Al eliminar, procesar la cola por si hay capacidad liberada
        fetch(`http://localhost:${port}/api/cc-prospectos/procesar-cola`, { method: 'POST' }).catch(() => {});
        res.json({ success: true });
    } catch (e) {
        console.error('[CC-PROSPECTOS] DELETE error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// DELETE: Eliminar un registro específico

app.post('/api/delete', async (req, res) => {
    try {
        const { table, id, column } = req.body;
        if (!table || !id) return res.status(400).json({ error: 'Faltan parámetros' });

        const col = column || 'id';
        console.log(`[SUPABASE] Intentando borrar de ${table} donde ${col} = ${id}`);
        
        const { error, count } = await supabase
            .from(table)
            .delete({ count: 'exact' })
            .eq(col, id);

        if (error) {
            console.error('[SUPABASE ERROR] delete:', error.message);
            return res.status(500).json({ error: error.message, details: error });
        }

        console.log(`[SUPABASE] Borrado exitoso en ${table}. Filas eliminadas: ${count}`);
        res.json({ success: true, count });
    } catch (error) {
        console.error('[CRITICAL ERROR] api/delete:', error);
        res.status(500).json({ error: 'Fallo crítico al eliminar de Supabase' });
    }
});

app.post('/api/delete-bulk', async (req, res) => {
    try {
        const { table, ids, column } = req.body;
        if (!table || !ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: 'Faltan parámetros o ids no es un array' });
        }

        const col = column || 'id';
        console.log(`[SUPABASE] Bulk delete en ${table} donde ${col} IN (${ids.join(', ')})`);
        
        const { error, count } = await supabase
            .from(table)
            .delete({ count: 'exact' })
            .in(col, ids);

        if (error) {
            console.error('[SUPABASE ERROR] bulk delete:', error.message);
            return res.status(500).json({ error: error.message, details: error });
        }

        console.log(`[SUPABASE] Bulk delete exitoso en ${table}. Filas eliminadas: ${count}`);
        res.json({ success: true, count });
    } catch (error) {
        console.error('[CRITICAL ERROR] api/delete-bulk:', error);
        res.status(500).json({ error: 'Fallo crítico en borrado masivo' });
    }
});

// ── 2. STORAGE MANAGEMENT (PRESERVED) ──

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// Helper function to upload — saves locally and returns public URL accessible from anywhere
const subirArchivo = async (file, folder) => {
    if (!file || !file.buffer) {
        throw new Error('Archivo inválido o sin buffer');
    }
    const ext = path.extname(file.originalname);
    
    // Normalize folder name and file name
    let targetFolder = folder.replace(/^\//, '').replace(/\/$/, '');
    const fileName = `${targetFolder}/${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;

    console.log(`[STORAGE] Uploading to Supabase: archivos_renew/${fileName}`);

    try {
        const { data, error } = await supabase.storage
            .from('archivos_renew')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (error) {
            console.error('[STORAGE SUPABASE ERROR]', error);
            throw error;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('archivos_renew')
            .getPublicUrl(fileName);

        console.log('[STORAGE] ✅ Upload successful:', publicUrl);
        return publicUrl;
    } catch (err) {
        console.error(`[STORAGE CRITICAL ERROR]:`, err.message);
        throw err;
    }
};

// Startup check for storage bucket
async function initStorage() {
    try {
        console.log('[STORAGE] Verificando bucket "archivos_renew"...');
        const { data: buckets, error: bErr } = await supabaseStorage.storage.listBuckets();
        if (bErr) throw bErr;

        const exists = buckets.find(b => b.name === 'archivos_renew');
        const bucketOptions = {
            public: true,
            allowedMimeTypes: ['image/*', 'application/pdf', 'video/*'],
            fileSizeLimit: 524288000 // 500MB
        };

        if (!exists) {
            console.log('[STORAGE] El bucket "archivos_renew" no existe. Creándolo...');
            const { error: cErr } = await supabaseStorage.storage.createBucket('archivos_renew', bucketOptions);
            if (cErr) console.error('[STORAGE] ❌ Error creando bucket:', cErr.message);
            else console.log('[STORAGE] ✅ Bucket "archivos_renew" creado exitosamente.');
        } else {
            console.log('[STORAGE] El bucket "archivos_renew" ya existe. Asegurando configuración de 500MB...');
            const { error: uErr } = await supabaseStorage.storage.updateBucket('archivos_renew', bucketOptions);
            if (uErr) {
                console.warn('[STORAGE] ⚠️ No se pudo actualizar el límite del bucket desde el código:', uErr.message);
                console.warn('[STORAGE] 💡 POR FAVOR: Ve a tu panel de Supabase -> Storage -> Buckets -> archivos_renew -> Settings y cambia "File size limit" a 500MB manualmente.');
            }
            else console.log('[STORAGE] ✅ Configuración de bucket (500MB) verificada con éxito.');
        }
    } catch (err) {
        console.error('[STORAGE] Error inicializando bucket:', err.message);
    }
}
initStorage();

app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        console.log('[API-UPLOAD] Request received');
        if (!req.file) {
            console.error('[API-UPLOAD] No file in request');
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Use 'type' or 'folder' from body, or fallback to 'others'
        const folder = req.body.type || req.body.folder || 'others';
        console.log(`[API-UPLOAD] Uploading ${req.file.originalname} to folder: ${folder}`);

        const url = await subirArchivo(req.file, folder);
        console.log('[API-UPLOAD] Success:', url);
        res.json({ success: true, url: fixUrl(url) });
    } catch (e) {
        console.error('[API-UPLOAD] Critical Error:', e);
        res.status(500).json({ 
            success: false, 
            error: e.message || 'Fallo subiendo material',
            details: e.toString()
        });
    }
});

// /api/upload-academia – acepta los campos 'video' y/o 'miniatura'
// También acepta 'file' genérico para compatibilidad con llamadas antiguas
app.post('/api/upload-academia', upload.fields([
    { name: 'video',     maxCount: 1 },
    { name: 'miniatura', maxCount: 1 },
    { name: 'file',      maxCount: 1 }
]), async (req, res) => {
    try {
        let videoUrl     = null;
        let miniaturaUrl = null;

        const files = req.files || {};

        // Soporte para campo 'video' o 'file' (compatibilidad)
        const videoFile     = (files['video']     && files['video'][0])     || (files['file'] && files['file'][0])     || null;
        const miniaturaFile = (files['miniatura'] && files['miniatura'][0]) || null;

        if (videoFile)     videoUrl     = await subirArchivo(videoFile,     'academia');
        if (miniaturaFile) miniaturaUrl = await subirArchivo(miniaturaFile, 'academia');

        res.json({ success: true, videoUrl, miniaturaUrl });
    } catch (e) {
        console.error('[ACADEMIA-UPLOAD] Error:', e);
        res.status(500).json({ success: false, error: e.message || 'Fallo subiendo material de academia' });
    }
});

// New endpoint for Signed Upload URLs (Bypasses 413 Request Entity Too Large)
app.post('/api/get-upload-url', async (req, res) => {
    try {
        const { fileName, folder } = req.body;
        if (!fileName || !folder) throw new Error('Nombre de archivo y carpeta requeridos');

        const path = `${folder}/${Date.now()}_${fileName.replace(/\s+/g, '_')}`;
        
        // Use createSignedUploadUrl if available in your Supabase version, 
        // or just return the path to use with the public key if policies allow.
        // For security, we'll use the signed URL approach.
        const { data, error } = await supabase.storage
            .from('archivos_renew')
            .createSignedUploadUrl(path);

        if (error) throw error;

        res.json({ 
            success: true, 
            uploadUrl: data.signedUrl,
            publicUrl: `${SUPABASE_URL}/storage/v1/object/public/archivos_renew/${path}`,
            token: data.token
        });
    } catch (e) {
        console.error('[API-SIGNED-URL] Error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Chunked Upload Endpoints (using binary body to bypass multipart limits)
app.post('/api/upload-chunk', express.raw({ type: 'application/octet-stream', limit: '10mb' }), async (req, res) => {
    try {
        const { uploadId, chunkIndex } = req.query;
        if (!uploadId || !req.body) throw new Error('Faltan datos de fragmento');

        const uploadPath = path.join(CHUNK_DIR, uploadId);
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

        const chunkPath = path.join(uploadPath, `chunk-${chunkIndex}`);
        fs.writeFileSync(chunkPath, req.body);

        res.json({ success: true });
    } catch (e) {
        console.error('[CHUNK] Error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/complete-upload', async (req, res) => {
    try {
        const { uploadId, fileName, folder, totalChunks, contentType } = req.body;
        if (!uploadId || !fileName || !folder || !totalChunks) {
            return res.status(400).json({ success: false, error: 'Faltan parámetros (uploadId, fileName, folder, totalChunks)' });
        }

        const uploadPath = path.join(CHUNK_DIR, uploadId);
        const finalPath  = path.join(CHUNK_DIR, `${uploadId}-final`);

        // ── Ensamblado de fragmentos ──
        const writeStream = fs.createWriteStream(finalPath);
        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(uploadPath, `chunk-${i}`);
            if (!fs.existsSync(chunkPath)) throw new Error(`Fragmento ${i} no encontrado en el servidor. Vuelve a intentar la subida.`);
            const data = fs.readFileSync(chunkPath);
            writeStream.write(data);
            fs.unlinkSync(chunkPath); // Liberar espacio inmediatamente
        }
        writeStream.end();

        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        const finalFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const storagePath  = `${folder}/${finalFileName}`;

        console.log(`[COMPLETE UPLOAD] Procesando subida. Folder: "${folder}", FileName: "${fileName}"`);

        // ── Guardado Local para Academia (Bypass Supabase 50MB limit) ──
        if (folder === 'academia') {
            const localUploadsDir = path.join(__dirname, 'uploads', folder);
            if (!fs.existsSync(localUploadsDir)) fs.mkdirSync(localUploadsDir, { recursive: true });
            
            const localFilePath = path.join(localUploadsDir, finalFileName);
            fs.copyFileSync(finalPath, localFilePath);
            
            // Limpieza de temporales
            try { fs.unlinkSync(finalPath); } catch (_) {}
            try { if (fs.readdirSync(uploadPath).length === 0) fs.rmdirSync(uploadPath); } catch (_) {}

            const publicUrl = `https://renewgroup.site/uploads/${folder}/${finalFileName}`;
            console.log(`[LOCAL STORAGE] ✅ Upload exitoso a VPS: ${publicUrl}`);
            return res.json({ success: true, url: publicUrl });
        }

        // ── Guardar localmente (todos los tipos, no solo academia) ──
        const localUploadsDir2 = path.join(__dirname, 'uploads', folder);
        if (!fs.existsSync(localUploadsDir2)) fs.mkdirSync(localUploadsDir2, { recursive: true });
        const localFilePath2 = path.join(localUploadsDir2, finalFileName);
        fs.copyFileSync(finalPath, localFilePath2);

        // ── Limpieza de temporales ──
        try { fs.unlinkSync(finalPath); } catch (_) {}
        try { if (fs.readdirSync(uploadPath).length === 0) fs.rmdirSync(uploadPath); } catch (_) {}

        const publicUrl = `${PUBLIC_BASE_URL}/uploads/${folder}/${finalFileName}`;
        console.log(`[STORAGE] ✅ Upload exitoso (local): ${publicUrl}`);
        res.json({ success: true, url: publicUrl });

    } catch (e) {
        console.error('[COMPLETE] Critical Error:', e);
        res.status(500).json({ 
            success: false, 
            error: e.message || 'Fallo al completar la subida',
            details: e.toString(),
            source: 'complete-upload'
        });
    }
});

// ── PROXY para imágenes antiguas guardadas en Supabase con IP interna ──
// Permite que URLs como /api/storage-proxy/announcements/... funcionen públicamente
app.use('/api/storage-proxy', async (req, res) => {
    try {
        let filePath = req.path.replace(/^\//, ''); // Quitamos la barra inicial
        if (!filePath) return res.status(404).json({ error: 'Ruta de archivo no especificada' });
        
        // Si el filePath empieza con archivos_renew/, lo mantenemos. 
        // El internalUrl final debe ser: {IP}/storage/v1/object/public/{filePath}
        const internalUrl = `${SUPABASE_URL}/storage/v1/object/public/${filePath}`;
        console.log(`[PROXY] Fetching file: ${internalUrl}`);
        
        const https = require('https');
        const http = require('http');
        const protocol = internalUrl.startsWith('https') ? https : http;
        
        protocol.get(internalUrl, (proxyRes) => {
            // Forward headers
            const headers = {
                'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream',
                'Cache-Control': 'public, max-age=31536000',
                'Access-Control-Allow-Origin': '*'
            };
            res.writeHead(proxyRes.statusCode, headers);
            proxyRes.pipe(res);
        }).on('error', (err) => {
            console.error('[PROXY ERROR] Failed to fetch:', internalUrl, err.message);
            res.status(502).json({ error: 'No se pudo recuperar el archivo del almacenamiento interno.' });
        });
    } catch (e) {
        console.error('[PROXY CRITICAL]', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`\n🚀 RENEW CLOUD SERVER RUNNING`);
    console.log(`📡 Admin Panel : http://localhost:${port}/admin.html`);
    console.log(`📱 Mobile App  : http://localhost:${port}/index.html`);
    console.log(`🔐 Database    : SUPABASE (Live Connection)`);
    console.log(`🖼️  Public URL  : ${PUBLIC_BASE_URL}\n`);
});


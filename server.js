// Variables locales del servidor (.env, no se sube a git): AGENTE_TOKEN, AGENTE_WEBHOOK_URL
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

// ── CONFIGURACIÓN SUPABASE ───────────────
const SUPABASE_URL = 'https://gateway.renewgroup.site';
// URL pública del servidor (para generar URLs de archivos accesibles desde internet)
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://renewgroup.site';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.JlrSkGO6ZyAaaToY0xTLajbLsNuL8kn2QwCI3jrCeFs'; // secret: RenewJWTSuperSecret2026Key32Chars

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

// Alias para no romper las funciones que ya actualicé
const supabaseStorage = supabase;

const cron = require('node-cron');
const { syncPreciosFromSheets } = require('./google-sheets-sync.js');

// Sincronización Automática de Precios a las 10:00 AM todos los días
cron.schedule('0 10 * * *', async () => {
    console.log('[CRON] Iniciando sincronización de precios desde Google Sheets (10:00 AM)...');
    await syncPreciosFromSheets(supabase);
});

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

// La carpeta del proyecto se sirve completa, así que se bloquea todo lo que no es de la web:
// código del servidor, scripts sueltos con claves, SQL, configuración y documentos internos.
const RUTAS_PRIVADAS = [
    /^\/[^/]+\.(js|mjs|cjs|json|sql|sh|ps1|py|yml|yaml|md|txt|diff|patch|xlsx|csv|env)$/i, // archivos sueltos en la raíz
    /^\/(scratch|scripts|Agente-Renew-Water|node_modules|reportes|uploads_tmp)(\/|$)/i,
    /^\/(CONTRATO-RENEW-WATER|FORMULARIO-RENEW-WATER-main)\/(server\.js|api\/|package|\.env|vercel\.json|README)/i,
    /\/\./, // archivos ocultos (.env, .git, …)
];
const RUTAS_PUBLICAS_RAIZ = new Set(['/manifest.json']);
app.use((req, res, next) => {
    let ruta = req.path;
    try { ruta = decodeURIComponent(ruta); } catch (e) { return res.status(400).end(); }
    if (!RUTAS_PUBLICAS_RAIZ.has(ruta) && RUTAS_PRIVADAS.some(r => r.test(ruta))) return res.status(404).send('Not found');
    next();
});

// Serve static files — JS and HTML always get no-cache so browsers pick up updates immediately
app.use(express.static(path.join(__dirname), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js') || filePath.endsWith('.html') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// ── SESIÓN: login en el servidor con pase firmado (JWT) ──────────────────────
// La contraseña se revisa aquí y nunca sale hacia el navegador. El pase se guarda en
// localStorage ('rs_token') y las rutas protegidas lo piden en "Authorization: Bearer …".
// Secreto: AUTH_SECRET del .env o, si no existe, uno aleatorio guardado en .auth-secret (fuera de git).
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const AUTH_SECRET = (() => {
    if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
    const archivo = path.join(__dirname, '.auth-secret');
    try { return fs.readFileSync(archivo, 'utf8').trim(); } catch (e) { /* se crea abajo */ }
    const nuevo = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(archivo, nuevo, { mode: 0o600 });
    return nuevo;
})();
const SESION_DURACION = '30d';
const ROLES_ADMIN = /\b(admin|administrador|ceo)\b/;

const rolesTexto = (u) => (Array.isArray(u?.rol) ? u.rol.join(' ') : String(u?.rol || '')).toLowerCase();

// Usuario sin contraseña, con las URLs de archivos corregidas (igual que en /api/db)
function usuarioPublico(u) {
    const { password, pass, ...resto } = u || {};
    return {
        ...resto,
        foto:         fixUrl(u.foto),
        w9_url:       fixUrl(u.w9_url || u.w9Url),
        carnet_url:   fixUrl(u.carnet_url || u.carnetUrl),
        contrato_url: fixUrl(u.contrato_url || u.contratoUrl),
    };
}

// Al guardar usuarios el navegador ya no conoce las contraseñas: si un registro llega sin
// contraseña se conserva la que ya está en la base (si no, el guardado la borraría).
async function conservarPasswords(registros) {
    const sinPassword = registros.filter(u => u.id && !u.password).map(u => u.id);
    if (!sinPassword.length) return registros;
    const { data, error } = await supabase.from('usuarios').select('id, password').in('id', sinPassword);
    if (error) throw new Error('No se pudieron conservar las contraseñas: ' + error.message);
    const actuales = new Map((data || []).map(u => [String(u.id), u.password]));
    return registros.map(u => (u.password ? u : { ...u, password: actuales.get(String(u.id)) ?? null }));
}

// Freno contra adivinar contraseñas: 10 intentos fallidos por IP+correo cada 15 minutos
const intentosLogin = new Map();
const LOGIN_MAX_FALLOS = 10;
const LOGIN_VENTANA_MS = 15 * 60 * 1000;

app.post('/api/login', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim();
        const password = String(req.body?.password || '');
        if (!email || !password) return res.status(400).json({ error: 'Escribe tu correo y contraseña' });

        const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
        const clave = `${ip}|${email.toLowerCase()}`;
        const ahora = Date.now();
        const reg = intentosLogin.get(clave);
        if (reg && ahora - reg.desde < LOGIN_VENTANA_MS && reg.fallos >= LOGIN_MAX_FALLOS) {
            return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.' });
        }

        const { data: candidatos, error } = await supabase.from('usuarios').select('*').ilike('email', email);
        if (error) throw error;
        const u = (candidatos || []).find(x => String(x.email || '').toLowerCase() === email.toLowerCase() && (x.password === password || x.pass === password));
        if (!u) {
            const r = reg && ahora - reg.desde < LOGIN_VENTANA_MS ? reg : { desde: ahora, fallos: 0 };
            r.fallos += 1;
            intentosLogin.set(clave, r);
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        intentosLogin.delete(clave);
        if (u.is_suspended) return res.status(403).json({ error: 'Tu cuenta ha sido inhabilitada temporalmente. Por favor, contacta a administración.' });

        const token = jwt.sign({ sub: String(u.id) }, AUTH_SECRET, { expiresIn: SESION_DURACION });
        res.json({ user: usuarioPublico(u), token });
    } catch (e) {
        console.error('[API/LOGIN] error:', e.message);
        res.status(500).json({ error: 'No se pudo iniciar sesión. Intenta de nuevo.' });
    }
});

// Middleware: exige un pase válido y un usuario activo. Con soloAdmin, además Admin/CEO.
// El pase se lee de "Authorization: Bearer" o de ?t= (para <img>/<audio>, que no mandan cabeceras).
// Las respuestas 401 llevan "x-sesion: invalida" para que js/auth-fetch.js cierre la sesión y mande al login.
function requiereSesion({ soloAdmin = false } = {}) {
    return async (req, res, next) => {
        const rechazar = (msg) => res.status(401).set('x-sesion', 'invalida').json({ error: msg });
        try {
            const cab = req.headers.authorization || '';
            const token = cab.startsWith('Bearer ') ? cab.slice(7) : String(req.query.t || '');
            if (!token) return rechazar('Inicia sesión de nuevo');
            let datos;
            try { datos = jwt.verify(token, AUTH_SECRET); } catch (e) { return rechazar('Tu sesión expiró. Inicia sesión de nuevo.'); }
            const { data: u } = await supabase.from('usuarios').select('id, nombre, apellido, rol, is_suspended').eq('id', datos.sub).maybeSingle();
            if (!u || u.is_suspended) return rechazar('Tu cuenta no está activa');
            if (soloAdmin && !ROLES_ADMIN.test(rolesTexto(u))) return res.status(403).json({ error: 'Solo Admin o CEO' });
            req.usuario = u;
            next();
        } catch (e) {
            console.error('[SESION] error:', e.message);
            res.status(500).json({ error: 'Error verificando la sesión' });
        }
    };
}

const esAdmin = (u) => ROLES_ADMIN.test(rolesTexto(u));

// Reglas al guardar usuarios desde una sesión que no es Admin/CEO:
// - Nadie se cambia (ni le cambia a otro) el rol, la suspensión o los permisos.
// - Su propio perfil sí lo puede editar, incluida su contraseña.
// - De otros usuarios solo puede cambiar el rango (lo hace el ascenso automático al avanzar un proyecto).
// - No puede crear usuarios con rol Admin/CEO.
const CAMPOS_PROTEGIDOS = ['rol', 'is_suspended', 'unidades', 'equipo_ids', 'pipeline_ids', 'estatus_rrhh', 'ver_catalogo', 'ver_partners'];
async function limitarCambiosUsuarios(registros, sesion) {
    if (esAdmin(sesion)) return registros;
    const ids = registros.map(u => u.id).filter(Boolean);
    const { data, error } = await supabase.from('usuarios').select('*').in('id', ids.length ? ids : ['__ninguno__']);
    if (error) throw new Error('No se pudieron validar los usuarios: ' + error.message);
    const actuales = new Map((data || []).map(u => [String(u.id), u]));
    const permitidos = [];
    for (const u of registros) {
        const actual = actuales.get(String(u.id));
        if (!actual) {
            if (ROLES_ADMIN.test(rolesTexto(u))) { console.warn(`[SEGURIDAD] ${sesion.id} intentó crear un usuario Admin/CEO`); continue; }
            permitidos.push(u);
            continue;
        }
        const resultado = {};
        for (const k of Object.keys(u)) resultado[k] = k in actual ? actual[k] : u[k];
        if (String(u.id) === String(sesion.id)) {
            for (const k of Object.keys(u)) if (!CAMPOS_PROTEGIDOS.includes(k)) resultado[k] = u[k];
        } else if ('rango' in u) {
            resultado.rango = u.rango;
        }
        permitidos.push(resultado);
    }
    return permitidos;
}

// Tablas que la app nunca toca directamente, y borrado de usuarios solo para Admin/CEO
const TABLAS_SOLO_SERVIDOR = ['agente_auditoria', 'solicitudes_firma'];
function tablaProhibida(table, sesion) {
    if (TABLAS_SOLO_SERVIDOR.includes(table)) return 'Esta tabla no se puede modificar desde la app';
    if (table === 'usuarios' && !esAdmin(sesion)) return 'Solo Admin o CEO pueden borrar usuarios';
    return null;
}

// Servir archivos subidos localmente (fotos de clientes, anuncios, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '30d' // uploads are content-addressed, safe to cache
}));

// Chunked Upload State
const os = require('os');
const CHUNK_DIR = path.join(os.tmpdir(), 'renew-uploads');
if (!fs.existsSync(CHUNK_DIR)) fs.mkdirSync(CHUNK_DIR, { recursive: true });

// Static files are served above via express.static(__dirname)
// Explicit routes ensure SPAs load correctly for any non-API route
app.get('/admin', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.join(__dirname, 'admin.html'));
});
app.get('/app', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
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
    if (url.includes('31.97.') || url.includes('gateway.renewgroup.site') || url.includes('supabase.renewgroup.site') || url.includes('/storage/v1/object/public/')) {
        const parts = url.split('/storage/v1/object/public/');
        const filePath = parts[parts.length - 1];
        return `/api/storage-proxy/${filePath.replace(/^\//, '')}`;
    }
    
    // Convertir localhost a URL pública si existe
    if (url.includes('http://localhost:3010')) {
        return url.replace('http://localhost:3010', PUBLIC_BASE_URL);
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
            'recibos_pagos', 'water_productos', 'admin_catalogos', 'admin_meetings', 'admin_meetings_reads', 'mensajes_internos',
            'rrhh_adelantos', 'admin_roles'
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
            Usuarios:                (results[6].data || []).map(usuarioPublico),
            academiaContent:         (results[7].data || []).map(item => ({
                id:             item.id,
                titulo:         item.titulo         || null,
                tipo:           item.tipo           || null,
                enlace:         item.enlace         || null,
                miniaturaUrl:   fixUrl(item.miniatura_url  || item.miniaturaUrl),
                permisos:       item.permisos       || [],
                fecha_creacion: item.fecha_creacion || null,
                parent_id:      item.parent_id      || null,
                is_folder:      !!item.is_folder,
                notas:          item.notas          || null
            })),
            inventarioGlobal:        (results[8].data || []).map(item => ({
                id:          item.id,
                nombreItem:  item.nombre_item  || item.nombreItem  || null,
                ecosistema:  item.ecosistema   || null,
                category:    item.category     || null,
                locacion:    item.locacion     || null,
                storage:     item.storage      || null,
                medida:      item.medida       || null,
                boton:       item.boton        || null,
                color:       item.color        || null,
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
                precio_iniciante: p.precio_iniciante ?? null,
                precio_junior:   p.precio_junior   ?? null,
                precio_subvende: p.precio_subvende  ?? null,
                precio_vendedor: p.precio_vendedor  ?? null,
                precio_analista: p.precio_analista  ?? null,
                precio_oficina:  p.precio_oficina   ?? null,
                precio_dealer:   p.precio_dealer    ?? p.solo_equipo_grande ?? null,
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
            rrhh_adelantos:          results[19].data || [],
            Admin_Roles:             results[20].data || [],
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
        
        // Final Global Fix: Stringify everything and replace internal URLs globally
        const jsonString = JSON.stringify(db);
        const fixedJson = jsonString
            .replace(/https?:\/\/31\.97\.\d+\.\d+:\d+\/storage\/v1\/object\/public\//g, '/api/storage-proxy/')
            .replace(/https?:\/\/31\.97\.\d+\.\d+:\d+\//g, '/api/storage-proxy/')
            .replace(/https?:\/\/(gateway|supabase)\.renewgroup\.site\/storage\/v1\/object\/public\//g, '/api/storage-proxy/')
            .replace(/https?:\/\/(api-renew|files-renew)\.0f2zfh\.easypanel\.host(\/storage\/v1)?(\/object\/public)?\//g, '/api/storage-proxy/')
            .replace(/http:\/\/localhost:3010/g, PUBLIC_BASE_URL);
        
        res.setHeader('Content-Type', 'application/json');
        res.send(fixedJson);
    } catch (error) {
        console.error('[SUPABASE ERROR] getDB:', error.message);
        res.status(500).json({ error: 'Fallo al recuperar datos de Supabase', details: error.message });
    }
});

// GET: Mensajes Internos (endpoint dedicado para el chat — evita depender del /api/db completo)
app.get('/api/messages', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    try {
        const { data, error } = await supabase
            .from('mensajes_internos')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[API/MESSAGES] Supabase error:', error.message);
            return res.status(500).json({ error: error.message });
        }

        // Apply URL normalization same as /api/db
        const messages = (data || []).map(m => ({
            ...m,
            image_url: fixUrl(m.image_url)
        }));

        // Global string replace for any remaining internal URLs
        const jsonString = JSON.stringify(messages);
        const fixedJson = jsonString
            .replace(/https?:\/\/31\.97\.\d+\.\d+:\d+\/storage\/v1\/object\/public\//g, '/api/storage-proxy/')
            .replace(/https?:\/\/(gateway|supabase)\.renewgroup\.site\/storage\/v1\/object\/public\//g, '/api/storage-proxy/')
            .replace(/http:\/\/localhost:3010/g, PUBLIC_BASE_URL);

        console.log(`[API/MESSAGES] Returning ${messages.length} messages.`);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ messages: JSON.parse(fixedJson) }));
    } catch (error) {
        console.error('[API/MESSAGES] Critical error:', error.message);
        res.status(500).json({ error: 'Fallo al recuperar mensajes', details: error.message });
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

// GET: Buscar clientes para autocompletar en formularios
app.get('/api/search-clients', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) return res.json([]);

        console.log(`[API] Searching clients for: ${q}`);
        
        const { data: clients, error } = await supabase
            .from('clientes_maestro')
            .select('id, nombre, telefono, email, direccion')
            .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`)
            .limit(10);

        if (error) {
            console.error('[API ERROR] search-clients:', error);
            return res.status(500).json({ error: 'Error buscando clientes' });
        }

        // Also look up each client's most recent project so we can link directly
        const enriched = await Promise.all((clients || []).map(async (cli) => {
            try {
                const { data: proyectos } = await supabase
                    .from('proyectos_dinamicos')
                    .select('id')
                    .eq('cliente_id', cli.id)
                    .order('created_at', { ascending: false })
                    .limit(1);
                return { ...cli, proyectoId: proyectos?.[0]?.id || null };
            } catch (_) {
                return { ...cli, proyectoId: null };
            }
        }));

        res.json(enriched);
    } catch (error) {
        console.error('[API ERROR] search-clients:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST: Guardar documentos de la aplicación de crédito en el perfil del cliente
app.post('/api/save-credit-docs', async (req, res) => {
    try {
        const { clienteId, fotoIdAplicante, fotoIdCoAplicante, pdfBase64 } = req.body;
        
        if (!clienteId) {
            return res.status(400).json({ error: 'ID de cliente requerido' });
        }

        console.log(`[API] Saving credit docs for client: ${clienteId}`);

        // Helper para decodificar base64
        const decodeBase64 = (dataString) => {
            const matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) return null;
            return { type: matches[1], data: Buffer.from(matches[2], 'base64') };
        };

        const urls = {};
        const updatePayload = {};

        // 1. Obtener cliente actual para actualizar adjuntos_oficina
        const { data: cliente, error: getErr } = await supabase
            .from('clientes_maestro')
            .select('adjuntos_oficina')
            .eq('id', clienteId)
            .single();

        if (getErr) {
            console.error('[API] Error getting client:', getErr);
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        let adjuntos = cliente.adjuntos_oficina || {};

        // 2. Subir Foto ID Aplicante
        if (fotoIdAplicante && fotoIdAplicante.startsWith('data:image')) {
            const decoded = decodeBase64(fotoIdAplicante);
            if (decoded) {
                const fileName = `id_aplicante_${Date.now()}.jpg`;
                const { data: sData, error: sErr } = await supabase.storage
                    .from('archivos_renew')
                    .upload(`clientes/${clienteId}/${fileName}`, decoded.data, { contentType: decoded.type, upsert: true });

                if (!sErr) {
                    const { data: { publicUrl } } = supabase.storage.from('archivos_renew').getPublicUrl(`clientes/${clienteId}/${fileName}`);
                    urls.aplicante = publicUrl;
                    updatePayload.adjunto_id_url = publicUrl;
                    updatePayload.id_photo = publicUrl; // También para mantener compatibilidad
                } else {
                    console.error('[API] Error uploading ID Aplicante:', sErr);
                }
            }
        }

        // 3. Subir Foto ID Co-Aplicante
        if (fotoIdCoAplicante && fotoIdCoAplicante.startsWith('data:image')) {
            const decoded = decodeBase64(fotoIdCoAplicante);
            if (decoded) {
                const fileName = `id_coaplicante_${Date.now()}.jpg`;
                const { data: sData, error: sErr } = await supabase.storage
                    .from('archivos_renew')
                    .upload(`clientes/${clienteId}/${fileName}`, decoded.data, { contentType: decoded.type, upsert: true });

                if (!sErr) {
                    const { data: { publicUrl } } = supabase.storage.from('archivos_renew').getPublicUrl(`clientes/${clienteId}/${fileName}`);
                    urls.coaplicante = publicUrl;
                    adjuntos.co_applicant_id_url = publicUrl;
                } else {
                    console.error('[API] Error uploading ID Co-Aplicante:', sErr);
                }
            }
        }

        // 4. Subir PDF
        if (pdfBase64) {
            const decoded = decodeBase64(pdfBase64);
            if (decoded) {
                const fileName = `credit_app_${Date.now()}.pdf`;
                const { data: sData, error: sErr } = await supabase.storage
                    .from('archivos_renew')
                    .upload(`clientes/${clienteId}/${fileName}`, decoded.data, { contentType: 'application/pdf', upsert: true });

                if (!sErr) {
                    const { data: { publicUrl } } = supabase.storage.from('archivos_renew').getPublicUrl(`clientes/${clienteId}/${fileName}`);
                    urls.pdf = publicUrl;
                    adjuntos.app_url = publicUrl;
                    updatePayload.credit_app_url = publicUrl; // Legacy
                } else {
                    console.error('[API] Error uploading PDF:', sErr);
                }
            }
        }

        updatePayload.adjuntos_oficina = adjuntos;

        // 5. Actualizar registro en DB
        if (Object.keys(updatePayload).length > 0) {
            const { error: updErr } = await supabase
                .from('clientes_maestro')
                .update(updatePayload)
                .eq('id', clienteId);

            if (updErr) {
                console.error('[API] Error updating client docs:', updErr);
            }
        }

        res.json({ success: true, urls });

    } catch (error) {
        console.error('[API ERROR] save-credit-docs:', error);
        res.status(500).json({ error: 'Error interno al guardar documentos' });
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
                
                console.log(`[PDF-SYNC] <i class="fa-solid fa-check text-green-500"></i> Perfil del cliente ${proy.cliente_id} actualizado con recibo_url y detalles.`);
            }
        }

        console.log(`[PDF] <i class="fa-solid fa-check text-green-500"></i> Generación exitosa: ${cleanUrl}`);
        res.json({ success: true, url: cleanUrl });

    } catch (error) {
        console.error('[PDF ERROR]:', error);
        res.status(500).json({ error: 'Fallo al generar el PDF', details: error.message });
    }
});

// POST: Sincronización masiva (Upsert) a Supabase
// ── GOOGLE CALENDAR SYNC (SERVICE ACCOUNT) ──
app.post('/api/calendar/sync', requiereSesion(), async (req, res) => {
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

// POST: Sincronización manual de la Lista de Precios desde Google Sheets
app.post('/api/sync-google-sheets', requiereSesion(), async (req, res) => {
    try {
        console.log('[API/SYNC] Petición manual de sincronización recibida.');
        const result = await syncPreciosFromSheets(supabase);
        if (result.success) {
            res.json({ success: true, count: result.count, message: result.message || 'Sincronizado' });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (e) {
        console.error('[API/SYNC] Error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/db', requiereSesion(), async (req, res) => {
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
                    rango:      u.rango      || null,
                    rango_solar: u.rango_solar || null,
                    department: u.department || null,
                    dob:        u.dob        || null,
                    foto:       u.foto       || null,
                    telefono:   u.telefono   || null,
                    w9_url:     u.w9_url     || u.w9Url || null,
                    carnet_url: u.carnet_url || u.carnetUrl || null,
                    contrato_url: u.contrato_url || u.contratoUrl || null,
                    estatus_rrhh: u.estatus_rrhh || null,
                    is_suspended: u.is_suspended || false,
                    sede:         u.sede         || null,
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
                    banco_ruta:     u.banco_ruta     || null,
                    zadarma_sip_id: u.zadarma_sip_id || null,
                    ver_catalogo:   !!u.ver_catalogo
                };
                if (mapped.id === 'u1') console.log('[DEBUG-U1] Mapped Carlos:', JSON.stringify(mapped));
                return mapped;
            });
            syncTasks.push(
                limitarCambiosUsuarios(usrs, req.usuario).then(conservarPasswords).then(conPassword => supabase.from('usuarios').upsert(conPassword, { onConflict: 'id' })).then(({ error }) => {
                    if (error) {
                        console.error('[DIAGNOSTIC SUPABASE] Error guardando usuarios:', error);
                        throw error;
                    } else {
                        console.log('[DIAGNOSTIC SUPABASE] Usuarios guardados correctamente.');
                    }
                })
            );
        }
        if (db.Clientes_Maestro?.length) {
            // Pre-fetch existing clients to merge server-side background data safely (like grabacion_url)
            const clientIds = db.Clientes_Maestro.map(c => c.id);
            const { data: existingClients } = await supabase.from('clientes_maestro').select('id, historial_llamadas').in('id', clientIds);
            const existingMap = {};
            if (existingClients) {
                existingClients.forEach(c => existingMap[c.id] = c);
            }
            
            // Pre-fetch origin Leads for new clients to guarantee we don't lose webhooks that hit the lead before conversion
            const newClientsFromLeads = db.Clientes_Maestro.filter(c => !existingMap[c.id] && c.origen_tipo === 'call_center' && c.origen_id);
            const leadIds = newClientsFromLeads.map(c => c.origen_id);
            const leadMap = {};
            if (leadIds.length > 0) {
                const { data: leadsData } = await supabase.from('call_center_prospectos').select('id, historial_llamadas').in('id', leadIds);
                if (leadsData) {
                    leadsData.forEach(l => leadMap[l.id] = l);
                }
            }

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
                // CRITICAL: Only include adjuntos_oficina and contrato_water_url if they
                // have a real value in the LOCAL cache.
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
                
                // MERGE historial_llamadas
                if (item.historial_llamadas) {
                    const existing = existingMap[item.id] || (item.origen_tipo === 'call_center' && leadMap[item.origen_id] ? leadMap[item.origen_id] : null);
                    if (existing && existing.historial_llamadas) {
                        const callMap = {};
                        // 1. Load server calls (source of truth for recordings and new calls)
                        existing.historial_llamadas.forEach(c => {
                            if (c.call_id) callMap[c.call_id] = { ...c };
                        });
                        // 2. Overlay client calls (source of truth for proyecto_id modifications)
                        item.historial_llamadas.forEach(c => {
                            if (c.call_id) {
                                if (callMap[c.call_id]) {
                                    callMap[c.call_id].proyecto_id = c.proyecto_id || callMap[c.call_id].proyecto_id;
                                    if (!callMap[c.call_id].grabacion_url && c.grabacion_url) {
                                        callMap[c.call_id].grabacion_url = c.grabacion_url;
                                    }
                                } else {
                                    callMap[c.call_id] = { ...c };
                                }
                            }
                        });
                        mapped.historial_llamadas = Object.values(callMap).sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
                    } else {
                        mapped.historial_llamadas = item.historial_llamadas;
                    }
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
                fecha_creacion: item.fecha_creacion || null,
                parent_id:      item.parent_id      || null,
                is_folder:      !!item.is_folder,
                notas:          item.notas          || null
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

        if (db.rrhh_adelantos?.length) {
            const cleanAdelantos = db.rrhh_adelantos.map(a => ({
                id: a.id,
                trabajador_id: a.trabajador_id || null,
                trabajador_nombre: a.trabajador_nombre || null,
                monto: a.monto || 0,
                fecha: a.fecha || null,
                motivo: a.motivo || null,
                document_url: a.document_url || null,
                created_at: a.created_at || new Date().toISOString()
            }));
            syncTasks.push(supabase.from('rrhh_adelantos').upsert(cleanAdelantos, { onConflict: 'id' }));
        }

        if (db.Admin_Roles?.length) {
            const cleanRoles = db.Admin_Roles.map(r => ({
                id: r.id,
                nombre: r.nombre || null,
                permisos: r.permisos || {},
                is_base: !!r.is_base,
                created_at: r.created_at || new Date().toISOString()
            }));
            syncTasks.push(supabase.from('admin_roles').upsert(cleanRoles, { onConflict: 'id' }));
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

        if (db.admin_meetings?.length) {
            const cleanMeetings = db.admin_meetings.map(m => ({
                id: m.id,
                titulo: m.titulo || null,
                texto: m.texto || null,
                enlace: m.enlace || null,
                imagen_url: m.imagen_url || null,
                audiencia: m.audiencia || null,
                audiencia_tags: Array.isArray(m.audiencia_tags) ? m.audiencia_tags : [],
                created_at: m.created_at || new Date().toISOString()
            }));
            syncTasks.push(supabase.from('admin_meetings').upsert(cleanMeetings, { onConflict: 'id' }));
        }

        if (db.admin_meetings_reads?.length) {
            const cleanReads = db.admin_meetings_reads.map(r => ({
                id: r.id,
                meeting_id: r.meeting_id || null,
                user_id: r.user_id || null,
                read_at: r.read_at || new Date().toISOString()
            }));
            syncTasks.push(supabase.from('admin_meetings_reads').upsert(cleanReads, { onConflict: 'id' }));
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
app.post('/api/upsert', requiereSesion(), async (req, res) => {
    try {
        const { table, records } = req.body;
        if (!table || !records || !Array.isArray(records)) {
            return res.status(400).json({ error: 'Formato incorrecto. Se requiere "table" y un array "records".' });
        }
        if (TABLAS_SOLO_SERVIDOR.includes(table)) return res.status(403).json({ error: 'Esta tabla no se puede modificar desde la app' });
        
        console.log(`[SUPABASE GRANULAR] Upserting ${records.length} records into ${table}...`);
        
        // ── STRIP VIRTUAL FIELDS ──
        // Some tables have computed/virtual fields that only exist in memory, not in Supabase.
        let sanitizedRecords = records;
        if (table === 'admin_campos_formulario') {
            sanitizedRecords = records.map(c => ({
                id: c.id,
                fase_id: c.fase_id,
                etiqueta: c.etiqueta,
                tipo: c.tipo,
                opciones: c.opciones || ''
            }));
        } else if (table === 'proyectos_dinamicos') {
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
        } else if (table === 'usuarios') {
            // Map ONLY the columns that exist in Supabase's 'usuarios' table
            sanitizedRecords = records.map(u => ({
                id:                         u.id                         || null,
                nombre:                     u.nombre                     || null,
                apellido:                   u.apellido                   || null,
                email:                      u.email                      || null,
                password:                   u.password                   || null,
                rol:                        u.rol                        || null,
                rango:                      u.rango                      || null,
                rango_solar:                u.rango_solar                || null,
                department:                 u.department                 || null,
                dob:                        u.dob                        || null,
                foto:                       u.foto                       || null,
                telefono:                   u.telefono                   || null,
                w9_url:                     u.w9_url                     || u.w9Url || null,
                carnet_url:                 u.carnet_url                 || u.carnetUrl || null,
                contrato_url:               u.contrato_url               || u.contratoUrl || null,
                estatus_rrhh:               u.estatus_rrhh               || null,
                is_suspended:               u.is_suspended               || false,
                sede:                       u.sede                       || null,
                unidades:                   Array.isArray(u.unidades) ? u.unidades : [],
                equipo_ids:                 Array.isArray(u.equipo_ids) ? u.equipo_ids : [],
                pipeline_ids:               Array.isArray(u.pipeline_ids) ? u.pipeline_ids : [],
                tel_emergencia:             u.tel_emergencia             || null,
                contacto_emergencia_nombre: u.contacto_emergencia_nombre || null,
                direccion:                  u.direccion                  || null,
                zelle_nombre:               u.zelle_nombre               || null,
                zelle_cuenta:               u.zelle_cuenta               || null,
                zelle_tel:                  u.zelle_tel                  || null,
                banco_nombre:               u.banco_nombre               || null,
                banco_cuenta:               u.banco_cuenta               || null,
                banco_ruta:                 u.banco_ruta                 || null,
                zadarma_sip_id:             u.zadarma_sip_id             || null,
                ver_catalogo:               !!u.ver_catalogo,
                ver_partners:               !!u.ver_partners
            }));
            sanitizedRecords = await conservarPasswords(await limitarCambiosUsuarios(sanitizedRecords, req.usuario));
        } else if (table === 'calendario_eventos') {
            sanitizedRecords = records.map(ev => ({
                ...ev,
                colaboradores: Array.isArray(ev.colaboradores) ? ev.colaboradores.map(c => typeof c === 'string' ? c : JSON.stringify(c)) : [],
                attendees: ev.attendees || []
            }));
        } else if (table === 'historial_inventario') {
            // Strip the client-side 'id' string because Supabase uses a serial/integer ID
            sanitizedRecords = records.map(({ id, ...rest }) => rest);
        } else if (table === 'water_productos') {
            sanitizedRecords = records.map(r => ({
                ...r,
                solo_equipo_grande: r.precio_dealer ?? r.solo_equipo_grande ?? 0
            }));
        }
        
        // El id es el identificador por defecto para el conflicto en la mayoría de tablas
        let conflictObj = { onConflict: 'id' };
        if (table === 'historial_inventario') conflictObj.onConflict = 'fecha';
        
        let { error, data } = await supabase.from(table).upsert(sanitizedRecords, conflictObj).select();
        
        if (error && table === 'water_productos' && error.message && error.message.includes('precio_dealer')) {
            const fallbackRecords = sanitizedRecords.map(({ precio_dealer, ...rest }) => rest);
            const retryRes = await supabase.from(table).upsert(fallbackRecords, conflictObj).select();
            error = retryRes.error;
            data = retryRes.data;
        }
        
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
// ── ORDEN DE TRABAJO: payload del formulario → campos de molde_orden_v4.pdf ──
const MOLDE_ORDEN = 'molde_orden_v4.pdf';
function buildWorkOrderPdfData(raw, dealerName) {
  const c = raw.comprador || {};
  const e = raw.equipos || {};
  const i = raw.instalacion || {};
  const f = raw.finanzas || {};
  const s = raw.firmas || {};
  const X = (v) => (v ? 'X' : '');
  const num = (v) => parseFloat(String(v || '').replace(/[^0-9.]/g, '')) || 0;
  const todayStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

  // Payloads antiguos (agente n8n) no traen formaPago: se deduce de los montos
  const formas = Array.isArray(f.formaPago) ? f.formaPago : [];
  const legacy = !formas.length && f.cuotaInicialMarcada === undefined && !f.otroMetodo;
  const financiado = formas.includes('Financed') || (legacy && (num(f.cantidad_financiar) > 0 || num(f.saldo_financiado) > 0));
  const tarjeta = formas.includes('Credit Card') || (legacy && num(f.tarjetaMonto) > 0);
  const efectivo = formas.includes('Cash') || (legacy && !financiado && !tarjeta && num(f.precioContado) > 0);
  const inicial = f.cuotaInicialMarcada !== undefined ? !!f.cuotaInicialMarcada : num(f.cuotaInicial) > 0;

  return {
    fecha_orden: raw.fecha || todayStr,
    comprador_1: [c.nombre || c.nombreCompleto, c.segundoNombre].filter(Boolean).join(' / '),
    telefono: c.telefono || '',
    email: c.email || '',
    direccion: c.direccion || '',
    ciudad: c.ciudad || '',
    estado: c.estado || '',
    zip: c.zipCode || c.zip || '',

    terminos_previos: X(e.terminosPrevios),
    equipo_softener: X(e.suavizadorCasa_entera || e.suavizadorCasa),
    equipo_ro: X(e.osmosisReversa || e.osmosisReverso),
    equipo_alkaline: X(e.aguaAlcalina),
    agua_ciudad: X(e.aguaCiudad),
    tipo_linea: e.tipoLinea || '',
    producto_especifico: e.productoEspecifico || '',
    equipo_well: X(e.aguaPozo),
    equipo_otro: X(e.otro || e.otros || e.otro_texto),
    equipo_otro_texto: e.otros || e.otro_texto || '',

    fecha_inst: i.fechaEstimada || '',
    hora_9_2: X(i.horario === '9:00am-2:00pm'),
    hora_2_6: X(i.horario === '2:00pm-6:00pm'),
    instrucciones: i.instruccionesEspeciales || '',

    pago_efectivo: X(efectivo),
    pago_financiado: X(financiado),
    pago_tarjeta: X(tarjeta),
    pago_inicial: X(inicial),
    cuota_inicial: inicial ? String(f.cuotaInicial || '').replace(/^\s*\$\s*/, '') : '',
    pago_otro: X(f.otroMetodo || f.otroMetodoTexto),
    pago_otro_texto: f.otroMetodoTexto || '',

    firma_comp1: s.comprador_1 || s.comprador || '',
    firma_comp2: s.comprador_2 || '',
    nombre_rep: dealerName || '',
    firma_rep: s.representante || '',
    fecha_c1: todayStr,
    fecha_c2: (s.comprador_2 || c.segundoNombre) ? todayStr : '',
    fecha_rep: todayStr,
  };
}

// opciones.fitImages: las firmas conservan su proporción dentro del campo (alineadas a la izquierda)
async function generarPDF(moldePath, datos, opciones = {}) {
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
              let box = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
              if (opciones.fitImages) {
                const dims = pngImage.scaleToFit(rect.width, rect.height);
                box = { x: rect.x, y: rect.y + (rect.height - dims.height) / 2, width: dims.width, height: dims.height };
              }
              // ── FIX: Draw white background first so transparent PNG areas ──
              // don't render as dark/black in PDF viewers
              pageOfField.drawRectangle({
                ...box,
                color: rgb(1, 1, 1),
                borderWidth: 0,
              });
              pageOfField.drawImage(pngImage, box);
              textField.setText('');
            }
          } else {
            textField.setText(String(value));
            // FIX: If a field is multiline (or explicitly forced to be), setting an explicit font size prevents pdf-lib from vertically centering the text
            try {
              if (name === 'nota' || name.toLowerCase().includes('nota') || name.toLowerCase().includes('note')) {
                textField.enableMultiline();
                textField.setFontSize(10);
              } else if (textField.isMultiline()) {
                textField.setFontSize(10);
              }
            } catch (e) {}
          }
        } catch (innerErr) {
          console.warn(`[PDF] Error al escribir en campo ${name}:`, innerErr.message);
        }
      } else if (type === 'PDFCheckBox') {
        try {
          const checkBox = form.getCheckBox(name);
          console.log(`[PDF] Rellenando checkbox: ${name} | Valor: ${value}`);
          if (value === true || value === 'true' || value === 'on' || value === 'si' || value === 'X' || value === 'x') {
            checkBox.check();
          } else {
            checkBox.uncheck();
          }
        } catch (innerErr) {
          console.warn(`[PDF] Error al escribir en checkbox ${name}:`, innerErr.message);
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

// ── CONFIRMACION DE INSTALACION WATER PDF ENDPOINT ──
app.post('/api/generar-confirmacion-instalacion', async (req, res) => {
    console.log('[/api/generar-confirmacion-instalacion] Petición recibida.');
    try {
        let d = req.body.datos || req.body;
        const moldePath = path.join(__dirname, 'confirmacion_instalacion_water_molde_v2.pdf');

        if (!fs.existsSync(moldePath)) {
            return res.status(404).json({ error: 'No se encontró el PDF de confirmación molde' });
        }

        // Mapeo de datos (radio buttons y booleanos -> 'X' o vacío porque son TextFields en el PDF)
        // Las 3 observaciones van en una sola confirmación Sí/No + iniciales
        d.obs_yes = d.confirmacion_cliente === 'si' ? 'X' : '';
        d.obs_no  = d.confirmacion_cliente === 'no' ? 'X' : '';
        d.obs_iniciales = d.iniciales || '';

        d.chk_water_treatment = d.water_treatment ? 'X' : '';
        d.chk_reverse_osmosis = d.reverse_osmosis ? 'X' : '';
        d.chk_well_water = d.well_water ? 'X' : '';

        console.log('[PDF] Generando confirmación con molde:', moldePath);
        const pdfBytes = await generarPDF(moldePath, d, { fitImages: true });

        // Subir a Supabase
        const esBorrador = !!d._borrador;
        const fileName = `${esBorrador ? 'confirmaciones/borradores' : 'confirmaciones'}/confirmacion_instalacion_${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
            .from('archivos_renew')
            .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });

        let finalUrl = null;
        if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('archivos_renew').getPublicUrl(fileName);
            finalUrl = publicUrl;

            // Guardar en clientes_maestro si hay proyectoId o clienteId
            let targetClienteId = d.clienteId || null;
            if (!targetClienteId && d.proyectoId) {
                const { data: proy } = await supabase.from('proyectos_dinamicos')
                    .select('cliente_id').eq('id', d.proyectoId).single();
                if (proy?.cliente_id) targetClienteId = proy.cliente_id;
            }

            if (targetClienteId && !esBorrador) {
                const { data: cli } = await supabase.from('clientes_maestro')
                    .select('adjuntos_oficina').eq('id', targetClienteId).single();
                let adj = (!cli?.adjuntos_oficina || Array.isArray(cli.adjuntos_oficina)) ? {} : cli.adjuntos_oficina;
                adj.confirmacion_instalacion_url = finalUrl;
                await supabase.from('clientes_maestro')
                    .update({ adjuntos_oficina: adj, confirmacion_instalacion_url: finalUrl })
                    .eq('id', targetClienteId);
                console.log(`[CONFIRMACION] Cliente ${targetClienteId} actualizado.`);
            }
        } else {
            console.error('[STORAGE ERROR - CONFIRMACION]', uploadError);
        }

        res.json({ success: true, url: finalUrl });
    } catch (err) {
        console.error('[/api/generar-confirmacion-instalacion] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── FIRMA VIRTUAL DEL CLIENTE (enlace único por WhatsApp) ──
// El agente Renew Water crea una solicitud con los datos de la plantilla y un borrador en PDF.
// El cliente abre /firmar.html?t=TOKEN, revisa el borrador y firma; aquí se genera el PDF oficial
// con su firma y se avisa al agente (n8n) para que siga con el pipeline.
// Requiere en el .env del servidor: AGENTE_TOKEN (mismo valor que WEBHOOK_TOKEN del workflow)
// y opcionalmente AGENTE_WEBHOOK_URL (por defecto el webhook del agente en n8n).
const FIRMA_TIPOS = {
    orden_trabajo: { titulo: 'Orden de Trabajo', endpoint: '/api/generar-orden' },
    confirmacion_instalacion: { titulo: 'Confirmación de Instalación', endpoint: '/api/generar-confirmacion-instalacion' },
};
const FIRMA_DIAS_VIGENCIA = 7;

function agenteAutorizado(req) {
    const token = process.env.AGENTE_TOKEN;
    return !!token && req.headers['x-agente-token'] === token;
}

// Genera el PDF llamando al endpoint propio (así se reutiliza exactamente la misma lógica)
async function generarPdfInterno(tipo, datos) {
    const conf = FIRMA_TIPOS[tipo];
    const r = await fetch(`http://127.0.0.1:${port}${conf.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datos }),
    });
    if (!r.ok) throw new Error(`No se pudo generar ${conf.titulo} (${r.status})`);
    if (tipo === 'orden_trabajo') return r.headers.get('x-document-url');
    const j = await r.json();
    return j.url;
}

// 1) El agente crea la solicitud (genera también el borrador para que el cliente lo revise)
app.post('/api/firmas/solicitud', async (req, res) => {
    try {
        if (!agenteAutorizado(req)) return res.status(401).json({ error: 'No autorizado' });
        const { tipo, proyecto_id, cliente_id, cliente_nombre, datos, creado_por } = req.body || {};
        if (!FIRMA_TIPOS[tipo]) return res.status(400).json({ error: 'Tipo de documento no válido' });
        if (!datos || typeof datos !== 'object') return res.status(400).json({ error: 'Faltan los datos del documento' });

        const preview_url = await generarPdfInterno(tipo, { ...datos, _borrador: true });
        const token = require('crypto').randomBytes(24).toString('hex');
        const expira_en = new Date(Date.now() + FIRMA_DIAS_VIGENCIA * 864e5).toISOString();
        const { error } = await supabase.from('solicitudes_firma').insert({
            token, tipo, proyecto_id: proyecto_id || null, cliente_id: cliente_id || null,
            cliente_nombre: cliente_nombre || null, datos, preview_url, estado: 'pendiente',
            creado_por: creado_por || null, expira_en,
        });
        if (error) throw new Error(error.message);
        res.json({ success: true, token, url: `${PUBLIC_BASE_URL}/firmar.html?t=${token}`, preview_url, expira_en });
    } catch (err) {
        console.error('[/api/firmas/solicitud] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

async function leerSolicitud(token) {
    if (!/^[a-f0-9]{48}$/.test(String(token || ''))) return null;
    const { data } = await supabase.from('solicitudes_firma').select('*').eq('token', token).maybeSingle();
    return data || null;
}

// 2) La página pública consulta la solicitud (solo lo necesario para mostrarla)
app.get('/api/firmas/:token', async (req, res) => {
    const s = await leerSolicitud(req.params.token);
    if (!s) return res.status(404).json({ error: 'Enlace no válido' });
    const vencida = s.estado === 'pendiente' && s.expira_en && new Date(s.expira_en) < new Date();
    res.json({
        tipo: s.tipo, titulo: FIRMA_TIPOS[s.tipo]?.titulo || 'Documento',
        cliente_nombre: s.cliente_nombre, estado: vencida ? 'vencida' : s.estado,
        preview_url: s.preview_url, pdf_url: s.estado === 'firmado' ? s.pdf_url : null, firmado_en: s.firmado_en,
    });
});

// 3) El cliente firma: se genera el PDF oficial con su firma y se avisa al agente
app.post('/api/firmas/:token', async (req, res) => {
    try {
        const s = await leerSolicitud(req.params.token);
        if (!s) return res.status(404).json({ error: 'Enlace no válido' });
        if (s.estado !== 'pendiente') return res.status(409).json({ error: 'Este documento ya fue firmado' });
        if (s.expira_en && new Date(s.expira_en) < new Date()) return res.status(410).json({ error: 'El enlace venció. Pide uno nuevo a tu representante.' });

        const { firma, firmante_nombre, confirmacion_cliente, iniciales } = req.body || {};
        if (typeof firma !== 'string' || !firma.startsWith('data:image/png;base64,') || firma.length > 1.5e6) {
            return res.status(400).json({ error: 'Firma no válida' });
        }

        // Marca la solicitud como en proceso para evitar dobles firmas
        const { data: tomada } = await supabase.from('solicitudes_firma')
            .update({ estado: 'procesando' }).eq('token', s.token).eq('estado', 'pendiente').select('token');
        if (!tomada || !tomada.length) return res.status(409).json({ error: 'Este documento ya está siendo firmado' });

        const datos = { ...s.datos, _borrador: false };
        if (s.tipo === 'orden_trabajo') {
            datos.firmas = { ...(datos.firmas || {}), comprador_1: firma };
        } else {
            datos.firma_comprador = firma;
            if (confirmacion_cliente === 'si' || confirmacion_cliente === 'no') datos.confirmacion_cliente = confirmacion_cliente;
            if (iniciales) datos.iniciales = String(iniciales).slice(0, 8);
        }

        let pdf_url;
        try {
            pdf_url = await generarPdfInterno(s.tipo, datos);
        } catch (e) {
            await supabase.from('solicitudes_firma').update({ estado: 'pendiente' }).eq('token', s.token);
            throw e;
        }

        const firmado_en = new Date().toISOString();
        await supabase.from('solicitudes_firma').update({
            estado: 'firmado', firmado_en, pdf_url,
            firmante_nombre: firmante_nombre ? String(firmante_nombre).slice(0, 120) : null,
            firma_ip: String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(),
        }).eq('token', s.token);

        // Avisar al agente para que continúe (no bloquea la respuesta al cliente)
        if (process.env.AGENTE_TOKEN) {
            fetch(process.env.AGENTE_WEBHOOK_URL || 'https://n8n.renewgroup.site/webhook/agente-renew-sistema', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-agente-token': process.env.AGENTE_TOKEN },
                body: JSON.stringify({ event: 'firma.completada', token: s.token, tipo: s.tipo, proyecto_id: s.proyecto_id, cliente_id: s.cliente_id, pdf_url, firmado_en }),
            }).catch(err => console.error('[FIRMA] No se pudo avisar al agente:', err.message));
        }

        res.json({ success: true, pdf_url });
    } catch (err) {
        console.error('[/api/firmas/:token] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── PLANTILLA POZO PDF ENDPOINT ──
app.post('/api/generar-plantilla-pozo', async (req, res) => {
    console.log('[/api/generar-plantilla-pozo] Petición recibida.');
    try {
        let d = req.body.datos || req.body;
        const moldePath = path.join(__dirname, 'PLANTILLAS_RENEW_POZO_molde.pdf');

        if (!fs.existsSync(moldePath)) {
            return res.status(404).json({ error: 'No se encontró el PDF de molde de pozo' });
        }

        console.log('[PDF] Generando plantilla pozo con molde:', moldePath);
        const pdfBytes = await generarPDF(moldePath, d);

        // Subir a Supabase
        const fileName = `plantillas_pozo/plantilla_pozo_${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
            .from('archivos_renew')
            .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });

        let finalUrl = null;
        if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('archivos_renew').getPublicUrl(fileName);
            finalUrl = publicUrl;

            let targetClienteId = d.clienteId || null;
            if (!targetClienteId && d.proyectoId) {
                const { data: proy } = await supabase.from('proyectos_dinamicos')
                    .select('cliente_id').eq('id', d.proyectoId).single();
                if (proy?.cliente_id) targetClienteId = proy.cliente_id;
            }

            if (targetClienteId) {
                const { data: cli } = await supabase.from('clientes_maestro')
                    .select('adjuntos_oficina').eq('id', targetClienteId).single();
                let adj = (!cli?.adjuntos_oficina || Array.isArray(cli.adjuntos_oficina)) ? {} : cli.adjuntos_oficina;
                adj.plantilla_pozo_url = finalUrl;
                await supabase.from('clientes_maestro')
                    .update({ adjuntos_oficina: adj, plantilla_pozo_url: finalUrl })
                    .eq('id', targetClienteId);
                console.log(`[PLANTILLA POZO] Cliente ${targetClienteId} actualizado.`);
            }
        } else {
            console.error('[STORAGE ERROR - PLANTILLA POZO]', uploadError);
        }

        res.json({ 
            success: true, 
            url: finalUrl,
            pdfBase64: Buffer.from(pdfBytes).toString('base64')
        });
    } catch (err) {
        console.error('[/api/generar-plantilla-pozo] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

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
  console.log(`[/api/generar-pdf] <i class="fa-solid fa-rocket"></i> Petición Recibida | Proyecto: ${rawData.proyectoId} | Cliente: ${rawData.aplicante?.nombreCompleto || 'Sin nombre'}`);
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
            console.log(`[PDF-SYNC] <i class="fa-solid fa-magnifying-glass"></i> Buscando vinculación para Proyecto: "${datos.proyectoId}"`);
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
                    console.log(`[PDF-SYNC] <i class="fa-solid fa-check text-green-500"></i> Proyecto hallado: ${proy.id}. Cliente: ${cliId}. Actualizando...`);
                    
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
                    console.warn(`[PDF-SYNC] <i class="fa-solid fa-triangle-exclamation text-orange-500"></i> No se pudo vincular el documento. El ID "${datos.proyectoId}" no fue encontrado en Supabase.`);
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
        const moldePath = path.join(__dirname, 'FORMULARIO-RENEW-WATER-main', MOLDE_ORDEN);
        
        if (!fs.existsSync(moldePath)) {
            console.error('[PDF ERROR] Molde no encontrado en:', moldePath);
            return res.status(404).json({ error: 'No se encontró el molde de la orden de trabajo' });
        }

        const datos = buildWorkOrderPdfData(rawData, rawData.nombre_dealer || '');
        datos.proyectoId = rawData.proyectoId;

        console.log('[PDF] Generando orden con molde:', moldePath, 'para proyecto:', datos.proyectoId);
        const pdfBytes = await generarPDF(moldePath, datos, { fitImages: true });
        console.log('[PDF] Generado correctamente. Tamaño:', pdfBytes.length, 'bytes');

        // 1. Subir PDF a Supabase Storage
        // _borrador: vista previa para firmar (no toca al cliente ni avisa al grupo de aplicaciones)
        const esBorrador = !!rawData._borrador;
        const fileName = `${esBorrador ? 'ordenes/borradores' : 'ordenes'}/orden_trabajo_${Date.now()}_${Math.round(Math.random() * 1E9)}.pdf`;
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
            if (proyId && !esBorrador) {
                console.log(`[PDF-SYNC-ORDEN] <i class="fa-solid fa-magnifying-glass"></i> Buscando vinculación para Proyecto: "${proyId}"`);
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
                                adjuntos_oficina: adjuntos
                            })
                            .eq('id', cliId);
                        
                        if (uErr) {
                            console.error(`[DB ERROR] Falló la actualización de la orden para el cliente ${cliId}:`, uErr.message);
                        } else {
                            console.log(`[SUCCESS] Cliente ${cliId} vinculado correctamente con Orden de Trabajo: ${finalUrl}`);
                        }

                        // Actualizar también en el proyecto dinámico
                        await supabase.from('proyectos_dinamicos')
                            .update({ orden_trabajo_url: finalUrl })
                            .eq('id', proy.id);
                    } else {
                        console.warn(`[PDF-SYNC-ORDEN] <i class="fa-solid fa-triangle-exclamation text-orange-500"></i> No se pudo vincular el documento. El ID "${proyId}" no fue encontrado en Supabase.`);
                    }
                } catch (syncErr) {
                    console.error(`[CRITICAL SYNC ERROR ORDEN]`, syncErr);
                }
            }
        }

        // 3. Procesar foto del ID si existe
        let idPhotoUrl = null;
        if (rawData.comprador?.fotoId && !esBorrador) {
            idPhotoUrl = await uploadBase64ToSupabase(rawData.comprador.fotoId, 'ordenes_ids');
            if (idPhotoUrl) rawData.comprador.fotoIdUrl = idPhotoUrl;
        }

        // Webhook Trigger a n8n (solo la orden oficial)
        const WEBHOOK_URL = 'https://n8n.renewgroup.site/webhook/aplicacion-credito-o-trabajo';
        if (!esBorrador) fetch(WEBHOOK_URL, {
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

// ─── ENDPOINT: Sincronización de Formulario Externo (Crédito y Orden de Trabajo) ───
// Permite que enlaces independientes (Vercel / n8n) sincronicen automáticamente prospectos,
// proyectos dinámicos, PDFs y fotos de ID en Renew OS según las plantillas del sistema.
// Acepta tanto /api/webhook/formulario-externo como /api/webhook/formulario
const handlerFormularioExterno = async (req, res) => {
    try {
        console.log('[WEBHOOK-SYNC] Recibida petición de sincronización de formulario externo...');
        let payload = req.body;
        if (payload && payload.body && typeof payload.body === 'object') {
            payload = payload.body;
        }
        if (payload && payload.datos && typeof payload.datos === 'object') {
            payload = { ...payload, ...payload.datos };
        }
        if (payload && payload.true && typeof payload.true === 'object') {
            payload = payload.true;
        }
        // Desempaquetar si viene envuelto en una sola propiedad que contiene el formulario
        if (payload && typeof payload === 'object' && !payload.comprador && !payload.aplicante && !payload.tipo_formulario) {
            const keys = Object.keys(payload);
            if (keys.length === 1 && typeof payload[keys[0]] === 'object' && payload[keys[0]] !== null) {
                payload = payload[keys[0]];
            }
        }

        const tipo = (payload.tipo_formulario || payload.evento || '').toLowerCase();
        const isCredit = tipo.includes('credito') || tipo.includes('credit');
        const isWorkOrder = tipo.includes('orden') || tipo.includes('trabajo') || tipo.includes('workorder');

        // Extraer comprador / aplicante
        const comp = payload.comprador || payload.aplicante || {};
        const coApp = payload.coAplicante || payload.co_aplicante || {};
        const emp = payload.empleoAplicante || payload.empleo || {};
        const inst = payload.instalacion || {};
        const fin = payload.finanzas || {};
        const firmas = payload.firmas || {};
        const dealerName = (payload.nombre_dealer || payload.dealerName || payload.nombre_rep || '').trim();
        const procedencia = payload.negocio_procedencia || payload.negocio || 'Renew Water';

        const nombreCliente = (
            comp.nombreCompleto || 
            `${comp.nombre || ''} ${comp.segundoNombre || comp.apellido || ''}`.trim() || 
            'Cliente Nuevo'
        ).trim();

        const telefono = comp.telefono || comp.phone || '';
        const email = comp.email || '';
        const direccion = comp.direccion || comp.address || '';
        const ciudad = comp.ciudad || comp.city || '';
        const estado = comp.estado || comp.state || '';
        const zip = comp.zipCode || comp.zip || '';
        const direccionCompleta = [direccion, ciudad, estado, zip].filter(Boolean).join(', ');
        const dob = comp.fechaNacimiento || comp.dob || '-';
        const stateId = comp.licenciaEstado || comp.estado || '-';

        // 1. Buscar o asignar Dealer (Vendedor) en usuarios
        let responsableId = null;
        let responsableNombre = dealerName || 'Representante';

        if (dealerName) {
            const cleanDealer = dealerName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const { data: users } = await supabase.from('usuarios').select('id, nombre, apellido, email, rol');
            if (users && users.length > 0) {
                // Coincidencia exacta
                let match = users.find(u => {
                    const full = `${u.nombre || ''} ${u.apellido || ''}`.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    return full === cleanDealer;
                });
                // Coincidencia por partes (tanto nombre como apellido deben estar presentes si se ingresaron ambos)
                if (!match) {
                    const parts = cleanDealer.split(/\s+/).filter(Boolean);
                    if (parts.length > 1) {
                        match = users.find(u => {
                            const full = `${u.nombre || ''} ${u.apellido || ''}`.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                            return parts.every(p => full.includes(p));
                        });
                    } else if (parts.length === 1 && parts[0].length >= 3) {
                        // Solo se ingresó una sola palabra
                        match = users.find(u => {
                            const fn = (u.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                            const ln = (u.apellido || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                            return fn === parts[0] || ln === parts[0];
                        });
                    }
                }
                if (match) {
                    responsableId = match.id;
                    responsableNombre = `${match.nombre || ''} ${match.apellido || ''}`.trim();
                    console.log(`[WEBHOOK-SYNC] Dealer "${dealerName}" asignado al usuario ID: ${responsableId} (${responsableNombre})`);
                } else {
                    const adminUser = users.find(u => (u.rol || '').includes('Admin') || (u.rol || '').includes('CEO')) || users[0];
                    if (adminUser) responsableId = adminUser.id;
                    console.log(`[WEBHOOK-SYNC] Dealer "${dealerName}" no encontrado exacto. Fallback a ID: ${responsableId}`);
                }
            }
        }

        // 2. Subir Foto del ID si viene en Base64
        let idPhotoUrl = payload.id_photo_url || null;
        if (!idPhotoUrl && comp.fotoId && typeof comp.fotoId === 'string' && comp.fotoId.startsWith('data:image')) {
            idPhotoUrl = await uploadBase64ToSupabase(comp.fotoId, isCredit ? 'creditos_ids' : 'ordenes_ids');
            console.log(`[WEBHOOK-SYNC] Foto de ID subida a: ${idPhotoUrl}`);
        }

        // 3. Subir Foto del ID del Co-Aplicante si viene en Base64
        let coIdPhotoUrl = null;
        if (coApp.fotoId && typeof coApp.fotoId === 'string' && coApp.fotoId.startsWith('data:image')) {
            coIdPhotoUrl = await uploadBase64ToSupabase(coApp.fotoId, 'creditos_ids');
        }

        // 4. Obtener o Generar el PDF
        let pdfUrl = payload.pdf_url || payload.orden_url || payload.document_url || null;
        if (!pdfUrl) {
            console.log('[WEBHOOK-SYNC] Generando PDF automáticamente...');
            const moldeName = isWorkOrder ? MOLDE_ORDEN : 'molde_credito_v9.pdf';
            const moldePath = path.join(__dirname, 'FORMULARIO-RENEW-WATER-main', moldeName);
            if (fs.existsSync(moldePath)) {
                let datosPDF = {};
                const todayStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

                if (isWorkOrder) {
                    datosPDF = buildWorkOrderPdfData(payload, dealerName);
                } else {
                    const ea = payload.empleoAplicante || payload.empleo || {};
                    const eco = payload.empleoCoAplicante || {};
                    datosPDF = {
                        "monto_credito": payload.monto_credito || comp.monto || '',
                        "aplicante_nombre": comp.nombreCompleto || `${comp.nombre || ''} ${comp.segundoNombre || ''}`.trim(),
                        "aplicante_dob": comp.fechaNacimiento || '',
                        "aplicante_ssn": comp.seguroSocial || '',
                        "aplicante_licencia": comp.licencia || '',
                        "aplicante_estado_lic": comp.licenciaEstado || '',
                        "aplicante_expedicion_lic": comp.licenciaExpedicion || '',
                        "aplicante_expiracion_lic": comp.licenciaExpiracion || '',
                        "aplicante_telefono": comp.telefono || '',
                        "aplicante_email": comp.email || '',
                        "aplicante_direccion": comp.direccion || '',
                        "aplicante_tiempo_casa": comp.tiempoViviendo || '',
                        "aplicante_pago_casa": comp.pagoMensual || '',
                        "aplicante_tipo_house": comp.tipoVivienda === 'Casa' ? 'X' : '',
                        "aplicante_tipo_dept": comp.tipoVivienda === 'Departamento' ? 'X' : '',
                        "aplicante_tipo_condo": comp.tipoVivienda === 'Condo' ? 'X' : '',
                        "aplicante_tipo_mobile": comp.tipoVivienda === 'Mobile Home' ? 'X' : '',
                        "aplicante_estatus_paid": comp.estatusVivienda === 'Pagado' ? 'X' : '',
                        "aplicante_estatus_mortgage": comp.estatusVivienda === 'Hipotecado' ? 'X' : '',
                        "aplicante_estatus_rent": comp.estatusVivienda === 'Rentado' ? 'X' : '',
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
                        "co_nombre": coApp.nombreCompleto || `${coApp.nombre || ''} ${coApp.segundoNombre || ''}`.trim(),
                        "co_dob": coApp.fechaNacimiento || '',
                        "co_ssn": coApp.seguroSocial || '',
                        "co_licencia": coApp.licencia || '',
                        "co_estado_lic": coApp.licenciaEstado || '',
                        "co_telefono": coApp.telefono || '',
                        "co_email": coApp.email || '',
                        "co_direccion": coApp.direccion || '',
                        "co_empresa": eco.nombreEmpleo || '',
                        "firma_aplicante": firmas.firma_aplicante || firmas.comprador_1 || firmas.signature || '',
                        "firma_co_aplicante": firmas.firma_co_aplicante || firmas.comprador_2 || '',
                        "fecha_firma_aplicante": todayStr,
                        "fecha_firma_co": todayStr,
                        "nombre_dealer": dealerName,
                        "fecha_firma_dealer": todayStr
                    };
                }

                try {
                    const pdfBytes = await generarPDF(moldePath, datosPDF, { fitImages: isWorkOrder });
                    const folder = isWorkOrder ? 'ordenes' : 'creditos';
                    const prefix = isWorkOrder ? 'orden_trabajo' : 'app_credito';
                    const fileName = `${folder}/${prefix}_${Date.now()}_${Math.round(Math.random() * 1E9)}.pdf`;
                    const { error: upErr } = await supabase.storage
                        .from('archivos_renew')
                        .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });

                    if (!upErr) {
                        const { data: { publicUrl } } = supabase.storage.from('archivos_renew').getPublicUrl(fileName);
                        pdfUrl = publicUrl;
                        console.log(`[WEBHOOK-SYNC] PDF generado y subido con éxito: ${pdfUrl}`);
                    } else {
                        console.error('[WEBHOOK-SYNC] Error subiendo PDF a Storage:', upErr);
                    }
                } catch (pdfGenErr) {
                    console.error('[WEBHOOK-SYNC] Error en generarPDF:', pdfGenErr);
                }
            }
        }

        // 5. Buscar Cliente existente en clientes_maestro (por teléfono o email)
        const cleanPhone = telefono.replace(/\D/g, '').slice(-10);
        const cleanEmail = email.trim().toLowerCase();

        const { data: allClients } = await supabase.from('clientes_maestro').select('*');
        let existingCli = null;

        if (allClients && allClients.length > 0) {
            if (cleanPhone && cleanPhone.length >= 7) {
                existingCli = allClients.find(c => (c.telefono || '').replace(/\D/g, '').slice(-10) === cleanPhone);
            }
            if (!existingCli && cleanEmail && cleanEmail.includes('@')) {
                existingCli = allClients.find(c => (c.email || '').trim().toLowerCase() === cleanEmail);
            }
        }

        let clienteId = existingCli ? existingCli.id : null;
        let adjuntos = (existingCli && existingCli.adjuntos_oficina && typeof existingCli.adjuntos_oficina === 'object' && !Array.isArray(existingCli.adjuntos_oficina)) 
            ? { ...existingCli.adjuntos_oficina } 
            : {};

        if (isWorkOrder) {
            if (pdfUrl) {
                adjuntos.orden_trabajo_url = pdfUrl;
                adjuntos.ultima_orden_fecha = new Date().toISOString();
            }
        } else {
            if (pdfUrl) {
                adjuntos.app_url = pdfUrl;
                adjuntos.ultima_credit_fecha = new Date().toISOString();
            }
        }

        if (idPhotoUrl) {
            adjuntos.id_photo_url = idPhotoUrl;
        }
        if (coIdPhotoUrl) {
            adjuntos.co_applicant_id_url = coIdPhotoUrl;
        }

        const resolvedDept = procedencia.toLowerCase().includes('home') ? 'Renew Home' : 'Renew Water';
        const nowIso = new Date().toISOString();
        const todayDate = nowIso.split('T')[0];

        if (existingCli) {
            console.log(`[WEBHOOK-SYNC] Actualizando cliente existente: ${clienteId} (${existingCli.nombre})`);
            const depts = Array.isArray(existingCli.departamentos_activos) ? [...existingCli.departamentos_activos] : [];
            if (!depts.includes(resolvedDept)) depts.push(resolvedDept);

            const updateData = {
                adjuntos_oficina: adjuntos,
                departamentos_activos: depts,
                departamento: resolvedDept,
                estado: isWorkOrder ? 'En Proceso' : (existingCli.estado || 'Lead'),
                macro_estado: isWorkOrder ? 'Clientes' : (existingCli.macro_estado || 'Prospectos')
            };
            if (!isWorkOrder && pdfUrl) updateData.credit_app_url = pdfUrl;
            if (idPhotoUrl) {
                updateData.id_photo = idPhotoUrl;
                updateData.adjunto_id_url = idPhotoUrl;
            }
            if (responsableId && !existingCli.vendedor_asignado_id) {
                updateData.vendedor_asignado_id = responsableId;
                updateData.vendedor_asignado_nombre = responsableNombre;
            }

            const { error: updCliErr } = await supabase.from('clientes_maestro').update(updateData).eq('id', clienteId);
            if (updCliErr) {
                console.error('[WEBHOOK-SYNC] Error actualizando cliente en clientes_maestro:', updCliErr);
                throw updCliErr;
            }
        } else {
            clienteId = `cli_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
            console.log(`[WEBHOOK-SYNC] Creando nuevo prospecto/cliente: ${clienteId} (${nombreCliente})`);

            const newCli = {
                id: clienteId,
                nombre: nombreCliente,
                telefono: telefono,
                email: email,
                direccion: direccionCompleta,
                zip: zip,
                state_id: stateId,
                dob: dob,
                empresa: '',
                estado: isWorkOrder ? 'En Proceso' : 'Lead',
                macro_estado: isWorkOrder ? 'Clientes' : 'Prospectos',
                fecha: todayDate,
                fecha_inicio: nowIso,
                departamento: resolvedDept,
                departamentos_activos: [resolvedDept],
                origen_tipo: 'representante',
                origen_id: responsableId,
                origen_nombre: responsableNombre,
                vendedor_asignado_id: responsableId,
                vendedor_asignado_nombre: responsableNombre,
                adjuntos_oficina: adjuntos,
                id_photo: idPhotoUrl,
                adjunto_id_url: idPhotoUrl,
                credit_app_url: !isWorkOrder ? pdfUrl : null
            };

            const { error: insCliErr } = await supabase.from('clientes_maestro').insert([newCli]);
            if (insCliErr) {
                console.error('[WEBHOOK-SYNC] Error creando cliente en clientes_maestro:', insCliErr);
                throw insCliErr;
            }
        }

        // 6. Lógica de Proyecto según el tipo de formulario:
        // - Aplicación de Crédito: SE QUEDA COMO PROSPECTO (sin proyecto en Kanban aún). La aplicación queda vinculada en su perfil para que cuando sea aprobada, se comience el proyecto.
        // - Orden de Trabajo: CLIENTE APROBADO (crea o avanza el proyecto en proyectos_dinamicos en la fase de Orden de Trabajo).
        let proyecto = null;
        let proyectoId = null;
        let pipelineId = null;
        let targetFaseId = null;

        if (isWorkOrder) {
            const { data: pipelines } = await supabase.from('admin_pipelines').select('*');
            const pipTarget = (pipelines || []).find(p => 
                p.nombre.trim().toLowerCase().includes(resolvedDept.toLowerCase().replace('renew ', '')) ||
                p.nombre.trim().toLowerCase() === resolvedDept.toLowerCase()
            ) || (pipelines || []).find(p => p.id === 'pip_water') || pipelines?.[0];

            pipelineId = pipTarget?.id || 'pip_water';

            const { data: allFases } = await supabase
                .from('admin_fases')
                .select('*')
                .eq('pipeline_id', pipelineId)
                .order('orden', { ascending: true });

            const fases = allFases || [];
            const firstFase = fases[0];
            const ordenTrabajoFase = fases.find(f => f.nombre.toLowerCase().includes('orden') || f.orden === 2) || firstFase;
            targetFaseId = ordenTrabajoFase?.id || firstFase?.id;

            // Buscar o Crear Proyecto Dinámico
            const { data: existingProjects } = await supabase
                .from('proyectos_dinamicos')
                .select('*')
                .eq('cliente_id', clienteId)
                .eq('pipeline_id', pipelineId);

            proyecto = existingProjects && existingProjects.length > 0 ? existingProjects[0] : null;
            proyectoId = proyecto ? proyecto.id : null;

            if (proyecto) {
                console.log(`[WEBHOOK-SYNC] Proyecto existente encontrado: ${proyectoId}. Avanzando a Orden de Trabajo...`);
                const disc = Array.isArray(proyecto.discusion) ? proyecto.discusion : [];
                disc.push({
                    id: `disc_${Date.now()}`,
                    autor: responsableNombre || 'Sistema',
                    fecha: nowIso,
                    mensaje: `Orden de Trabajo recibida. Proyecto avanzado a ${ordenTrabajoFase?.nombre || 'Orden de Trabajo'}.`
                });

                const proyUpdate = {
                    fase_id: targetFaseId,
                    ultima_actividad: nowIso,
                    ultima_actividad_label: 'Orden de Trabajo Recibida',
                    discusion: disc
                };

                if (responsableId && !proyecto.responsable_id) {
                    proyUpdate.responsable_id = responsableId;
                }

                await supabase.from('proyectos_dinamicos').update(proyUpdate).eq('id', proyectoId);
            } else {
                proyectoId = `proy_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
                console.log(`[WEBHOOK-SYNC] Creando nuevo proyecto dinámico para Orden de Trabajo: ${proyectoId}`);

                const newProy = {
                    id: proyectoId,
                    cliente_id: clienteId,
                    pipeline_id: pipelineId,
                    fase_id: targetFaseId,
                    responsable_id: responsableId,
                    fecha: todayDate,
                    estado: 'Activo',
                    ultima_actividad: nowIso,
                    ultima_actividad_label: 'Orden de Trabajo Recibida',
                    colaboradores: [],
                    discusion: [
                        {
                            id: `disc_${Date.now()}`,
                            autor: responsableNombre || 'Sistema',
                            fecha: nowIso,
                            mensaje: `Proyecto iniciado por Orden de Trabajo desde enlace independiente. Vendedor/Dealer: ${responsableNombre}.`
                        }
                    ]
                };

                const { error: insProyErr } = await supabase.from('proyectos_dinamicos').insert([newProy]);
                if (insProyErr) {
                    console.error('[WEBHOOK-SYNC] Error creando proyecto dinámico:', insProyErr);
                    throw insProyErr;
                }
            }

            // Sincronizar Campos Dinámicos (respuestas_dinamicas) para Orden de Trabajo
            if (pdfUrl && targetFaseId) {
                const { data: campos } = await supabase
                    .from('admin_campos_formulario')
                    .select('*')
                    .eq('fase_id', targetFaseId);

                if (campos && campos.length > 0) {
                    const campoTarget = campos.find(c => (c.tipo || '').toLowerCase().includes('orden')) || campos[0];
                    if (campoTarget) {
                        const respId = `resp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
                        await supabase.from('respuestas_dinamicas').upsert({
                            id: respId,
                            proyecto_id: proyectoId,
                            campo_id: campoTarget.id,
                            valor: pdfUrl
                        }, { onConflict: 'id' });
                    }
                }
            }
        } else {
            console.log(`[WEBHOOK-SYNC] Aplicación de Crédito guardada exitosamente como Prospecto (sin proyecto en Kanban). Cliente: ${clienteId}`);
        }

        console.log(`[WEBHOOK-SYNC] Sincronización exitosa | Cliente: ${clienteId} | Proyecto: ${proyectoId}`);

        return res.status(200).json({
            success: true,
            cliente_id: clienteId,
            proyecto_id: proyectoId,
            pipeline_id: pipelineId,
            fase_id: targetFaseId,
            responsable_id: responsableId,
            responsable_nombre: responsableNombre,
            pdf_url: pdfUrl,
            id_photo_url: idPhotoUrl,
            tipo_formulario: isWorkOrder ? 'orden_trabajo' : 'aplicacion_credito',
            mensaje: 'Prospecto y Proyecto sincronizados exitosamente en Renew OS'
        });

    } catch (error) {
        console.error('[WEBHOOK-SYNC ERROR]', error);
        return res.status(500).json({
            success: false,
            error: 'Error al sincronizar formulario externo con Renew OS',
            detalle: error.message
        });
    }
};

app.post('/api/webhook/formulario-externo', handlerFormularioExterno);
app.post('/api/webhook/formulario', handlerFormularioExterno);

// ─── ENDPOINT: Webhook Análisis Gratuito (Sitio Web renewwaterus.com) ───
// Recibe los datos del modal "Agenda tu prueba gratis" de la web oficial y crea o actualiza
// el lead en la sección Leads (call_center_prospectos), no en Clientes.
const handlerAnalisisGratuito = async (req, res) => {
    try {
        console.log('[ANALISIS-GRATUITO] Recibida solicitud desde sitio web / n8n...');
        let payload = req.body || {};
        if (payload.body && typeof payload.body === 'object') payload = payload.body;
        if (payload.datos && typeof payload.datos === 'object') payload = { ...payload, ...payload.datos };
        if (payload.data && typeof payload.data === 'object') payload = { ...payload, ...payload.data };
        if (payload.true && typeof payload.true === 'object') payload = payload.true;

        // Desempaquetar si viene envuelto en un objeto anidado
        if (payload && typeof payload === 'object' && !payload.nombre && !payload.telefono && !payload.phone && !payload.nombreCompleto && !payload.fullName) {
            const keys = Object.keys(payload);
            if (keys.length === 1 && typeof payload[keys[0]] === 'object' && payload[keys[0]] !== null) {
                payload = payload[keys[0]];
            }
        }

        const sanitizeField = (val) => {
            if (val === null || val === undefined) return '';
            let s = String(val).trim();
            while (s.startsWith('=')) {
                s = s.substring(1).trim();
            }
            return s;
        };

        const rawNombre = (
            payload.nombre || 
            payload.fullName || 
            payload.nombreCompleto || 
            payload.nombre_completo || 
            payload.name || 
            payload.full_name || 
            payload.cliente || 
            ''
        );
        const nombreCliente = sanitizeField(rawNombre) || 'Prospecto Web';

        const rawTel = (
            payload.telefono || 
            payload.phone || 
            payload.phoneFmt || 
            payload.tel || 
            payload.celular || 
            payload.numero || 
            ''
        );
        const telefono = sanitizeField(rawTel);

        const email = sanitizeField(payload.email || payload.emailRaw || payload.correo || '');
        const horario = sanitizeField(payload.horario || payload.preferredTime || payload.horario_preferido || payload.horarioPreferido || payload.preferred_time || payload.schedule || '');
        const zip = sanitizeField(payload.codigo_postal || payload.codigoPostal || payload.zip || payload.zip_code || payload.zipCode || payload.postal_code || '');
        const estado = sanitizeField(payload.estado || payload.stateName || payload.state || payload.state_id || 'Florida') || 'Florida';
        const zonaCubierta = payload.zona_cubierta !== undefined ? Boolean(payload.zona_cubierta) : (payload.zonaCubierta !== undefined ? Boolean(payload.zonaCubierta) : true);

        const cleanDigits = (str) => String(str || '').replace(/\D/g, '');
        const cleanTel = cleanDigits(telefono);
        const tel10 = cleanTel.length >= 10 ? cleanTel.slice(-10) : cleanTel;

        const now = new Date();
                const nowIso = now.toISOString();
        const direccionCompleta = [zip, estado].filter(Boolean).map(sanitizeField).join(', ');

        const notaLead = `🎯 Lead de Sitio Web (Análisis Gratuito - renewwaterus.com)\n` +
            `• Horario preferido: ${horario || 'No especificado'}\n` +
            `• Zona / Zip: ${zip || ''} ${estado || ''}\n` +
            `• Cobertura de zona: ${zonaCubierta ? 'Cubierta' : 'Por verificar'}\n` +
            `• Registrado: ${now.toLocaleString('es-ES', { timeZone: 'America/New_York' })}`;

        // El lead entra a la sección Leads (call_center_prospectos), NO a Clientes.
        // Si ya hay un lead activo con el mismo teléfono, se actualiza en vez de duplicarlo.
        const ORIGEN_WEB = 'Web Renew Water - Análisis Gratuito';
        let existente = null;
        if (tel10 && tel10.length >= 7) {
            const { data: activos, error: actErr } = await supabase
                .from('call_center_prospectos')
                .select('id, telefono, notas_pre')
                .in('estado', CC_ESTADOS_ACTIVOS);
            if (actErr) throw actErr;
            existente = (activos || []).find(e => cleanDigits(e.telefono).slice(-10) === tel10) || null;
        }

        let leadId;
        if (existente) {
            leadId = existente.id;
            const notasPrevias = (existente.notas_pre || '').trim();
            const updateData = {
                notas_pre: notasPrevias ? `${notasPrevias}\n\n---\n${notaLead}` : notaLead,
                pipeline: 'Renew Water',
                fuente: 'sitio_web',
                origen: ORIGEN_WEB,
                prioridad: 1
            };
            if (nombreCliente && nombreCliente !== 'Prospecto Web') updateData.nombre = nombreCliente;
            if (email) updateData.email = email;
            if (zip) updateData.zip_code = zip;
            const { error: updErr } = await supabase.from('call_center_prospectos').update(updateData).eq('id', leadId);
            if (updErr) throw updErr;
            console.log(`[ANALISIS-GRATUITO] Lead existente actualizado en Leads: ${leadId} (${nombreCliente})`);
        } else {
            leadId = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
            const ccLead = {
                id: leadId,
                nombre: nombreCliente,
                telefono: telefono,
                direccion: direccionCompleta,
                email: email,
                zip_code: zip,
                estado_geo: estado,
                pipeline: 'Renew Water',
                fuente: 'sitio_web',
                origen: ORIGEN_WEB,
                estado: 'pendiente',
                prioridad: 1, // Alta prioridad por ser lead directo de la web
                intentos_reasignacion: 0,
                operador_id: null,
                operador_nombre: null,
                fecha_creacion: nowIso,
                fecha_asignacion: null,
                fecha_expiracion: null,
                notas_pre: notaLead
            };
            const { error: insErr } = await supabase.from('call_center_prospectos').insert([ccLead]);
            if (insErr) throw insErr;
            console.log(`[ANALISIS-GRATUITO] Nuevo lead creado en Leads: ${leadId} (${nombreCliente})`);
        }

        return res.status(200).json({
            success: true,
            mensaje: existente ? 'Lead actualizado en Leads de Renew OS' : 'Lead creado en Leads de Renew OS',
            lead_id: leadId,
            lead: {
                id: leadId,
                nombre: nombreCliente,
                telefono: telefono,
                pipeline: 'Renew Water',
                horario_preferido: horario,
                zona: `${zip} ${estado}`.trim()
            }
        });

    } catch (error) {
        console.error('[ANALISIS-GRATUITO ERROR]', error);
        return res.status(500).json({
            success: false,
            error: 'Error al procesar formulario de análisis gratuito en Renew OS',
            detalle: error.message
        });
    }
};

app.post('/api/webhook/analisis-gratuito', handlerAnalisisGratuito);
app.post('/api/webhook/formulario-web', handlerAnalisisGratuito);
app.post('/api/webhook/lead-web', handlerAnalisisGratuito);



// ── CALL CENTER PROSPECTOS API ──────────────────────────────
// Lista compartida: todos los usuarios con acceso ven TODOS los leads activos
// (sin cola ni asignación por agente). Un lead sale de la lista solo cuando
// cambia de estado: 'aceptado' (convertido a cliente) o 'rechazado'.
const CC_ESTADOS_ACTIVOS = ['pendiente', 'confirmacion_pendiente', 'en_espera'];

// Migración única al arrancar: los leads que quedaron en la antigua cola o
// esperando confirmación pasan a 'pendiente' sin expiración.
(async () => {
    try {
        const { error } = await supabase.from('call_center_prospectos').update({
            estado: 'pendiente',
            fecha_expiracion: null,
        }).in('estado', ['confirmacion_pendiente', 'en_espera']);
        if (error) throw error;
    } catch (err) {
        console.error('[CC-MIGRACION] Error normalizando leads:', err.message);
    }
})();

// ── CHATS DEL AGENTE (WhatsApp vía Evolution API, solo lectura) ──────────────
// Requiere en el .env del servidor: EVOLUTION_API_KEY (la misma del nodo Config de n8n).
// Opcionales: EVOLUTION_API_URL, EVOLUTION_INSTANCE.
const EVO_URL = process.env.EVOLUTION_API_URL || 'https://evolutionapi.renewgroup.site';
const EVO_INST = process.env.EVOLUTION_INSTANCE || 'RenewIA'; // la instancia del agente de IA (la misma del nodo Config de n8n)

async function evo(ruta, body) {
    if (!process.env.EVOLUTION_API_KEY) throw new Error('Falta EVOLUTION_API_KEY en el .env del servidor');
    const r = await fetch(`${EVO_URL}${ruta}/${EVO_INST}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY },
        body: JSON.stringify(body || {}),
    });
    if (!r.ok) throw new Error(`Evolution ${ruta} respondió ${r.status}`);
    return r.json();
}

const soloDigitos = (t) => String(t || '').replace(/\D/g, '');
const ultimos10 = (t) => soloDigitos(t).slice(-10);

// Texto legible de un mensaje de WhatsApp (para la lista y las burbujas)
function textoMensaje(m) {
    const msg = (m && m.message) || {};
    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage) return msg.extendedTextMessage.text || '';
    if (msg.imageMessage) return msg.imageMessage.caption || '';
    if (msg.videoMessage) return msg.videoMessage.caption || '';
    if (msg.documentMessage) return msg.documentMessage.caption || '';
    if (msg.documentWithCaptionMessage) return msg.documentWithCaptionMessage.message?.documentMessage?.caption || '';
    if (msg.reactionMessage) return msg.reactionMessage.text || '';
    if (msg.interactiveMessage) return msg.interactiveMessage.body?.text || '';
    if (msg.buttonsResponseMessage) return msg.buttonsResponseMessage.selectedDisplayText || '';
    if (msg.listResponseMessage) return msg.listResponseMessage.title || '';
    return '';
}

function normalizarMensaje(m) {
    const msg = m.message || {};
    const doc = msg.documentMessage || msg.documentWithCaptionMessage?.message?.documentMessage;
    const updates = m.MessageUpdate || [];
    const estados = updates.map(u => u.status);
    const estado = estados.includes('READ') || estados.includes('PLAYED') ? 'leido'
        : estados.includes('DELIVERY_ACK') ? 'entregado' : 'enviado';
    return {
        id: m.key?.id,
        fromMe: !!m.key?.fromMe,
        ts: Number(m.messageTimestamp) || 0,
        tipo: m.messageType,
        texto: textoMensaje(m),
        archivo: doc ? (doc.fileName || doc.title || 'Documento') : null,
        estado,
        origen: m.source || null,
    };
}

// Etiqueta (nombre, rol) de un teléfono según usuarios y clientes del sistema
async function directorioTelefonos() {
    const [{ data: usuarios }, { data: clientes }, { data: leads }] = await Promise.all([
        supabase.from('usuarios').select('id, nombre, apellido, telefono, rol'),
        supabase.from('clientes_maestro').select('id, nombre, telefono, macro_estado'),
        supabase.from('call_center_prospectos').select('id, nombre, telefono, estado, operador_nombre').in('estado', CC_ESTADOS_ACTIVOS),
    ]);
    const dir = {};
    (leads || []).forEach(l => {
        const k = ultimos10(l.telefono);
        if (k.length === 10) dir[k] = { tipo: 'lead', id: l.id, nombre: l.nombre, detalle: `Lead · ${l.operador_nombre ? 'con ' + l.operador_nombre : 'sin operador'}` };
    });
    (clientes || []).forEach(c => {
        const k = ultimos10(c.telefono);
        if (k.length === 10) dir[k] = { tipo: 'cliente', id: c.id, nombre: c.nombre, detalle: c.macro_estado || 'Cliente' };
    });
    // Los usuarios ganan sobre clientes si comparten número
    (usuarios || []).forEach(u => {
        const k = ultimos10(u.telefono);
        const rol = Array.isArray(u.rol) ? u.rol.join(', ') : String(u.rol || '').replace(/[\[\]"]/g, '').replace(/,/g, ', ');
        if (k.length === 10) dir[k] = { tipo: 'equipo', id: u.id, nombre: `${u.nombre || ''} ${u.apellido || ''}`.trim(), detalle: rol || 'Equipo' };
    });
    return dir;
}

// Pausas vigentes del agente (tabla agente_pausas, ver supabase_chats_agente.sql).
// Devuelve null si la tabla todavía no existe, para que el panel avise en vez de fallar.
async function pausasVigentes() {
    const { data, error } = await supabase.from('agente_pausas').select('telefono, hasta, nombre')
        .or(`hasta.is.null,hasta.gt.${new Date().toISOString()}`);
    if (error) { console.warn('[AGENTE-PAUSAS] no disponible:', error.message); return null; }
    return new Map((data || []).map(p => [p.telefono, p]));
}

// Asignación, etiquetas y archivo de cada conversación (tabla agente_conversaciones) y cuántas notas tiene.
// Devuelve mapas vacíos si las tablas todavía no existen.
async function datosConversaciones() {
    const [{ data: convs, error: e1 }, { data: notas }] = await Promise.all([
        supabase.from('agente_conversaciones').select('clave, asignado_id, asignado_nombre, etiquetas, archivado_en'),
        supabase.from('agente_notas').select('clave'),
    ]);
    if (e1) return { convs: new Map(), notas: new Map(), disponible: false };
    const cuentaNotas = new Map();
    (notas || []).forEach(n => cuentaNotas.set(n.clave, (cuentaNotas.get(n.clave) || 0) + 1));
    return { convs: new Map((convs || []).map(c => [c.clave, c])), notas: cuentaNotas, disponible: true };
}

// Mensajes que no cuentan como "le escribieron y nadie contestó"
const TIPOS_SIN_RESPUESTA = ['reactionMessage', 'protocolMessage', 'stickerMessage'];

// Lista de conversaciones del número del agente, agrupadas por contacto.
// Se guarda 10 s en memoria: la pantalla y los avisos de todos los admins la piden seguido.
const LISTA_CACHE_MS = 10000;
let listaCache = null; // { t, datos }
const invalidarListaChats = () => { listaCache = null; };

async function listaChats() {
    if (listaCache && Date.now() - listaCache.t < LISTA_CACHE_MS) return listaCache.datos;
    const [chats, dir, pausas, panel] = await Promise.all([evo('/chat/findChats'), directorioTelefonos(), pausasVigentes(), datosConversaciones()]);
    const porContacto = {};
    (Array.isArray(chats) ? chats : []).forEach(c => {
        const jid = c.remoteJid || '';
        if (!jid || jid === 'status@broadcast') return;
        const esGrupo = jid.endsWith('@g.us');
        // Teléfono real: del jid clásico, o del remoteJidAlt cuando WhatsApp usa @lid
        const alt = c.lastMessage?.key?.remoteJidAlt || '';
        const tel = esGrupo ? '' : jid.endsWith('@s.whatsapp.net') ? jid.split('@')[0] : alt.endsWith('@s.whatsapp.net') ? alt.split('@')[0] : '';
        const clave = tel || jid;
        const ultimo = c.lastMessage ? normalizarMensaje(c.lastMessage) : null;
        const actual = porContacto[clave] || { clave, jids: [], telefono: tel, esGrupo, nombreWa: null, foto: null, ultimo: null };
        if (!actual.jids.includes(jid)) actual.jids.push(jid);
        if (alt && !actual.jids.includes(alt)) actual.jids.push(alt);
        // pushName de un mensaje propio es el nombre de la cuenta de Renew, no el del contacto
        const pushContacto = c.lastMessage && !c.lastMessage.key?.fromMe ? c.lastMessage.pushName : null;
        actual.nombreWa = actual.nombreWa || c.pushName || pushContacto || null;
        actual.foto = actual.foto || c.profilePicUrl || null;
        if (ultimo && (!actual.ultimo || ultimo.ts > actual.ultimo.ts)) actual.ultimo = ultimo;
        porContacto[clave] = actual;
    });
    const lista = Object.values(porContacto).map(c => {
        const info = c.telefono ? dir[ultimos10(c.telefono)] : null;
        const meta = panel.convs.get(c.clave) || {};
        // Archivada hasta que llegue un mensaje posterior al momento de archivar
        const archivada = !!meta.archivado_en && (!c.ultimo || c.ultimo.ts * 1000 <= Date.parse(meta.archivado_en));
        return {
            ...c,
            nombre: info?.nombre || c.nombreWa || (c.telefono ? `+${c.telefono}` : c.esGrupo ? 'Grupo' : 'Contacto sin número'),
            tipo: c.esGrupo ? 'grupo' : info?.tipo || 'desconocido',
            detalle: info?.detalle || null,
            refId: info?.id || null,
            pendiente: !archivada && !c.esGrupo && !!c.ultimo && !c.ultimo.fromMe && !TIPOS_SIN_RESPUESTA.includes(c.ultimo.tipo),
            archivada,
            asignado: meta.asignado_id ? { id: meta.asignado_id, nombre: meta.asignado_nombre } : null,
            etiquetas: meta.etiquetas || [],
            notas: panel.notas.get(c.clave) || 0,
            pausa: (c.telefono && pausas?.get(ultimos10(c.telefono))) || null,
        };
    }).sort((a, b) => (b.ultimo?.ts || 0) - (a.ultimo?.ts || 0));
    const datos = { chats: lista, pausasDisponibles: pausas !== null, gestionDisponible: panel.disponible };
    listaCache = { t: Date.now(), datos };
    return datos;
}

app.get('/api/agente-chats', requiereSesion({ soloAdmin: true }), async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        res.json(await listaChats());
    } catch (e) {
        console.error('[API/AGENTE-CHATS] error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET: resumen liviano para el contador del menú y las notificaciones
app.get('/api/agente-chats/resumen', requiereSesion({ soloAdmin: true }), async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const { chats } = await listaChats();
        const pendientes = chats.filter(c => c.pendiente);
        res.json({
            pendientes: pendientes.length,
            // Últimos mensajes entrantes, para avisar de los nuevos
            recientes: pendientes.slice(0, 10).map(c => ({ clave: c.clave, nombre: c.nombre, tipo: c.tipo, ts: c.ultimo.ts, texto: (c.ultimo.texto || c.ultimo.archivo || '').slice(0, 120) })),
        });
    } catch (e) {
        console.error('[API/AGENTE-CHATS/RESUMEN] error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET: mensajes de un contacto (?jids=a,b&page=1). Une los jids @lid y @s.whatsapp.net del mismo número.
app.get('/api/agente-chats/mensajes', requiereSesion({ soloAdmin: true }), async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const jids = String(req.query.jids || '').split(',').filter(j => /@(s\.whatsapp\.net|lid|g\.us)$/.test(j)).slice(0, 4);
        if (!jids.length) return res.status(400).json({ error: 'Falta jids' });
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const POR_PAGINA = 100;
        const resultados = await Promise.all(jids.map(remoteJid =>
            evo('/chat/findMessages', { where: { key: { remoteJid } }, page, offset: POR_PAGINA })
        ));
        const vistos = new Set();
        const mensajes = [];
        let hayMas = false;
        resultados.forEach(r => {
            const m = r?.messages || {};
            if ((m.pages || 0) > page) hayMas = true;
            (m.records || (Array.isArray(r) ? r : [])).forEach(x => {
                if (!x.key?.id || vistos.has(x.key.id)) return;
                if (['protocolMessage', 'reactionMessage', 'senderKeyDistributionMessage'].includes(x.messageType)) return;
                vistos.add(x.key.id);
                mensajes.push(normalizarMensaje(x));
            });
        });
        mensajes.sort((a, b) => a.ts - b.ts);
        // Quién del equipo envió a mano cada mensaje desde el panel (si la tabla existe)
        const propios = mensajes.filter(m => m.fromMe).map(m => m.id);
        if (propios.length) {
            const { data: autores } = await supabase.from('agente_mensajes_panel').select('mensaje_id, nombre').in('mensaje_id', propios);
            const porId = new Map((autores || []).map(a => [a.mensaje_id, a.nombre]));
            mensajes.forEach(m => { if (porId.has(m.id)) m.enviadoPor = porId.get(m.id); });
        }
        res.json({ mensajes, hayMas });
    } catch (e) {
        console.error('[API/AGENTE-CHATS/MENSAJES] error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Freno anti-baneo para envíos manuales: WhatsApp castiga ráfagas y mensajes en cadena.
const ENVIO_MAX_POR_VENTANA = 20;          // mensajes manuales en total…
const ENVIO_VENTANA_MS = 10 * 60 * 1000;   // …cada 10 minutos
const ENVIO_PAUSA_MISMO_CHAT_MS = 3000;    // entre dos mensajes al mismo contacto
const enviosRecientes = [];
const ultimoEnvioPorChat = new Map();

// Devuelve el motivo para no enviar ahora, o null y registra el envío
function frenoEnvio(jid) {
    const ahora = Date.now();
    while (enviosRecientes.length && ahora - enviosRecientes[0] > ENVIO_VENTANA_MS) enviosRecientes.shift();
    if (enviosRecientes.length >= ENVIO_MAX_POR_VENTANA) return 'Has enviado muchos mensajes seguidos. Espera unos minutos para cuidar el número de un bloqueo de WhatsApp.';
    if (ahora - (ultimoEnvioPorChat.get(jid) || 0) < ENVIO_PAUSA_MISMO_CHAT_MS) return 'Espera unos segundos antes de mandar otro mensaje a este contacto.';
    enviosRecientes.push(ahora);
    ultimoEnvioPorChat.set(jid, ahora);
    return null;
}

// Para números normales Evolution espera solo los dígitos; @lid y grupos van con el jid completo
const numeroEvolution = (jid) => (jid.endsWith('@s.whatsapp.net') ? jid.split('@')[0] : jid);
const jidValido = (jid) => /@(s\.whatsapp\.net|lid|g\.us)$/.test(String(jid || ''));

// Deja constancia de un envío manual: autor del mensaje (para la conversación) y auditoría
async function registrarEnvioPanel(r, number, usr, detalle) {
    const nombre = `${usr.nombre || ''} ${usr.apellido || ''}`.trim();
    if (r?.key?.id) {
        const { error } = await supabase.from('agente_mensajes_panel').insert({ mensaje_id: r.key.id, telefono: ultimos10(number) || number, usuario_id: String(usr.id), nombre });
        if (error) console.warn('[AGENTE-CHATS] no se guardó el autor:', error.message || error.code);
    }
    await supabase.from('agente_auditoria').insert({
        telefono: number, usuario_id: String(usr.id), nivel: 'admin', accion: 'mensaje_manual_panel', permitido: true,
        detalle: `${nombre}: ${detalle}`.slice(0, 300),
    });
    invalidarListaChats();
    return nombre;
}

// POST: enviar un mensaje de texto desde el panel ({ jid, texto }). Solo Admin/CEO (según el pase de sesión).
app.post('/api/agente-chats/enviar', requiereSesion({ soloAdmin: true }), async (req, res) => {
    try {
        const { jid } = req.body || {};
        const texto = String(req.body?.texto || '').trim();
        if (!jidValido(jid)) return res.status(400).json({ error: 'Conversación inválida' });
        if (!texto) return res.status(400).json({ error: 'Mensaje vacío' });
        if (texto.length > 4000) return res.status(400).json({ error: 'Mensaje demasiado largo' });

        const freno = frenoEnvio(jid);
        if (freno) return res.status(429).json({ error: freno });

        // delay: WhatsApp muestra "escribiendo…" antes del mensaje, como lo haría una persona
        const number = numeroEvolution(jid);
        const r = await evo('/message/sendText', { number, text: texto, delay: Math.min(1000 + texto.length * 20, 4000) });
        const enviadoPor = await registrarEnvioPanel(r, number, req.usuario, texto);
        res.json({ ok: true, mensaje: r?.key ? { ...normalizarMensaje({ ...r, MessageUpdate: [] }), enviadoPor } : null });
    } catch (e) {
        console.error('[API/AGENTE-CHATS/ENVIAR] error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST: enviar una foto o un PDF ({ jid, base64, mimetype, nombre, caption }). Máximo 10 MB.
const ARCHIVO_MAX_BYTES = 10 * 1024 * 1024;
const MIME_PERMITIDOS = { 'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'application/pdf': 'document' };
app.post('/api/agente-chats/enviar-archivo', requiereSesion({ soloAdmin: true }), async (req, res) => {
    try {
        const { jid, mimetype } = req.body || {};
        const base64 = String(req.body?.base64 || '').replace(/^data:[^;]+;base64,/, '');
        const caption = String(req.body?.caption || '').trim().slice(0, 1000);
        const nombreArchivo = String(req.body?.nombre || 'archivo').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
        if (!jidValido(jid)) return res.status(400).json({ error: 'Conversación inválida' });
        const mediatype = MIME_PERMITIDOS[mimetype];
        if (!mediatype) return res.status(400).json({ error: 'Solo se pueden enviar fotos (JPG, PNG, WEBP) o PDF' });
        if (!base64 || Math.floor(base64.length * 3 / 4) > ARCHIVO_MAX_BYTES) return res.status(400).json({ error: 'El archivo está vacío o pasa de 10 MB' });

        const freno = frenoEnvio(jid);
        if (freno) return res.status(429).json({ error: freno });

        const number = numeroEvolution(jid);
        const r = await evo('/message/sendMedia', { number, mediatype, mimetype, media: base64, fileName: nombreArchivo, caption, delay: 1500 });
        const enviadoPor = await registrarEnvioPanel(r, number, req.usuario, `[${mediatype === 'image' ? 'foto' : 'PDF'} ${nombreArchivo}] ${caption}`);
        const mensaje = r?.key ? {
            ...normalizarMensaje({ ...r, MessageUpdate: [] }),
            tipo: mediatype === 'image' ? 'imageMessage' : 'documentMessage',
            archivo: mediatype === 'document' ? nombreArchivo : null,
            texto: caption, enviadoPor,
        } : null;
        res.json({ ok: true, mensaje });
    } catch (e) {
        console.error('[API/AGENTE-CHATS/ENVIAR-ARCHIVO] error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Respuestas rápidas (tabla agente_respuestas_rapidas, ver supabase_chats_agente.sql)
app.get('/api/agente-chats/respuestas', requiereSesion({ soloAdmin: true }), async (req, res) => {
    const { data, error } = await supabase.from('agente_respuestas_rapidas').select('id, titulo, texto').order('titulo');
    if (error) return res.status(500).json({ error: 'Falta crear las tablas del chat: ejecuta supabase_chats_agente.sql en Supabase' });
    res.json({ respuestas: data || [] });
});

app.post('/api/agente-chats/respuestas', requiereSesion({ soloAdmin: true }), async (req, res) => {
    const titulo = String(req.body?.titulo || '').trim().slice(0, 60);
    const texto = String(req.body?.texto || '').trim().slice(0, 2000);
    if (!titulo || !texto) return res.status(400).json({ error: 'Escribe un título y el texto' });
    const { data, error } = await supabase.from('agente_respuestas_rapidas').insert({ titulo, texto, creado_por: String(req.usuario.id) }).select('id, titulo, texto').single();
    if (error) return res.status(500).json({ error: error.message || 'No se pudo guardar' });
    res.json({ respuesta: data });
});

app.delete('/api/agente-chats/respuestas/:id', requiereSesion({ soloAdmin: true }), async (req, res) => {
    const { error } = await supabase.from('agente_respuestas_rapidas').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message || 'No se pudo borrar' });
    res.json({ ok: true });
});

// Clave de conversación válida: número en dígitos o jid de WhatsApp
const claveValida = (c) => /^\d{7,16}$/.test(String(c || '')) || jidValido(c);
const nombreDe = (u) => `${u?.nombre || ''} ${u?.apellido || ''}`.trim();
const FALTAN_TABLAS = 'Falta crear las tablas del chat: ejecuta supabase_chats_agente.sql en Supabase';

// PATCH: asignar, etiquetar o archivar una conversación ({ clave, asignado_id?, etiquetas?, archivar? })
app.patch('/api/agente-chats/conversacion', requiereSesion({ soloAdmin: true }), async (req, res) => {
    try {
        const { clave } = req.body || {};
        if (!claveValida(clave)) return res.status(400).json({ error: 'Conversación inválida' });
        const cambios = { clave, actualizado: new Date().toISOString(), actualizado_por: String(req.usuario.id) };
        if ('asignado_id' in req.body) {
            if (req.body.asignado_id) {
                const { data: u } = await supabase.from('usuarios').select('id, nombre, apellido, is_suspended').eq('id', req.body.asignado_id).maybeSingle();
                if (!u || u.is_suspended) return res.status(400).json({ error: 'Ese usuario no existe o está suspendido' });
                cambios.asignado_id = String(u.id);
                cambios.asignado_nombre = nombreDe(u);
            } else {
                cambios.asignado_id = null;
                cambios.asignado_nombre = null;
            }
        }
        if (Array.isArray(req.body.etiquetas)) {
            cambios.etiquetas = [...new Set(req.body.etiquetas.map(e => String(e).trim().slice(0, 30)).filter(Boolean))].slice(0, 10);
        }
        if ('archivar' in req.body) cambios.archivado_en = req.body.archivar ? new Date().toISOString() : null;

        const { data, error } = await supabase.from('agente_conversaciones').upsert(cambios, { onConflict: 'clave' })
            .select('clave, asignado_id, asignado_nombre, etiquetas, archivado_en').single();
        if (error) throw new Error((await datosConversaciones()).disponible ? (error.message || 'No se pudo guardar') : FALTAN_TABLAS);
        if ('asignado_id' in req.body) {
            await supabase.from('agente_auditoria').insert({ telefono: clave, usuario_id: String(req.usuario.id), nivel: 'admin', accion: 'chat_asignado_panel', permitido: true, detalle: `${nombreDe(req.usuario)} → ${cambios.asignado_nombre || 'sin asignar'}` });
        }
        invalidarListaChats();
        res.json({ ok: true, conversacion: data });
    } catch (e) {
        console.error('[API/AGENTE-CHATS/CONVERSACION] error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Notas internas de una conversación
app.get('/api/agente-chats/notas', requiereSesion({ soloAdmin: true }), async (req, res) => {
    const clave = String(req.query.clave || '');
    if (!claveValida(clave)) return res.status(400).json({ error: 'Conversación inválida' });
    const { data, error } = await supabase.from('agente_notas').select('id, texto, nombre, usuario_id, creado').eq('clave', clave).order('creado', { ascending: false });
    if (error) return res.status(500).json({ error: FALTAN_TABLAS });
    res.json({ notas: data || [] });
});

app.post('/api/agente-chats/notas', requiereSesion({ soloAdmin: true }), async (req, res) => {
    const clave = String(req.body?.clave || '');
    const texto = String(req.body?.texto || '').trim().slice(0, 2000);
    if (!claveValida(clave)) return res.status(400).json({ error: 'Conversación inválida' });
    if (!texto) return res.status(400).json({ error: 'La nota está vacía' });
    const { data, error } = await supabase.from('agente_notas')
        .insert({ clave, texto, usuario_id: String(req.usuario.id), nombre: nombreDe(req.usuario) })
        .select('id, texto, nombre, usuario_id, creado').single();
    if (error) return res.status(500).json({ error: FALTAN_TABLAS });
    invalidarListaChats();
    res.json({ nota: data });
});

app.delete('/api/agente-chats/notas/:id', requiereSesion({ soloAdmin: true }), async (req, res) => {
    const { error } = await supabase.from('agente_notas').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message || 'No se pudo borrar' });
    invalidarListaChats();
    res.json({ ok: true });
});

// POST: crear un lead en el Call Center a partir de un número que escribió y no está en el sistema
// ({ telefono, nombre, nota }). Si ya hay un lead activo con ese número, solo le agrega la nota.
app.post('/api/agente-chats/crear-lead', requiereSesion({ soloAdmin: true }), async (req, res) => {
    try {
        const telefono = soloDigitos(req.body?.telefono);
        const tel10 = telefono.slice(-10);
        const nombre = String(req.body?.nombre || '').trim().slice(0, 120) || 'Prospecto WhatsApp';
        const nota = String(req.body?.nota || '').trim().slice(0, 1000);
        if (tel10.length !== 10) return res.status(400).json({ error: 'Este contacto no tiene un número válido' });

        const ahora = new Date();
        const notaLead = `💬 Lead de WhatsApp (escribió al número del agente)\n` +
            `• Registrado desde Chats Agente IA por ${nombreDe(req.usuario)}\n` +
            `• Fecha: ${ahora.toLocaleString('es-ES', { timeZone: 'America/New_York' })}` +
            (nota ? `\n• Nota: ${nota}` : '');
        const ORIGEN_WHATSAPP = 'WhatsApp - Chats Agente IA';

        const { data: activos, error: actErr } = await supabase.from('call_center_prospectos').select('id, telefono, notas_pre').in('estado', CC_ESTADOS_ACTIVOS);
        if (actErr) throw actErr;
        const existente = (activos || []).find(l => soloDigitos(l.telefono).slice(-10) === tel10);
        let leadId;
        if (existente) {
            leadId = existente.id;
            const previas = (existente.notas_pre || '').trim();
            const { error } = await supabase.from('call_center_prospectos').update({ notas_pre: previas ? `${previas}\n\n---\n${notaLead}` : notaLead }).eq('id', leadId);
            if (error) throw error;
        } else {
            leadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const { error } = await supabase.from('call_center_prospectos').insert([{
                id: leadId, nombre, telefono: '+' + telefono, pipeline: 'Renew Water',
                fuente: 'whatsapp', origen: ORIGEN_WHATSAPP, estado: 'pendiente', prioridad: 1,
                intentos_reasignacion: 0, operador_id: null, operador_nombre: null,
                fecha_creacion: ahora.toISOString(), fecha_asignacion: null, fecha_expiracion: null,
                notas_pre: notaLead,
            }]);
            if (error) throw error;
        }
        await supabase.from('agente_auditoria').insert({ telefono: tel10, usuario_id: String(req.usuario.id), nivel: 'admin', accion: 'lead_creado_panel', permitido: true, detalle: `${nombreDe(req.usuario)}: ${leadId} (${nombre})` });
        invalidarListaChats();
        res.json({ ok: true, lead_id: leadId, existia: !!existente });
    } catch (e) {
        console.error('[API/AGENTE-CHATS/CREAR-LEAD] error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST: pausar al agente con un contacto ({ telefono, horas }). horas vacío = hasta reanudar.
app.post('/api/agente-chats/pausa', requiereSesion({ soloAdmin: true }), async (req, res) => {
    try {
        const tel = ultimos10(req.body?.telefono);
        if (tel.length !== 10) return res.status(400).json({ error: 'Este contacto no tiene un número que el agente atienda' });
        const horas = Number(req.body?.horas) || 0;
        const hasta = horas > 0 ? new Date(Date.now() + Math.min(horas, 24 * 30) * 3600e3).toISOString() : null;
        const nombre = `${req.usuario.nombre || ''} ${req.usuario.apellido || ''}`.trim();
        const { error } = await supabase.from('agente_pausas').upsert({ telefono: tel, hasta, pausado_por: String(req.usuario.id), nombre, creado: new Date().toISOString() }, { onConflict: 'telefono' });
        if (error) {
            // El error de "tabla inexistente" a veces llega sin mensaje: se confirma leyendo la tabla
            const faltaTabla = (await pausasVigentes()) === null;
            throw new Error(faltaTabla ? 'Falta crear la tabla de pausas: ejecuta supabase_chats_agente.sql en Supabase' : (error.message || error.code || 'No se pudo guardar la pausa'));
        }
        await supabase.from('agente_auditoria').insert({ telefono: tel, usuario_id: String(req.usuario.id), nivel: 'admin', accion: 'agente_pausado_panel', permitido: true, detalle: `${nombre}: ${hasta ? 'hasta ' + hasta : 'sin límite'}` });
        invalidarListaChats();
        res.json({ ok: true, pausa: { telefono: tel, hasta, nombre } });
    } catch (e) {
        console.error('[API/AGENTE-CHATS/PAUSA] error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// DELETE: reanudar al agente con un contacto (?telefono=)
app.delete('/api/agente-chats/pausa', requiereSesion({ soloAdmin: true }), async (req, res) => {
    try {
        const tel = ultimos10(req.query.telefono);
        if (tel.length !== 10) return res.status(400).json({ error: 'Número inválido' });
        const { error } = await supabase.from('agente_pausas').delete().eq('telefono', tel);
        if (error) throw error;
        const nombre = `${req.usuario.nombre || ''} ${req.usuario.apellido || ''}`.trim();
        await supabase.from('agente_auditoria').insert({ telefono: tel, usuario_id: String(req.usuario.id), nivel: 'admin', accion: 'agente_reanudado_panel', permitido: true, detalle: nombre });
        invalidarListaChats();
        res.json({ ok: true });
    } catch (e) {
        console.error('[API/AGENTE-CHATS/PAUSA] error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET: imagen/documento de un mensaje (se descarga de Evolution bajo demanda)
app.get('/api/agente-chats/media/:id', requiereSesion({ soloAdmin: true }), async (req, res) => {
    try {
        const r = await evo('/chat/getBase64FromMediaMessage', { message: { key: { id: req.params.id } } });
        if (!r?.base64) return res.status(404).send('Sin archivo');
        res.setHeader('Content-Type', r.mimetype || 'application/octet-stream');
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.send(Buffer.from(r.base64, 'base64'));
    } catch (e) {
        console.error('[API/AGENTE-CHATS/MEDIA] error:', e.message);
        res.status(500).send('No se pudo obtener el archivo');
    }
});

// GET: Usuarios (para asignaciones manuales en Call Center)
app.get('/api/usuarios', async (req, res) => {
    try {
        const { data, error } = await supabase.from('usuarios').select('id, nombre, apellido, rol');
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        console.error('[API/USUARIOS] GET error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

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

// GET: Prospecto individual
app.get('/api/cc-prospectos/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('call_center_prospectos')
            .select('*')
            .eq('id', req.params.id)
            .single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DEBUG ONLY
app.get('/api/zadarma/debug', (req, res) => {
    const fs = require('fs');
    try {
        const log = fs.readFileSync(path.join(__dirname, 'zadarma_debug.jsonl'), 'utf8');
        res.type('text/plain').send(log);
    } catch(e) {
        res.send('No log yet');
    }
});
// POST: Ingresar nuevos prospectos (scraper n8n / manual / referidos / cualquier fuente)
// Body: { nombre, telefono, direccion, email?, pipeline?, fuente? }
//  OR batch: { leads: [ { ... } ] }
app.post('/api/cc-prospectos', requiereSesion(), async (req, res) => {
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
        const summary = { asignados: 0, en_espera: 0, duplicados: 0, distribution: {} };

        for (let idx = 0; idx < leadsIn.length; idx++) {
            const lead = leadsIn[idx];
            const leadId = 'cc_' + Date.now().toString(36) + '_' + idx;

            // ── Detección de duplicados por teléfono ──
            const cleanTel = (lead.telefono || '').replace(/\D/g, '').slice(-10);
            if (cleanTel.length >= 7) {
                const { data: existentes } = await supabase
                    .from('call_center_prospectos')
                    .select('id, telefono, estado')
                    .in('estado', CC_ESTADOS_ACTIVOS);
                
                const isDuplicate = (existentes || []).some(e => 
                    (e.telefono || '').replace(/\D/g, '').slice(-10) === cleanTel
                );
                
                if (isDuplicate) {
                    console.log(`[CC-PROSPECTOS] Lead ${lead.nombre || lead.telefono} omitido — teléfono duplicado (${cleanTel})`);
                    resultados.push({ id: leadId, nombre: lead.nombre, telefono: lead.telefono, estado: 'duplicado', _skipped: true });
                    summary.duplicados++;
                    continue;
                }
            }

            // Operador opcional (solo informativo); el lead es visible para todos
            let operador = null;
            if (lead.operador_id) {
                const { data: usr } = await supabase.from('usuarios').select('id, nombre, apellido').eq('id', lead.operador_id).single();
                if (usr) operador = usr;
            }

            const nuevoLead = {
                id:                    leadId,
                nombre:               lead.nombre     || null,
                telefono:             lead.telefono,
                direccion:            lead.direccion  || null,
                email:                lead.email      || null,
                ciudad:               lead.ciudad     || null,
                estado_geo:           lead.estado_geo || lead.estado || null,
                zip_code:             lead.zip_code   || null,
                pipeline:             lead.pipeline   || lead.ecosistema || null,
                fuente:               lead.fuente     || 'scraper',
                origen:               lead.origen     || null,
                estado:               'pendiente',
                prioridad:            0,
                intentos_reasignacion: 0,
                operador_id:          operador ? operador.id : null,
                operador_nombre:      operador ? `${operador.nombre || ''} ${operador.apellido || ''}`.trim() : null,
                fecha_creacion:       new Date().toISOString(),
                fecha_asignacion:     operador ? new Date().toISOString() : null,
                fecha_expiracion:     null
            };
            summary.asignados++;

            resultados.push(nuevoLead);
        }

        // Batch insert (excluding duplicates)
        const leadsToInsert = resultados.filter(r => !r._skipped);
        let data = [];
        if (leadsToInsert.length > 0) {
            const { data: inserted, error } = await supabase
                .from('call_center_prospectos')
                .insert(leadsToInsert)
                .select();
            if (error) throw error;
            data = inserted || [];
        }

        console.log(`[CC-PROSPECTOS] ${leadsIn.length} leads procesados — Nuevos: ${summary.asignados}, Duplicados: ${summary.duplicados}`);
        res.json({ success: true, total: leadsIn.length, ...summary, data });

    } catch (e) {
        console.error('[CC-PROSPECTOS] POST error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// PATCH: Agente responde (acepta o rechaza) un prospecto asignado
// Body: { accion: 'aceptar' | 'rechazar', ...otros_campos }
app.patch('/api/cc-prospectos/:id', requiereSesion(), async (req, res) => {
    try {
        const { id } = req.params;
        const { accion, ...extraFields } = req.body;
        const now = new Date().toISOString();

        if (accion === 'aceptar') {
            // El lead sigue en la lista hasta que se convierte (estado 'aceptado')
            const { error } = await supabase.from('call_center_prospectos')
                .update({ ...extraFields, estado: 'pendiente', fecha_gestion: now }).eq('id', id);
            if (error) throw error;
            return res.json({ success: true, accion: 'aceptado' });
        }

        if (accion === 'rechazar') {
            // Rechazo definitivo → sale de la lista para todos
            const { error } = await supabase.from('call_center_prospectos')
                .update({ ...extraFields, estado: 'rechazado', fecha_expiracion: null, fecha_gestion: now }).eq('id', id);
            if (error) throw error;
            return res.json({ success: true, accion: 'rechazado' });
        }

        if (accion === 'timeout') {
            // Ya no hay temporizador por agente: se ignora (compatibilidad)
            return res.json({ success: true, accion: 'sin_cambios' });
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

// POST: Procesar cola — ya no existe cola por agente; se mantiene por compatibilidad (n8n / admin)
app.post('/api/cc-prospectos/procesar-cola', requiereSesion(), (req, res) => {
    res.json({ success: true, procesados: 0, en_cola: 0, mensaje: 'Lista compartida: no hay cola por agente' });
});

// DELETE: Eliminar un prospecto de la tabla
app.delete('/api/cc-prospectos/:id', requiereSesion(), async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('call_center_prospectos').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        console.error('[CC-PROSPECTOS] DELETE error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// DELETE: Eliminar un registro específico

app.post('/api/delete', requiereSesion(), async (req, res) => {
    try {
        const { table, id, column } = req.body;
        if (!table || !id) return res.status(400).json({ error: 'Faltan parámetros' });
        const prohibido = tablaProhibida(table, req.usuario);
        if (prohibido) return res.status(403).json({ error: prohibido });

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

app.post('/api/delete-bulk', requiereSesion(), async (req, res) => {
    try {
        const { table, ids, column } = req.body;
        if (!table || !ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: 'Faltan parámetros o ids no es un array' });
        }
        const prohibido = tablaProhibida(table, req.usuario);
        if (prohibido) return res.status(403).json({ error: prohibido });

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

        console.log('[STORAGE] <i class="fa-solid fa-check text-green-500"></i> Upload successful:', publicUrl);
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
            if (cErr) console.error('[STORAGE] <i class="fa-solid fa-xmark text-red-500"></i> Error creando bucket:', cErr.message);
            else console.log('[STORAGE] <i class="fa-solid fa-check text-green-500"></i> Bucket "archivos_renew" creado exitosamente.');
        } else {
            console.log('[STORAGE] El bucket "archivos_renew" ya existe. Asegurando configuración de 500MB...');
            const { error: uErr } = await supabaseStorage.storage.updateBucket('archivos_renew', bucketOptions);
            if (uErr) {
                console.warn('[STORAGE] <i class="fa-solid fa-triangle-exclamation text-orange-500"></i> No se pudo actualizar el límite del bucket desde el código:', uErr.message);
                console.warn('[STORAGE] 💡 POR FAVOR: Ve a tu panel de Supabase -> Storage -> Buckets -> archivos_renew -> Settings y cambia "File size limit" a 500MB manualmente.');
            }
            else console.log('[STORAGE] <i class="fa-solid fa-check text-green-500"></i> Configuración de bucket (500MB) verificada con éxito.');
        }
    } catch (err) {
        console.error('[STORAGE] Error inicializando bucket:', err.message);
    }
}
initStorage();

app.post('/api/upload', requiereSesion(), upload.single('file'), async (req, res) => {
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
app.post('/api/upload-academia', requiereSesion(), upload.fields([
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
app.post('/api/get-upload-url', requiereSesion(), async (req, res) => {
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
app.post('/api/upload-chunk', requiereSesion(), express.raw({ type: 'application/octet-stream', limit: '10mb' }), async (req, res) => {
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

app.post('/api/complete-upload', requiereSesion(), async (req, res) => {
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
            console.log(`[LOCAL STORAGE] <i class="fa-solid fa-check text-green-500"></i> Upload exitoso a VPS: ${publicUrl}`);
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
        console.log(`[STORAGE] <i class="fa-solid fa-check text-green-500"></i> Upload exitoso (local): ${publicUrl}`);
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
            if (!res.headersSent) {
                res.status(502).json({ error: 'No se pudo recuperar el archivo del almacenamiento interno.' });
            } else {
                res.end();
            }
        });
    } catch (e) {
        console.error('[PROXY CRITICAL]', e.message);
        if (!res.headersSent) {
            res.status(500).json({ error: e.message });
        } else {
            res.end();
        }
    }
});

// ── ZADARMA API INTEGRATION ─────────────────────────────────────────
const ZADARMA_KEY = 'cd41f69ba094fd7f962e';
const ZADARMA_SECRET = '43e065ae9b6e36670558';

function generateZadarmaSignature(method, params) {
    const sortedKeys = Object.keys(params).sort();
    let queryString = '';
    sortedKeys.forEach((k, i) => {
        queryString += `${k}=${encodeURIComponent(params[k])}`;
        if (i < sortedKeys.length - 1) queryString += '&';
    });

    const crypto = require('crypto');
    const md5 = crypto.createHash('md5').update(queryString).digest('hex');
    const data = method + queryString + md5;
    
    // Zadarma API (PHP backend) expects the HMAC SHA1 to be output as a HEX string, 
    // and THEN that HEX string is base64 encoded.
    const hmacHex = crypto.createHmac('sha1', ZADARMA_SECRET).update(data).digest('hex');
    const signature = Buffer.from(hmacHex).toString('base64');
    
    return { queryString, signature };
}

app.post('/api/zadarma/call', requiereSesion(), async (req, res) => {
    try {
        let { from, to } = req.body;
        if (!from || !to) return res.status(400).json({ error: 'Faltan parámetros (from, to)' });

        // Si el SIP viene con el formato 524497-100, extraer solo la extensión (100)
        let ext = from;
        if (from.includes('-')) {
            ext = from.split('-')[1];
        }

        const params = { from: ext, to, sip: ext };
        const method = '/v1/request/callback/';
        const { queryString, signature } = generateZadarmaSignature(method, params);

        const response = await fetch(`https://api.zadarma.com${method}?${queryString}`, {
            method: 'GET',
            headers: {
                'Authorization': `${ZADARMA_KEY}:${signature}`
            }
        });

        const data = await response.json();
        res.json(data);
    } catch (e) {
        console.error('[ZADARMA CALL]', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/zadarma/webrtc-key', async (req, res) => {
    try {
        const { sip } = req.query;
        if (!sip) return res.status(400).json({ error: 'Falta parámetro (sip)' });

        const params = { sip };
        const method = '/v1/webrtc/get_key/';
        const { queryString, signature } = generateZadarmaSignature(method, params);

        const response = await fetch(`https://api.zadarma.com${method}?${queryString}`, {
            method: 'GET',
            headers: {
                'Authorization': `${ZADARMA_KEY}:${signature}`
            }
        });

        const data = await response.json();
        res.json(data);
    } catch (e) {
        console.error('[ZADARMA WEBRTC]', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/zadarma/webhook', (req, res) => {
    if (req.query.zd_echo) {
        return res.send(req.query.zd_echo);
    }
    res.status(400).send('Bad Request');
});

app.post('/api/zadarma/webhook', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        console.log('[ZADARMA WEBHOOK] Evento recibido', req.body);
        const fs = require('fs');
        fs.appendFileSync(path.join(__dirname, 'zadarma_debug.jsonl'), JSON.stringify(req.body) + '\\n');
        
        if (req.query.zd_echo) {
            return res.send(req.query.zd_echo);
        }

        const event = req.body.event;
        
        // 1. Cuando termina la llamada, guardamos el historial básico
        if (event === 'NOTIFY_END' || event === 'NOTIFY_OUT_END' || event === 'NOTIFY_INTERNAL') {
            const { destination, duration, caller_id, call_id_with_rec } = req.body;
            const prospectPhone = destination || caller_id;
            console.log(`[ZADARMA] Llamada terminada para ${prospectPhone}: Duración ${duration}s`);
            
            if (prospectPhone) {
                const cleanPhone = prospectPhone.replace(/\\D/g, '').slice(-10);
                
                // 1. Buscar en call_center_prospectos
                const { data: leads } = await supabase.from('call_center_prospectos').select('id, telefono, historial_llamadas');
                
                if (leads) {
                    const matchingLeads = leads.filter(l => (l.telefono || '').replace(/\D/g, '').slice(-10) === cleanPhone);
                    for (const lead of matchingLeads) {
                        const history = lead.historial_llamadas || [];
                        history.push({
                            call_id: call_id_with_rec || null,
                            fecha: new Date().toISOString(),
                            duracion: duration || 0,
                            grabacion_url: null,
                            tipo: (event === 'NOTIFY_END' || event === 'NOTIFY_INTERNAL') ? 'Entrante' : 'Saliente'
                        });
                        await supabase.from('call_center_prospectos').update({ historial_llamadas: history }).eq('id', lead.id);
                        console.log(`[ZADARMA] Historial guardado para el lead ${lead.id}`);
                    }
                }
                
                // 2. Buscar en clientes_maestro
                const { data: clientes } = await supabase.from('clientes_maestro').select('id, telefono, historial_llamadas');
                if (clientes) {
                    const matchingClientes = clientes.filter(c => (c.telefono || '').replace(/\D/g, '').slice(-10) === cleanPhone);
                    for (const cliente of matchingClientes) {
                        const history = cliente.historial_llamadas || [];
                        history.push({
                            call_id: call_id_with_rec || null,
                            fecha: new Date().toISOString(),
                            duracion: duration || 0,
                            grabacion_url: null,
                            tipo: (event === 'NOTIFY_END' || event === 'NOTIFY_INTERNAL') ? 'Entrante' : 'Saliente'
                        });
                        await supabase.from('clientes_maestro').update({ historial_llamadas: history }).eq('id', cliente.id);
                        console.log(`[ZADARMA] Historial guardado para el CLIENTE ${cliente.id}`);
                    }
                }
            }
        }
        
        // 2. Cuando la grabación está lista, pedimos el link usando la API de Zadarma
        if (event === 'NOTIFY_RECORD') {
            const { call_id_with_rec, pbx_call_id } = req.body;
            console.log(`[ZADARMA] NOTIFY_RECORD recibido para call_id_with_rec: ${call_id_with_rec}, pbx_call_id: ${pbx_call_id}`);
            
            if (pbx_call_id || call_id_with_rec) {
                try {
                    const { api: z_api } = require('zadarma');
                    const response = await z_api({
                        api_method: '/v1/pbx/record/request/',
                        api_user_key: 'cd41f69ba094fd7f962e',
                        api_secret_key: '43e065ae9b6e36670558',
                        params: {
                            pbx_call_id: pbx_call_id || '',
                            call_id: call_id_with_rec || '',
                            lifetime: 7200
                        }
                    });
                    
                    console.log(`[ZADARMA API] Respuesta link:`, response);
                    
                    if (response && response.status === 'success' && response.links && response.links.length > 0) {
                        const call_record_link = response.links[0];
                        
                        
                        
                        // 1. Intentar guardar en leads
                        const { data: leads } = await supabase.from('call_center_prospectos').select('id, historial_llamadas');
                        if (leads) {
                            for (const lead of leads) {
                                if (!lead.historial_llamadas) continue;
                                const callIndex = lead.historial_llamadas.findIndex(h => h.call_id === call_id_with_rec || h.call_id === pbx_call_id);
                                if (callIndex !== -1) {
                                    lead.historial_llamadas[callIndex].grabacion_url = call_record_link;
                                    await supabase.from('call_center_prospectos').update({ historial_llamadas: lead.historial_llamadas }).eq('id', lead.id);
                                    console.log(`[ZADARMA] Grabación vinculada exitosamente al lead ${lead.id}`);
                                }
                            }
                        }
                        
                        // 2. Intentar guardar en clientes_maestro
                        const { data: clientes } = await supabase.from('clientes_maestro').select('id, historial_llamadas');
                        if (clientes) {
                            for (const cliente of clientes) {
                                if (!cliente.historial_llamadas) continue;
                                const callIndex = cliente.historial_llamadas.findIndex(h => h.call_id === call_id_with_rec || h.call_id === pbx_call_id);
                                if (callIndex !== -1) {
                                    cliente.historial_llamadas[callIndex].grabacion_url = call_record_link;
                                    await supabase.from('clientes_maestro').update({ historial_llamadas: cliente.historial_llamadas }).eq('id', cliente.id);
                                    console.log(`[ZADARMA] Grabación vinculada exitosamente al CLIENTE ${cliente.id}`);
                                }
                            }
                        }
                    }
                } catch(err) {
                    console.error('[ZADARMA API] Error pidiendo el link:', err);
                }
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error('[ZADARMA WEBHOOK ERROR]', e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`\n<i class="fa-solid fa-rocket"></i> RENEW CLOUD SERVER RUNNING`);
    console.log(`<i class="fa-solid fa-satellite-dish"></i> Admin Panel : http://localhost:${port}/admin.html`);
    console.log(`<i class="fa-solid fa-mobile"></i> Mobile App  : http://localhost:${port}/index.html`);
    console.log(`<i class="fa-solid fa-lock"></i> Database    : SUPABASE (Live Connection)`);
    console.log(`<i class="fa-solid fa-image"></i>️  Public URL  : ${PUBLIC_BASE_URL}\n`);
});


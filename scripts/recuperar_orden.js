// Recupera una Orden de Trabajo cuyo link se borró del cliente/proyecto.
// El PDF sigue en Supabase Storage (archivos_renew/ordenes/), solo se perdió la URL.
//
// Uso (desde la raíz del proyecto, en el servidor):
//   node scripts/recuperar_orden.js buscar "Fleitas"
//       → muestra cliente, proyecto, respuestas con archivos y los PDFs de
//         ordenes/ que contienen ese nombre (lee el texto de cada PDF).
//   node scripts/recuperar_orden.js aplicar <proyectoId> <urlDelPdf>
//       → guarda la URL en adjuntos_oficina.orden_trabajo_url del cliente
//         y en orden_trabajo_url del proyecto.
//
// Credenciales: usa SUPABASE_URL / SUPABASE_KEY del entorno o, si no están,
// las mismas que tiene server.js.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function credenciales() {
    let url = process.env.SUPABASE_URL, key = process.env.SUPABASE_KEY;
    if (!url || !key) {
        const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
        url = url || (src.match(/const SUPABASE_URL = '([^']+)'/) || [])[1];
        key = key || (src.match(/const SUPABASE_KEY = '([^']+)'/) || [])[1];
    }
    if (!url || !key) throw new Error('No encontré SUPABASE_URL / SUPABASE_KEY');
    return { url, key };
}

const { url: SB_URL, key: SB_KEY } = credenciales();
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const BUCKET = 'archivos_renew';

async function textoPdf(buffer) {
    const mod = require('pdf-parse');
    if (mod.PDFParse) { // pdf-parse v2
        const parser = new mod.PDFParse({ data: buffer });
        const r = await parser.getText();
        if (parser.destroy) await parser.destroy();
        return r.text || '';
    }
    const fn = typeof mod === 'function' ? mod : mod.default;
    return (await fn(buffer)).text || '';
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function buscar(nombre) {
    const { data: clientes, error } = await sb.from('clientes_maestro')
        .select('id, nombre, adjuntos_oficina, created_at').ilike('nombre', `%${nombre}%`);
    if (error) throw error;
    console.log(`\n== Clientes que coinciden con "${nombre}": ${clientes.length}`);
    let desde = null;
    for (const c of clientes) {
        console.log(`\n· Cliente ${c.id} — ${c.nombre}`);
        console.log('  adjuntos_oficina:', JSON.stringify(c.adjuntos_oficina || {}, null, 2).replace(/\n/g, '\n  '));
        const { data: proys } = await sb.from('proyectos_dinamicos').select('*').eq('cliente_id', c.id);
        for (const p of proys || []) {
            console.log(`  Proyecto ${p.id}  creado ${p.created_at}  orden_trabajo_url=${p.orden_trabajo_url || '(vacío)'}`);
            if (p.created_at && (!desde || p.created_at < desde)) desde = p.created_at;
            const { data: resps } = await sb.from('respuestas_dinamicas').select('*').eq('proyecto_id', p.id);
            (resps || []).filter(r => /https?:|\/api\//.test(String(r.valor || '')))
                .forEach(r => console.log(`    respuesta campo ${r.campo_id}: ${r.valor}`));
        }
    }

    // PDFs de órdenes en storage creados desde la fecha del proyecto
    const { data: files, error: lErr } = await sb.storage.from(BUCKET)
        .list('ordenes', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
    if (lErr) throw lErr;
    const limite = desde ? new Date(new Date(desde).getTime() - 86400000) : null;
    const candidatos = (files || []).filter(f => f.name.endsWith('.pdf') && (!limite || new Date(f.created_at) >= limite));
    console.log(`\n== Revisando ${candidatos.length} PDF(s) en ordenes/ ${limite ? 'desde ' + limite.toISOString() : ''}`);
    const buscado = norm(nombre);
    const hallados = [];
    for (const f of candidatos) {
        const ruta = `ordenes/${f.name}`;
        try {
            const { data: blob, error: dErr } = await sb.storage.from(BUCKET).download(ruta);
            if (dErr) { console.log(`  (no se pudo bajar ${ruta}: ${dErr.message})`); continue; }
            const txt = norm(await textoPdf(Buffer.from(await blob.arrayBuffer())));
            if (txt.includes(buscado)) {
                const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(ruta);
                hallados.push({ ruta, creado: f.created_at, url: publicUrl });
            }
        } catch (e) {
            console.log(`  (error leyendo ${ruta}: ${e.message})`);
        }
    }
    console.log(`\n== Órdenes que mencionan "${nombre}": ${hallados.length}`);
    hallados.forEach(h => console.log(`  ${h.creado}  ${h.url}`));
    if (hallados.length) console.log('\nAbre el link para confirmar y luego corre:\n  node scripts/recuperar_orden.js aplicar <proyectoId> <url>');
}

async function aplicar(proyectoId, url) {
    const { data: p, error } = await sb.from('proyectos_dinamicos').select('id, cliente_id').eq('id', proyectoId).single();
    if (error || !p) throw new Error(`Proyecto ${proyectoId} no encontrado`);
    const { data: c, error: cErr } = await sb.from('clientes_maestro').select('id, adjuntos_oficina').eq('id', p.cliente_id).single();
    if (cErr) throw cErr;
    const adj = (c.adjuntos_oficina && !Array.isArray(c.adjuntos_oficina)) ? c.adjuntos_oficina : {};
    adj.orden_trabajo_url = url;
    adj.ultima_orden_fecha = adj.ultima_orden_fecha || new Date().toISOString();
    const { error: u1 } = await sb.from('clientes_maestro').update({ adjuntos_oficina: adj }).eq('id', c.id);
    if (u1) throw u1;
    const { error: u2 } = await sb.from('proyectos_dinamicos').update({ orden_trabajo_url: url }).eq('id', p.id);
    if (u2) console.warn('Aviso al actualizar proyecto:', u2.message);
    console.log(`Listo: cliente ${c.id} y proyecto ${p.id} vinculados a ${url}`);
}

(async () => {
    const [cmd, a, b] = process.argv.slice(2);
    if (cmd === 'buscar' && a) await buscar(a);
    else if (cmd === 'aplicar' && a && b) await aplicar(a, b);
    else console.log('Uso:\n  node scripts/recuperar_orden.js buscar "Nombre"\n  node scripts/recuperar_orden.js aplicar <proyectoId> <url>');
})().catch(e => { console.error('ERROR:', e.message || e); process.exit(1); });

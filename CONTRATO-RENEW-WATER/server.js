/* ============================================================
   RENEW WATER — server.js (CONTRATOS)
   Servidor Express para despliegue en VPS.
   ============================================================ */

import express  from 'express';
import path     from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument } from 'pdf-lib';
import { readFile }    from 'fs/promises';

// ─── Resolución de rutas (ESM no tiene __dirname) ────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Configuración ───────────────────────────────────────────
const PORT = process.env.PORT || 3005;
const app  = express();

// ─── Middlewares ─────────────────────────────────────────────
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde la raíz del proyecto
app.use(express.static(__dirname));

// ─── Helper: llenar PDF con pdf-lib ──────────────────────────
async function generarPDF(moldeFileName, datos) {
  const moldePath  = path.join(__dirname, moldeFileName);
  const pdfBuffer  = await readFile(moldePath);
  const pdfDoc     = await PDFDocument.load(pdfBuffer);
  const form       = pdfDoc.getForm();

  for (const [key, value] of Object.entries(datos)) {
    try {
      const field = form.getTextField(key.trim());
      if (!field) continue;

      if (typeof value === 'string' && value.startsWith('data:image/png;base64,')) {
        const base64Data = value.split(',')[1];
        const imageBytes = Buffer.from(base64Data, 'base64');
        const pngImage   = await pdfDoc.embedPng(imageBytes);

        const widgets = field.acroField.getWidgets();
        const widget  = widgets[0];
        const rect    = widget.getRectangle();

        const pages       = pdfDoc.getPages();
        let pageOfField   = pages[0];
        for (const p of pages) {
          try {
            if (p.ref === widget.P()) { pageOfField = p; break; }
          } catch(_) {}
        }

        pageOfField.drawImage(pngImage, {
          x:      rect.x,
          y:      rect.y,
          width:  rect.width,
          height: rect.height,
        });

        field.setText('');
      } else {
        field.setText(value ? String(value) : '');
      }
    } catch (err) {
      console.log(`[PDF] Campo omitido: "${key}" → ${err.message}`);
    }
  }

  form.flatten();
  return pdfDoc.save();
}

import { createClient } from '@supabase/supabase-js';

// ─── Configuración Supabase ──────────────────────────────────
const SUPABASE_URL = 'https://api-renew.0f2zfh.easypanel.host';
// Using the service_role key to bypass RLS for server-side operations
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MTI4ODAwMDAsImV4cCI6MjAyODQxNjAwMH0.LgwaO10yxM6SN8mDx5uxYyUhx_0jjA3CkfcVMY-AOB0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  global: {
    fetch: (url, options) => {
      let fixedUrl = url;
      if (url.includes('/storage/v1/')) {
          fixedUrl = url.replace('api-renew', 'files-renew').replace('/storage/v1/', '/');
      }
      return fetch(fixedUrl, options);
    }
  }
});

// ─── RUTA: POST /api/generar-contrato  (Contrato Renew Water) ────
app.post('/api/generar-contrato', async (req, res) => {
  try {
    const datos    = req.body.datos || req.body;
    const pipeline = (datos.pipeline || 'Renew Water').toLowerCase();
    
    // ─── SELECCIÓN DE MOLDE ──────────────────────────────────────
    let moldeFile = 'molde_contrato.pdf';
    let filePrefix = 'water';
    let dbColumn = 'contrato_water_url';

    if (pipeline.includes('solar')) {
      moldeFile = 'molde_contrato_solar.pdf';
      filePrefix = 'solar';
      dbColumn = 'contrato_solar_url';
    } else if (pipeline.includes('home')) {
      filePrefix = 'home';
      dbColumn = 'contrato_home_url';
    }

    const pdfBytes = await generarPDF(moldeFile, datos);

    // 1. Subir PDF a Supabase Storage
    const fileName = `contratos/contrato_${filePrefix}_${Date.now()}_${Math.round(Math.random() * 1E9)}.pdf`;
    const { error: uploadError } = await supabase.storage
        .from('archivos_renew')
        .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });

    let finalUrl = null;
    if (uploadError) {
        console.error('[STORAGE ERROR]', uploadError);
    } else {
        const { data: { publicUrl } } = supabase.storage.from('archivos_renew').getPublicUrl(fileName);
        finalUrl = publicUrl.replace('api-renew', 'files-renew').replace('/storage/v1/', '/');
        
        // 2. Actualizar la base de datos (Columna específica + Adjuntos Oficina)
        if (datos.proyectoId) {
            // Update specific column and also the generic adjuntos_oficina for backward compatibility
            const updatePayload = { [dbColumn]: finalUrl };
            
            // Get current adjuntos_oficina to not overwrite other things
            const { data: currentCli } = await supabase
              .from('clientes_maestro')
              .select('adjuntos_oficina')
              .eq('id', datos.proyectoId)
              .single();
            
            let adjuntos = currentCli?.adjuntos_oficina || {};
            if (Array.isArray(adjuntos)) adjuntos = {};
            
            // Store pipeline-specific contract in adjuntos_oficina
            adjuntos[`contrato_${filePrefix}_url`] = finalUrl;
            // Also keep the main one for the general "Contrato Firmado" button if preferred
            adjuntos.contrato_url = finalUrl; 
            
            updatePayload.adjuntos_oficina = adjuntos;

            const { error: dbError } = await supabase
              .from('clientes_maestro')
              .update(updatePayload)
              .eq('id', datos.proyectoId);
            
            if (dbError) console.error('[DB UPDATE ERROR]', dbError);
            else console.log(`[SUPABASE] Cliente ${datos.proyectoId} actualizado con contrato ${filePrefix}: ${finalUrl}`);
        }
    }

    // Webhook Trigger (Fire and Forget)
    const WEBHOOK_URL = 'https://n8n.renewgroup.site/webhook/contrato-renew-water';
    fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evento: "contrato_generado", pipeline: pipeline, contrato_url: finalUrl, datos })
    }).catch(err => console.error("Error al disparar webhook:", err));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contrato_renew_${filePrefix}.pdf"`);
    return res.status(200).send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('[/api/generar-contrato] Error:', error);
    return res.status(500).json({ error: 'Error al generar el PDF del contrato', detalle: error.message });
  }
});

// ─── Fallback SPA: todas las rutas sirven index.html ─────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Arrancar servidor ────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log(`  ║   🌊 RENEW WATER — API Contratos         ║`);
  console.log(`  ║   Servidor activo en el puerto ${PORT}       ║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`  → Local:    http://localhost:${PORT}`);
  console.log(`  → API PDF:  POST http://localhost:${PORT}/api/generar-contrato`);
  console.log('');
});


/* ============================================================
   RENEW WATER — server.js
   Servidor Express para despliegue en VPS.
   Reemplaza las funciones serverless de Vercel.

   Uso:
     node server.js            (producción)
     npm run dev               (desarrollo con auto-reload)
     pm2 start server.js --name renew-water  (producción con PM2)
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
const PORT = process.env.PORT || 3000;
const app  = express();

// ─── Middlewares ─────────────────────────────────────────────
app.use(express.json({ limit: '20mb' }));      // Parse JSON bodies (las fotos/firmas son grandes)
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde la raíz del proyecto
app.use(express.static(__dirname));

// ─── Helper: llenar PDF con pdf-lib ──────────────────────────
/**
 * Carga un molde PDF, llena sus campos con los datos recibidos
 * y devuelve los bytes del PDF generado.
 *
 * @param {string} moldeFileName  - Nombre del archivo PDF molde (ej. 'molde_credito_v9.pdf')
 * @param {Object} datos          - Objeto clave→valor con los datos a insertar
 * @returns {Promise<Uint8Array>} - Bytes del PDF generado
 */
async function generarPDF(moldeFileName, datos) {
  // Leer el molde directamente desde el disco (más rápido que fetch en VPS)
  const moldePath  = path.join(__dirname, moldeFileName);
  const pdfBuffer  = await readFile(moldePath);
  const pdfDoc     = await PDFDocument.load(pdfBuffer);
  const form       = pdfDoc.getForm();

  for (const [key, value] of Object.entries(datos)) {
    try {
      const field = form.getTextField(key.trim());
      if (!field) continue;

      if (typeof value === 'string' && value.startsWith('data:image/png;base64,')) {
        // ── Firma digital: se dibuja como imagen en el PDF ──
        const base64Data = value.split(',')[1];
        const imageBytes = Buffer.from(base64Data, 'base64');
        const pngImage   = await pdfDoc.embedPng(imageBytes);

        const widgets = field.acroField.getWidgets();
        const widget  = widgets[0];
        const rect    = widget.getRectangle();

        // Buscar la página que contiene este campo
        const pages       = pdfDoc.getPages();
        let pageOfField   = pages[0];
        for (const p of pages) {
          try {
            if (p.ref === widget.P()) { pageOfField = p; break; }
          } catch(_) { /* ignorar si P() falla */ }
        }

        pageOfField.drawImage(pngImage, {
          x:      rect.x,
          y:      rect.y,
          width:  rect.width,
          height: rect.height,
        });

        field.setText(''); // Limpiar texto del campo para que no tape la imagen
      } else {
        // ── Texto normal ──
        field.setText(value ? String(value) : '');
      }
    } catch (err) {
      // Campo no existe o no es un TextField — se ignora silenciosamente
      console.log(`[PDF] Campo omitido: "${key}" → ${err.message}`);
    }
  }

  form.flatten();
  return pdfDoc.save();
}

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
    return publicUrl.replace('api-renew', 'files-renew').replace('/storage/v1/', '/');
  } catch (err) {
    console.error(`[UPLOAD ERROR - ${pathPrefix}]`, err);
    return null;
  }
}

// ─── RUTA: POST /api/generar-pdf  (Aplicación de Crédito) ────
app.post('/api/generar-pdf', async (req, res) => {
  try {
    const rawData = req.body.datos || req.body;
    
    // El PDF molde_credito_v9.pdf espera campos planos.
    // Mapeamos los datos anidados de creditForm.js a un objeto plano.
    const datos = {
      // Aplicante
      "monto":            rawData.aplicante?.monto || '',
      "fullname":         rawData.aplicante?.nombreCompleto || '',
      "dob":              rawData.aplicante?.fechaNacimiento || '',
      "ssn":              rawData.aplicante?.seguroSocial || '',
      "dl":               rawData.aplicante?.licencia || '',
      "dl_state":         rawData.aplicante?.licenciaEstado || '',
      "dl_issue":         rawData.aplicante?.licenciaExpedicion || '',
      "dl_exp":           rawData.aplicante?.licenciaExpiracion || '',
      "phone":            rawData.aplicante?.telefono || '',
      "email":            rawData.aplicante?.email || '',
      "address":          rawData.aplicante?.direccion || '',
      "time_living":      rawData.aplicante?.tiempoViviendo || '',
      "mortgage_payment": rawData.aplicante?.pagoMensual || '',
      "housing_type":     rawData.aplicante?.tipoVivienda || '',
      "housing_status":   rawData.aplicante?.estatusVivienda || '',
      
      // Co-Aplicante
      "cb_monto":            rawData.coAplicante?.monto || '',
      "cb_fullname":         rawData.coAplicante?.nombreCompleto || '',
      "cb_dob":              rawData.coAplicante?.fechaNacimiento || '',
      "cb_ssn":              rawData.coAplicante?.seguroSocial || '',
      "cb_dl":               rawData.coAplicante?.licencia || '',
      "cb_dl_state":         rawData.coAplicante?.licenciaEstado || '',
      "cb_dl_issue":         rawData.coAplicante?.licenciaExpedicion || '',
      "cb_dl_exp":           rawData.coAplicante?.licenciaExpiracion || '',
      "cb_phone":            rawData.coAplicante?.telefono || '',
      "cb_email":            rawData.coAplicante?.email || '',
      "cb_address":          rawData.coAplicante?.direccion || '',
      "cb_time_living":      rawData.coAplicante?.tiempoViviendo || '',
      "cb_mortgage_payment": rawData.coAplicante?.pagoMensual || '',
      "cb_housing_type":     rawData.coAplicante?.tipoVivienda || '',
      "cb_housing_status":   rawData.coAplicante?.estatusVivienda || '',

      // Empleo Aplicante
      "ca_income_type":      rawData.empleoAplicante?.tipoIngreso || '',
      "ca_employer":         rawData.empleoAplicante?.nombreEmpleo || '',
      "ca_work_phone":       rawData.empleoAplicante?.telefonoTrabajo || '',
      "ca_work_address":     rawData.empleoAplicante?.direccionTrabajo || '',
      "ca_position":         rawData.empleoAplicante?.posicion || '',
      "ca_time_job":         rawData.empleoAplicante?.tiempoTrabajo || '',
      "ca_monthly_income":   rawData.empleoAplicante?.pagoMensual || '',
      "ca_income_freq":      rawData.empleoAplicante?.frecuenciaPago || '',

      // Empleo Co-Aplicante
      "cb_income_type":      rawData.empleoCoAplicante?.tipoIngreso || '',
      "cb_employer":         rawData.empleoCoAplicante?.nombreEmpleo || '',
      "cb_work_phone":       rawData.empleoCoAplicante?.telefonoTrabajo || '',
      "cb_work_address":     rawData.empleoCoAplicante?.direccionTrabajo || '',
      "cb_position":         rawData.empleoCoAplicante?.posicion || '',
      "cb_time_job":         rawData.empleoCoAplicante?.tiempoTrabajo || '',
      "cb_monthly_income":   rawData.empleoCoAplicante?.pagoMensual || '',
      "cb_income_freq":      rawData.empleoCoAplicante?.frecuenciaPago || '',

      // Firmas (se procesan en generarPDF si empiezan con data:image)
      "firma_aplicante":     rawData.firma_aplicante || '',
      "firma_co_aplicante":  rawData.firma_co_aplicante || '',
      
      "nombre_dealer":       rawData.nombre_dealer || '',
      "negocio_procedencia": rawData.negocio_procedencia || '',
      "proyectoId":          rawData.proyectoId
    };

    const pdfBytes = await generarPDF('molde_credito_v9.pdf', datos);

    // 1. Subir PDF a Supabase Storage
    const fileName = `creditos/app_credito_${Date.now()}_${Math.round(Math.random() * 1E9)}.pdf`;
    const { error: uploadError } = await supabase.storage
        .from('archivos_renew')
        .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });

    let finalUrl = null;
    if (uploadError) {
        console.error('[STORAGE ERROR - CREDIT]', uploadError);
    } else {
        const { data: { publicUrl } } = supabase.storage.from('archivos_renew').getPublicUrl(fileName);
        finalUrl = publicUrl.replace('api-renew', 'files-renew').replace('/storage/v1/', '/');
        
        // 2. Actualizar en Supabase (campo credit_app_url)
        if (datos.proyectoId) {
            await supabase
              .from('clientes_maestro')
              .update({ credit_app_url: finalUrl })
              .eq('id', datos.proyectoId);
            console.log(`[SUPABASE] Cliente ${datos.proyectoId} actualizado con App de Crédito: ${finalUrl}`);
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

import { createClient } from '@supabase/supabase-js';

// ─── Configuración Supabase ──────────────────────────────────
const SUPABASE_URL = 'https://api-renew.0f2zfh.easypanel.host';
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

function formatDateUS(dateStr) {
  if (!dateStr) return '';
  const [yyyy, mm, dd] = dateStr.split('-');
  return `${mm}/${dd}/${yyyy}`;
}

// ─── RUTA: POST /api/generar-orden  (Orden de Trabajo) ───────
app.post('/api/generar-orden', async (req, res) => {
  try {
    const rawData = req.body.datos || req.body;
    
    const todayStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    
    // Mapeo exacto solicitado por el usuario
    const datos = {
      "fecha_orden": todayStr,
      "comprador_1": rawData.comprador?.nombre || '',
      "comprador_2": rawData.comprador?.segundoNombre || '',
      "telefono": rawData.comprador?.telefono || '',
      "email": rawData.comprador?.email || '',
      "direccion": rawData.comprador?.direccion || '',
      "ciudad": rawData.comprador?.ciudad || '',
      "estado": rawData.comprador?.estado || '',
      "zip": rawData.comprador?.zipCode || '',

      "equipo_softener": rawData.equipos?.suavizadorCasa_entera ? 'X' : '',
      "equipo_ro": rawData.equipos?.osmosisReverso ? 'X' : '',
      "equipo_alkaline": rawData.equipos?.aguaAlcalina ? 'X' : '',
      "equipo_well": rawData.equipos?.aguaPozo ? 'X' : '',
      "equipo_otro_texto": rawData.equipos?.otros || '',

      "fecha_inst": formatDateUS(rawData.instalacion?.fechaEstimada),
      "num_personas": rawData.instalacion?.personasEnCasa || '',
      "piso_elevado": rawData.instalacion?.tipoPiso === 'Raised' ? 'X' : '',
      "piso_concreto": rawData.instalacion?.tipoPiso === 'Concrete-slab' ? 'X' : '',
      "icemaker_yes": rawData.instalacion?.conexionRefrigerador === 'Yes' ? 'X' : '',
      "icemaker_no": rawData.instalacion?.conexionRefrigerador === 'No' ? 'X' : '',
      "hora_9_2": rawData.instalacion?.horario === '9:00am-2:00pm' ? 'X' : '',
      "hora_2_6": rawData.instalacion?.horario === '2:00pm-6:00pm' ? 'X' : '',
      "dureza": rawData.instalacion?.granossDureza || '',
      "instrucciones": rawData.instalacion?.instruccionesEspeciales || '',

      "precio_contado": rawData.finanzas?.precioContado || '',
      "instalacion": rawData.finanzas?.instalacion || '',
      "total_contado": rawData.finanzas?.precioContado || '',
      "cuota_inicial": rawData.finanzas?.cuotaInicial || '',
      "saldo_financiado": rawData.finanzas?.saldo_financiado || '',
      "cantidad_financiar": rawData.finanzas?.cantidad_financiar || '',
      "terminos_pago": rawData.finanzas?.terminos_pago || '',
      "apr": rawData.finanzas?.apr || '',
      "cargos_financieros": rawData.finanzas?.cargosFinancieros || '',
      "total_pagos": rawData.finanzas?.totalPagos || '',

      "cc_monto": rawData.finanzas?.tarjetaMonto || '',
      "cc_num": rawData.finanzas?.tarjetaNumero || '',
      "cc_exp": rawData.finanzas?.tarjetaExpiracion || '',
      "cc_cvv": rawData.finanzas?.tarjetaCvv || '',

      "firma_comp1": rawData.firmas?.comprador || '',
      "firma_comp2": rawData.firmas?.comprador_2 || '',
      "nombre_rep": rawData.nombre_dealer || '',
      "firma_rep": rawData.firmas?.representante || '',

      "fecha_c1": todayStr,
      "fecha_c2": todayStr,
      "fecha_rep": todayStr,
      "proyectoId": rawData.proyectoId
    };

    const pdfBytes = await generarPDF('molde_orden_v3.pdf', datos);

    // 1. Subir PDF a Supabase Storage
    const fileName = `ordenes/orden_trabajo_${Date.now()}_${Math.round(Math.random() * 1E9)}.pdf`;
    const { error: uploadError } = await supabase.storage
        .from('archivos_renew')
        .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });

    let finalUrl = null;
    if (uploadError) {
        console.error('[STORAGE ERROR]', uploadError);
    } else {
        const { data: { publicUrl } } = supabase.storage.from('archivos_renew').getPublicUrl(fileName);
        finalUrl = publicUrl.replace('api-renew', 'files-renew').replace('/storage/v1/', '/');
        
        // 2. Actualizar la nueva columna en clientes_maestro (orden_trabajo_url)
        if (datos.proyectoId) {
            const { error: dbError } = await supabase
              .from('clientes_maestro')
              .update({ orden_trabajo_url: finalUrl }) // Asumimos que esta columna existe o puede recibirlo si hay update dinamico, pero en Supabase debe existir.
              .eq('id', datos.proyectoId);
            
            if (dbError) console.error('[DB UPDATE ERROR]', dbError);
            else console.log(`[SUPABASE] Cliente ${datos.proyectoId} actualizado con orden de trabajo: ${finalUrl}`);
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
      // Exponer el header explícitamente para CORS si es necesario
      res.setHeader('Access-Control-Expose-Headers', 'X-Document-Url');
      res.setHeader('X-Document-Url', finalUrl);
    }
    return res.status(200).send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('[/api/generar-orden] Error:', error);
    return res.status(500).json({ error: 'Error al generar la Orden de Trabajo', detalle: error.message });
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
  console.log(`  ║   🌊 RENEW WATER — Portal de Contratos   ║`);
  console.log(`  ║   Servidor activo en el puerto ${PORT}       ║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`  → Local:    http://localhost:${PORT}`);
  console.log(`  → API PDF:  POST http://localhost:${PORT}/api/generar-pdf`);
  console.log(`  → API WO:   POST http://localhost:${PORT}/api/generar-orden`);
  console.log('');
});

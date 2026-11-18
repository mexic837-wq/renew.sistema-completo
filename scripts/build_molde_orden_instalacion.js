// Genera orden_instalacion_molde.pdf a partir del molde de Confirmación de Instalación (v2):
//  · Conserva logo, encabezado y datos básicos del comprador (fecha, comprador, teléfono, e-mail, dirección, ciudad, estado, zip)
//  · Cambia el título de la franja a INSTALLATION ORDER / ORDEN DE INSTALACION
//  · Reemplaza el resto por: fecha y hora, técnico, representante, tipo de equipo (ciudad / pozo) con detalle,
//    datos del pozo, instrucciones y nombre/firma del cliente.
// Uso: node scripts/build_molde_orden_instalacion.js
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'confirmacion_instalacion_water_molde_v2.pdf');
const OUT = path.join(ROOT, 'orden_instalacion_molde.pdf');

const INK = rgb(0.14, 0.12, 0.13);
const MUTED = rgb(0.42, 0.45, 0.5);
const WHITE = rgb(1, 1, 1);
const TEAL = rgb(78 / 255, 178 / 255, 178 / 255);
const TEAL_BG = rgb(0.93, 0.97, 0.97);

const QUITAR = [
  'instalador', 'fecha_instalacion', 'representante_ventas',
  'costo_instalacion', 'costo_millas', 'costo_extra', 'costo_otro', 'costo_total',
  'firma_comprador', 'fecha_firma', 'obs_yes', 'obs_no', 'obs_iniciales',
  'chk_water_treatment', 'chk_reverse_osmosis', 'chk_well_water',
];

(async () => {
  const doc = await PDFDocument.load(fs.readFileSync(SRC));
  const page = doc.getPages()[0];
  const form = doc.getForm();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const name of QUITAR) { try { form.removeField(form.getField(name)); } catch (_) {} }
  // Dirección y ciudad suelen ser largas: letra más chica para que no se corten
  for (const [n, sz] of [['direccion', 8], ['ciudad', 7]]) { try { form.getTextField(n).setFontSize(sz); } catch (_) {} }

  const text = (t, x, y, { font = regular, size = 11, center = false, color = INK } = {}) => {
    const w = font.widthOfTextAtSize(t, size);
    page.drawText(t, { x: center ? x - w / 2 : x, y, size, font, color });
    return w;
  };
  const line = (x1, x2, y) => page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.8, color: INK });
  const field = (name, x, y, w, h, size = 11, multiline = false) => {
    const f = form.createTextField(name);
    if (multiline) f.enableMultiline();
    f.addToPage(page, { x, y, width: w, height: h, borderWidth: 0, borderColor: undefined, backgroundColor: undefined });
    f.setFontSize(size);
  };
  // Etiqueta + línea + campo en la misma fila
  const fila = (etiqueta, name, x, y, xFin) => {
    const w = text(etiqueta, x, y, { font: bold, size: 10.5 });
    line(x + w + 6, xFin, y - 2);
    field(name, x + w + 8, y - 1, xFin - (x + w + 8), 14, 11);
  };
  const seccion = (titulo, y) => {
    page.drawRectangle({ x: 40, y: y - 5, width: 532, height: 19, color: TEAL_BG });
    page.drawRectangle({ x: 40, y: y - 5, width: 4, height: 19, color: TEAL });
    text(titulo, 52, y, { font: bold, size: 11 });
  };
  const casilla = (name, x, y) => {
    page.drawRectangle({ x, y: y - 3, width: 14, height: 14, borderColor: INK, borderWidth: 0.9, color: WHITE });
    field(name, x + 1, y - 2, 12, 12, 11);
  };
  const caja = (name, x, y, w, h) => {
    page.drawRectangle({ x, y, width: w, height: h, borderColor: INK, borderWidth: 0.9, color: WHITE });
    field(name, x + 5, y + 3, w - 10, h - 6, 10, true);
  };

  // ── Franja del título (degradado turquesa → verde) ──
  const A = [78, 178, 178], B = [180, 206, 105], X0 = 17, X1 = 592;
  for (let x = 100; x < 532; x += 2) {
    const t = (x - X0) / (X1 - X0);
    const c = A.map((v, i) => (v + (B[i] - v) * t) / 255);
    page.drawRectangle({ x, y: 673, width: 2.5, height: 17, color: rgb(c[0], c[1], c[2]) });
  }
  text('INSTALLATION ORDER / ORDEN DE INSTALACION', 306, 678, { font: bold, size: 11.5, center: true });

  // ── Borrar todo lo que está debajo de los datos básicos ──
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 578, color: WHITE });

  // ── 1. Instalación ──
  seccion('INSTALLATION / INSTALACION', 548);
  fila('Installation date / Fecha:', 'inst_fecha', 40, 518, 300);
  fila('Time / Hora:', 'inst_hora', 316, 518, 572);
  fila('Technician / Técnico:', 'tecnico', 40, 494, 300);
  fila('Tech phone / Tel.:', 'tecnico_tel', 316, 494, 572);
  fila('Sales representative / Representante de ventas:', 'representante', 40, 470, 572);

  // ── 2. Tipo de equipo ──
  seccion('EQUIPMENT TYPE / TIPO DE EQUIPO', 436);
  casilla('chk_ciudad', 40, 408);
  text('City water equipment / Equipo de ciudad', 60, 408, { font: bold, size: 10.5 });
  casilla('chk_pozo', 316, 408);
  text('Well water equipment / Equipo de pozo', 336, 408, { font: bold, size: 10.5 });

  text('Equipment details / Especifique el equipo:', 40, 384, { font: bold, size: 10.5 });
  caja('equipo_detalle', 40, 314, 532, 62);

  text('Well data / Datos del pozo (solo equipo de pozo):', 40, 296, { font: bold, size: 10.5 });
  caja('pozo_detalle', 40, 226, 532, 62);

  // ── 3. Instrucciones ──
  text('Special instructions / Instrucciones especiales:', 40, 208, { font: bold, size: 10.5 });
  caja('instrucciones', 40, 150, 532, 50);

  // ── 4. Cliente ──
  seccion('CUSTOMER / CLIENTE', 118);
  fila('Customer name / Nombre del cliente:', 'cliente_nombre', 40, 88, 572);
  text('Customer signature / Firma del cliente:', 40, 58, { font: bold, size: 10.5 });
  line(250, 572, 56);
  text('Generado automáticamente por la plataforma Renew al asignar el técnico.', 306, 26, { size: 8, center: true, color: MUTED });

  fs.writeFileSync(OUT, await doc.save());
  console.log('Molde generado:', OUT, `(${form.getFields().length} campos)`);
})();

// Genera extras_instalacion_molde.pdf a partir del molde de Confirmación de Instalación (v2):
//  · Conserva logo, encabezado y datos básicos del comprador (fecha, comprador, teléfono, e-mail, dirección, ciudad, estado, zip)
//  · Cambia el título de la franja a EXTRAS OF INSTALLATION / EXTRAS DE INSTALACION
//  · Reemplaza el resto de la hoja por: Millas, Trabajo extra, Días y monto, Total
// Uso: node scripts/build_molde_extras_instalacion.js
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'confirmacion_instalacion_water_molde_v2.pdf');
const OUT = path.join(ROOT, 'extras_instalacion_molde.pdf');

const INK = rgb(0.14, 0.12, 0.13);
const WHITE = rgb(1, 1, 1);

// Campos del molde de confirmación que no se usan aquí
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

  const text = (t, x, y, { font = regular, size = 11, center = false } = {}) => {
    const w = font.widthOfTextAtSize(t, size);
    page.drawText(t, { x: center ? x - w / 2 : x, y, size, font, color: INK });
    return w;
  };
  const line = (x1, x2, y) => page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.8, color: INK });
  const field = (name, x, y, w, h, size = 11, multiline = false) => {
    const f = form.createTextField(name);
    if (multiline) f.enableMultiline();
    f.addToPage(page, { x, y, width: w, height: h, borderWidth: 0, borderColor: undefined, backgroundColor: undefined });
    f.setFontSize(size);
  };

  // ── Franja del título: se repinta el degradado (turquesa → verde) y se escribe el nuevo título ──
  const A = [78, 178, 178], B = [180, 206, 105], X0 = 17, X1 = 592;
  for (let x = 100; x < 532; x += 2) {
    const t = (x - X0) / (X1 - X0);
    const c = A.map((v, i) => (v + (B[i] - v) * t) / 255);
    page.drawRectangle({ x, y: 673, width: 2.5, height: 17, color: rgb(c[0], c[1], c[2]) });
  }
  text('EXTRAS OF INSTALLATION / EXTRAS DE INSTALACION', 306, 678, { font: bold, size: 11.5, center: true });

  // ── Borrar todo lo que está debajo de los datos básicos ──
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 578, color: WHITE });

  // ── Contenido nuevo ──
  text('EXTRAS / EXTRAS', 306, 540, { font: bold, size: 14, center: true });
  line(40, 572, 530);

  const dinero = (en, es, name, y, grosor = false) => {
    const f = grosor ? bold : regular;
    text(`${en} / ${es}:`, 40, y, { font: bold, size: 12 });
    text('$', 200, y, { font: f, size: 12 });
    line(212, 372, y - 2);
    field(name, 214, y - 1, 156, 15, 12);
  };
  dinero('Miles', 'Millas', 'extras_millas', 480);
  dinero('Extra work', 'Trabajo extra', 'extras_trabajo', 440);

  text('Days and amount / Días y monto:', 40, 396, { font: bold, size: 12 });
  page.drawRectangle({ x: 40, y: 290, width: 532, height: 94, borderColor: INK, borderWidth: 0.9, color: WHITE });
  field('extras_dias_monto', 46, 294, 520, 86, 11, true);

  text('TOTAL:', 40, 245, { font: bold, size: 14 });
  text('$', 200, 245, { font: bold, size: 14 });
  line(212, 372, 243);
  field('extras_total', 214, 244, 156, 17, 13);

  fs.writeFileSync(OUT, await doc.save());
  console.log('Molde generado:', OUT, `(${form.getFields().length} campos)`);
})();

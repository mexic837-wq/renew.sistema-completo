// Genera confirmacion_instalacion_water_molde_v2.pdf a partir del molde actual:
//  · Observaciones: las 3 preguntas se unen en una sola confirmación con Yes/No + iniciales
//  · Equipos instalados: solo tratamiento para toda la casa, ósmosis inversa y pozo (con # de serie)
// El resto del PDF (encabezado, logo, colores, costos y firma) no se toca.
// Uso: node scripts/build_molde_confirmacion_v2.js
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, TextAlignment, rgb } = require('pdf-lib');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'confirmacion_instalacion_water_molde.pdf');
const OUT = path.join(ROOT, 'confirmacion_instalacion_water_molde_v2.pdf');

const INK = rgb(0.14, 0.12, 0.13);   // mismo negro del diseño original

// Campos del molde anterior que pertenecen a las zonas que se rediseñan
const OLD_FIELDS = [
  'p1_yes', 'p1_no', 'p2_yes', 'p2_no', 'p3_yes', 'p3_no', 'iniciales_1', 'iniciales_2', 'iniciales_3',
  'chk_agua_municipal', 'chk_ice_maker', 'chk_water_treatment', 'hk_reverse_osmosis', 'chk_well_water',
  'chk_ultraviolet', 'chk_big_blue', 'chk_spin_down', 'chk_other_equip',
  'serial_water', 'serial_ro', 'serial_well', 'other_equip_text',
];

(async () => {
  const doc = await PDFDocument.load(fs.readFileSync(SRC));
  const page = doc.getPages()[0];
  const form = doc.getForm();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Corrige el molde anterior: "ciudad" tenía un segundo widget sobre la línea de e-mail y no existía "email"
  form.removeField(form.getField('ciudad'));
  for (const [name, x, y, w, h] of [['ciudad', 364, 600, 45, 16], ['email', 355, 620, 217, 15]]) {
    const f = form.createTextField(name);
    f.addToPage(page, { x, y, width: w, height: h, borderWidth: 0, borderColor: undefined, backgroundColor: undefined });
    f.setFontSize(name === 'ciudad' ? 8 : 11);
  }

  for (const name of OLD_FIELDS) {
    try { form.removeField(form.getField(name)); } catch (_) {}
  }

  const width = (t, f, s) => f.widthOfTextAtSize(t, s);
  const text = (t, x, y, { font = regular, size = 9, center = false } = {}) => {
    const w = width(t, font, size);
    page.drawText(t, { x: center ? x - w / 2 : x, y, size, font, color: INK });
    return w;
  };
  const box = (x, y, s = 10) => page.drawRectangle({ x, y, width: s, height: s, borderColor: INK, borderWidth: 0.9 });
  const line = (x1, x2, y) => page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.7, color: INK });
  const field = (name, x, y, w, h, size = 9, center = false) => {
    const f = form.createTextField(name);
    f.addToPage(page, { x, y, width: w, height: h, borderWidth: 0, borderColor: undefined, backgroundColor: undefined });
    f.setFontSize(size);
    if (center) f.setAlignment(TextAlignment.Center);
  };

  // ── Borrar zonas a rediseñar (fondo blanco del original) ──
  page.drawRectangle({ x: 6, y: 241, width: 600, height: 131, color: rgb(1, 1, 1) });   // 3 preguntas
  page.drawRectangle({ x: 28, y: 125, width: 372, height: 117, color: rgb(1, 1, 1) });   // lista de equipos

  // ── OBSERVACIONES: una sola confirmación ──
  const cx = 306;
  text('The customer confirms that they: / El cliente confirma que:', cx, 356, { font: bold, size: 11, center: true });
  const items = [
    'Were taught how to program the L.E.D. display / Se le enseñó a programar el cabezal (pantalla L.E.D.)',
    'Agree with the location where the system was installed / Está de acuerdo con el lugar donde se instaló el sistema',
    'Were informed how to protect the system in case of freezing / Se le informó cómo proteger el sistema en caso de congelamiento',
  ];
  const itemW = Math.max(...items.map(t => width('1.  ' + t, regular, 9)));
  const ix = cx - itemW / 2;
  items.forEach((t, i) => text(`${i + 1}.  ${t}`, ix, 339 - i * 15, { size: 9 }));

  // Fila Yes / No / Iniciales (misma disposición que el original)
  const ry = 274;
  text('Yes', 168, ry + 1.5, { size: 10.5 });
  box(189, ry);
  text('No', 216, ry + 1.5, { size: 10.5 });
  box(231, ry);
  text('x', 272, ry + 1.5, { size: 10.5 });
  line(282, 334, ry);
  text('Customer Initials (Iniciales)', 337, ry + 1.5, { size: 10.5 });
  field('obs_yes', 189, ry, 10, 10, 9, true);
  field('obs_no', 231, ry, 10, 10, 9, true);
  field('obs_iniciales', 284, ry + 1, 48, 11, 9, true);

  // ── EQUIPOS INSTALADOS ──
  const equipos = [
    ['chk_water_treatment', 'serial_water', 'WHOLE HOUSE WATER TREATMENT SYSTEM', 'Sistema de tratamiento de agua para toda la casa'],
    ['chk_reverse_osmosis', 'serial_ro', 'REVERSE OSMOSIS SYSTEM', 'Sistema de ósmosis inversa'],
    ['chk_well_water', 'serial_well', 'WELL WATER SYSTEM', 'Sistema de agua de pozo'],
  ];
  // Mismo tamaño para las 3 etiquetas, sin invadir la columna de costos (x ≈ 400)
  const GAP = 5;
  let size = 9.5;
  while (equipos.some(([, , en, es]) => width(en + ' /', bold, size) + GAP + width(es, regular, size) > 335)) size -= 0.25;
  equipos.forEach(([chk, serial, en, es], i) => {
    const y = 224 - i * 36;
    box(39, y);
    field(chk, 39, y, 10, 10, 9, true);
    const w = text(en + ' /', 56, y + 1.5, { font: bold, size });
    text(es, 56 + w + GAP, y + 1.5, { size });
    text('Serial #:', 56, y - 14, { size: 9.5 });
    line(90, 230, y - 15.5);
    field(serial, 92, y - 15, 136, 11, 9);
  });

  fs.writeFileSync(OUT, await doc.save());
  console.log('Molde generado:', OUT, `(${form.getFields().length} campos)`);
})();

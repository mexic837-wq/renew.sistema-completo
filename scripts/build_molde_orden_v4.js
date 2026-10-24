// Genera FORMULARIO-RENEW-WATER-main/molde_orden_v4.pdf a partir del PDF oficial
// (orden_trabajo_oficial.pdf), agregando campos de formulario sobre cada línea/casilla.
// Uso: node scripts/build_molde_orden_v4.js
const fs = require('fs');
const path = require('path');
const { PDFDocument, TextAlignment } = require('pdf-lib');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'orden_trabajo_oficial.pdf');
const OUT = path.join(ROOT, 'FORMULARIO-RENEW-WATER-main', 'molde_orden_v4.pdf');

// [nombre, x, y, ancho, alto, tamañoFuente, alineación]
// Coordenadas tomadas de las líneas y casillas del PDF oficial (pt, origen abajo-izquierda).
const TXT = [
  ['fecha_orden', 98, 701, 200, 10],
  ['telefono', 398, 701, 168, 10],
  ['comprador_1', 140, 683, 160, 10],
  ['email', 356, 683, 210, 10],
  ['direccion', 128, 665, 172, 10],
  ['ciudad', 376, 665, 54, 10, 8],
  ['estado', 462, 665, 28, 10, 8],
  ['zip', 535, 665, 32, 10, 8],
  ['tipo_linea', 273, 540, 73, 10, 8],
  ['producto_especifico', 523, 540, 44, 10, 7],
  ['equipo_otro_texto', 253, 525.5, 105, 10, 8],
  ['fecha_inst', 276, 450.5, 97, 10],
  ['instrucciones', 230, 428.5, 337, 10, 8],
  ['cuota_inicial', 197, 254, 66, 10],
  ['pago_otro_texto', 507, 254, 56, 10, 7],
  ['fecha_c1', 484, 131, 83, 10],
  ['fecha_c2', 484, 107, 83, 10],
  ['nombre_rep', 197, 83, 118, 10, 8],
  ['fecha_rep', 484, 83, 83, 10],
];

// Casillas: [nombre, x, y, lado]
const BOX = [
  ['terminos_previos', 30, 609, 8],
  ['equipo_softener', 30, 583, 8],
  ['equipo_ro', 30, 569, 8],
  ['equipo_alkaline', 30, 554, 8],
  ['agua_ciudad', 30, 540, 8],
  ['equipo_well', 30, 525, 8],
  ['equipo_otro', 188, 525, 8],
  ['hora_9_2', 413, 450, 8],
  ['hora_2_6', 486, 450, 8],
  ['pago_efectivo', 58, 274, 9],
  ['pago_financiado', 218, 274, 9],
  ['pago_tarjeta', 398, 274, 9],
  ['pago_inicial', 58, 254, 9],
  ['pago_otro', 290, 254, 9],
];

// Firmas (imagen PNG): [nombre, x, y, ancho, alto]
const SIG = [
  ['firma_comp1', 140, 130.5, 280, 21],
  ['firma_comp2', 140, 106.5, 280, 21],
  ['firma_rep', 320, 82.5, 108, 21],
];

(async () => {
  const doc = await PDFDocument.load(fs.readFileSync(SRC));
  const page = doc.getPages()[0];
  const form = doc.getForm();
  const noBorder = { borderWidth: 0, borderColor: undefined, backgroundColor: undefined };

  for (const [name, x, y, width, height, size = 9] of TXT) {
    const f = form.createTextField(name);
    f.addToPage(page, { x, y, width, height, ...noBorder });
    f.setFontSize(size);
  }
  for (const [name, x, y, s] of BOX) {
    const f = form.createTextField(name);
    f.addToPage(page, { x, y, width: s, height: s, ...noBorder });
    f.setFontSize(s - 1);
    f.setAlignment(TextAlignment.Center);
  }
  for (const [name, x, y, width, height] of SIG) {
    const f = form.createTextField(name);
    f.addToPage(page, { x, y, width, height, ...noBorder });
  }

  fs.writeFileSync(OUT, await doc.save());
  console.log('Molde generado:', OUT, `(${TXT.length + BOX.length + SIG.length} campos)`);
})();

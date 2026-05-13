const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function run() {
  const p = path.join(__dirname, '..', 'confirmacion_instalacion_water.pdf');
  const buf = fs.readFileSync(p);
  const doc = await PDFDocument.load(buf);
  const form = doc.getForm();
  const fields = form.getFields();
  console.log('Fields in confirmacion_instalacion_water.pdf (' + fields.length + ' total):');
  fields.forEach(function(f) {
    var name = f.getName();
    var val = '';
    try { val = f.getText() || ''; } catch(e) {}
    var type = f.constructor.name;
    console.log('  - ' + name + ' [' + type + ']');
  });
}

run().catch(function(e) { console.error(e); });

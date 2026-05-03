const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function listFields(pdfPath) {
    const bytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(bytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    console.log(`Fields for ${path.basename(pdfPath)}:`);
    fields.forEach(f => console.log(`- ${f.getName()}`));
}

async function run() {
    try {
        await listFields('RECIBO_PAGO_ANALISTA.pdf');
        console.log('\n');
        await listFields('RECIBO_INSTALACION.pdf');
    } catch (e) {
        console.error(e);
    }
}

run();

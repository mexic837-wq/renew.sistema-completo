const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function checkPdf(pdfPath) {
    const bytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(bytes);
    console.log(`${pdfPath}: Pages = ${pdfDoc.getPageCount()}`);
    const form = pdfDoc.getForm();
    console.log(`${pdfPath}: Fields count = ${form.getFields().length}`);
}

checkPdf('RECIBO_PAGO_ANALISTA.pdf');
checkPdf('RECIBO_INSTALACION.pdf');

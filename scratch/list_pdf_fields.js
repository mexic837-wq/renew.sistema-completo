const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function listFields() {
    const folder = 'c:\\Users\\LENOVO\\Downloads\\renew-sistema-completo-main\\renew.sistema-completo-main\\CONTRATO-RENEW-WATER';
    const pdfPath = path.join(folder, 'molde_contrato.pdf');
    
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    console.log(`Fields in molde_contrato.pdf:`);
    fields.forEach(field => {
        const name = field.getName();
        let value = '';
        try { value = field.getText() || ''; } catch(e) {}
        console.log(`- ${name}: "${value}"`);
    });
}

listFields().catch(err => console.error(err));

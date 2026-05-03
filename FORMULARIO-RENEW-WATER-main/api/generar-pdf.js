import { PDFDocument } from 'pdf-lib';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  try {
    // 1. Asegurar parseo del JSON
    let bodyData = req.body;
    if (typeof bodyData === 'string') {
      bodyData = JSON.parse(bodyData);
    }
    const datos = bodyData.datos || bodyData;

    // 2. Descargar el molde público
    const protocolo = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const urlMolde = `${protocolo}://${host}/molde_credito_v9.pdf`;
    
    const fetchResponse = await fetch(urlMolde);
    if (!fetchResponse.ok) {
      throw new Error(`No se pudo descargar el molde desde ${urlMolde}`);
    }

    const pdfArrayBuffer = await fetchResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfArrayBuffer);
    const form = pdfDoc.getForm();

    // 3. Llenar los campos dinámicamente o estampar imágenes
    for (const [key, value] of Object.entries(datos)) {
      try {
        const field = form.getTextField(key.trim());
        if (!field) continue;

        if (typeof value === 'string' && value.startsWith('data:image/png;base64,')) {
          // Es una firma digital
          const base64Data = value.split(',')[1];
          const imageBytes = Buffer.from(base64Data, 'base64');
          const pngImage = await pdfDoc.embedPng(imageBytes);
          
          // Obtener las coordenadas del campo de texto
          const widgets = field.acroField.getWidgets();
          const widget = widgets[0];
          const rect = widget.getRectangle();
          
          // Buscar en qué página está este campo
          const pages = pdfDoc.getPages();
          let pageOfField = pages[0]; // Por defecto la página 1
          for (const p of pages) {
            if (p.ref === widget.P()) {
              pageOfField = p;
              break;
            }
          }
          
          // Dibujar la firma ajustada al tamaño del cuadro
          pageOfField.drawImage(pngImage, {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          });
          
          // Borrar el texto del campo para que no estorbe
          field.setText('');
        } else {
          // Es un texto normal
          field.setText(value ? String(value) : '');
        }
      } catch (err) {
        console.log(`Campo omitido o no es un text field: ${key}`);
      }
    }

    // 4. Aplanar y guardar
    form.flatten();
    const pdfBytes = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="contrato_generado.pdf"');
    return res.status(200).send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Error interno:', error);
    return res.status(500).json({ error: 'Fallo interno', detalle: error.message });
  }
}

const fs = require('fs');
const path = require('path');

// --- 1. ACTUALIZAR ADMIN-APP.JS (Ortografía y Apertura de PDF) ---
const adminPath = path.join(__dirname, '..', 'js', 'admin-app.js');
let ac = fs.readFileSync(adminPath, 'utf8');

// Corregir ortografía global en el admin
ac = ac.replace(/Recibo de Pago - Vendedor/g, 'Recibo de Pago - Vendedor');
ac = ac.replace(/Recibo de Pago - Tecnico/g, 'Recibo de Pago - Técnico');
ac = ac.replace(/Recibo de Instalacin/g, 'Recibo de Instalación');

// Modificar la visualización de recibos para que abra el PDF
const oldVerRecibo = 'function _showReciboDetail(recibo) {';
const newVerRecibo = `function _showReciboDetail(recibo) {
  if (recibo.pdf_url) {
    window.open(recibo.pdf_url, '_blank');
  } else {
    // Fallback si el PDF aún no se genera
    alert('El PDF se está generando, por favor espera unos segundos y vuelve a intentar.');
  }`;

ac = ac.replace(oldVerRecibo, newVerRecibo);

fs.writeFileSync(adminPath, ac, 'utf8');

// --- 2. ACTUALIZAR PROJECTDETAIL.JS (Ortografía y UX) ---
const pPath = path.join(__dirname, '..', 'js', 'screens', 'projectDetail.js');
let pc = fs.readFileSync(pPath, 'utf8');

pc = pc.replace(/Recibo de apgo/g, 'Recibo de Pago');
pc = pc.replace(/Recibo de Instalacin/g, 'Recibo de Instalación');
pc = pc.replace(/Recibo de Pago - Vendedor/g, 'Recibo de Pago - Vendedor');

// Cambiar el comportamiento del botón de recibo completado
pc = pc.replace(
    "if (openBtn) { openBtn.disabled = true; openBtn.textContent = '✓ Recibo Completado'; openBtn.style.opacity = '0.7'; }",
    "if (openBtn) { \n          openBtn.textContent = '📄 Ver PDF Generado'; \n          openBtn.onclick = () => { \n            const db = getDB(); \n            const r = (db.Recibos_Pagos || []).find(x => x.proyecto_id === dealId && x.tipo === (isVendedor ? 'vendedor' : 'tecnico'));\n            if (r && r.pdf_url) window.open(r.pdf_url, '_blank');\n            else alert('El PDF se está procesando. Estará listo en breve.');\n          };\n        }"
);

fs.writeFileSync(pPath, pc, 'utf8');

console.log('PDF interconectado y ortografía corregida.');

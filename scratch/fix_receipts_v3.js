const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'js', 'screens', 'projectDetail.js');
let c = fs.readFileSync(filePath, 'utf8');

// 1. Corregir Ortografía y añadir campos en _abrirReciboModal
c = c.replace(
    'const tecnicoAsignado = (db.Usuarios || []).find(u => u.id === deal.asignado_a);',
    'const tecnicoAsignado = (db.Usuarios || []).find(u => u.id === deal.tecnico_id || (u.id === deal.asignado_a && (u.rol === "tecnico" || u.rol === "técnico")));'
);

// 2. Actualizar el constructor del formulario de Vendedor para incluir Customer Name
const buildVendedorOld = 'function _buildFormVendedor(vendedorNom = "", tecnicoNom = "", clienteNom = "") {';
const buildVendedorNew = 'function _buildFormVendedor(vendedorNom = "", tecnicoNom = "", clienteNom = "") {\n  const st = "background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text-primary);font-size:0.82rem;width:100%;";\n  const today = new Date().toISOString().split("T")[0];\n  const field = (lbl, id, type="text", ph="", val="") => `\n    <div style="margin-bottom:12px;">\n      <label style="font-size:0.68rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:5px;">${lbl}</label>\n      <input type="${type}" id="${id}" placeholder="${ph}" value="${val}" style="${st}"/>\n    </div>`;\n  const sep = txt => `<p style="font-size:0.65rem;font-weight:900;color:#3b82f6;text-transform:uppercase;letter-spacing:1.5px;margin:16px 0 10px;padding-top:14px;border-top:1px solid var(--border);">${txt}</p>`;\n  return `\n    ${sep("INFORMACIÓN PRINCIPAL")}\n    ${field("Customer Name","rec-customer-name","text","Nombre del cliente", clienteNom)}\n    ${field("Sales Representative","rec-sales-rep","text","Nombre del vendedor", vendedorNom)}`;';

// Reemplazar el bloque completo de _buildFormVendedor para evitar conflictos de encoding
const startV = c.indexOf('function _buildFormVendedor');
const endV = c.indexOf('function _buildFormTecnico');
if (startV !== -1 && endV !== -1) {
    const middleContent = `function _buildFormVendedor(vendedorNom = "", tecnicoNom = "", clienteNom = "") {
  const st = 'background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text-primary);font-size:0.82rem;width:100%;';
  const today = new Date().toISOString().split('T')[0];
  const field = (lbl, id, type='text', ph='', val='') => \`
    <div style="margin-bottom:12px;">
      <label style="font-size:0.68rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:5px;">\${lbl}</label>
      <input type="\${type}" id="\${id}" placeholder="\${ph}" value="\${val}" style="\${st}"/>
    </div>\`;
  const sep = txt => \`<p style="font-size:0.65rem;font-weight:900;color:#3b82f6;text-transform:uppercase;letter-spacing:1.5px;margin:16px 0 10px;padding-top:14px;border-top:1px solid var(--border);">\${txt}</p>\`;
  return \`
    \${sep('INFORMACIÓN PRINCIPAL')}
    \${field('Customer Name','rec-customer-name','text','Nombre del cliente', clienteNom)}
    \${field('Sales Representative','rec-sales-rep','text','Nombre del vendedor', vendedorNom)}
    \${field('Check Number','rec-check-number','text','# de cheque')}
    \${field('Transfer Date','rec-transfer-date','date','',today)}
    \${field('Finance Company','rec-finance','text','Empresa financiera')}
    \${sep('Montos')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      \${field('Sales Amount ($)','rec-sales-amount','number','0.00')}
      \${field('Aprobación (%)','rec-aprobacion-pct','number','100')}
    </div>
    \${field('Monto Aprobación ($)','rec-monto-aprobacion','number','0.00')}
    \${sep('Costos')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      \${field('Cost ($)','rec-cost','number','0.00')}
      \${field('Costo Plan (%)','rec-costo-plan-pct','number','2')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      \${field('Total Costo ($)','rec-total-costo','number','0.00')}
      \${field('Total Analista ($)','rec-total-analista','number','0.00')}
    </div>
    \${field('LÍNEA POZO','rec-linea-pozo','text','Opcional')}
    \${sep('Extra Charges')}
    <div id="extra-charges-container">
      <div class="extra-charge-row" style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:6px;"><input type="text" placeholder="MILLAS" style="\${st}" value="MILLAS"/><input type="number" placeholder="0" style="\${st}" value="0"/></div>
      <div class="extra-charge-row" style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:6px;"><input type="text" placeholder="EXTRA" style="\${st}" value="EXTRA"/><input type="number" placeholder="0" style="\${st}" value="0"/></div>
    </div>
    \${sep('Deductions')}
    <div id="deductions-container">
      <div class="deduction-row" style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:6px;"><input type="text" placeholder="Bono" style="\${st}" value="Bono"/><input type="number" placeholder="0" style="\${st}" value="0"/></div>
      <div class="deduction-row" style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:6px;"><input type="text" placeholder="Reversa" style="\${st}" value="Reversa"/><input type="number" placeholder="0" style="\${st}" value="0"/></div>
    </div>
    \${sep('Instalador & Credits')}
    \${field('Nombre del Instalador','rec-instalador','text','Nombre del técnico', tecnicoNom)}
    <div id="credits-container">
      <div class="credit-row" style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:6px;"><input type="text" placeholder="Transfer" style="\${st}" value="Transfer"/><input type="number" placeholder="0" style="\${st}" value="0"/></div>
      <div class="credit-row" style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:6px;"><input type="text" placeholder="Adicional" style="\${st}" value="Adicional"/><input type="number" placeholder="0" style="\${st}" value="0"/></div>
    </div>
    \${sep('Total')}
    \${field('GRAND TOTAL ($)','rec-grand-total','number','0.00')}
  \`;
}\n\n`;
    c = c.substring(0, startV) + middleContent + c.substring(endV);
}

// 3. Asegurar que al guardar el recibo, use el valor de rec-customer-name si existe
c = c.replace(
    'customer_name: clienteNom,',
    'customer_name: g("customer-name") || clienteNom,'
);

fs.writeFileSync(filePath, c, 'utf8');
console.log('projectDetail.js actualizado con Customer Name y mejoras de auto-relleno.');

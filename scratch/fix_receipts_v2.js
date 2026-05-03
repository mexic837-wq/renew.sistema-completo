const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'js', 'screens', 'projectDetail.js');
let c = fs.readFileSync(filePath, 'utf8');

// 1. Asegurar que las importaciones necesarias están al inicio del archivo
// (Normalmente ya están, pero vamos a forzar que getCurrentUser esté disponible)
if (!c.includes('getCurrentUser')) {
    c = c.replace("import {", "import { getCurrentUser,");
}

// 2. Reescribir _abrirReciboModal para que sea robusta
const newModalFunc = `window._abrirReciboModal = async function(campoId, tipo, dealId) {
  const isVendedor = tipo === 'Recibo Vendedor';
  const existingModal = document.getElementById('modal-recibo-dinamico');
  if (existingModal) existingModal.remove();

  // Importar herramientas necesarias
  const { getDB, saveRecibo, getCurrentUser } = await import('../api.js');
  const db = getDB();
  const user = getCurrentUser() || {};
  const deal = (db.Proyectos_Dinamicos || []).find(p => p.id === dealId) || {};
  const cli  = (db.Clientes_Maestro || []).find(c => c.id === deal.cliente_id) || {};
  const tecnicoAsignado = (db.Usuarios || []).find(u => u.id === deal.asignado_a);
  
  const tecnicoNom = tecnicoAsignado ? (tecnicoAsignado.nombre + " " + (tecnicoAsignado.apellido || "")) : "";
  const vendedorNom = (user.nombre || "") + " " + (user.apellido || "");
  const clienteNom = cli.nombre || deal.nombre_cliente || "";

  const modal = document.createElement('div');
  modal.id = 'modal-recibo-dinamico';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = \`
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:24px;width:100%;max-width:550px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 48px rgba(0,0,0,0.4);animation:modalIn 0.3s ease-out;">
      <div style="padding:24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3 style="font-size:1.1rem;font-weight:900;color:var(--text-primary);margin:0;">\${isVendedor ? 'Recibo de Pago' : 'Recibo de Instalación'}</h3>
          <p style="font-size:0.75rem;color:var(--text-muted);margin:4px 0 0;">\${clienteNom}</p>
        </div>
        <button id="btn-close-recibo" style="background:var(--surface-alt);border:none;border-radius:12px;width:40px;height:40px;color:var(--text-primary);cursor:pointer;">✕</button>
      </div>
      <div id="recibo-form-fields" style="flex:1;overflow-y:auto;padding:24px;background:var(--bg-main);">
        \${isVendedor ? _buildFormVendedor(vendedorNom, tecnicoNom, clienteNom) : _buildFormTecnico(tecnicoNom, clienteNom)}
      </div>
      <div style="padding:24px;border-top:1px solid var(--border);display:flex;gap:12px;">
        <button id="btn-guardar-recibo" style="flex:1;background:var(--accent);color:white;border:none;border-radius:14px;padding:16px;font-weight:800;font-size:0.95rem;cursor:pointer;box-shadow:0 8px 16px var(--accent-alpha);">
          Guardar Recibo
        </button>
      </div>
    </div>\`;

  document.body.appendChild(modal);

  // Manejo de eventos
  modal.querySelector('#btn-close-recibo').onclick = () => modal.remove();
  
  if (!isVendedor) {
    modal.querySelector('#btn-add-item').onclick = () => {
      const container = modal.querySelector('#items-container');
      const row = document.createElement('div');
      row.className = 'item-row';
      row.style.cssText = 'display:grid;grid-template-columns:2fr 60px 1fr 80px 20px;gap:6px;margin-bottom:8px;align-items:center;';
      row.innerHTML = \`
        <input type="text" placeholder="Descripción..." style="background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text-primary);font-size:0.82rem;width:100%;"/>
        <input type="number" placeholder="1" value="1" style="background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text-primary);font-size:0.82rem;width:100%;"/>
        <input type="text" placeholder="Modelo" style="background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text-primary);font-size:0.82rem;width:100%;"/>
        <input type="number" placeholder="0.00" style="background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text-primary);font-size:0.82rem;width:100%;"/>
        <button type="button" onclick="this.closest('.item-row').remove()" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1.2rem;font-weight:900;">✕</button>\`;
      container.appendChild(row);
    };
  }

  modal.querySelector('#btn-guardar-recibo').onclick = async () => {
    const btn = modal.querySelector('#btn-guardar-recibo');
    btn.textContent = 'Guardando...';
    btn.disabled = true;
    
    try {
      const g = id => modal.querySelector('#rec-' + id)?.value || '';
      let datosJson = {};

      if (isVendedor) {
        const extraCharges = [...modal.querySelectorAll('.extra-charge-row')].map(r => {
          const [conc, monto] = r.querySelectorAll('input'); return { concepto: conc.value, monto: parseFloat(monto.value)||0 };
        }).filter(x => x.concepto);
        
        datosJson = {
          sales_representative: g('sales-rep'),
          check_number: g('check-number'),
          transfer_date: g('transfer-date'),
          customer_name: clienteNom,
          finance_company: g('finance'),
          sales_amount: parseFloat(g('sales-amount'))||0,
          aprobacion_pct: parseFloat(g('aprobacion-pct'))||0,
          monto_aprobacion: parseFloat(g('monto-aprobacion'))||0,
          cost: parseFloat(g('cost'))||0,
          costo_plan_pct: parseFloat(g('costo-plan-pct'))||0,
          total_costo: parseFloat(g('total-costo'))||0,
          linea_pozo: g('linea-pozo'),
          total_analista: parseFloat(g('total-analista'))||0,
          extra_charges: extraCharges,
          instalador: g('instalador'),
          grand_total: parseFloat(g('grand-total'))||0
        };
      } else {
        const items = [...modal.querySelectorAll('.item-row')].map(row => {
          const inputs = row.querySelectorAll('input');
          return { description: inputs[0].value, qty: parseFloat(inputs[1].value)||1, model: inputs[2].value, total: parseFloat(inputs[3].value)||0 };
        }).filter(i => i.description);
        
        datosJson = {
          installer_name: tecnicoNom,
          customer_name: clienteNom,
          address: cli.direccion || deal.direccion || '',
          date: g('date'),
          items,
          total_price: parseFloat(g('total-price'))||0
        };
      }

      const recibo = {
        proyecto_id: dealId,
        tipo: isVendedor ? 'vendedor' : 'tecnico',
        trabajador_id: user.id,
        trabajador_nombre: vendedorNom,
        cliente_nombre: clienteNom,
        direccion: cli.direccion || deal.direccion || '—',
        fecha_recibo: new Date().toISOString().split('T')[0],
        datos_json: datosJson
      };

      await saveRecibo(recibo);
      
      const hiddenField = document.getElementById('df_' + campoId);
      if (hiddenField) { hiddenField.value = 'Completado'; hiddenField.dispatchEvent(new Event('change')); }
      
      const wrap = document.getElementById('recibo-wrap-' + campoId);
      if (wrap) {
        const b = wrap.querySelector('button');
        if (b) { b.disabled = true; b.textContent = '✓ Recibo Completado'; b.style.opacity = '0.7'; }
      }

      const { showToast } = await import('../components/toast.js');
      showToast('Recibo guardado ✓', 'success');
      modal.remove();
      
    } catch(err) {
      console.error(err);
      btn.textContent = 'Guardar Recibo';
      btn.disabled = false;
    }
  };
};`;

// Buscar el inicio de la función vieja y reemplazar hasta el final de la misma
// Como la función creció mucho, buscaremos el inicio y el final de forma más precisa
const startIdx = c.indexOf('window._abrirReciboModal = function');
const endIdx = c.indexOf('function _buildFormVendedor');

if (startIdx !== -1 && endIdx !== -1) {
    c = c.substring(0, startIdx) + newModalFunc + '\n\n' + c.substring(endIdx);
}

// Limpiar tildes rotas una vez más
c = c.replace(/Informacin/g, 'Información');
c = c.replace(/tcnico/g, 'técnico');
c = c.replace(/Aprobacin/g, 'Aprobación');
c = c.replace(/Instalacin/g, 'Instalación');

fs.writeFileSync(filePath, c, 'utf8');
console.log('projectDetail.js reparado.');

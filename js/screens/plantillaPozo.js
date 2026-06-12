/* ============================================================
   RENEW OS - plantillaPozo.js
   Formulario: Plantilla Pozo (Renew Water)
   ============================================================ */
import { getCurrentUser, getDB } from '../api.js';
import { showToast } from '../components/toast.js';

export function renderPlantillaPozo() {
  const screen = document.getElementById('screen-plantilla-pozo');
  if (!screen) return;

  screen.innerHTML = `
  <style>
    .ci-header { position:sticky;top:0;z-index:10;background:var(--surface);border-bottom:1px solid var(--border);padding:14px 20px;display:flex;align-items:center;gap:12px; }
    .ci-back { width:38px;height:38px;border-radius:50%;border:none;background:var(--surface-alt);color:var(--text-secondary);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:.2s; }
    .ci-back:hover { background:rgba(14,165,233,.12);color:#0ea5e9; }
    .ci-body { padding:20px;display:flex;flex-direction:column;gap:20px;padding-bottom:160px; }
    .ci-section { background:var(--surface);border:1px solid var(--border);border-radius:20px;overflow:visible; }
    .ci-section-hdr { padding:16px 20px;display:flex;align-items:center;gap:12px; }
    .ci-section-icon { width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0; }
    .ci-section-body { padding:0 20px 20px; }
    .ci-field { margin-bottom:14px; }
    .ci-label { font-size:.7rem;font-weight:800;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;display:block; }
    .ci-input { width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:12px;background:var(--surface-alt);color:var(--text-primary);font-family:inherit;font-size:.9rem;outline:none;transition:.2s; }
    .ci-input:focus { border-color:#0ea5e9;box-shadow:0 0 0 3px rgba(14,165,233,.12); }
    .ci-grid { display:grid;grid-template-columns:1fr 1fr;gap:14px; }
    .ci-submit { position:fixed;bottom:70px;left:0;right:0;padding:16px;background:var(--surface);border-top:1px solid var(--border);z-index:99; }
    .ci-btn-submit { width:100%;padding:16px;background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#fff;border:none;border-radius:16px;font-size:1rem;font-weight:800;cursor:pointer;transition:.2s;display:flex;align-items:center;justify-content:center;gap:8px; }
    @media (max-width:360px) { .ci-grid { grid-template-columns:1fr; } }
  </style>

  <div class="ci-header">
    <button class="ci-back" onclick="window.appNavigate('plantillas')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
    </button>
    <div>
      <h2 style="margin:0;font-size:1rem;font-weight:900;color:var(--text-primary);">Especificaciones de Pozo</h2>
      <p style="margin:0;font-size:.65rem;color:#0ea5e9;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Renew Water</p>
    </div>
  </div>

  <div class="ci-body">
    <!-- Vinculación -->
    <div class="ci-section">
      <div class="ci-section-hdr">
        <div class="ci-section-icon" style="background:rgba(234,179,8,.1);"><i class="fa-solid fa-link text-yellow-500"></i></div>
        <div>
          <div style="font-size:.95rem;font-weight:900;color:var(--text-primary);">Vincular con Proyecto</div>
        </div>
      </div>
      <div class="ci-section-body">
        <div class="ci-field" style="position:relative;">
          <label class="ci-label">Buscar Proyecto / Cliente</label>
          <input type="text" id="pp-search" class="ci-input" placeholder="Ej. Eduardo Luengo..." autocomplete="off">
          <div id="pp-autocomplete-results" style="display:none; position:absolute; top:100%; left:0; right:0; background:var(--surface); border:1px solid var(--border); border-radius:12px; margin-top:4px; max-height:200px; overflow-y:auto; z-index:50; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);"></div>
        </div>
      </div>
    </div>

    <div class="ci-section">
      <div class="ci-section-hdr">
        <div class="ci-section-icon" style="background:rgba(14,165,233,.1);"><i class="fa-solid fa-water"></i></div>
        <div>
          <div style="font-size:.95rem;font-weight:900;color:var(--text-primary);">Especificaciones de Pozo</div>
        </div>
      </div>
      <div class="ci-section-body">
        <div class="ci-field">
          <label class="ci-label">Nombre / Name <span style="color:#ef4444">*</span></label>
          <input class="ci-input" type="text" id="pp-nombre" placeholder="Nombre del cliente">
        </div>
        <div class="ci-grid">
          <div class="ci-field">
            <label class="ci-label">Tanques / Tanks</label>
            <input class="ci-input" type="text" id="pp-tanques" placeholder="Ej. 2">
          </div>
          <div class="ci-field">
            <label class="ci-label">Medidas / Measures</label>
            <input class="ci-input" type="text" id="pp-medidas" placeholder="Ej. 10x54">
          </div>
        </div>
        <div class="ci-field">
          <label class="ci-label">Material / Material</label>
          <input class="ci-input" type="text" id="pp-material" placeholder="Ej. Fibra de vidrio">
        </div>
      </div>
    </div>

    <div class="ci-section">
      <div class="ci-section-hdr">
        <div class="ci-section-icon" style="background:rgba(168,85,247,.1);"><i class="fa-solid fa-flask text-purple-500"></i></div>
        <div>
          <div style="font-size:.95rem;font-weight:900;color:var(--text-primary);">Descripción del Agua</div>
        </div>
      </div>
      <div class="ci-section-body">
        <div class="ci-grid">
          <div class="ci-field">
            <label class="ci-label">TDS</label>
            <input class="ci-input" type="text" id="pp-tds" placeholder="">
          </div>
          <div class="ci-field">
            <label class="ci-label">Dureza / Hardness</label>
            <input class="ci-input" type="text" id="pp-dureza" placeholder="">
          </div>
          <div class="ci-field">
            <label class="ci-label">PH</label>
            <input class="ci-input" type="text" id="pp-ph" placeholder="">
          </div>
          <div class="ci-field">
            <label class="ci-label">Hierro / Iron</label>
            <input class="ci-input" type="text" id="pp-hierro" placeholder="">
          </div>
          <div class="ci-field">
            <label class="ci-label">Color / Color</label>
            <input class="ci-input" type="text" id="pp-color" placeholder="">
          </div>
          <div class="ci-field">
            <label class="ci-label">Olor / Olor</label>
            <input class="ci-input" type="text" id="pp-olor" placeholder="">
          </div>
          <div class="ci-field">
            <label class="ci-label">Sulfuro / Sulfide</label>
            <input class="ci-input" type="text" id="pp-sulfuro" placeholder="">
          </div>
          <div class="ci-field">
            <label class="ci-label">Tanil / Tanil</label>
            <input class="ci-input" type="text" id="pp-tanil" placeholder="">
          </div>
        </div>
      </div>
    </div>

    <div class="ci-section">
      <div class="ci-section-hdr">
        <div class="ci-section-icon" style="background:rgba(20,184,166,.1);"><i class="fa-solid fa-pen text-teal-500"></i></div>
        <div>
          <div style="font-size:.95rem;font-weight:900;color:var(--text-primary);">Nota / Note</div>
        </div>
      </div>
      <div class="ci-section-body">
        <textarea id="pp-nota" class="ci-input" style="height:120px;resize:vertical;" placeholder="Escribe notas adicionales aquí..."></textarea>
      </div>
    </div>
  </div>

  <div class="ci-submit">
    <button class="ci-btn-submit" id="pp-btn-submit" onclick="window.ppSubmit()">
      <i class="fa-solid fa-file-pdf"></i> Generar PDF
    </button>
  </div>
  `;

  let linkedClienteId = null;
  let linkedProyectoId = null;

  setTimeout(() => {
    const searchInput = document.getElementById('pp-search');
    const resultsContainer = document.getElementById('pp-autocomplete-results');

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      resultsContainer.innerHTML = '';
      if (query.length < 2) {
        resultsContainer.style.display = 'none';
        return;
      }
      const db = getDB();
      const cliMatches = (db.Clientes_Maestro || []).filter(c => 
        (c.nombre || '').toLowerCase().includes(query) || 
        (c.telefono || '').includes(query)
      ).slice(0, 5);

      if (cliMatches.length === 0) {
        resultsContainer.style.display = 'none';
        return;
      }

      cliMatches.forEach(c => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:10px 14px; border-bottom:1px solid var(--border); cursor:pointer; font-size:0.85rem;';
        div.innerHTML = `<div style="font-weight:700; color:var(--text-primary)">${c.nombre}</div>
                         <div style="font-size:0.75rem; color:var(--text-muted)">${c.telefono || ''}</div>`;
        div.onmouseenter = () => div.style.background = 'var(--surface-alt)';
        div.onmouseleave = () => div.style.background = 'transparent';
        div.onclick = () => {
          linkedClienteId = c.id;
          const proy = (db.Proyectos_Dinamicos || []).find(p => p.cliente_id === c.id);
          if (proy) linkedProyectoId = proy.id;
          
          searchInput.value = c.nombre;
          document.getElementById('pp-nombre').value = c.nombre;
          
          resultsContainer.style.display = 'none';
        };
        resultsContainer.appendChild(div);
      });
      resultsContainer.style.display = 'block';
    });

    document.addEventListener('click', (e) => {
      if(e.target !== searchInput && e.target !== resultsContainer) {
        if(resultsContainer) resultsContainer.style.display = 'none';
      }
    });
  }, 100);

  window.ppSubmit = async () => {
    const btn = document.getElementById('pp-btn-submit');
    const orgHtml = btn.innerHTML;
    
    const d = {
      clienteId: linkedClienteId,
      proyectoId: linkedProyectoId,
      nombre: document.getElementById('pp-nombre').value.trim(),
      tanques: document.getElementById('pp-tanques').value.trim(),
      medidas: document.getElementById('pp-medidas').value.trim(),
      material: document.getElementById('pp-material').value.trim(),
      tds: document.getElementById('pp-tds').value.trim(),
      dureza: document.getElementById('pp-dureza').value.trim(),
      ph: document.getElementById('pp-ph').value.trim(),
      hierro: document.getElementById('pp-hierro').value.trim(),
      color: document.getElementById('pp-color').value.trim(),
      olor: document.getElementById('pp-olor').value.trim(),
      sulfuro: document.getElementById('pp-sulfuro').value.trim(),
      tanil: document.getElementById('pp-tanil').value.trim(),
      nota: document.getElementById('pp-nota').value.trim()
    };

    if (!d.nombre) {
      showToast('El nombre del cliente es obligatorio', 'error');
      return;
    }

    try {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
      const token = localStorage.getItem('renew_token');
      const res = await fetch('/api/generar-plantilla-pozo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(d)
      });

      if (!res.ok) throw new Error('Error al generar PDF de Pozo');
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      showToast('¡PDF generado exitosamente!', 'success');
      
      // Descarga automática en el dispositivo
      const a = document.createElement('a');
      a.href = url;
      a.download = `Especificaciones_Pozo_${d.nombre.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      window.open(url, '_blank');
      
      setTimeout(() => window.appNavigate('plantillas'), 1000);

    } catch (error) {
      console.error(error);
      showToast(error.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = orgHtml;
    }
  };
}

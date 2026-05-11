/* ============================================================
   RENEW WATER — js/contractForm.js
   Responsabilidades EXCLUSIVAS del Contrato:
     · Recolección de datos del contrato
     · Validación y Firmas
     · Envío al Webhook
   ============================================================ */

let selectedProyectoId = null;
let selectedClienteId = null;

/**
 * Recolecta los datos del formulario de contrato.
 */
function collectContractData(formEl) {
  const clientName = document.getElementById('ct_fullname').value;
  const repName = document.getElementById('ct_rep_name').value;
  const contractDate = document.getElementById('ct_date').value;
  const address = document.getElementById('ct_address').value;

  const data = {
    // Campos planos para mapeo directo a PDF (Compatibilidad)
    ct_fullname: clientName,
    ct_address: address,
    ct_date: contractDate,
    ct_rep_name: repName,

    // Mapeo DIRECTO a los campos del molde PDF (molde_contrato.pdf y molde_contrato_solar.pdf)
    nombre_cliente: clientName,
    nombre_cliente_pag1: clientName,
    nombre_representante: repName,
    fecha_cliente: contractDate,
    fecha_representante: contractDate,

    cliente: {
      nombre: clientName,
      direccion: address,
      fecha: contractDate
    },
    firmas: {
      cliente: "",
      representante: "",
      nombreRepresentante: repName
    },
    _tipo: 'contrato_instalacion',
    _timestamp: new Date().toISOString()
  };

  const canvas = document.getElementById('firma-contract-client');
  if (canvas && typeof checkSignatureDrawn === 'function' && checkSignatureDrawn('firma-contract-client')) {
    const b64 = canvas.toDataURL('image/png');
    data.firmas.cliente = b64;
    data.firma_cliente = b64; // Mapping for PDF field 'firma_cliente'
  }

  const canvasRep = document.getElementById('firma-contract-rep');
  if (canvasRep && typeof checkSignatureDrawn === 'function' && checkSignatureDrawn('firma-contract-rep')) {
    const b64 = canvasRep.toDataURL('image/png');
    data.firmas.representante = b64;
    data.firma_representante = b64; // Mapping for PDF field 'firma_representante'
  }

  return data;
}

/**
 * Maneja el submit del contrato.
 */
async function handleContractSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById('btn-submit-contract');
  const span = btn.querySelector('.btn-text');
  const originalText = span.textContent;

  // Validación básica
  const nombre = document.getElementById('ct_fullname').value.trim();
  if (!nombre) {
    showToast('Por favor ingrese el nombre del cliente.', 'error');
    return;
  }

  if (typeof checkSignatureDrawn === 'function' && !checkSignatureDrawn('firma-contract-client')) {
    showToast('La firma del cliente es obligatoria.', 'error');
    return;
  }

  const repName = document.getElementById('ct_rep_name').value.trim();
  if (!repName) {
    showToast('Por favor ingrese el nombre del representante.', 'error');
    return;
  }

  if (typeof checkSignatureDrawn === 'function' && !checkSignatureDrawn('firma-contract-rep')) {
    showToast('La firma del representante es obligatoria.', 'error');
    return;
  }

  // Carga
  btn.classList.add('loading');
  span.textContent = 'Generando Contrato...';

  const payload = collectContractData(form);
  const urlParams = new URLSearchParams(window.location.search);
  payload.proyectoId = urlParams.get('proyectoId') || selectedProyectoId;
  payload.clienteId = selectedClienteId;
  payload.pipeline = urlParams.get('pipeline') || 'Renew Water';

  try {
    const response = await fetch('/api/generar-contrato', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datos: payload })
    });

    if (response.ok) {
      const result = await response.json();
      showToast('¡Contrato generado y guardado exitosamente! ✅', 'success');
      form.reset();
      if (typeof clearSignature === 'function') clearSignature('firma-contract-client');
      
      // Notificar al padre para avanzar fase y registrar el PDF
      if (payload.proyectoId) {
        window.parent.postMessage({ 
          type: 'CONTRACT_SUBMITTED', 
          proyectoId: payload.proyectoId,
          signature: payload.firmas.cliente,
          contractUrl: result.url
        }, '*');
      }
    } else {
      throw new Error('Error en el servidor: ' + response.status);
    }
  } catch (err) {
    console.error(err);
    showToast('Error al enviar el contrato: ' + err.message, 'error');
  } finally {
    btn.classList.remove('loading');
    span.textContent = originalText;
  }
}

// Inicializar firmas y autocompletado
document.addEventListener('DOMContentLoaded', () => {
  if (typeof initSignatureCanvas === 'function') {
    initSignatureCanvas('firma-contract-client', 'btn-clear-contract-client');
    initSignatureCanvas('firma-contract-rep', 'btn-clear-contract-rep');
  }

  // Auto-fill Representative Name from logged-in user
  try {
    const rawUser = localStorage.getItem('rs_user');
    if (rawUser) {
      const user = JSON.parse(rawUser);
      const repInput = document.getElementById('ct_rep_name');
      if (repInput && !repInput.value) {
        const fullName = [user.nombre, user.apellido].filter(Boolean).join(' ');
        if (fullName) {
          repInput.value = fullName;
          // Trigger input event for any listeners
          repInput.dispatchEvent(new Event('input'));
        }
      }
    }
  } catch (err) {
    console.warn('[CONTRACT] Error auto-filling representative name:', err);
  }

    // Poblar datalist de clientes desde window.parent
    const ctDatalist = document.getElementById('clients_list');

    async function populateClients() {
        console.log('[CONTRACT] Starting client population...');
        let db = null;
        let attempts = 0;
        const maxAttempts = 15; // Increased to 15 (7.5s total)
        
        while (attempts < maxAttempts) {
            // Try to get DB from parent/top
            const parentObj = window.parent || window.top;
            if (parentObj && typeof parentObj.getDB === 'function') {
                db = parentObj.getDB();
                // ONLY break if we actually have clients! 
                // If the app is still syncing, it might return an empty array initially.
                if (db && db.Clientes_Maestro && db.Clientes_Maestro.length > 0) {
                    console.log('[CONTRACT] DB found with clients via parent sync.');
                    break;
                }
            }
            
            console.log(`[CONTRACT] Waiting for DB sync... (Attempt ${attempts + 1}/${maxAttempts})`);
            await new Promise(r => setTimeout(r, 600)); // 600ms between attempts
            attempts++;
        }

        // 2. Fallback: Fetch directo a la API if still empty
        if (!db || !db.Clientes_Maestro || db.Clientes_Maestro.length === 0) {
            console.log('[CONTRACT] Parent sync unavailable or empty. Fetching DB directly from API...');
            try {
                const response = await fetch('/api/db');
                if (response.ok) {
                    const freshDB = await response.json();
                    if (freshDB && freshDB.Clientes_Maestro && freshDB.Clientes_Maestro.length > 0) {
                        db = freshDB;
                        console.log('[CONTRACT] DB fetched directly from API with clients.');
                    }
                }
            } catch (err) {
                console.error('[CONTRACT] Direct fetch failed:', err);
            }
        }

        if (!db || !db.Clientes_Maestro || db.Clientes_Maestro.length === 0) {
            console.warn('[CONTRACT] Could not retrieve clients. Autocomplete will be empty.');
            return;
        }

        const clientes = db.Clientes_Maestro;
        console.log(`[CONTRACT] Populating ${clientes.length} clients.`);

        // Poblar datalist (fallback nativo)
        if (ctDatalist) {
            ctDatalist.innerHTML = '';
            clientes.forEach(cli => {
                let fullName = (cli.nombre || '').trim();
                if (cli.apellidos && !fullName.includes(cli.apellidos)) {
                    fullName += ' ' + cli.apellidos;
                }
                if (!fullName) return;
                const option = document.createElement('option');
                option.value = fullName;
                ctDatalist.appendChild(option);
            });
        }

        // Definir los pares de [Input Nombre, Input Dirección] que deben tener búsqueda
        const searchPairs = [
            { nameId: 'ca_fullname', addrId: 'ca_address' },
            { nameId: 'wo_purchaser', addrId: 'wo_address' },
            { nameId: 'ct_fullname', addrId: 'ct_address' }
        ];

        searchPairs.forEach(pair => {
            const nameInput = document.getElementById(pair.nameId);
            const addrInput = document.getElementById(pair.addrId);
            if (!nameInput) return;

            // Asegurar que el contenedor de sugerencias existe para este input
            let suggestionsContainer = nameInput.parentNode.querySelector('.custom-suggestions-list');
            if (!suggestionsContainer) {
                suggestionsContainer = document.createElement('div');
                suggestionsContainer.className = 'custom-suggestions-list';
                nameInput.parentNode.appendChild(suggestionsContainer);
            }

            nameInput.addEventListener('input', (e) => {
                const val = e.target.value.toLowerCase().trim();
                suggestionsContainer.innerHTML = '';

                if (val.length < 2) {
                    suggestionsContainer.style.display = 'none';
                    return;
                }

                const matches = clientes.filter(cli => {
                    const full = `${cli.nombre} ${cli.apellidos || ''}`.toLowerCase();
                    return full.includes(val);
                }).slice(0, 8);

                if (matches.length > 0) {
                    matches.forEach(match => {
                        const div = document.createElement('div');
                        const name = `${match.nombre} ${match.apellidos || ''}`.trim();
                        div.className = 'suggestion-item';
                        div.innerHTML = `<strong>${name.substring(0, val.length)}</strong>${name.substring(val.length)}`;
                        div.onclick = () => {
                            nameInput.value = name;
                            if (addrInput) addrInput.value = match.direccion || '';
                            
                            // Capture IDs for the server
                            selectedClienteId = match.id;
                            
                            // Try to find the associated project in the database
                            if (db && db.Proyectos_Dinamicos) {
                                const proy = db.Proyectos_Dinamicos.find(p => p.cliente_id === match.id);
                                if (proy) selectedProyectoId = proy.id;
                            }
                            
                            suggestionsContainer.style.display = 'none';
                            
                            // Disparar evento input para que las barras de progreso se actualicen
                            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
                            if (addrInput) addrInput.dispatchEvent(new Event('input', { bubbles: true }));
                        };
                        suggestionsContainer.appendChild(div);
                    });
                    suggestionsContainer.style.display = 'block';
                } else {
                    suggestionsContainer.style.display = 'none';
                }
            });

            // Cerrar sugerencias al hacer clic fuera
            document.addEventListener('click', (e) => {
                if (e.target !== nameInput) {
                    suggestionsContainer.style.display = 'none';
                }
            });
        });

        // Intentar autocompletar si hay proyectoId en la URL (específico para el contrato)
        const urlParams = new URLSearchParams(window.location.search);
        const pId = urlParams.get('proyectoId');
        if (pId && db.Proyectos_Dinamicos) {
            const proyecto = db.Proyectos_Dinamicos.find(p => p.id === pId);
            if (proyecto) {
                const cliAsociado = clientes.find(c => c.id === proyecto.cliente_id);
                if (cliAsociado) {
                    let fullName = (cliAsociado.nombre || '').trim();
                    if (cliAsociado.apellidos && !fullName.includes(cliAsociado.apellidos)) {
                        fullName += ' ' + cliAsociado.apellidos;
                    }
                    const ctFullnameInput = document.getElementById('ct_fullname');
                    const ctAddress = document.getElementById('ct_address');
                    if (ctFullnameInput) ctFullnameInput.value = fullName;
                    if (ctAddress) ctAddress.value = cliAsociado.direccion || '';
                }
            }
        }
    }

    populateClients();

    // Default date
    const ctDateInput = document.getElementById('ct_date');
    if (ctDateInput && !ctDateInput.value) {
        const today = new Date();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const yyyy = today.getFullYear();
        ctDateInput.value = `${mm}/${dd}/${yyyy}`;
    }
});

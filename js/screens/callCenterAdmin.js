import { showToast } from '../components/toast.js';

export async function renderCallCenterAdmin() {
    const main = document.getElementById('main-canvas');
    main.innerHTML = `
        <div class="px-10 py-10 fade-in w-full max-w-[1600px] mx-auto min-h-screen flex flex-col">
            <div class="flex items-center justify-between mb-8">
                <div>
                    <div class="aqua-label"><i class="fa-solid fa-headset mr-2"></i> Módulo Call Center</div>
                    <h2 class="text-4xl font-black text-gray-900 dark:text-white tracking-tighter leading-none mb-2">Call Center Leads</h2>
                    <p class="text-[12px] uppercase tracking-[0.2em] font-bold text-gray-500">Gestión de prospectos del Call Center y carga manual</p>
                </div>
                <button id="btn-add-cc-lead" class="btn-premium">
                    <i class="fa-solid fa-user-plus text-lg"></i> Añadir Lead Call Center
                </button>
            </div>

            <div class="bg-white dark:bg-darkCard border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-light-card flex-1">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="border-b border-gray-100 dark:border-white/10 text-[10px] uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500">
                                <th class="pb-4 font-black">Nombre</th>
                                <th class="pb-4 font-black">Teléfono</th>
                                <th class="pb-4 font-black">Dirección</th>
                                <th class="pb-4 font-black">Email</th>
                                <th class="pb-4 font-black">Operador</th>
                                <th class="pb-4 font-black">Origen</th>
                                <th class="pb-4 font-black">Notas</th>
                                <th class="pb-4 font-black">Estado</th>
                                <th class="pb-4 font-black text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody id="cc-leads-tbody" class="text-sm">
                            <tr><td colspan="7" class="py-10 text-center text-gray-500 text-xs uppercase tracking-widest"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Cargando...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- MODAL AGREGAR LEAD CC ADMIN -->
        <div id="modal-cc-admin-add" class="fixed inset-0 bg-black/60 backdrop-blur-sm hidden z-[999999] flex items-center justify-center transition-opacity duration-300 opacity-0">
            <div class="bg-white dark:bg-[#111827] w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden transform scale-95 transition-all duration-300 p-8">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h3 class="text-2xl font-black text-gray-900 dark:text-white leading-none mb-1">Nuevo Lead Call Center</h3>
                        <p class="text-xs text-gray-500 font-bold uppercase tracking-widest">Ingreso Manual Administrativo</p>
                    </div>
                    <button id="btn-close-cc-modal" class="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <form id="form-cc-admin" class="space-y-4">
                    <div>
                        <label class="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Nombre Completo *</label>
                        <input type="text" id="inp-cc-nom" required class="w-full bg-gray-50 dark:bg-[#0B0F1A] border border-gray-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-white focus:border-tealAccent focus:ring-1 focus:ring-tealAccent outline-none transition-all">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Teléfono *</label>
                            <div class="flex gap-2">
                                <select id="sel-cc-tel-code" class="w-24 bg-gray-50 dark:bg-[#0B0F1A] border border-gray-200 dark:border-white/5 rounded-xl px-2 py-3 text-sm text-gray-800 dark:text-white focus:border-tealAccent focus:ring-1 focus:ring-tealAccent outline-none transition-all">
                                    <option value="+1">+1 (USA/CAN)</option>
                                    <option value="+58">+58 (VEN)</option>
                                    <option value="+57">+57 (COL)</option>
                                </select>
                                <input type="tel" id="inp-cc-tel" required class="flex-1 bg-gray-50 dark:bg-[#0B0F1A] border border-gray-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-white focus:border-tealAccent focus:ring-1 focus:ring-tealAccent outline-none transition-all" placeholder="Número">
                            </div>
                        </div>
                        <div>
                            <label class="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Email</label>
                            <input type="email" id="inp-cc-email" class="w-full bg-gray-50 dark:bg-[#0B0F1A] border border-gray-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-white focus:border-tealAccent focus:ring-1 focus:ring-tealAccent outline-none transition-all">
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Dirección Completa *</label>
                        <input type="text" id="inp-cc-dir" required placeholder="Buscar dirección con Google Maps..." autocomplete="off" class="w-full bg-gray-50 dark:bg-[#0B0F1A] border border-gray-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-white focus:border-tealAccent focus:ring-1 focus:ring-tealAccent outline-none transition-all">
                    </div>

                    <div>
                        <label class="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Origen / Fuente (Ej: Facebook, Referido, etc.)</label>
                        <input type="text" id="inp-cc-origen" placeholder="Ej: Facebook Ads, Google, etc." class="w-full bg-gray-50 dark:bg-[#0B0F1A] border border-gray-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-white focus:border-tealAccent focus:ring-1 focus:ring-tealAccent outline-none transition-all">
                    </div>
                    
                    <div>
                        <label class="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Asignar Operador (Opcional)</label>
                        <select id="sel-cc-operador" class="w-full bg-gray-50 dark:bg-[#0B0F1A] border border-gray-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-white focus:border-tealAccent focus:ring-1 focus:ring-tealAccent outline-none transition-all">
                            <option value="">Selección Automática</option>
                        </select>
                    </div>

                    <div class="pt-6 flex gap-3">
                        <button type="button" id="btn-cancel-cc" class="flex-1 py-4 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" id="btn-save-cc" class="flex-1 py-4 bg-tealAccent text-black rounded-xl font-black uppercase text-[10px] tracking-widest shadow-[0_4px_15px_rgba(0,245,212,0.3)] hover:scale-[1.02] active:scale-95 transition-all">
                            Guardar Lead
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Load data
    await loadCCLeads();
    await loadOperators();

    // Events
    const modal = document.getElementById('modal-cc-admin-add');
    const openBtn = document.getElementById('btn-add-cc-lead');
    const closeBtn = document.getElementById('btn-close-cc-modal');
    const cancelBtn = document.getElementById('btn-cancel-cc');
    const form = document.getElementById('form-cc-admin');

    setTimeout(() => {
        const dirInp = document.getElementById('inp-cc-dir');
        if (dirInp && window.google && window.google.maps && window.google.maps.places) {
            const autocomplete = new window.google.maps.places.Autocomplete(dirInp, {
                fields: ["address_components", "formatted_address"]
            });
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place.formatted_address) {
                    dirInp.value = place.formatted_address;
                    window._ccAdminCity = '';
                    window._ccAdminState = '';
                    window._ccAdminZip = '';
                    
                    if (place.address_components) {
                        for (let comp of place.address_components) {
                            if (comp.types.includes('locality') || comp.types.includes('administrative_area_level_2')) {
                                window._ccAdminCity = comp.long_name;
                            }
                            if (comp.types.includes('administrative_area_level_1')) {
                                window._ccAdminState = comp.long_name;
                            }
                            if (comp.types.includes('postal_code')) {
                                window._ccAdminZip = comp.long_name;
                            }
                        }
                    }
                }
            });
        }
    }, 500);

    const openModal = () => {
        form.reset();
        window._ccAdminCity = '';
        window._ccAdminState = '';
        window._ccAdminZip = '';
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('div').classList.remove('scale-95');
        }, 10);
    };

    const closeModal = () => {
        modal.classList.add('opacity-0');
        modal.querySelector('div').classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

    openBtn.onclick = openModal;
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const btnSave = document.getElementById('btn-save-cc');
        btnSave.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
        btnSave.disabled = true;

        const payload = {
            nombre: document.getElementById('inp-cc-nom').value.trim(),
            telefono: document.getElementById('sel-cc-tel-code').value + document.getElementById('inp-cc-tel').value.trim(),
            email: document.getElementById('inp-cc-email').value.trim(),
            direccion: document.getElementById('inp-cc-dir').value.trim(),
            ciudad: window._ccAdminCity || '',
            estado_geo: window._ccAdminState || '',
            zip_code: window._ccAdminZip || '',
            operador_id: document.getElementById('sel-cc-operador').value || null,
            origen: document.getElementById('inp-cc-origen').value.trim() || 'Manual Admin',
            fuente: 'manual_admin'
        };

        try {
            const res = await fetch('/api/cc-prospectos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Error al guardar lead');
            
            showToast('Lead agregado exitosamente', 'success');
            closeModal();
            await loadCCLeads();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btnSave.innerHTML = 'Guardar Lead';
            btnSave.disabled = false;
        }
    };
}

async function loadOperators() {
    const sel = document.getElementById('sel-cc-operador');
    if (!sel) return;
    try {
        const res = await fetch('/api/usuarios?t=' + Date.now());
        const users = await res.json();
        console.log('[CC-ADMIN] Users fetched:', users.length);
        
        // Filter case-insensitive and trim
        const operators = users.filter(u => u.rol && u.rol.trim().toLowerCase() === 'call center');
        console.log('[CC-ADMIN] Call Center operators found:', operators.length);
        
        sel.innerHTML = '<option value="">Selección Automática</option>';
        operators.forEach(op => {
            const opt = document.createElement('option');
            opt.value = op.id;
            opt.textContent = `${op.nombre} ${op.apellido || ''}`;
            sel.appendChild(opt);
        });
    } catch (err) {
        console.error('Error cargando operadores:', err);
    }
}

async function loadCCLeads() {
    const tbody = document.getElementById('cc-leads-tbody');
    try {
        const res = await fetch('/api/cc-prospectos');
        const data = await res.json();
        
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="py-10 text-center text-gray-500 text-xs uppercase tracking-widest">No hay leads en el sistema</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(l => `
            <tr class="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <td class="py-4 font-bold text-gray-900 dark:text-white">${l.nombre || 'Sin nombre'}</td>
                <td class="py-4 text-gray-600 dark:text-gray-300 flex items-center gap-2">
                    ${l.telefono || '-'}
                    ${l.telefono ? `<button onclick="adminZadarmaCall('${l.telefono}')" class="hidden w-6 h-6 rounded bg-teal-100 text-teal-600 hover:bg-teal-500 hover:text-white items-center justify-center transition-colors" title="Click to Call (Zadarma)"><i class="fa-solid fa-phone text-[10px]"></i></button>` : ''}
                </td>
                <td class="py-4 text-gray-600 dark:text-gray-300 text-xs">${l.direccion || '-'} ${l.ciudad ? ', ' + l.ciudad : ''}</td>
                <td class="py-4 text-gray-600 dark:text-gray-300 text-xs">${l.email || '-'}</td>
                <td class="py-4 text-gray-600 dark:text-gray-300 text-xs">${l.operador_nombre || '<span class="text-yellow-500">En Cola</span>'}</td>
                <td class="py-4 text-gray-600 dark:text-gray-300 text-[10px] font-bold uppercase tracking-tight">${l.origen || '-'}</td>
                <td class="py-4">
                    <div class="text-xs text-gray-500 max-w-[150px] truncate" title="${l.notas_pre || ''}">${l.notas_pre || '-'}</div>
                </td>
                <td class="py-4">
                    <span class="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider
                        ${l.estado === 'pendiente' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                        l.estado === 'rechazado' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'}">
                        ${(l.estado || '').replace(/_/g, ' ')}
                    </span>
                </td>
                <td class="py-4 text-right">
                    <div class="flex justify-end gap-2">
                    <button class="w-8 h-8 rounded-lg hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-500/10 text-gray-400 transition-colors" onclick="adminEditCCNotas('${l.id}', '${encodeURIComponent(l.notas_pre || '')}')" title="Ver/Editar Notas">
                        <i class="fa-solid fa-file-pen text-xs"></i>
                    </button>
                    <button class="w-8 h-8 rounded-lg hover:bg-amber-50 hover:text-amber-500 dark:hover:bg-amber-500/10 text-gray-400 transition-colors" onclick="const b=this;b.disabled=true;const old=b.innerHTML;b.innerHTML='<i class=\\\'fa-solid fa-spinner fa-spin text-xs\\\'></i>';fetch('/api/cc-prospectos/${l.id}').then(r=>r.json()).then(d=>{b.disabled=false;b.innerHTML=old;if(window.showZadarmaHistory)window.showZadarmaHistory(d.historial_llamadas||[]);else alert('Sin historial')}).catch(()=>{b.disabled=false;b.innerHTML=old;alert('Error al cargar historial')});" title="Ver Historial de Llamadas">
                        <i class="fa-solid fa-headphones text-xs"></i>
                    </button>
                    <button class="w-8 h-8 rounded-lg hover:bg-tealAccent/20 hover:text-tealAccent dark:hover:bg-tealAccent/10 text-gray-400 transition-colors" onclick="adminEditCCLead('${l.id}', '${l.operador_id || ''}')" title="Asignar Operador">
                        <i class="fa-solid fa-user-pen text-xs"></i>
                    </button>
                    <button class="w-8 h-8 rounded-lg hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 text-gray-400 transition-colors" onclick="adminDeleteCCLead('${l.id}')" title="Eliminar Lead">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                    </div>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-10 text-center text-red-500 text-xs uppercase tracking-widest">Error al cargar leads</td></tr>';
    }
}

window.adminEditCCLead = async (id, currentOpId) => {
    // Create edit modal if not exists
    let modal = document.getElementById('modal-cc-admin-edit');
    if (!modal) {
        const modalHtml = `
            <div id="modal-cc-admin-edit" class="fixed inset-0 bg-black/60 backdrop-blur-sm hidden z-[999999] flex items-center justify-center transition-opacity duration-300 opacity-0">
                <div class="bg-white dark:bg-[#111827] w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden transform scale-95 transition-all duration-300 p-8">
                    <div class="flex justify-between items-center mb-6">
                        <div>
                            <h3 class="text-2xl font-black text-gray-900 dark:text-white leading-none mb-1">Reasignar Lead</h3>
                            <p class="text-xs text-gray-500 font-bold uppercase tracking-widest">Cambiar operador asignado</p>
                        </div>
                        <button id="btn-close-cc-edit-modal" class="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                            <i class="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Nuevo Operador</label>
                            <select id="sel-cc-edit-operador" class="w-full bg-gray-50 dark:bg-[#0B0F1A] border border-gray-200 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-white focus:border-tealAccent focus:ring-1 focus:ring-tealAccent outline-none transition-all">
                                <option value="">En Cola / Sin Asignar</option>
                            </select>
                        </div>
                        <div class="pt-6 flex gap-3">
                            <button type="button" id="btn-cancel-cc-edit" class="flex-1 py-4 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                                Cancelar
                            </button>
                            <button type="button" id="btn-update-cc-lead" class="flex-1 py-4 bg-tealAccent text-black rounded-xl font-black uppercase text-[10px] tracking-widest shadow-[0_4px_15px_rgba(0,245,212,0.3)] hover:scale-[1.02] active:scale-95 transition-all">
                                Actualizar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById('modal-cc-admin-edit');
    }

    const sel = document.getElementById('sel-cc-edit-operador');
    const closeBtn = document.getElementById('btn-close-cc-edit-modal');
    const cancelBtn = document.getElementById('btn-cancel-cc-edit');
    const updateBtn = document.getElementById('btn-update-cc-lead');

    // Load operators into edit select
    sel.innerHTML = '<option value="">En Cola / Sin Asignar</option>';
    try {
        const res = await fetch('/api/usuarios?t=' + Date.now());
        const users = await res.json();
        console.log('[CC-EDIT] All Users fetched:', users.length);
        console.log('[CC-EDIT] Roles found:', [...new Set(users.map(u => u.rol))]);
        
        const operators = users.filter(u => u.rol && u.rol.trim().toLowerCase() === 'call center');
        console.log('[CC-EDIT] Call Center operators found:', operators.length);
        
        operators.forEach(op => {
            const opt = document.createElement('option');
            opt.value = op.id;
            opt.textContent = `${op.nombre} ${op.apellido || ''}`;
            if (op.id === currentOpId) opt.selected = true;
            sel.appendChild(opt);
        });
    } catch (e) {
        console.error('[CC-EDIT] Error loading operators:', e);
    }

    const openModal = () => {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('div').classList.remove('scale-95');
        }, 10);
    };

    const closeModal = () => {
        modal.classList.add('opacity-0');
        modal.querySelector('div').classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    openModal();

    updateBtn.onclick = async () => {
        const newOpId = sel.value;
        const newOpName = sel.options[sel.selectedIndex].text;
        
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

        try {
            const res = await fetch(`/api/cc-prospectos/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    operador_id: newOpId || null,
                    operador_nombre: newOpId ? newOpName : null,
                    estado: newOpId ? 'pendiente' : 'en_espera',
                    fecha_asignacion: newOpId ? new Date().toISOString() : null,
                    fecha_expiracion: null // No expiration for manual assignments
                })
            });

            if (!res.ok) throw new Error('No se pudo actualizar');
            showToast('Lead actualizado correctamente', 'success');
            closeModal();
            await loadCCLeads();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            updateBtn.disabled = false;
            updateBtn.innerHTML = 'Actualizar';
        }
    };
};

window.adminEditCCNotas = async (id, currentNotes) => {
    const notes = decodeURIComponent(currentNotes || '');
    const newNotes = window.prompt('Anotaciones del lead:', notes);
    if (newNotes === null) return;
    
    try {
        const res = await fetch(`/api/cc-prospectos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notas_pre: newNotes.trim() })
        });
        if (!res.ok) throw new Error('No se pudo guardar la nota');
        showToast('Notas actualizadas', 'success');
        await loadCCLeads();
    } catch (err) {
        showToast(err.message, 'error');
    }
};

window.adminDeleteCCLead = async (id) => {
    if (!confirm('¿Eliminar este lead permanentemente?')) return;
    try {
        const res = await fetch(`/api/cc-prospectos/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('No se pudo eliminar');
        showToast('Lead eliminado', 'warning');
        await loadCCLeads();
    } catch (err) {
        showToast(err.message, 'error');
    }
};


window.adminZadarmaCall = async (phone) => {
    // Use _getZadarmaUser if available (defined in zadarma.js), otherwise fallback to getCurrentUser()
    const currentUser = (typeof _getZadarmaUser === 'function')
        ? _getZadarmaUser()
        : (() => {
            const sessionUser = getCurrentUser();
            if (!sessionUser || sessionUser.zadarma_sip_id) return sessionUser;
            // Try fresh from local DB
            try {
                const dbStr = localStorage.getItem('rs_admin_db');
                if (dbStr) {
                    const db = JSON.parse(dbStr);
                    const freshUser = (db.Usuarios || []).find(u => u.id === sessionUser.id);
                    if (freshUser && freshUser.zadarma_sip_id) {
                        const merged = { ...sessionUser, zadarma_sip_id: freshUser.zadarma_sip_id };
                        localStorage.setItem('rs_user', JSON.stringify(merged));
                        return merged;
                    }
                }
            } catch(e) { /* ignore */ }
            return sessionUser;
        })();

    if (!currentUser || !currentUser.zadarma_sip_id) {
        showToast('Debes tener un SIP ID de Zadarma configurado en tu perfil.', 'error');
        return;
    }
    if (!confirm('¿Deseas llamar al ' + phone + ' desde tu extensión ' + currentUser.zadarma_sip_id + '?')) return;

    try {
        const res = await fetch('/api/zadarma/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: currentUser.zadarma_sip_id, to: phone })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Llamada en curso. Contesta tu teléfono Zadarma.', 'success');
        } else {
            throw new Error(data.message || 'Error de Zadarma');
        }
    } catch (e) {
        console.error('[ZADARMA]', e);
        showToast('Error al llamar: ' + e.message, 'error');
    }
};

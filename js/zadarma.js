// ── ZADARMA GLOBALS ─────────────────────────────────────────

// Helper: get the current user with fresh zadarma_sip_id from local DB if needed
function _getZadarmaUser() {
    const userStr = localStorage.getItem('rs_user');
    const sessionUser = userStr ? JSON.parse(userStr) : null;
    if (!sessionUser) return null;

    // Always try to get fresh data from local DB cache
    try {
        const dbStr = localStorage.getItem('rs_admin_db');
        if (dbStr) {
            const db = JSON.parse(dbStr);
            const freshUser = (db.Usuarios || []).find(u => u.id === sessionUser.id);
            if (freshUser) {
                sessionUser.zadarma_sip_id = freshUser.zadarma_sip_id;
                localStorage.setItem('rs_user', JSON.stringify(sessionUser));
            }
        }
    } catch(e) { /* ignore */ }
    
    return sessionUser;
}

window.zadarmaCall = async (phone) => {
    const currentUser = _getZadarmaUser();
    if (!currentUser || !currentUser.zadarma_sip_id) {
        if (window.showToast) window.showToast('Debes tener un SIP ID de Zadarma configurado en tu perfil.', 'error');
        else alert('Debes tener un SIP ID configurado.');
        return;
    }
    if (!confirm('¿Deseas llamar al ' + phone + ' desde tu extensión ' + currentUser.zadarma_sip_id + '?')) return;

    try {
        const res = await fetch('/api/zadarma/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: currentUser.zadarma_sip_id, to: phone })
        });

        // Detect when the server returns HTML instead of JSON (e.g. 404 on outdated server)
        if (res.status === 404) {
            throw new Error('El servidor no tiene el módulo Zadarma activo. Contacta al administrador para reiniciar el servidor.');
        }

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch(parseErr) {
            throw new Error('Respuesta inesperada del servidor. El servidor puede necesitar reiniciarse.');
        }

        if (data.status === 'success') {
            if (window.showToast) window.showToast('✅ Llamada en curso. Contesta tu teléfono Zadarma.', 'success');
            else alert('Llamada en curso. Contesta tu teléfono Zadarma.');
        } else {
            throw new Error(data.message || data.error || 'Error de Zadarma');
        }
    } catch (e) {
        console.error('[ZADARMA]', e);
        if (window.showToast) window.showToast('Error al llamar: ' + e.message, 'error');
        else alert('Error: ' + e.message);
    }
};



window.showZadarmaHistory = (historial) => {
    if (!historial || historial.length === 0) {
        if (window.showToast) window.showToast('No hay historial de llamadas.', 'info');
        else alert('No hay historial');
        return;
    }
    
    const listHtml = historial.map(h => `<div style="padding:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="font-size:11px; color:#94a3b8; margin-bottom:4px;">${new Date(h.fecha).toLocaleString()} - ${h.tipo} - ${h.duracion}s</div>
        ${h.grabacion_url ? `<audio controls src="${h.grabacion_url}" style="width:100%; height:30px;"></audio>` : '<span style="font-size:10px; color:#ef4444;">Sin grabación</span>'}
    </div>`).join('');

    const modalHtml = `<div id="zadarma-hist-modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:999999; display:flex; align-items:center; justify-content:center; padding:20px;">
        <div style="background:#1e293b; border:1px solid #334155; border-radius:16px; width:100%; max-width:400px; max-height:80vh; overflow-y:auto; padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h3 style="margin:0; color:white; font-size:16px;">Historial de Llamadas</h3>
                <button onclick="document.getElementById('zadarma-hist-modal').remove()" style="background:none; border:none; color:white; font-size:20px; cursor:pointer;">&times;</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
                ${listHtml}
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.initZadarmaWebRTC = async () => {
    const currentUser = _getZadarmaUser();
    if (!currentUser || !currentUser.zadarma_sip_id) {
        console.log('[Zadarma WebRTC] No SIP ID found for current user. Widget will not load.');
        return;
    }

    try {
        console.log('[Zadarma WebRTC] Fetching key for SIP:', currentUser.zadarma_sip_id);
        const res = await fetch('/api/zadarma/webrtc-key?sip=' + encodeURIComponent(currentUser.zadarma_sip_id));
        const data = await res.json();
        
        if (data.status === 'success' && data.key) {
            console.log('[Zadarma WebRTC] Key received, initializing widget...');
            if (typeof zadarmaWidgetFn === 'function') {
                zadarmaWidgetFn(data.key, currentUser.zadarma_sip_id);
            } else {
                console.warn('[Zadarma WebRTC] zadarmaWidgetFn not found. Are scripts loaded in index.html?');
            }
        } else {
            console.error('[Zadarma WebRTC] Error fetching key:', data);
        }
    } catch(err) {
        console.error('[Zadarma WebRTC] Initialization failed:', err);
    }
};

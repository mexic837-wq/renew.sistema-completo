/* ============================================================
   RENEW OS – js/auth-fetch.js
   Añade el pase de sesión (rs_token) a todas las peticiones a /api/ de este
   mismo sitio, para que el servidor sepa quién hace cada cambio.
   Si el servidor dice que la sesión no vale, se cierra y se vuelve al login.
   Se carga antes que cualquier otro script (también dentro de los iframes).
   ============================================================ */
(function () {
    if (window.__renewAuthFetch) return;
    window.__renewAuthFetch = true;
    var fetchOriginal = window.fetch.bind(window);

    function esApiPropia(url) {
        try {
            var u = new URL(url, window.location.href);
            return u.origin === window.location.origin && u.pathname.indexOf('/api/') === 0;
        } catch (e) { return false; }
    }

    function cerrarSesion() {
        if (window.__renewSesionCerrada) return;
        window.__renewSesionCerrada = true;
        try {
            localStorage.removeItem('rs_user');
            localStorage.removeItem('rs_token');
        } catch (e) { /* almacenamiento bloqueado */ }
        alert('Tu sesión expiró o se actualizó el sistema. Inicia sesión de nuevo.');
        (window.top || window).location.href = '/index.html#login';
    }

    window.fetch = function (input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if (!esApiPropia(url)) return fetchOriginal(input, init);

        var token = null;
        try { token = localStorage.getItem('rs_token'); } catch (e) { /* sin acceso */ }
        init = init || {};
        if (token) {
            var headers = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
            if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
            init = Object.assign({}, init, { headers: headers });
        }
        return fetchOriginal(input, init).then(function (res) {
            if (res.status === 401 && res.headers.get('x-sesion') === 'invalida') cerrarSesion();
            return res;
        });
    };
})();

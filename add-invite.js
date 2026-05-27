const fs = require('fs');

// 1. Modificar admin.html
let html = fs.readFileSync('admin.html', 'utf8');

// Insertar el botón en el header (junto a Create Task)
html = html.replace(
  '<button id="btn-global-action"',
  `<button id="btn-global-invite" onclick="window.openInviteModal()" class="flex items-center gap-2 px-4 py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-xl transition-all border border-blue-500/20 shadow-sm shadow-blue-500/10 mr-2">
                    <i class="fa-solid fa-user-plus text-sm"></i> 
                    <span class="text-xs uppercase tracking-widest font-black">Invitar</span>
                </button>
                <button id="btn-global-action"`
);

// Insertar el modal justo antes del modal-nuclear-usr
const inviteModal = `
    <!-- MODAL: INVITAR TRABAJADOR -->
    <div id="modal-nuclear-invite" class="fixed inset-0 bg-black/60 backdrop-blur-sm nuclear-hidden flex items-center justify-center z-[100] p-6">
        <div class="bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 w-full max-w-[600px] rounded-[3rem] shadow-2xl p-12 max-h-[95vh] overflow-y-auto hide-scrollbar animate-scaleIn">
            <h3 class="text-xl text-gray-800 dark:text-white font-bold mb-4 flex items-center gap-2">
                <i class="fa-solid fa-envelope-open-text text-blue-500"></i> Invitar Trabajador
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-6">Selecciona un trabajador existente para generarle su invitación de acceso a la plataforma.</p>
            
            <div class="mb-6">
                <label class="aqua-label">Seleccionar Trabajador</label>
                <select id="inp-invite-worker" class="w-full bg-bgLight dark:bg-bgDark transition-colors duration-300 border border-gray-300 dark:border-gray-600 rounded p-3 text-gray-800 dark:text-white focus:border-blue-500 focus:outline-none">
                    <option value="">Cargando trabajadores...</option>
                </select>
            </div>

            <div id="invite-preview-box" class="hidden mb-6">
                <label class="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">Vista Previa del Mensaje</label>
                <div class="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono" id="invite-preview-text" style="font-size: 0.8rem; line-height: 1.4;">
                </div>
            </div>

            <div class="flex gap-3 justify-end mt-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button class="btn-cancel-invite text-gray-500 dark:text-gray-400 dark:text-white px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">Cancelar</button>
                <button id="btn-send-invite-wa" class="bg-[#25D366] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#128C7E] shadow-lg shadow-[#25D366]/20 flex items-center gap-2 transition-all hidden">
                    <i class="fa-brands fa-whatsapp text-lg"></i> Enviar WhatsApp
                </button>
                <button id="btn-send-invite-email" class="bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all hidden">
                    <i class="fa-solid fa-envelope text-lg"></i> Enviar Correo
                </button>
            </div>
        </div>
    </div>
`;
html = html.replace('<!-- MODAL: AÑADIR USUARIO / TRABAJADOR -->', inviteModal + '\\n    <!-- MODAL: AÑADIR USUARIO / TRABAJADOR -->');
fs.writeFileSync('admin.html', html);


// 2. Modificar js/admin-app.js
let js = fs.readFileSync('js/admin-app.js', 'utf8');

const inviteLogic = `
// ==========================================
// LOGICA DE INVITACION DE TRABAJADORES
// ==========================================
window.openInviteModal = function() {
    const modal = document.getElementById('modal-nuclear-invite');
    if (!modal) return;
    
    const select = document.getElementById('inp-invite-worker');
    const previewBox = document.getElementById('invite-preview-box');
    const previewText = document.getElementById('invite-preview-text');
    const btnWa = document.getElementById('btn-send-invite-wa');
    const btnEmail = document.getElementById('btn-send-invite-email');
    
    select.innerHTML = '<option value="">Selecciona un trabajador...</option>';
    previewBox.classList.add('hidden');
    btnWa.classList.add('hidden');
    btnEmail.classList.add('hidden');
    
    // Poblar trabajadores
    const users = db.Usuarios || [];
    users.sort((a,b) => (a.nombre || '').localeCompare(b.nombre || '')).forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = \`\${u.nombre} \${u.apellido || ''} - \${u.rol}\`;
        select.appendChild(opt);
    });
    
    modal.classList.remove('nuclear-hidden');
    
    select.onchange = () => {
        const userId = select.value;
        const user = users.find(u => u.id === userId);
        if (!user) {
            previewBox.classList.add('hidden');
            btnWa.classList.add('hidden');
            btnEmail.classList.add('hidden');
            return;
        }
        
        const platformLinkApp = "https://renewgroup.site/index.html";
        const platformLinkAdmin = "https://renewgroup.site/admin.html";
        const isWorkerApp = user.rol === 'Vendedor' || user.rol === 'Representante de Ventas' || user.rol === 'Técnico';
        const mainLink = isWorkerApp ? platformLinkApp : platformLinkAdmin;
        
        const msg = \`¡Hola \${user.nombre}! <i class="fa-solid fa-handshake"></i>\\n\\nTe damos la bienvenida al equipo Renew. A continuación, te compartimos tus credenciales de acceso a nuestra plataforma.\\n\\n<i class="fa-solid fa-link"></i> Enlace de acceso: \${mainLink}\\n✉️ Usuario: \${user.email}\\n🔑 Contraseña: \${user.pass}\\n\\nSi tienes alguna duda, no dudes en contactar al administrador.\\n¡Éxitos!\`;
        
        previewText.textContent = msg;
        previewBox.classList.remove('hidden');
        
        if (user.tel) {
            btnWa.classList.remove('hidden');
            btnWa.onclick = () => {
                const phone = user.tel.replace(/\\D/g, '');
                window.open(\`https://api.whatsapp.com/send?phone=\${phone}&text=\${encodeURIComponent(msg)}\`, '_blank');
            };
        } else {
            btnWa.classList.add('hidden');
        }
        
        if (user.email) {
            btnEmail.classList.remove('hidden');
            btnEmail.onclick = () => {
                window.open(\`mailto:\${user.email}?subject=\${encodeURIComponent('Tus Credenciales de Renew')}&body=\${encodeURIComponent(msg)}\`, '_blank');
            };
        } else {
            btnEmail.classList.add('hidden');
        }
    };
};

document.addEventListener('DOMContentLoaded', () => {
    const cancelBtns = document.querySelectorAll('.btn-cancel-invite');
    cancelBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById('modal-nuclear-invite');
            if (modal) modal.classList.add('nuclear-hidden');
        });
    });
});
`;

js = js + "\\n" + inviteLogic;
fs.writeFileSync('js/admin-app.js', js);
console.log('Invite logic injected');

/* ============================================================
   RENEW SOLAR – app.js
   SPA Router + Auth State
   ============================================================ */
window.appNavigate = (screen, param) => navigate(screen, param);

// Plantillas: navigate to full screen instead of modal
window.showPlantillasModal = () => {
    if (window.appNavigate) window.appNavigate('plantillas');
};

window.closeModals = () => {
    const ids = ['modal-calendar-event', 'modal-plantillas', 'modal-nuevo-cliente'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
            el.classList.add('nuclear-hidden');
        }
    });
};

import { initDB, getCurrentUser, logout } from './api.js';
export { getCurrentUser, logout }; // Re-export for compatibility

import { renderLogin }    from './screens/login.js';
import { renderHub }       from './screens/hub.js';
import { renderDashboard } from './screens/dashboard.js?v=2';
import { renderNotificaciones } from './screens/notificaciones.js';
import { renderNewClient }  from './screens/newClient.js';
import { renderDetail }     from './screens/projectDetail.js';
import { renderAcademy }    from './screens/academy.js';
import { renderMenu }       from './screens/menu.js?v=2';
import { renderInventoryTech } from './screens/inventory.js';
import { renderClients } from './screens/clients.js?v=3';
import { renderCallCenter } from './screens/callCenter.js';
import { renderMiCalendario } from './screens/calendar.js?v=6';
import { renderMiMapa } from './screens/mapa.js';
import { renderMiEquipo } from './screens/equipo.js';
import { renderPartners } from './screens/partners.js';
import { renderMisRecibos } from './screens/recibos.js?v=2';
import { renderListaPrecios } from './screens/listadeprecios.js';
import { renderCatalogo } from './screens/catalogo.js';
import { renderPlantillas }  from './screens/plantillas.js';
import { renderConfirmacionInstalacion } from './screens/confirmacionInstalacion.js';
import { renderPlantillaPozo } from './screens/plantillaPozo.js';
import { renderMisAdelantos } from './screens/adelantos.js'; // RRHH Adelantos
import { _renderToolsForPipeline } from './screens/dashboard.js?v=2';
import { t, getLang } from './i18n.js';
import { openChat } from './components/internal-chat.js';

window.openInternalChat = openChat;

// expose for window.switchLang toast
import { showToast } from './components/toast.js';
window._showToast = showToast;

import { advanceDealPhase, syncKanbanActivity, createDynamicDeal } from './api.js';

// Listen for cross-frame messages (e.g., from Work Order iframe)
window.addEventListener('message', async (e) => {
  if (e.data && e.data.type === 'SEARCH_CLIENTS') {
    try {
      const response = await fetch(`/api/search-clients?q=${encodeURIComponent(e.data.query)}`);
      const results = await response.json();
      e.source.postMessage({ type: 'SEARCH_CLIENTS_RESULT', data: results }, '*');
    } catch (err) {
      console.error('[APP] Error searching clients:', err);
    }
    return;
  }

  if (e.data && (e.data.type === 'WORK_ORDER_SUBMITTED' || e.data.type === 'CREDIT_APP_SUBMITTED')) {
    console.log(`[APP] Received ${e.data.type} message:`, e.data);
    try {
      let { proyectoId, formData, isNewClient } = e.data;
      const db = getDB();

      if (isNewClient && !proyectoId) {
          console.log('[APP] isNewClient flag detected. Skipping local auto-create to prevent duplicates (relying on n8n webhook).');
          // Close modals and navigate to dashboard for a smooth UX
          if (typeof window.closeModals === 'function') window.closeModals();
          navigate('dashboard');
          showToast('Formulario enviado. El prospecto aparecerá en breve.', 'success');
          return;
      } else if (!proyectoId) {
          console.warn('[APP] No proyectoId in message, skipping advancement.');
          return;
      }

      const rawPayload = formData || {};
      
      // Flatten the payload for saving to dynamic responses and webhook
      const flatResp = {};
      
      // Flatten helper (recursive)
      const flatten = (obj, prefix = '') => {
        for (const k in obj) {
          const key = prefix ? `${prefix}_${k}` : k;
          if (obj[k] && typeof obj[k] === 'object' && !obj[k].startsWith?.('data:')) {
            flatten(obj[k], key);
          } else {
            flatResp[key] = obj[k];
          }
        }
      };
      
      if (formData) flatten(formData);

      // Specific mapping for known fields the user wants in the webhook
      if (rawPayload.instalacion) {
        flatResp.fecha_instalacion = rawPayload.instalacion.fechaEstimada;
        flatResp.hora_instalacion = rawPayload.instalacion.horario;
      }

      // Auto-satisfy the dynamic field requirement for this phase so it can advance
      const isWorkOrder = (e.data.type === 'WORK_ORDER_SUBMITTED');
      
      // Find the project in the local database
      let project = (db.Proyectos_Dinamicos || []).find(p => p.id === proyectoId);
      
      // Fallback: search for normalized ID if not found directly
      if (!project) {
          const normalized = String(proyectoId).toLowerCase().replace('renew-', '').replace(/-/g, '_');
          project = (db.Proyectos_Dinamicos || []).find(p => p.id === normalized || p.id === `proy_${normalized}`);
          if (project) {
              console.log(`[APP] Found project via normalization: ${project.id}`);
              proyectoId = project.id;
          }
      }

      if (!project) {
          console.warn(`[APP] Project ${proyectoId} not found in local DB. Advancement might fail.`);
      }

      const dynamicField = db.Admin_Campos_Formulario?.find(c => 
        c.tipo === (isWorkOrder ? 'Orden de Trabajo' : 'Aplicación de Crédito') && 
        c.fase_id === project?.fase_id
      );
      
      if (dynamicField) {
        console.log(`[APP] Mapping form to field: ${dynamicField.id} (${dynamicField.etiqueta})`);
        flatResp[dynamicField.id] = 'Completado';
      }

      // ── NEW: Update local Client Profile metadata immediately ──
      if (project && e.data.pdfUrl) {
          const client = db.Clientes_Maestro?.find(c => c.id === project.cliente_id);
          const { saveGranular: sgLocal } = await import('./api.js');
          
          if (client) {
              console.log(`[APP] Syncing PDF URL to local client: ${client.id}`);
              if (!client.adjuntos_oficina || Array.isArray(client.adjuntos_oficina)) client.adjuntos_oficina = {};
              if (isWorkOrder) {
                  client.adjuntos_oficina.orden_trabajo_url = e.data.pdfUrl;
                  client.adjuntos_oficina.ultima_orden_fecha = new Date().toISOString();
              } else {
                  client.adjuntos_oficina.app_url = e.data.pdfUrl;
                  client.adjuntos_oficina.ultima_credit_fecha = new Date().toISOString();
              }
              await sgLocal('clientes_maestro', [client]);
          }
          
          console.log(`[APP] Syncing PDF URL to local project: ${project.id}`);
          // removed non-existent url assignments
          await sgLocal('proyectos_dinamicos', [project]);
      }

      // Log activity in Kanban
      if (project) {
        syncKanbanActivity({
          proyecto_id: proyectoId,
          evento: 'FORMULARIO_COMPLETADO',
          fase_nombre: isWorkOrder ? 'Orden de Trabajo' : 'Aplicación de Crédito',
          responsable_id: (getCurrentUser())?.id
        });
      }

      // Advance phase and pass flattened responses to the webhook
      const advOptions = {};
      if (e.data.type === 'CREDIT_APP_SUBMITTED' && project) {
        const curFase = db.Admin_Fases?.find(f => f.id === project.fase_id);
        if (curFase && curFase.nombre.toLowerCase().includes('aprobación')) {
          advOptions.preventAutoAdvance = true;
          advOptions.forceNotify = true;
        }
      }

      console.log(`[APP] Advancing phase for project: ${proyectoId}...`);
      const res = await advanceDealPhase(proyectoId, flatResp, advOptions);
      console.log('[APP] Advance result:', res);

      // ── WORK ORDER: persist schedule on project for later reference ───────
      if (isWorkOrder && project && rawPayload?.instalacion) {
        try {
          const horarioOrden = rawPayload.instalacion.horario || '';
          const fechaOrden   = rawPayload.instalacion.fechaEstimada || '';
          project.horario_instalacion = horarioOrden;
          project.fecha_instalacion   = fechaOrden;
          const { saveGranular: sg } = await import('./api.js');
          await sg('proyectos_dinamicos', [project]);
          console.log('[APP] Work order schedule saved to project:', horarioOrden, fechaOrden);
        } catch (woErr) {
          console.error('[APP] Error saving work order schedule:', woErr);
        }
      }
      // ── END WORK ORDER SCHEDULE PERSISTENCE ─────────────────────────────

      let successMsg = '';
      if (res.didAdvance) {
        successMsg = isWorkOrder 
          ? 'Orden de Trabajo Procesada. Fase avanzada automáticamente.'
          : 'Aplicación de Crédito Procesada. Fase avanzada automáticamente.';
      } else if (advOptions.preventAutoAdvance) {
        successMsg = 'Aplicación de Crédito enviada a Administración. Pendiente de aprobación.';
      } else {
        successMsg = 'Formulario guardado. Completa los campos restantes para avanzar.';
      }
        
      showToast(successMsg, 'success');
      navigate('dashboard');
    } catch(err) {
      console.error('[APP ERROR]', err);
      showToast('Error procesando formulario: ' + err.message, 'error');
    }
  }

  if (e.data && e.data.type === 'CONTRACT_SUBMITTED') {
    try {
      console.log('[APP] Received CONTRACT_SUBMITTED:', e.data);
      const db = getDB();
      let proyectoId = e.data.proyectoId;
      let project = (db.Proyectos_Dinamicos || []).find(p => p.id === proyectoId);

      // Fallback: search for normalized ID
      if (!project && proyectoId) {
          const normalized = String(proyectoId).toLowerCase().replace('renew-', '').replace(/-/g, '_');
          project = (db.Proyectos_Dinamicos || []).find(p => p.id === normalized || p.id === `proy_${normalized}`);
          if (project) proyectoId = project.id;
      }

      const responses = {};
      if (project) {
          const contractField = db.Admin_Campos_Formulario?.find(c => 
              c.tipo === 'Contrato' && c.fase_id === project.fase_id
          );
          if (contractField) {
              responses[contractField.id] = e.data.contractUrl || 'Completado';
          }
      }

      // 1. Advance phase (will only actually advance if all other fields are filled)
      const res = await advanceDealPhase(proyectoId, responses);
      
      // 2. Save signature and PDF URL to client record as "Contract" evidence
      if (project) {
          const client = (db.Clientes_Maestro || []).find(c => c.id === project.cliente_id);
          if (client) {
              if (!client.adjuntos_oficina || Array.isArray(client.adjuntos_oficina)) client.adjuntos_oficina = {};
              
              // Determinar prefijo por pipeline
              const pip = (db.Admin_Pipelines || []).find(p => p.id === project.pipeline_id);
              const prefix = (pip?.nombre || '').toLowerCase().includes('solar') ? 'solar' : 'water';

              if (e.data.contractUrl) {
                  client.adjuntos_oficina[`contrato_${prefix}_url`] = e.data.contractUrl;
                  client.adjuntos_oficina.contrato_url = e.data.contractUrl; // Main fallback
                  // Also update top-level column if it exists in local state
                  client[`contrato_${prefix}_url`] = e.data.contractUrl;
              }
              
              await saveDB(db);
              console.log(`[APP] Contract/Signature (${prefix}) saved to client:`, client.id);
          }

          // Log activity in Kanban
          syncKanbanActivity({
            proyecto_id: proyectoId,
            evento: 'FORMULARIO_COMPLETADO',
            fase_nombre: 'Contrato',
            responsable_id: (getCurrentUser())?.id
          });
      }

      if (res.didAdvance) {
        showToast('Contrato Procesado. Fase avanzada automáticamente.', 'success');
        navigate('dashboard');
      } else {
        showToast('Contrato Guardado. Completa los campos restantes para avanzar.', 'info');
        // Refresh detail view and switch screen back to detail
        if (proyectoId) {
            navigate('detail', proyectoId);
            setTimeout(() => renderDetail(proyectoId), 100);
        } else {
            navigate('dashboard');
        }
      }
    } catch(err) {
      console.error(err);
      showToast('Error procesando contrato: ' + err.message, 'error');
    }
  }
});

// getCurrentUser and logout moved to api.js to break circular dependency


// ── Interceptor de Anuncios GLOBALES ──────────────────────────
import { saveDB, getDB } from './api.js';
window.getDB = getDB;
window.saveDB = saveDB;

// ── Test function para probar el webhook de WhatsApp directamente desde la consola ──
window.testWpWebhook = async function() {
  const WH = 'https://n8n.renewgroup.site/webhook/notifiaciones-generales';
  const payload = {
    event: "notificacion_general",
    destinatario_nombre: "Test Usuario",
    destinatario_telefono: "",
    mensaje_directo: "Mensaje de prueba desde la consola.",
    mensaje_admin: "[Notificación para Test] Mensaje de prueba desde la consola.",
    link: "https://renewgroup.site/index.html#hub",
    timestamp: new Date().toISOString(),
    is_admin_only: false
  };
  console.log('[TEST WP] Enviando a:', WH);
  try {
    const r = await fetch(WH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    console.log('[TEST WP] Status:', r.status, r.statusText);
    const txt = await r.text();
    console.log('[TEST WP] Response:', txt);
  } catch(e) {
    console.error('[TEST WP] Error:', e);
  }
};

window.verificarAnunciosNuevos = async function() {
  const user = getCurrentUser();
  if (!user || !user.id) return;

  const db = getDB();
  const anuncios = db.anuncios_corporativos || [];
  const meetings = db.admin_meetings || [];
  const meetingReads = db.admin_meetings_reads || [];

  let unreadCount = 0;

  // 1. Contar anuncios no leídos
  for (let an of anuncios) {
    let pertenece = false;
    if (an.audiencia === 'todos') {
      pertenece = true;
    } else if (user.unidades) {
      pertenece = user.unidades.some(u => u.toLowerCase() === an.audiencia.toLowerCase() || an.audiencia.toLowerCase().includes(u.toLowerCase().replace('renew ', '').trim()));
    }
    
    if (pertenece) {
      let est = an.estado_lecturas.find(e => e.vendedor_id === user.id);
      if (!est) {
         est = { vendedor_id: user.id, vendedor_nombre: `${user.nombre || ''} ${user.apellido || ''}`, leido: false, fecha_lectura: null };
         an.estado_lecturas.push(est);
         await saveDB(db);
      }
      if (!est.leido) {
         unreadCount++;
      }
    }
  }

  // 2. Contar meetings no leídas
  // Use localStorage as primary source of truth (Supabase UUID columns reject custom string IDs)
  const localReadsKey = `rs_meeting_reads_${user.id}`;
  const localReadIds = JSON.parse(localStorage.getItem(localReadsKey) || '[]');

  const misMeetings = meetings.filter(mt => {
      const tags = mt.audiencia_tags || [mt.audiencia || 'Todos'];
      const isAll = tags.includes('todos') || tags.includes('Todos');
      if (isAll) return true;
      const matchesRole = tags.some(tag => tag.toLowerCase() === (user.rol || '').toLowerCase());
      const pipelinePerms = user.pipeline_perms || [];
      const matchesPipe = tags.some(tag => pipelinePerms.includes(tag) || (user.unidades || []).some(u => u.toLowerCase() === tag.toLowerCase() || tag.toLowerCase().includes(u.toLowerCase().replace('renew ', '').trim())));
      return matchesRole || matchesPipe;
  });

  for (let mt of misMeetings) {
      // Check localStorage first, then DB fallback
      const isRead = localReadIds.includes(String(mt.id))
                  || meetingReads.some(r => String(r.meeting_id) === String(mt.id) && String(r.user_id) === String(user.id));
      if (!isRead) {
          unreadCount++;
      }
  }

  // 3. Contar mensajes internos no leídos (donde el usuario es mencionado)
  const mensajes = db.mensajes_internos || [];
  let unreadChatCount = 0;
  for (let msg of mensajes) {
      if (msg.mentions && msg.mentions.includes(user.id)) {
          if (!msg.read_by || !msg.read_by.includes(user.id)) {
              unreadChatCount++;
          }
      }
  }
  window._unreadChatCount = unreadChatCount;

  // 4. Actualizar badges
  const navBadge = document.getElementById('notif-badge');
  if (navBadge) {
      if (unreadCount > 0) {
          navBadge.textContent = unreadCount;
          navBadge.style.display = 'flex';
      } else {
          navBadge.style.display = 'none';
      }
  }

  // Update all potential chat badges
  const chatBadges = document.querySelectorAll('[id^="chat-badge"]');
  chatBadges.forEach(badge => {
      if (unreadChatCount > 0) {
          badge.textContent = unreadChatCount;
          badge.classList.remove('hidden');
      } else {
          badge.classList.add('hidden');
      }
  });
}

// Check every 30 seconds
setInterval(window.verificarAnunciosNuevos, 30000);

// ── Router ──────────────────────────────────────────────────
const SCREENS = ['login', 'hub', 'dashboard', 'new-client', 'detail', 'academy', 'menu', 'inventory-tech', 'clients', 'call-center', 'credit-app', 'work-order', 'contract-app', 'mi-calendario', 'mi-mapa', 'mi-equipo', 'partners', 'mis-recibos', 'lista-precios', 'catalogo', 'notificaciones', 'plantillas', 'confirmacion-instalacion', 'plantilla-pozo', 'mis-adelantos'];

export function navigate(screen, param = null) {
  // Auth guard
  const user = getCurrentUser();
  if (screen !== 'login' && !user) {
    navigate('login');
    return;
  }

  // RBAC Guard
  if (screen === 'new-client' && user && user.rol && user.rol.toLowerCase().includes('call')) {
    import('./components/toast.js').then(m => m.showToast('Acceso denegado: Rol Call Center', 'error'));
    navigate('call-center');
    return;
  }

  if (screen === 'partners' && user) {
    const userRole = (user.rol || '').toLowerCase();
    const isAdmin = ['admin', 'administrador', 'ceo', 'desenvolvedor'].includes(userRole);
    const hasPerm = user.permisos && user.permisos.app_partners;
    if (!isAdmin && !userRole.includes('representante') && !userRole.includes('vendedor') && !userRole.includes('supervisor') && !userRole.includes('supervisión') && !hasPerm) {
      import('./components/toast.js').then(m => m.showToast('Acceso denegado', 'error'));
      navigate('dashboard');
      return;
    }
  }

  // Hide all screens
  SCREENS.forEach(id => {
    const el = document.getElementById(`screen-${id}`);
    if (el) el.classList.remove('active');
  });

  // Show target screen
  const target = document.getElementById(`screen-${screen}`);
  if (!target) return;
  target.classList.add('active');

  // Render screen content
  switch (screen) {
    case 'login':       renderLogin();              break;
    case 'hub':         renderHub();                break;
    case 'dashboard':   renderDashboard();          break;
    case 'notificaciones':    renderNotificaciones();           break;
    case 'new-client':  renderNewClient();          break;
    case 'detail':      renderDetail(param);        break;
    case 'academy':     renderAcademy();            break;
    case 'menu':        renderMenu();               break;
    case 'inventory-tech': renderInventoryTech(param);   break;
    case 'clients':
      renderClients().then(() => {
        if (param === 'new') {
          setTimeout(() => {
            const modal = document.getElementById('modal-nuevo-cliente');
            const title = document.querySelector('#modal-nuevo-cliente h3');
            if (title) title.textContent = 'Nuevo Prospecto';
            if (modal) modal.style.display = 'flex';
            
            // Prepare map container
            const mapCont = document.getElementById('quick-map-container');
            if (mapCont) mapCont.style.display = 'block';
            const dirInput = document.getElementById('quick-direccion');
            if (dirInput) dirInput.dataset.quickMapsLoaded = '';
            
            if (window.initQuickMaps) window.initQuickMaps();
          }, 450);
        }
      }).catch(() => {});
      break;
    case 'call-center': renderCallCenter();         break;
    case 'mi-calendario': renderMiCalendario();     break;
    case 'mi-mapa': renderMiMapa();                 break;
    case 'mi-equipo': renderMiEquipo();             break;
    case 'partners': renderPartners();               break;
    case 'mis-recibos': renderMisRecibos();          break;
    case 'lista-precios': renderListaPrecios();      break;
    case 'catalogo': renderCatalogo();               break;
    case 'plantillas':  renderPlantillas();          break;
    case 'confirmacion-instalacion': renderConfirmacionInstalacion(param); break;
    case 'plantilla-pozo': renderPlantillaPozo(param); break;
    case 'mis-adelantos': renderMisAdelantos(); break;
    case 'credit-app':
      setTimeout(() => _sizeIframeScreen('credit-app', 'iframe-credit-app'), 50);
      break;
    case 'work-order':
      setTimeout(() => _sizeIframeScreen('work-order', 'iframe-work-order'), 50);
      break;
    case 'contract-app':
      setTimeout(() => _sizeIframeScreen('contract-app', 'iframe-contract-app'), 50);
      break;
  }

  // Update hash (for browser history / deep linking)
  // For detail screen, serialize param as path: #detail/PROYECTO_ID
  let hashParam;
  if (screen === 'detail' && param && typeof param === 'object') {
    hashParam = param.projectId || param.dealId || null;
  } else {
    hashParam = (param && typeof param !== 'object') ? param : null;
  }
  const hash = hashParam ? `#${screen}/${hashParam}` : `#${screen}`;
  if (window.location.hash !== hash) {
    window.history.pushState({ screen, param }, '', hash);
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'instant' });

  // Update Nav Highlight & Visibility
  // Toggle Navigation (Sidebar/Bottom-Nav)
  const bNav = document.getElementById('bottom-nav');
  const isNavHidden = ['login', 'credit-app', 'work-order', 'contract-app'].includes(screen);
  
  if (isNavHidden) {
    document.body.classList.add('no-nav');
    document.body.classList.remove('on-dashboard');
    document.body.classList.remove('in-call-center');
    if (bNav) bNav.style.display = 'none';
  } else {
    document.body.classList.remove('no-nav');
    
    if (screen === 'dashboard') {
        document.body.classList.add('on-dashboard');
    } else {
        document.body.classList.remove('on-dashboard');
    }

    if (screen === 'call-center') {
        document.body.classList.add('in-call-center');
    } else {
        document.body.classList.remove('in-call-center');
    }
    
    if (bNav) {
      bNav.style.display = 'flex';
      // Force visibility on desktop
      if (window.innerWidth >= 1024) {
          bNav.style.display = 'flex';
          bNav.style.visibility = 'visible';
          bNav.style.opacity = '1';
      }
    }
  }

  // Populate sidebar tools if not already done (happens when landing on any non-dashboard screen)
  if (!['login', 'hub'].includes(screen)) {
    _ensureSidebarPopulated();
  }
  updateNavHighlight(screen);

  // Trigger Anuncios Interceptor for internal screens
  if (!['login', 'hub'].includes(screen)) {
     if (window.verificarAnunciosNuevos) {
        setTimeout(() => window.verificarAnunciosNuevos(), 600);
     }
  }
}

export function updateNavHighlight(activeScreen) {
  const bNav = document.getElementById('bottom-nav');
  if (!bNav) return;
  
  const user = getCurrentUser();
  const isCallCenter = user && (user.rol || '').toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim().includes('call');
  const isTecnico = user && /t[eé]cn[io]co/i.test(user.rol || '');

  // Global role classes for CSS
  document.body.classList.toggle('is-tecnico', !!isTecnico);
  document.body.classList.toggle('is-callcenter', !!isCallCenter);

  // Force nav visibility if somehow hidden
  if (isCallCenter && !['login', 'hub', 'credit-app', 'work-order', 'contract-app'].includes(activeScreen)) {
      document.body.classList.remove('no-nav');
      bNav.style.display = 'flex';
      if (window.innerWidth >= 768) {
          bNav.style.visibility = 'visible';
          bNav.style.opacity = '1';
      }
  }

  // Update nav labels with current language
  const navLabels = {
    'dashboard':    t('nav_home'),
    'clients':      isTecnico ? t('nav_clients_tech') : (isCallCenter ? 'Mis Llamadas' : t('nav_clients')),
    'academy':      t('nav_academy'),
    'mi-equipo':    t('nav_team'),
    'menu':         t('nav_menu'),
  };
  bNav.querySelectorAll('.nav-item').forEach(item => {
    const sc = item.dataset.screen;
    if (sc && navLabels[sc]) {
      const span = item.querySelector('span');
      // Don't overwrite the + button label
      if (span && span.id !== 'nav-plus-label') span.textContent = navLabels[sc];
    }

    // Hide 'Nuevo' for call_center or tecnico
    if (item.classList.contains('nav-item-plus')) {
        item.style.display = (isCallCenter || isTecnico) ? 'none' : 'flex';
    }

    // Check permissions for specific static nav items
    if (sc === 'mi-calendario') {
        const canCalendario = (user && user.permisos && 'app_calendario' in user.permisos) ? user.permisos.app_calendario : true;
        if (!canCalendario) {
            item.style.display = 'none';
        } else if (item.style.display === 'none') {
            item.style.display = 'flex';
        }
    }

    const screenMatch = item.dataset.screen === activeScreen;
    if (screenMatch) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update theme button label
  const themeBtn = document.getElementById('btn-theme-toggle');
  if (themeBtn) {
    const span = themeBtn.querySelector('span');
    if (span) span.textContent = t('nav_theme');
  }
}


// ── Hash-based navigation (back button support) ─────────────
function handleHashChange() {
  const hash = window.location.hash.replace('#', '');
  if (!hash) {
    const user = getCurrentUser();
    navigate(user ? 'dashboard' : 'login');
    return;
  }

  const parts = hash.split('/');
  const screen = parts[0];
  const param  = parts[1] || null;

  if (SCREENS.includes(screen)) {
    // Auth guard
    const user = getCurrentUser();
    if (screen !== 'login' && !user) {
      navigate('login');
      return;
    }

    // RBAC Guard
    if (screen === 'new-client' && user && (user.rol === 'call_center' || user.role === 'call_center')) {
      navigate('dashboard');
      return;
    }
    // Render without pushing to history again
    SCREENS.forEach(id => {
      const el = document.getElementById(`screen-${id}`);
      if (el) el.classList.remove('active');
    });
    const target = document.getElementById(`screen-${screen}`);
    if (target) target.classList.add('active');

    switch (screen) {
      case 'login':      renderLogin();           break;
      case 'hub':        renderHub();             break;
      case 'dashboard':  renderDashboard();       break;
      case 'notificaciones': renderNotificaciones(); break;
      case 'new-client': renderNewClient();       break;
      case 'detail': {
        // Hash format: #detail/PROYECTO_ID
        const projId = parts[1];
        if (projId) {
          renderDetail(projId);
        } else {
          navigate('dashboard');
        }
        break;
      }
      case 'academy':    renderAcademy();         break;
      case 'menu':       renderMenu();            break;
      case 'inventory-tech': renderInventoryTech(param); break;
      case 'clients':
        renderClients().then(() => {
          if (param === 'new') {
            setTimeout(() => {
              const modal = document.getElementById('modal-nuevo-cliente');
              const title = document.querySelector('#modal-nuevo-cliente h3');
              if (title) title.textContent = 'Nuevo Prospecto';
              if (modal) modal.style.display = 'flex';

              // Prepare map container
              const mapCont = document.getElementById('quick-map-container');
              if (mapCont) mapCont.style.display = 'block';
              const dirInput = document.getElementById('quick-direccion');
              if (dirInput) dirInput.dataset.quickMapsLoaded = '';

              if (window.initQuickMaps) window.initQuickMaps();
            }, 450);
          }
        }).catch(() => {});
        break;
      case 'call-center': renderCallCenter(); break;

      case 'mi-calendario': renderMiCalendario(); break;
      case 'mi-mapa': renderMiMapa(); break;
      case 'mi-equipo': renderMiEquipo(); break;
      case 'partners': renderPartners(); break;
      case 'mis-recibos': renderMisRecibos(); break;
      case 'lista-precios': renderListaPrecios(); break;
      case 'catalogo': renderCatalogo(); break;
      case 'plantillas':  renderPlantillas();  break;
      case 'mis-adelantos': renderMisAdelantos(); break;
      case 'contract-app': /* iframe */ break;
      case 'work-order': /* iframe */ break;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Toggle Bottom Nav & Highlight
    // Toggle Navigation (Sidebar/Bottom-Nav)
    const bNav = document.getElementById('bottom-nav');
    const isNavHidden = ['login', 'hub', 'credit-app', 'work-order', 'contract-app'].includes(screen);
    
    if (isNavHidden) {
      document.body.classList.add('no-nav');
      document.body.classList.remove('in-call-center');
      if (bNav) bNav.style.display = 'none';
    } else {
      document.body.classList.remove('no-nav');
      if (screen === 'call-center') {
          document.body.classList.add('in-call-center');
      } else {
          document.body.classList.remove('in-call-center');
      }
      if (bNav) bNav.style.display = 'flex';
    }
    // Ensure sidebar is populated even when landing on non-dashboard screens
    _ensureSidebarPopulated();
    updateNavHighlight(screen);

    // Trigger Anuncios Interceptor for internal screens
    if (!['login', 'hub'].includes(screen)) {
       if (window.verificarAnunciosNuevos) {
          setTimeout(() => window.verificarAnunciosNuevos(), 600);
       }
    }
  }
}

window.addEventListener('popstate', handleHashChange);

window.addEventListener('hashchange', handleHashChange);

// Ensure sidebar tools are populated whenever the user is logged in
// (in case they refresh on a screen other than dashboard)
function _ensureSidebarPopulated() {
  const user = getCurrentUser();
  if (user) {
    const activeUnit = localStorage.getItem('active_unit') || 'Renew Solar';
    _renderToolsForPipeline(user, activeUnit);
  }
}

// ── Theme & Sidebar – registered ONCE at module level ──────
const _applyTheme = (theme) => {
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
    document.documentElement.classList.add('dark');
  } else {
    document.body.classList.remove('dark-theme');
    document.documentElement.classList.remove('dark');
  }
  const themeStatusText = document.getElementById('theme-status-text');
  if (themeStatusText) {
    themeStatusText.innerText = (theme === 'dark') ? t('menu_theme_dark') : t('menu_theme_light');
  }
};

let lastThemeToggle = 0;
document.addEventListener('click', (e) => {
  const themeBtn = e.target.closest('#btn-theme-toggle') || e.target.closest('#btn-theme-toggle-mobile');
  const sidebarToggleBtn = e.target.closest('#btn-toggle-sidebar');

  if (sidebarToggleBtn) {
    e.preventDefault();
    e.stopPropagation();
    document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebar_collapsed', document.body.classList.contains('sidebar-collapsed'));
    return;
  }

  if (themeBtn) {
    e.preventDefault();
    e.stopImmediatePropagation();
    const now = Date.now();
    if (now - lastThemeToggle < 500) return;
    lastThemeToggle = now;
    const isCurrentlyDark = document.body.classList.contains('dark-theme');
    const newTheme = isCurrentlyDark ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    _applyTheme(newTheme);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: newTheme } }));
    import('./components/toast.js').then(m => m.showToast(
      newTheme === 'dark' ? '<i class="fa-solid fa-moon"></i> Modo Oscuro' : '☀️ Modo Claro',
      'success'
    ));
  }
});

// ── Bootstrap ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await initDB(); // Sync with local server
  
  const user = getCurrentUser();
  const hash = window.location.hash.replace('#', '');

  // We removed the forced Admin redirect from here to allow switching views.
  // It is now only handled during the actual Login process.


  if (hash && SCREENS.includes(hash.split('/')[0])) {
    handleHashChange();
  } else {
    // ── Deep Link Handler (from WhatsApp notifications) ──
    const urlParams = new URLSearchParams(window.location.search);
    const deepProyecto = urlParams.get('deepProyecto');
    const deepCliente  = urlParams.get('deepCliente');
    const deepScreen   = urlParams.get('deepScreen');

    // Also support LEGACY hash format: #proyecto?id=PROYECTO_ID
    let legacyProyectoId = null;
    if (!deepProyecto && hash.startsWith('proyecto')) {
      const idMatch = hash.match(/[?&]id=([^&\s]+)/);
      if (idMatch) legacyProyectoId = decodeURIComponent(idMatch[1]);
    }

    if ((deepProyecto && deepCliente) && user) {
      // New format: ?deepProyecto=ID&deepCliente=CLIENT_ID
      navigate('dashboard');
      setTimeout(() => navigate('detail', deepProyecto), 400);
    } else if (legacyProyectoId && user) {
      // Legacy format: #proyecto?id=ID
      navigate('dashboard');
      setTimeout(() => navigate('detail', legacyProyectoId), 400);
    } else if (deepScreen && user && SCREENS.includes(deepScreen)) {
      navigate(deepScreen);
    } else if (user && user.unidades && user.unidades.length > 1 && !localStorage.getItem('active_unit')) {
      navigate('hub');
    } else {
      navigate(user ? 'dashboard' : 'login');
    }
  }

  if (user && window.initZadarmaWebRTC) {
      setTimeout(() => window.initZadarmaWebRTC(), 1000);
  }

  // Desktop Sidebar Toggle
  if (localStorage.getItem('sidebar_collapsed') === 'true') {
    document.body.classList.add('sidebar-collapsed');
  }

  // Apply saved theme on load (listener is registered at module level above)
  const currentSavedTheme = localStorage.getItem('theme') || 'light';
  _applyTheme(currentSavedTheme);


  window.addEventListener('langchange', () => {
    // Find the currently active screen
    const activeEl = document.querySelector('.screen.active');
    if (!activeEl) return;
    const activeId = activeEl.id.replace('screen-', '');

    // Re-render the screen in the new language
    switch (activeId) {
      case 'login':         renderLogin();           break;
      case 'hub':           renderHub();             break;
      case 'dashboard':     renderDashboard();       break;
      case 'notificaciones': renderNotificaciones(); break;
      case 'new-client':    renderNewClient();       break;
      case 'academy':       renderAcademy();         break;
      case 'menu':          renderMenu();            break;
      case 'inventory-tech':renderInventoryTech();   break;
      case 'clients':       renderClients();         break;
      // detail: skip – would need dealId param
    }
    // Always refresh nav labels
    updateNavHighlight(activeId);
    showToast(localStorage.getItem('app_lang') === 'en' ? '🇺🇸 Language: English' : '🇪🇸 Idioma: Español', 'success');
  });

  // ── Background DB Sync: Re-render current screen ──────────
  window.addEventListener('db_synced', () => {
    // Disabled to prevent the UI from fully reloading/flashing every 30 seconds
    /*
    const activeEl = document.querySelector('.screen.active');
    if (!activeEl) return;
    const activeId = activeEl.id.replace('screen-', '');

    switch (activeId) {
      case 'dashboard':     renderDashboard();       break;
      case 'notificaciones': renderNotificaciones(); break;
      case 'new-client':    renderNewClient();       break;
      case 'inventory-tech':renderInventoryTech(param);   break;
      case 'clients':       renderClients();         break;
      case 'academy':       renderAcademy();         break;
      // Avoid re-rendering detail if it interrupts user typing
    }
    */
  });

  // HIDE PRELOADER
  setTimeout(() => {
    const preloader = document.getElementById('preloader');
    if (preloader) preloader.classList.add('fade-out');
  }, 1000); // Give it a second to look cool
});

// ── GLOBAL USER SYNC ─────────────────────────────────────────
window.addEventListener('user_updated', (e) => {
    const user = e.detail;
    const avatarBtn = document.getElementById('avatar-btn');
    if (avatarBtn) {
        if (user.foto) {
            avatarBtn.style.backgroundImage = `url(${user.foto})`;
            avatarBtn.style.backgroundSize = 'cover';
            avatarBtn.style.backgroundPosition = 'center';
            avatarBtn.style.color = 'transparent';
            avatarBtn.style.border = '2px solid rgba(255,255,255,0.15)';
            avatarBtn.textContent = '';
        } else {
            avatarBtn.style.backgroundImage = '';
            avatarBtn.style.color = '';
            avatarBtn.style.border = '';
            const initials = (user.initials || (user.nombre[0] + (user.apellido ? user.apellido[0] : ''))).toUpperCase();
            avatarBtn.textContent = initials;
        }
    }
});

// Sizes iframe screens to exactly fill the viewport below their header.
function _sizeIframeScreen(screenId, iframeId) {
  const section = document.getElementById(`screen-${screenId}`);
  const iframe  = document.getElementById(iframeId);
  if (!section || !iframe) return;

  const header  = section.querySelector('.iframe-screen-header');
  if (header) {
      header.style.display = 'flex';
      header.style.flexShrink = '0';
  }

  // Use flexbox instead of manual pixel calculation to avoid black bars
  iframe.style.flex = '1 1 auto';
  iframe.style.height = '0';
  iframe.style.minHeight = '0';
  iframe.style.width = '100%';
  iframe.style.border = 'none';
  iframe.style.display = 'block';

  // Re-apply on resize (handles orientation changes and desktop resizes)
  if (!section._resizeHandler) {
    section._resizeHandler = () => {
      if (section.classList.contains('active')) {
        _sizeIframeScreen(screenId, iframeId);
      }
    };
    window.addEventListener('resize', section._resizeHandler);
  }
}



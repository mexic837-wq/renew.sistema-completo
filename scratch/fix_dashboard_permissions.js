const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js/screens/dashboard.js');
let content = fs.readFileSync(filePath, 'utf8');

// We are going to replace the TOOLS and commonTools definition block.
// The block starts at `const TOOLS = {` and ends right before `const pipTools = (TOOLS[activeUnit] || TOOLS['Renew Solar']).filter(Boolean);`

const replacement = `const TOOLS = {
    'Renew Water': [
      ((user.permisos && 'app_callcenter' in user.permisos) ? user.permisos.app_callcenter : (['admin', 'administrador', 'ceo'].includes(userRole) || userRole.includes('call'))) ? {
        name: 'Gestión de Leads (Fase 1)', tag: 'Call Center',
        gradient: 'linear-gradient(90deg,#00f5d4,#00bbf9)',
        iconBg: 'rgba(0,245,212,0.12)', iconColor: '#00f5d4',
        icon: \`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>\`,
        action: () => window.appNavigate('call-center'), delay: '0s', screen: 'call-center'
      } : null,
      ((user.permisos && 'app_clientes' in user.permisos) ? user.permisos.app_clientes : (canWater || isTecnico)) ? {
        name: isTecnico ? t('nav_clients_tech') : (userRole.includes('call') ? 'Mis Llamadas' : 'Mis Clientes'), tag: 'Renew Water',
        gradient: 'linear-gradient(90deg,#22c55e,#16a34a)',
        iconBg: 'rgba(34,197,94,0.12)', iconColor: '#22c55e',
        icon: \`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>\`,
        action: () => window.appNavigate('clients'), delay: '0s', screen: 'clients'
      } : null,
      ((user.permisos && 'app_plantillas' in user.permisos) ? user.permisos.app_plantillas : (canWater && !isTecnico)) ? {
        name: 'Plantillas', tag: 'Renew Water',
        gradient: 'linear-gradient(90deg,#2563eb,#0d9488)',
        iconBg: 'rgba(37,99,235,0.12)', iconColor: '#2563eb',
        icon: \`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>\`,
        action: () => window.showPlantillasModal(), delay: '0s'
      } : null,
      canInventory ? {
        name: 'Inventario Real', tag: null,
        gradient: 'linear-gradient(90deg,#3b82f6,#6366f1)',
        iconBg: 'rgba(59,130,246,0.1)', iconColor: 'var(--info)',
        icon: \`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>\`,
        action: () => window.appNavigate('inventory-tech'), delay: '0.12s', screen: 'inventory-tech'
      } : null,
      ((user.permisos && 'app_pagos' in user.permisos) ? user.permisos.app_pagos : (canWater || isTecnico)) ? {
        name: 'Mis Recibos de Pagos', tag: 'Renew Water',
        gradient: 'linear-gradient(90deg,#8b5cf6,#6366f1)',
        iconBg: 'rgba(139,92,246,0.12)', iconColor: '#8b5cf6',
        icon: \`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>\`,
        action: () => window.appNavigate('mis-recibos'), delay: '0.15s', screen: 'mis-recibos'
      } : null,
      ((user.permisos && 'app_precios' in user.permisos) ? user.permisos.app_precios : canWater) ? {
        name: 'Lista de Precios', tag: 'Renew Water',
        gradient: 'linear-gradient(90deg,#ec4899,#f43f5e)',
        iconBg: 'rgba(236,72,153,0.12)', iconColor: '#ec4899',
        icon: \`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/></svg>\`,
        action: () => window.appNavigate('lista-precios'), delay: '0.18s', screen: 'lista-precios'
      } : null,
    ],
    'Renew Solar': [
      ((user.permisos && 'app_callcenter' in user.permisos) ? user.permisos.app_callcenter : (['admin', 'administrador', 'ceo'].includes(userRole) || userRole.includes('call'))) ? {
        name: 'Gestión de Leads (Fase 1)', tag: 'Call Center',
        gradient: 'linear-gradient(90deg,#00f5d4,#00bbf9)',
        iconBg: 'rgba(0,245,212,0.12)', iconColor: '#00f5d4',
        icon: \`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>\`,
        action: () => window.appNavigate('call-center'), delay: '0s', screen: 'call-center'
      } : null,
      ((user.permisos && 'app_clientes' in user.permisos) ? user.permisos.app_clientes : true) ? {
        name: isTecnico ? t('nav_clients_tech') : (userRole.includes('call') ? 'Mis Llamadas' : 'Mis Clientes'), tag: 'Renew Solar',
        gradient: 'linear-gradient(90deg,#f4c430,#f59e0b)',
        iconBg: 'rgba(244,196,48,0.12)', iconColor: '#f4c430',
        icon: \`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>\`,
        action: () => window.appNavigate('clients'), delay: '0s', screen: 'clients'
      } : null,
      ((user.permisos && 'app_plantillas' in user.permisos) ? user.permisos.app_plantillas : !isTecnico) ? {
        name: 'Plantillas', tag: 'Renew Solar',
        gradient: 'linear-gradient(90deg,#f4c430,#f59e0b)',
        iconBg: 'rgba(244,196,48,0.12)', iconColor: '#f4c430',
        icon: \`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>\`,
        action: () => window.showPlantillasModal(), delay: '0s'
      } : null,
      canInventory ? {
        name: 'Inventario Real', tag: null,
        gradient: 'linear-gradient(90deg,#3b82f6,#6366f1)',
        iconBg: 'rgba(59,130,246,0.1)', iconColor: 'var(--info)',
        icon: \`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>\`,
        action: () => window.appNavigate('inventory-tech'), delay: '0.06s', screen: 'inventory-tech'
      } : null,
      ((user.permisos && 'app_pagos' in user.permisos) ? user.permisos.app_pagos : true) ? {
        name: 'Mis Recibos de Pagos', tag: 'Renew Solar',
        gradient: 'linear-gradient(90deg,#f4c430,#f59e0b)',
        iconBg: 'rgba(244,196,48,0.12)', iconColor: '#f4c430',
        icon: \`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>\`,
        action: () => window.appNavigate('mis-recibos'), delay: '0.15s', screen: 'mis-recibos'
      } : null,
    ],
    'Renew Home': [
      ((user.permisos && 'app_callcenter' in user.permisos) ? user.permisos.app_callcenter : (['admin', 'administrador', 'ceo'].includes(userRole) || userRole.includes('call'))) ? {
        name: 'Gestión de Leads (Fase 1)', tag: 'Call Center',
        gradient: 'linear-gradient(90deg,#00f5d4,#00bbf9)',
        iconBg: 'rgba(0,245,212,0.12)', iconColor: '#00f5d4',
        icon: \`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>\`,
        action: () => window.appNavigate('call-center'), delay: '0s', screen: 'call-center'
      } : null,
      ((user.permisos && 'app_clientes' in user.permisos) ? user.permisos.app_clientes : true) ? {
        name: isTecnico ? t('nav_clients_tech') : (userRole.includes('call') ? 'Mis Llamadas' : 'Mis Clientes'), tag: 'Renew Home',
        gradient: 'linear-gradient(90deg,#a3d96b,#84cc16)',
        iconBg: 'rgba(163,217,107,0.12)', iconColor: '#a3d96b',
        icon: \`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>\`,
        action: () => window.appNavigate('clients'), delay: '0s', screen: 'clients'
      } : null,
    ],
  };

  const commonTools = [
    ((user.permisos && 'app_mapa' in user.permisos) ? user.permisos.app_mapa : true) ? {
      name: 'Mi Mapa', tag: null,
      gradient: 'linear-gradient(90deg,#8b5cf6,#d946ef)',
      iconBg: 'rgba(139,92,246,0.1)', iconColor: '#a78bfa',
      icon: \`<i class="fas fa-map-marked-alt"></i>\`,
      action: () => window.appNavigate('mi-mapa'), delay: '0.19s', screen: 'mi-mapa'
    } : null,
    ((user.permisos && 'app_calendario' in user.permisos) ? user.permisos.app_calendario : true) ? {
      name: 'Calendario', tag: null,
      gradient: 'linear-gradient(90deg,#00ff88,#00d4ff)',
      iconBg: 'rgba(0,255,136,0.1)', iconColor: '#00ff88',
      icon: \`<i class="fas fa-calendar-alt"></i>\`,
      className: 'desktop-only',
      action: () => window.appNavigate('mi-calendario'), delay: '0.20s', screen: 'mi-calendario'
    } : null,
    {
      name: 'Mi Equipo', tag: null,
      gradient: 'linear-gradient(90deg,#f4c430,#f59e0b)',
      iconBg: 'rgba(244,196,48,0.12)', iconColor: '#f4c430',
      icon: \`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>\`,
      action: () => window.appNavigate('mi-equipo'), delay: '0.22s', screen: 'mi-equipo'
    },
    ((user.permisos && 'app_partners' in user.permisos) ? user.permisos.app_partners : (isAdmin || isVentas)) ? {
      name: 'Partners', tag: null,
      gradient: 'linear-gradient(90deg,#10b981,#059669)',
      iconBg: 'rgba(16,185,129,0.1)', iconColor: '#10b981',
      icon: \`<i class="fa-solid fa-handshake"></i>\`,
      action: () => window.appNavigate('partners'), delay: '0.23s', screen: 'partners'
    } : null,
    ((user.permisos && 'app_os' in user.permisos) ? user.permisos.app_os : isAdmin) ? {
      name: 'Renew OS (Admin)', tag: null,
      gradient: 'linear-gradient(90deg,#f59e0b,#ef4444)',
      iconBg: 'rgba(245,158,11,0.1)', iconColor: 'var(--warning)',
      icon: \`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>\`,
      action: () => { window.location.href = 'admin.html'; }, delay: '0.24s'
    } : null,
    ((user.permisos && 'app_adelantos' in user.permisos) ? user.permisos.app_adelantos : !isAdmin) ? {
      name: 'Mis Adelantos', tag: 'RRHH',
      gradient: 'linear-gradient(90deg,#0ea5e9,#2563eb)',
      iconBg: 'rgba(14,165,233,0.12)', iconColor: '#0ea5e9',
      icon: \`<i class="fa-solid fa-hand-holding-dollar"></i>\`,
      action: () => window.appNavigate('mis-adelantos'), delay: '0.25s', screen: 'mis-adelantos'
    } : null
  ];`;

const startIdx = content.indexOf('const TOOLS = {');
const endIdx = content.indexOf("const pipTools = (TOOLS[activeUnit] || TOOLS['Renew Solar']).filter(Boolean);");

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find boundaries');
  process.exit(1);
}

content = content.substring(0, startIdx) + replacement + '\n\n  ' + content.substring(endIdx);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Success');

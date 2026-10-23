const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Read logo as base64
const logoPath = path.join(__dirname, 'assets', 'images', 'renew copia logo.png');
let logoBase64 = '';
if (fs.existsSync(logoPath)) {
    logoBase64 = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64');
}

const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte Integral de Transformación y Mejoras - Renew OS</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  
  @page {
    size: A4;
    margin: 12mm 14mm 14mm 14mm;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #1e293b;
    background-color: #ffffff;
    line-height: 1.5;
    font-size: 11.5px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page-break {
    page-break-before: always;
  }

  /* Header Cover */
  .report-header {
    background: linear-gradient(135deg, #09131f 0%, #0f172a 60%, #113838 100%);
    border-radius: 14px;
    padding: 22px 26px;
    color: #ffffff;
    margin-bottom: 18px;
    position: relative;
    border: 1px solid rgba(0, 223, 191, 0.3);
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .logo-container {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-img {
    height: 40px;
    width: auto;
    object-fit: contain;
  }

  .badge-status {
    background: rgba(5, 213, 100, 0.15);
    color: #05d564;
    border: 1px solid rgba(5, 213, 100, 0.4);
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .report-title {
    font-size: 20px;
    font-weight: 800;
    line-height: 1.25;
    color: #ffffff;
    margin-bottom: 5px;
  }

  .report-title span {
    color: #00dfbf;
  }

  .report-subtitle {
    font-size: 11.5px;
    color: #94a3b8;
    max-width: 680px;
  }

  .header-meta {
    display: flex;
    gap: 20px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 10px;
    color: #cbd5e1;
  }

  .meta-item strong {
    color: #00dfbf;
  }

  /* Section Styling */
  .section {
    margin-bottom: 16px;
    page-break-inside: avoid;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13.5px;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 2px solid #e2e8f0;
  }

  .section-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: rgba(0, 223, 191, 0.18);
    color: #00937f;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 800;
  }

  .card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 15px;
    margin-bottom: 10px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    page-break-inside: avoid;
  }

  .card-highlight {
    border-left: 4px solid #00dfbf;
    background: #f8fafc;
  }

  .card-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .card-title {
    font-size: 12.5px;
    font-weight: 700;
    color: #0f172a;
  }

  .tag {
    font-size: 9.5px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 8px;
    text-transform: uppercase;
  }

  .tag-green { background: #dcfce7; color: #15803d; }
  .tag-teal { background: #ccfbf1; color: #0f766e; }
  .tag-purple { background: #f3e8ff; color: #7e22ce; }
  .tag-blue { background: #e0f2fe; color: #0369a1; }

  p {
    margin-bottom: 6px;
    color: #334155;
  }

  p:last-child {
    margin-bottom: 0;
  }

  /* Comparison Grid */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 6px;
  }

  .comparison-box {
    border-radius: 8px;
    padding: 9px 11px;
    font-size: 11px;
  }

  .box-before {
    background: #fef2f2;
    border: 1px solid #fecaca;
  }

  .box-before .title {
    font-weight: 700;
    color: #b91c1c;
    margin-bottom: 3px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .box-after {
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
  }

  .box-after .title {
    font-weight: 700;
    color: #047857;
    margin-bottom: 3px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  ul.check-list {
    list-style: none;
    margin-top: 5px;
  }

  ul.check-list li {
    position: relative;
    padding-left: 17px;
    margin-bottom: 4px;
    color: #334155;
    font-size: 11px;
  }

  ul.check-list li::before {
    content: '✓';
    position: absolute;
    left: 0;
    top: 0;
    color: #05d564;
    font-weight: 800;
    font-size: 11px;
  }

  /* Table styling */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 6px;
    font-size: 10.5px;
  }

  th {
    background: #0f172a;
    color: #ffffff;
    text-align: left;
    padding: 6px 9px;
    font-weight: 600;
  }

  th:first-child { border-top-left-radius: 6px; }
  th:last-child { border-top-right-radius: 6px; }

  td {
    padding: 6px 9px;
    border-bottom: 1px solid #e2e8f0;
    color: #334155;
  }

  tr:nth-child(even) td {
    background-color: #f8fafc;
  }

  /* Footer */
  .report-footer {
    margin-top: 14px;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9.5px;
    color: #94a3b8;
  }

  .footer-brand {
    font-weight: 700;
    color: #00937f;
  }
</style>
</head>
<body>

  <!-- ==================== PÁGINA 1: RESUMEN Y MEJORAS VISUALES ==================== -->
  
  <div class="report-header">
    <div class="header-top">
      <div class="logo-container">
        ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" alt="Renew Logo">` : '<h2 style="color:#00dfbf">RENEW</h2>'}
      </div>
      <div class="badge-status">100% Implementado en Producción</div>
    </div>
    <div class="report-title">Reporte Ejecutivo de Transformación <span>Renew OS</span></div>
    <div class="report-subtitle">Modernización integral de interfaz, experiencia de usuario y automatización de captura de prospectos comerciales.</div>
    <div class="header-meta">
      <div class="meta-item"><strong>Fecha:</strong> ${today}</div>
      <div class="meta-item"><strong>Sistemas:</strong> Renew OS • Renew Water • Renew Solar</div>
      <div class="meta-item"><strong>Alcance:</strong> Rediseño Visual + Sincronización Webhooks</div>
    </div>
  </div>

  <!-- Resumen Ejecutivo -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon">1</span>
      Resumen Ejecutivo
    </div>
    <div class="card card-highlight">
      <p>Durante estas sesiones de trabajo se ejecutó una evolución integral sobre <strong>Renew OS</strong>, abordando dos frentes complementarios: una <strong>modernización visual profunda</strong> de la plataforma para entregar una experiencia fluida, corporativa y elegante, y la <strong>conexión automatizada</strong> de todas las fuentes de captura de clientes (enlaces externos de crédito y formulario web oficial).</p>
      <p>El resultado es una plataforma unificada donde el equipo comercial, directivo y operativo navega con total claridad visual, mientras que los prospectos ingresan en tiempo real sin requerir recaptura manual.</p>
    </div>
  </div>

  <!-- Módulo Visual 1: Barra Lateral y Topbar -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon">2</span>
      Evolución Visual: Barra Lateral y Barra Superior (Topbar)
    </div>
    
    <div class="card">
      <div class="card-header-row">
        <span class="card-title">Barra Lateral (Sidebar): Estética Minimalista y Navegación Suave</span>
        <span class="tag tag-purple">Rediseño UI</span>
      </div>
      <p>La barra lateral es el eje de control diario de cada usuario. Se eliminaron las fricciones visuales que restaban elegancia:</p>
      
      <div class="grid-2">
        <div class="comparison-box box-before">
          <div class="title">✕ Antes</div>
          • Barra de scroll tosca y ancha visible de forma permanente.<br>
          • Textos superpuestos y descuadrados al colapsar el menú lateral.<br>
          • Etiquetas de versión de marca excesivas que ocupaban espacio innecesario.
        </div>
        <div class="comparison-box box-after">
          <div class="title">✓ Ahora</div>
          • Scrollbar invisible y fluido (navegación limpia y moderna).<br>
          • Modo colapsado perfecto: iconos centrados con tooltips flotantes elegantes.<br>
          • Estética de marca minimalista y profesional sin textos residuales.
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header-row">
        <span class="card-title">Topbar Ejecutiva y Breadcrumbs Dinámicos</span>
        <span class="tag tag-blue">Experiencia de Usuario</span>
      </div>
      <ul class="check-list">
        <li><strong>Efecto Glassmorphism:</strong> Barra superior traslúcida moderna con fondo oscuro, alineada a la identidad premium de Renew.</li>
        <li><strong>Breadcrumbs (Migas de Pan):</strong> Indicador de ruta interactivo que permite saber exactamente en qué sección está y regresar con un clic.</li>
        <li><strong>Perfil y Controles Rápidos:</strong> Acceso simplificado al estado de conexión, sede activa y selector de cuenta de usuario.</li>
      </ul>
    </div>
  </div>

  <div class="report-footer">
    <div>Página 1 de 2 • Renew Group LLC</div>
    <div class="footer-brand">Renew OS • Modernización de Plataforma</div>
  </div>

  <!-- ==================== PÁGINA 2: SECCIONES Y AUTOMATIZACIONES ==================== -->
  <div class="page-break"></div>

  <!-- Módulo Visual 2: Unificación de Secciones y Modales -->
  <div class="section" style="margin-top: 6px;">
    <div class="section-title">
      <span class="section-icon">3</span>
      Unificación Visual de Secciones y Modales del Sistema
    </div>

    <div class="card">
      <div class="card-header-row">
        <span class="card-title">Armonización Gráfica en Módulos Clave</span>
        <span class="tag tag-teal">Línea Gráfica Unificada</span>
      </div>
      <p>Se eliminaron las diferencias de estilos entre pantallas, unificando la tipografía <em>Inter</em>, bordes redondeados y paleta de colores oficial en:</p>
      <ul class="check-list">
        <li><strong>Rendimiento Global:</strong> Tarjetas de KPIs pulidas con métricas destacadas y gráficos limpios.</li>
        <li><strong>Call Center Admin:</strong> Tableros de asignación con estados visuales claros (activo, en espera, completado).</li>
        <li><strong>Directorio de Colaboradores (HR Hub):</strong> Filtros inteligentes por sede y departamento con búsqueda instantánea.</li>
        <li><strong>Fichas y Modales:</strong> Ventanas de detalle de clientes, colaboradores y el Drawer lateral del tablero Kanban rediseñados con distribución ordenada de documentos, notas e historial.</li>
      </ul>
    </div>
  </div>

  <!-- Módulo Funcional 1: Enlaces de Crédito -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon">4</span>
      Sincronización de Enlaces Externos de Aplicaciones de Crédito
    </div>
    <div class="card">
      <div class="card-header-row">
        <span class="card-title">Conexión de Solicitudes de Crédito Independientes</span>
        <span class="tag tag-green">Automatización</span>
      </div>
      <p>Muchos vendedores utilizan enlaces dedicados externos para llenar solicitudes de crédito. Este flujo ahora se sincroniza de forma transparente con Renew OS:</p>
      <div class="grid-2">
        <div class="comparison-box box-before">
          <div class="title">✕ Problema Resuelto</div>
          Los clientes no entraban al sistema o se enviaban prematuramente a la Fase 1 del Kanban como proyectos activos sin estar aprobados.
        </div>
        <div class="comparison-box box-after">
          <div class="title">✓ Lógica Optimizada</div>
          El cliente ingresa en <strong>"Mis Prospectos"</strong> con su PDF de crédito y foto de ID vinculados, esperando aprobación para iniciar proyecto.
        </div>
      </div>
    </div>
  </div>

  <!-- Módulo Funcional 2: Sitio Web Oficial -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon">5</span>
      Captación de Leads del Sitio Web Oficial (renewwaterus.com)
    </div>
    <div class="card">
      <div class="card-header-row">
        <span class="card-title">Endpoint /api/webhook/analisis-gratuito & Integración n8n</span>
        <span class="tag tag-teal">En Vivo</span>
      </div>
      <p>Se puso en marcha el nuevo canal de captación para el modal <em>"Agenda tu prueba gratis"</em> de la web oficial:</p>
      <table>
        <thead>
          <tr>
            <th>Dato Recibido en Web</th>
            <th>Tratamiento en Renew OS</th>
            <th>Impacto Comercial</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Nombre y Teléfono</strong></td>
            <td>Verificación y creación del Prospecto</td>
            <td>Control total de duplicados mediante validación de últimos 10 dígitos.</td>
          </tr>
          <tr>
            <td><strong>Horario Preferido</strong></td>
            <td>Registrado en Notas del Prospecto</td>
            <td>El equipo comercial llama en el turno idóneo (Mañana/Tarde/Noche).</td>
          </tr>
          <tr>
            <td><strong>Código Postal / Zona</strong></td>
            <td>Asignación geográfica inmediata</td>
            <td>Planificación de cobertura y rutas técnicas sin demora.</td>
          </tr>
          <tr>
            <td><strong>Canal Call Center</strong></td>
            <td>Inyección con Alta Prioridad</td>
            <td>Atención veloz por operadores disponibles.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Resumen de Valor -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon">6</span>
      Valor Operativo para el Negocio
    </div>
    <div class="card card-highlight">
      <ul class="check-list">
        <li><strong>Plataforma de Clase Ejecutiva:</strong> Navegación fluida, sin elementos rotos ni barras invasivas.</li>
        <li><strong>Cero Pérdida de Clientes:</strong> Cada oportunidad de la web y de los vendedores entra de inmediato al sistema.</li>
        <li><strong>Control Comercial Eficiente:</strong> Un solo clic en <em>"Comenzar Proyecto"</em> cuando el prospecto califica.</li>
        <li><strong>Visualización en Tiempo Real:</strong> Refresco instantáneo de datos sin tener que recargar el navegador.</li>
      </ul>
    </div>
  </div>

  <div class="report-footer">
    <div>Página 2 de 2 • Documento Ejecutivo Confidencial</div>
    <div class="footer-brand">Renew Group • Renew OS 2026</div>
  </div>

</body>
</html>
`;

const htmlPath = path.join(__dirname, 'Reporte_Mejoras_Renew_OS.html');
const pdfPath = path.join(__dirname, 'Reporte_Mejoras_Renew_OS.pdf');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('HTML written to:', htmlPath);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const cmd = `"${chromePath}" --headless --disable-gpu --print-to-pdf="${pdfPath}" --no-pdf-header-footer "${htmlPath}"`;
console.log('Compiling PDF with Chrome...');
execSync(cmd);
console.log('PDF generated successfully at:', pdfPath);
const stats = fs.statSync(pdfPath);
console.log('PDF file size:', stats.size, 'bytes');

// Copy to brain artifacts
const brainDir = 'C:\\Users\\MigueNuevo\\.gemini\\antigravity\\brain\\f9145a17-24d3-4592-9f5e-62b06171a787';
if (fs.existsSync(brainDir)) {
    fs.copyFileSync(pdfPath, path.join(brainDir, 'Reporte_Mejoras_Renew_OS.pdf'));
}
console.log('Artifact copy updated.');

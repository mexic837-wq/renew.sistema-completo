/* ============================================================
   RENEW OS – i18n.js   (Complete Translation System)
   Languages: 'es' (Spanish) | 'en' (English)
   ============================================================ */

const TRANSLATIONS = {
  es: {
    // ── Navigation ─────────────────────────────────────────
    nav_home:           'Inicio',
    nav_clients:        'Clientes',
    nav_new:            'Nuevo Proyecto',
    nav_academy:        'Academia',
    nav_theme:          'Tema',
    nav_team:           'Mi Equipo',
    nav_menu:           'Menú',

    // ── Login ──────────────────────────────────────────────
    login_tagline:      'Portal del Equipo de Ventas',
    login_welcome:      'Bienvenido <i class="fa-solid fa-handshake"></i>',
    login_subtitle:     'Ingresa tus credenciales para continuar.',
    login_email:        'Correo Electrónico',
    login_password:     'Contraseña',
    login_btn:          'Iniciar Sesión',
    login_help:         '¿Problemas para acceder?',
    login_contact:      'Contactar soporte',

    // ── Dashboard ──────────────────────────────────────────
    dash_total:         'Total',
    dash_in_progress:   'En Proceso',
    dash_completed:     'Completados',
    dash_tab_projects:  'Mis Proyectos',
    dash_tab_perf:      'Mi Rendimiento',
    dash_tab_rank:      'Leaderboard',
    dash_month_perf:    'Desempeño del Mes',
    dash_top_sellers:   'Top Representantes de Ventas',
    dash_loading:       'Cargando...',
    dash_error:         'Error al cargar proyectos',
    dash_no_deals:      'Aún no tienes proyectos',
    dash_no_deals_sub:  'Crea uno nuevo para comenzar.',
    dash_profile:       'Mi Perfil',
    dash_logout:        'Cerrar Sesión',
    dash_greeting_morn: 'Buenos días',
    dash_greeting_aftn: 'Buenas tardes',
    dash_greeting_eve:  'Buenas noches',
    dash_phase:         'Fase',
    dash_created:       'Creado',
    dash_open_project:  'Ver Proyecto',
    dash_pipeline:      'Pipeline',

    // ── New Client ─────────────────────────────────────────
    nc_title:           'Datos del Cliente',
    nc_search:          'Buscar por nombre o teléfono...',
    nc_selected:        'Cliente Seleccionado <i class="fa-solid fa-check text-green-500"></i>',
    nc_edit:            'Completar Perfil / Editar',
    nc_address:         'Dirección completa',
    nc_address_label:   'Dirección GPS',
    nc_submit:          'Crear Proyecto',
    nc_submitting:      'Creando...',
    nc_error_client:    'Selecciona o crea un cliente primero',
    nc_error_address:   'Por favor ingresa una dirección',

    // ── Project Detail ─────────────────────────────────────
    pd_contact:         'Datos de Contacto Central',
    pd_email:           'Email',
    pd_phone:           'Teléfono',
    pd_address:         'Dirección',
    pd_id:              'ID / Licencia de Conducir',
    pd_discussion:      'Discusión Interna',
    pd_placeholder:     '@menciona a alguien...',
    pd_completed:       '¡Proyecto Finalizado!',
    pd_completed_sub:   'Todas las fases han sido procesadas.',
    pd_phase_waiting:   'Fase en espera',
    pd_advance:         'Avanzar a la Siguiente Fase',
    pd_action:          'Acción: Llenar',
    pd_save:            'Guardar Avances',
    pd_finish:          'Finalizar Fase y Enviar',
    pd_locked_msg:      'Esta etapa debe ser completada por',
    pd_locked_wait:     'Serás notificado cuando sea tu turno.',
    pd_doc_view:        'Ver Documento',
    pd_no_attach:       'Sin adjunto',
    pd_fields_missing:  'campos/archivos para poder avanzar.',
    pd_all_done:        '¡Todo listo! Ya puedes finalizar esta etapa.',
    pd_upload:          'Subir',
    pd_uploading:       'Subiendo...',
    pd_uploaded:        'Archivo Cargado',
    pd_readonly:        'Vista de Solo Lectura',
    pd_phase_process:   'Fase en Proceso',
    pd_locked_by:       'Corresponde a:',

    // ── Academy ────────────────────────────────────────────
    academy_title:      'Sala Virtual',
    academy_subtitle:   'Elige tu módulo',
    academy_team:       'Capacitación y herramientas técnicas para el equipo.',
    academy_videos:     'Videos',
    academy_docs:       'Entrenamiento',
    academy_info:       'Financieras',
    academy_faq:        'Preguntas',
    academy_multimedia: 'MULTIMEDIA',
    academy_recursos:   'RECURSOS',
    academy_banco:      'BANCO',
    academy_soporte:    'SOPORTE',
    academy_equipment:  'Detalles de equipo',
    academy_equipment_label: 'EQUIPO',
    academy_empty:      'No hay materiales.',

    // ── Clients Screen ─────────────────────────────────────
    clients_title:      'Cartera de Clientes',
    clients_title_tech: 'Mis Citas',
    clients_subtitle:   'Gestión de prospectos',
    clients_subtitle_tech: 'Gestión de citas asignadas',
    clients_new:        '+ Nuevo Prospecto',
    clients_tab_prospects_tech: 'Nuevas Citas',
    clients_tab_clients_tech: 'Citas Cerradas',
    clients_empty_prospects_tech: 'No tienes visitas pendientes aún.',
    clients_empty_clients_tech: 'No tienes citas cerradas aún.',
    nav_clients_tech:   'Mis Citas',

    // ── Menu Screen ────────────────────────────────────────
    menu_title:         'Menú Principal',
    menu_subtitle:      'Configuración y Herramientas',
    menu_tools:         'Herramientas de Trabajo',
    menu_settings:      'Ajustes de Usuario',
    menu_contracts:     'Generador Contratos',
    menu_inventory:     'Inventario Real',
    menu_admin:         'Renew OS (Admin)',
    menu_account:       'Mi Cuenta',
    menu_notifs:        'Notificaciones',
    menu_theme:         'Tema',
    menu_theme_dark:    'Oscuro',
    menu_theme_light:   'Claro',
    menu_support:       'Soporte Técnico',
    menu_language:      'Idioma',
    menu_logout:        'Cerrar Sesión Activa',

    // ── Admin Sidebar ──────────────────────────────────────
    admin_nav_dash:     'Dashboard',
    admin_nav_calendar: 'Calendario',
    admin_nav_crm:      'Clientes',
    admin_nav_team:     'Equipo',
    admin_nav_kanban:   'Kanban',
    admin_nav_academy:  'Gestor Academia',
    admin_nav_announce: 'Anuncios Globales',
    admin_nav_inv:      'Inventario',
    admin_nav_auto:     'Automations',
    admin_nav_hrhub:    'RRHH',
    admin_nav_theme:    'Tema del Sistema',
    admin_quick:        'Ajustes Rápidos',
    admin_edit_profile: 'Editar Perfil',
    admin_mobile:       'Versión Móvil',
    admin_logout:       'Cerrar Sesión',
    admin_language:     'Idioma / Language',

    // ── General ────────────────────────────────────────────
    btn_back:           'Volver',
    btn_save:           'Guardar',
    btn_cancel:         'Cancelar',
    btn_delete:         'Eliminar',
    btn_edit:           'Editar',
    loading:            'Cargando...',
    no_data:            'Sin datos',
    confirm_logout:     '¿Seguro que deseas cerrar tu sesión?',

    // ── Leaderboard ────────────────────────────────────────
    lb_title:           'Tabla de Posiciones',
    lb_top_performers:  'Mejores Representantes de Ventas',
    lb_no_sales:        'Sin ventas este mes',
    lb_sales:           'Ventas',
    lb_sale:            'venta',
    lb_sales_plural:    'ventas',
    lb_you:             'Tú',
    lb_rank:            'Posición',
    lb_1st:             '1er Lugar',
    lb_2nd:             '2do Lugar',
    lb_3rd:             '3er Lugar',
    confirm_delete:     '¿Estás seguro de eliminar esto?',
    error_generic:      'Ha ocurrido un error',
    toast_lang_es:      '🇪🇸 Idioma: Español',
    toast_lang_en:      '🇺🇸 Language: English',

    // ── Admin CRM ──────────────────────────────────────────
    crm_title:          'Clientes',
    crm_desc:           'Base de datos centralizada para todos los pipelines activos.',
    crm_btn_add:        'Añadir Prospecto',
    crm_col_id:         'Identidad',
    crm_col_source:     'Origen',
    crm_col_name:       'Nombre Cliente',
    crm_col_contact:    'Contacto',
    crm_col_email:      'Email',
    crm_col_address:    'Dirección',
    crm_col_dept:       'Departamento',
    crm_col_rep:        'Representante',
    crm_col_status:     'Estado',
    crm_bulk_delete:    'Borrar seleccionados',

    // ── New Client ──────────────────────────────────────────
    nc_loading:         'Cargando Formulario...',
    nc_modal_title:     'Nuevo Cliente (Maestro)',
    nc_modal_subtitle:  'Completa los campos principales',
    nc_placeholder_id:   'ID del Estado...',
    nc_placeholder_name: 'Nombre',
    nc_placeholder_last: 'Apellido',
    nc_placeholder_address: 'Dirección completa',
    nc_field_id_photo:  'Foto / ID Image',
    nc_btn_upload_photo: 'Subir Foto del Cliente',
    nc_capture_id:      'Capture ID o Photo Face',
    nc_btn_save_client: 'Guardar Cliente',
    nc_btn_cancel:      'Cerrar',
    nc_search_results:  'Resultados',
    nc_add_new:         '¿No existe? Crear Nuevo Cliente',
    nc_search_placeholder: 'Buscar por nombre o teléfono...',
    nc_client_selected: 'Cliente Seleccionado <i class="fa-solid fa-check text-green-500"></i>',
    nc_btn_edit_profile: 'Completar Perfil / Editar',
    nc_field_state_id:  'State ID',
    nc_field_dob:       'DOB',
    nc_field_address:   'Dirección',
    nc_field_email:     'Email',
    nc_field_name:      'Nombre',
    nc_field_last:      'Apellido',
    nc_field_phone:     'Teléfono',
    nc_select:          'Selecciona...',
    nc_text:            'Texto...',
    nc_placeholder_num: '0',
    nc_back_label:      'Volver',
    nc_error_no_fase:   'Este ecosistema no tiene fases configuradas aún.',
    nc_btn_save:        'Guardar Pipeline y Enviar',
    nc_btn_active:      'Procesando...',
    nc_complete_profile: 'Completar Perfil',
    nc_update_data:     'Actualizar Datos',

    // ── Admin Team ─────────────────────────────────────────
    team_title:         'Gestión de Equipo y Colaboradores',
    team_desc:          'Administra accesos y roles para el equipo móvil de RENEW.',
    team_btn_add:       'Añadir Colaborador',
    team_col_worker:    'Colaborador',
    team_col_division:  'División',
    team_col_auth_email: 'Email Autenticación',
    team_col_phone:     'Teléfono Móvil',
    team_col_activity:  'Actividad',
    team_col_interface: 'Interfaz',
    team_col_w9:        'W-9',

    // ── Admin Inventory ────────────────────────────────────
    inv_title:          'Control de Inventario',
    inv_desc:           'Visualización y control centralizado de existencias actuales.',
    inv_btn_add:        'Añadir Artículo',
    inv_col_code:       'Código',
    inv_col_prod:       'Producto',
    inv_col_line:       'Línea',
    inv_col_storage:    'Storage',
    inv_col_stock:      'Existencia Actual',
    inv_col_actions:    'Acciones',
    inv_history_title:  'Historial de Inventario',
    inv_history_desc:   'Retiros registrados por técnicos',
    inv_col_date:       'Fecha y Hora',
    inv_col_tech:       'Técnico',
    inv_col_item:       'Artículo Retirado',
    inv_col_qty:        'Cantidad',
    inv_col_sede:       'Sede',
    inv_empty:          'Sin existencias registradas',
    inv_no_history:     'Sin movimientos registrados',
    inv_sede_label:     'Sede',

    // ── Admin Announcements ────────────────────────────────
    ann_title:          'Gestor de Anuncios Globales',
    ann_desc:           'Publica comunicados para la aplicación móvil y rastrea su lectura.',
    ann_new_title:      'Nuevo Comunicado',
    ann_new_sub:        'Envío Inmediato',
    ann_field_title:    'Título del Anuncio',
    ann_field_aud:      'Audiencia (Pipeline)',
    ann_field_msg:      'Mensaje (Obligatorio en App)',
    ann_field_photo:    'Foto / Banner (Opcional)',
    ann_btn_pub:        'Publicar Anuncio',
    ann_hist:           'Historial de Anuncios',
    ann_report_select:  'Selecciona un anuncio',
    ann_report_users_desc: 'Para ver el reporte de lectura de los representantes',
    ann_report_pct:     'Aceptación (Lectura)',
    ann_report_users:   'Usuarios',
    ann_status_read:    'Leído',
    ann_status_pend:    'Pendiente',

    // ── Admin Academy ──────────────────────────────────────
    aca_library:        'Biblioteca Activa',
    aca_btn_save:       'Guardar Material',
    aca_btn_cancel:     'Cancelar',
    aca_upload_label:   'Miniatura/Portada (Opcional)',
    aca_add_title:      'Añadir Contenido',
    aca_field_title:    'Título del Recurso',
    aca_field_type:     'Tipo de Contenido',
    aca_field_file:     'Video o Documento a Subir',
    aca_field_vis:      'Visibilidad (Pipelines Autorizados)',
    aca_type_video:     'Video de Entrenamiento',
    aca_type_doc:       'Documento/PDF',
    aca_type_bank:      'Banco Financieras',
    aca_type_equipment: 'Detalles de equipo',
    aca_type_faq:       'FAQ',

    // ── Partners ──────────────────────────────────────────
    partner_cat_solar:    'Solar',
    partner_cat_roofing:  'Techos (Roofing)',
    partner_cat_hvac:     'Aire (HVAC)',
    partner_cat_painting: 'Pintura',
    partner_cat_fence:    'Cercas',
    partner_cat_general:  'General',
    partner_cat_remodelacion: 'Remodelación',
    partner_cat_dumpsters: 'Dumpsters',
    partner_cat_gutters: 'Gutters',
    partner_cat_screens: 'Screens',

    // ── Meetings ───────────────────────────────────────────
    mt_title:           'Coordinar Llamada',
    mt_desc:            'Programa reuniones y llamadas importantes para el equipo.',
    mt_field_link:      'Enlace de la Reunión (Zoom/Google Meet)',
    mt_field_msg:       'Instrucciones / Texto',
    mt_field_image:     'Imagen de Referencia',
    mt_btn_pub:         'Publicar Reunión',
  },

  en: {
    // ── Navigation ─────────────────────────────────────────
    nav_home:           'Home',
    nav_clients:        'Clients',
    nav_new:            'New Project',
    nav_academy:        'Academy',
    nav_theme:          'Theme',
    nav_team:           'My Team',
    nav_menu:           'Menu',

    // ── Login ──────────────────────────────────────────────
    login_tagline:      'Sales Team Portal',
    login_welcome:      'Welcome <i class="fa-solid fa-handshake"></i>',
    login_subtitle:     'Enter your credentials to continue.',
    login_email:        'Email Address',
    login_password:     'Password',
    login_btn:          'Sign In',
    login_help:         'Having trouble signing in?',
    login_contact:      'Contact support',

    // ── Dashboard ──────────────────────────────────────────
    dash_total:         'Total',
    dash_in_progress:   'In Progress',
    dash_completed:     'Completed',
    dash_tab_projects:  'My Projects',
    dash_tab_perf:      'My Performance',
    dash_tab_rank:      'Leaderboard',
    dash_month_perf:    'Monthly Performance',
    dash_top_sellers:   'Top Representatives',
    dash_loading:       'Loading...',
    dash_error:         'Error loading projects',
    dash_no_deals:      'You have no projects yet',
    dash_no_deals_sub:  'Create a new one to get started.',
    dash_profile:       'My Profile',
    dash_logout:        'Sign Out',
    dash_greeting_morn: 'Good morning',
    dash_greeting_aftn: 'Good afternoon',
    dash_greeting_eve:  'Good evening',
    dash_phase:         'Phase',
    dash_created:       'Created',
    dash_open_project:  'Open Project',
    dash_pipeline:      'Pipeline',

    // ── New Client ─────────────────────────────────────────
    nc_title:           'Client Info',
    nc_search:          'Search by name or phone...',
    nc_selected:        'Selected Client <i class="fa-solid fa-check text-green-500"></i>',
    nc_edit:            'Complete Profile / Edit',
    nc_address:         'Full address',
    nc_address_label:   'GPS Address',
    nc_submit:          'Create Project',
    nc_submitting:      'Creating...',
    nc_error_client:    'Please select or create a client first',
    nc_error_address:   'Please enter an address',

    // ── Project Detail ─────────────────────────────────────
    pd_contact:         'Main Contact Info',
    pd_email:           'Email',
    pd_phone:           'Phone',
    pd_address:         'Address',
    pd_id:              'ID / Driver\'s License',
    pd_discussion:      'Internal Discussion',
    pd_placeholder:     '@mention someone...',
    pd_completed:       'Project Completed!',
    pd_completed_sub:   'All phases have been processed.',
    pd_phase_waiting:   'Phase on hold',
    pd_advance:         'Advance to Next Phase',
    pd_action:          'Action: Fill',
    pd_save:            'Save Progress',
    pd_finish:          'Finish Phase & Submit',
    pd_locked_msg:      'This stage must be completed by',
    pd_locked_wait:     'You will be notified when it\'s your turn.',
    pd_doc_view:        'View Document',
    pd_no_attach:       'No attachment',
    pd_fields_missing:  'fields/files required to advance.',
    pd_all_done:        'All set! You can now finish this stage.',
    pd_upload:          'Upload',
    pd_uploading:       'Uploading...',
    pd_uploaded:        'File Uploaded',
    pd_readonly:        'Read-Only View',
    pd_phase_process:   'Phase In Progress',
    pd_locked_by:       'Assigned to:',

    // ── Academy ────────────────────────────────────────────
    academy_title:      'Virtual Room',
    academy_subtitle:   'Choose your module',
    academy_team:       'Training and technical tools for the team.',
    academy_videos:     'Videos',
    academy_docs:       'Training',
    academy_info:       'Finances',
    academy_faq:        'Questions',
    academy_multimedia: 'MULTIMEDIA',
    academy_recursos:   'RESOURCES',
    academy_banco:      'BANK',
    academy_soporte:    'SUPPORT',
    academy_equipment:  'Equipment Details',
    academy_equipment_label: 'EQUIPMENT',
    academy_empty:      'No materials available.',

    // ── Clients Screen ─────────────────────────────────────
    clients_title:      'Client Portfolio',
    clients_title_tech: 'My Appointments',
    clients_subtitle:   'Prospect management',
    clients_subtitle_tech: 'Assigned appointments management',
    clients_new:        '+ New Prospect',
    clients_tab_prospects_tech: 'New Appointments',
    clients_tab_clients_tech: 'Closed Appointments',
    clients_empty_prospects_tech: 'You have no pending visits yet.',
    clients_empty_clients_tech: 'You have no closed appointments yet.',
    nav_clients_tech:   'My Appointments',

    // ── Menu Screen ────────────────────────────────────────
    menu_title:         'Main Menu',
    menu_subtitle:      'Settings & Tools',
    menu_tools:         'Work Tools',
    menu_settings:      'User Settings',
    menu_contracts:     'Contract Generator',
    menu_inventory:     'Real Inventory',
    menu_admin:         'Renew OS (Admin)',
    menu_account:       'My Account',
    menu_notifs:        'Notifications',
    menu_theme:         'Theme',
    menu_theme_dark:    'Dark',
    menu_theme_light:   'Light',
    menu_support:       'Technical Support',
    menu_language:      'Language',
    menu_logout:        'Sign Out',

    // ── Admin Sidebar ──────────────────────────────────────
    admin_nav_dash:     'Dashboard',
    admin_nav_calendar: 'Calendar',
    admin_nav_crm:      'Clients',
    admin_nav_team:     'Team',
    admin_nav_kanban:   'Kanban',
    admin_nav_academy:  'Academy Manager',
    admin_nav_announce: 'Global Announcements',
    admin_nav_inv:      'Inventory',
    admin_nav_auto:     'Automations',
    admin_nav_hrhub:    'HR Hub',
    admin_nav_theme:    'System Theme',
    admin_quick:        'Quick Settings',
    admin_edit_profile: 'Edit Profile',
    admin_mobile:       'Mobile Version',
    admin_logout:       'Sign Out',
    admin_language:     'Language',

    // ── General ────────────────────────────────────────────
    btn_back:           'Back',
    btn_save:           'Save',
    btn_cancel:         'Cancel',
    btn_delete:         'Delete',
    btn_edit:           'Edit',
    loading:            'Loading...',
    no_data:            'No data',
    confirm_logout:     'Are you sure you want to sign out?',

    // ── Leaderboard ────────────────────────────────────────
    lb_title:           'Leaderboard',
    lb_top_performers:  'Best Representatives',
    lb_no_sales:        'No sales this month',
    lb_sales:           'Sales',
    lb_sale:            'sale',
    lb_sales_plural:    'sales',
    lb_you:             'You',
    lb_rank:            'Rank',
    lb_1st:             '1st Place',
    lb_2nd:             '2nd Place',
    lb_3rd:             '3rd Place',
    confirm_delete:     'Are you sure you want to delete this?',
    error_generic:      'An error occurred',
    toast_lang_es:      '🇪🇸 Language: Spanish',
    toast_lang_en:      '🇺🇸 Language: English',

    // ── Admin CRM ──────────────────────────────────────────
    crm_title:          'Clients',
    crm_desc:           'Centralized customer database for all active pipelines.',
    crm_btn_add:        'Add Prospect',
    crm_col_id:         'Identity',
    crm_col_source:     'Source',
    crm_col_name:       'Client Name',
    crm_col_contact:    'Contact',
    crm_col_email:      'Email',
    crm_col_address:    'Address',
    crm_col_dept:       'Department',
    crm_col_rep:        'Representative',
    crm_col_status:     'Status',
    crm_bulk_delete:    'Delete selected',

    // ── New Client ──────────────────────────────────────────
    nc_loading:         'Loading Form...',
    nc_modal_title:     'New Customer (Master)',
    nc_modal_subtitle:  'Complete main fields',
    nc_placeholder_id:   'State ID...',
    nc_placeholder_name: 'First Name',
    nc_placeholder_last: 'Last Name',
    nc_placeholder_address: 'Full Address',
    nc_field_id_photo:  'Photo / ID Image',
    nc_btn_upload_photo: 'Upload Customer Photo',
    nc_capture_id:      'Capture ID or Face Photo',
    nc_btn_save_client: 'Save Customer',
    nc_btn_cancel:      'Close',
    nc_search_results:  'Results',
    nc_add_new:         'Not there? Create New Customer',
    nc_search_placeholder: 'Search by name or phone...',
    nc_client_selected: 'Client Selected <i class="fa-solid fa-check text-green-500"></i>',
    nc_btn_edit_profile: 'Complete Profile / Edit',
    nc_field_state_id:  'State ID',
    nc_field_dob:       'DOB',
    nc_field_address:   'Address',
    nc_field_email:     'Email',
    nc_field_name:      'First Name',
    nc_field_last:      'Last Name',
    nc_field_phone:     'Phone',
    nc_select:          'Select...',
    nc_text:            'Text...',
    nc_placeholder_num: '0',
    nc_back_label:      'Back',
    nc_error_no_fase:   'This ecosystem has no phases configured yet.',
    nc_btn_save:        'Save Pipeline and Send',
    nc_btn_active:      'Processing...',
    nc_complete_profile: 'Complete Profile',
    nc_update_data:     'Update Data',

    // ── Admin Team ─────────────────────────────────────────
    team_title:         'Team Management & Collaborators',
    team_desc:          'Manage system access and roles for the RENEW mobile team.',
    team_btn_add:       'Add Collaborator',
    team_col_worker:    'Collaborator',
    team_col_division:  'Division',
    team_col_auth_email: 'Auth Email',
    team_col_phone:     'Mobile Phone',
    team_col_activity:  'Activity',
    team_col_interface: 'Interface',
    team_col_w9:        'W-9',

    // ── Admin Inventory ────────────────────────────────────
    inv_title:          'Inventory Control',
    inv_desc:           'Centralized visualization and control of current stock.',
    inv_btn_add:        'Add Item',
    inv_col_code:       'Code',
    inv_col_prod:       'Product',
    inv_col_line:       'Line',
    inv_col_storage:    'Storage',
    inv_col_stock:      'Current Stock',
    inv_col_actions:    'Actions',
    inv_history_title:  'Inventory History',
    inv_history_desc:   'Withdrawals recorded by technicians',
    inv_col_date:       'Date & Time',
    inv_col_tech:       'Technician',
    inv_col_item:       'Withdrawn Item',
    inv_col_qty:        'Quantity',
    inv_col_sede:       'Branch',
    inv_empty:          'No stock records found',
    inv_no_history:     'No movements recorded',
    inv_sede_label:     'Branch',

    // ── Admin Announcements ────────────────────────────────
    ann_title:          'Global Announcements Manager',
    ann_desc:           'Publish announcements for the mobile app and track reading status.',
    ann_new_title:      'New Announcement',
    ann_new_sub:        'Immediate Sending',
    ann_field_title:    'Announcement Title',
    ann_field_aud:      'Audience (Pipeline)',
    ann_field_msg:      'Message (Required in App)',
    ann_field_photo:    'Photo / Banner (Optional)',
    ann_btn_pub:        'Publish Announcement',
    ann_hist:           'Announcement History',
    ann_report_select:  'Select an announcement',
    ann_report_users_desc: 'To see the reading report of the sales team',
    ann_report_pct:     'Acceptance (Read)',
    ann_report_users:   'Users',
    ann_status_read:    'Read',
    ann_status_pend:    'Pending',

    // ── Admin Academy ──────────────────────────────────────
    aca_library:        'Active Library',
    aca_btn_save:       'Save Material',
    aca_btn_cancel:     'Cancel',
    aca_upload_label:   'Thumbnail/Cover (Optional)',
    aca_add_title:      'Add Content',
    aca_field_title:    'Resource Title',
    aca_field_type:     'Content Type',
    aca_field_file:     'Video or Document to Upload',
    aca_field_vis:      'Visibility (Authorized Pipelines)',
    aca_type_video:     'Training Video',
    aca_type_doc:       'Document/PDF',
    aca_type_bank:      'Financial Banks',
    aca_type_equipment: 'Equipment Details',
    aca_type_faq:       'FAQ',

    // ── Partners ──────────────────────────────────────────
    partner_cat_solar:    'Solar',
    partner_cat_roofing:  'Roofing',
    partner_cat_hvac:     'HVAC / AC',
    partner_cat_painting: 'Painting',
    partner_cat_fence:    'Fence',
    partner_cat_general:  'General',
    partner_cat_remodelacion: 'Remodeling',
    partner_cat_dumpsters: 'Dumpsters',
    partner_cat_gutters: 'Gutters',
    partner_cat_screens: 'Screens',

    // ── Meetings ───────────────────────────────────────────
    mt_title:           'Coordinate Call',
    mt_desc:            'Schedule important meetings and calls for the team.',
    mt_field_link:      'Meeting Link (Zoom/Google Meet)',
    mt_field_msg:       'Instructions / Text',
    mt_field_image:     'Reference Image',
    mt_btn_pub:         'Publish Meeting',
  }
};

/** Get current language (default: 'es') */
export function getLang() {
  return localStorage.getItem('app_lang') || 'es';
}

/** Set language and dispatch re-render event */
export function setLang(lang) {
  localStorage.setItem('app_lang', lang);
  window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

/** Translate a key */
export function t(key) {
  const lang = getLang();
  return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS['es'][key] || key;
}

/** Render language switcher buttons HTML */
export function langSwitcherHTML() {
  const current = getLang();
  const LANGS = [
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
  ];
  return `
    <div id="lang-switcher-wrap" style="display:flex; gap:8px;">
      ${LANGS.map(l => `
        <button
          onclick="window.switchLang('${l.code}')"
          style="
            display:flex; align-items:center; gap:6px;
            padding: 8px 14px; border-radius: 10px;
            border: 1.5px solid ${current === l.code ? 'var(--primary)' : 'var(--border)'};
            background: ${current === l.code ? 'rgba(0,223,191,0.1)' : 'var(--surface-alt)'};
            color: ${current === l.code ? 'var(--primary)' : 'var(--text-secondary)'};
            font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.2s;
          "
        >
          <span style="font-size:1.1rem">${l.flag}</span>
          ${l.label}
          ${current === l.code ? '<span style="margin-left:2px;font-size:0.8rem"><i class="fa-solid fa-check text-green-500"></i></span>' : ''}
        </button>
      `).join('')}
    </div>
  `;
}

/** Global helper for inline onclick */
window.switchLang = (lang) => {
  setLang(lang);
  // Show toast if available
  if (window._showToast) window._showToast(lang === 'es' ? '🇪🇸 Idioma: Español' : '🇺🇸 Language: English', 'success');
};

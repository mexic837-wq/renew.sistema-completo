# Bitácora de Aprendizaje – Agente Renew Water

Formato: `[AAAA-MM-DD HH:mm] Observación / regla aprendida`

- [2026-10-22 12:25] Bitácora inicializada.

- [2026-10-22 12:55] IDs reales fases pip_water: E1 fase_33_z8j9, E2 fase_35_nol4, E3 fase_fase_4111_4ltv, E4 fase_39_uivk, E5 fase_34_nocd, E6 fase_37_t6bg, E7 fase_38_508a, E8 fase_36_51fk, E9 fase_40_80vn.
- [2026-10-22 12:55] 'Completado en Formulario Externo' se detecta por evento FORMULARIO_COMPLETADO en proyectos_dinamicos.actividad, no en respuestas_dinamicas.
- [2026-10-22 12:55] Supabase: https://gateway.renewgroup.site. Evolution: instancia RenewGroup (+14079885020); tambi�n existe Renew-Agente.
- [2026-10-22 12:55] 9 proyectos avanzados E1->E2. Prueba piloto WhatsApp enviada a Omar Indriago (Einar Say).

- [2026-10-22 13:10] REGLA NUEVA (usuario): al completar la Aplicaci�n de Cr�dito solo se crea un PROSPECTO; el vendedor decide Crear Proyecto (aceptado) o Declinar (rechazado, con motivo). La primera pregunta del agente es siempre aceptada/rechazada. Antes de esto no existe proyecto ni Estaci�n 1.
- [2026-10-22 13:10] Modelo: clientes_maestro.macro_estado Prospecto/En Proceso/Declinado/Cliente. 69 prospectos al momento.
- [2026-10-22 13:10] Los 9 avances E1->E2 de la primera corrida eran proyectos ya creados (ya aceptados).

- [2026-10-29 13:30] REGLA (usuario): nunca pedir al vendedor datos que ya estén en el sistema (nombre, teléfono, email, dirección, ciudad, estado, zip, foto del ID). Solo pedir lo que falta.
- [2026-10-29 13:30] REGLA (usuario): el cliente firma la Orden de Trabajo y la Confirmación de Instalación desde un enlace (/firmar.html) que se envía al cliente y al vendedor. Sin firma no hay documento oficial.
- [2026-10-29 13:30] REGLA (usuario): En Proceso desde que se aprueba el crédito. La venta cuenta al firmarse la Confirmación de Instalación (fin de Certificado de Instalación); el agente sigue con el resto del pipeline hasta Comisión.
- [2026-10-29 13:30] REGLA (usuario): Orden de instalación = Certificado de Instalación = Confirmación de Instalación (mismo documento).
- [2026-10-29 13:30] REGLA (usuario): al terminar la instalación se pregunta de qué sede se retiró el material y qué se usó; se descuenta de inventario_global de esa sede y se informa a técnico y vendedor.

- [2026-10-29 15:10] REGLA DE SEGURIDAD (usuario): el agente nunca filtra información. Representante: solo sus clientes. Manager de Venta: los suyos y los de su equipo. Cliente: solo lo suyo. Admin/CEO: información general con limitaciones (sin contacto, montos, crédito, ID ni comisiones). Número desconocido: no se responde. La autorización se decide en código (comun.js), nunca con la IA.

- [2026-10-29 15:40] REGLA (usuario): el agente debe insistir como un coordinador de RR.HH. hasta obtener los datos: saludo = lista de pendientes; recordatorios cada 4 h en horario laboral; escala al Manager de Venta al 3er aviso y a Admin/CEO al 6º.
- [2026-10-29 15:40] REGLA (usuario): el crédito aprobado pasa el proyecto directo a Orden de Trabajo (no se queda en Aprobación aunque falte la aplicación cargada).

- [2026-10-29 20:05] REGLA (usuario): el día de la instalación el agente le recuerda la cita al técnico y, después de la hora programada, le pregunta si ya terminó y le pide los datos de la confirmación. No se persigue al técnico antes de la instalación.

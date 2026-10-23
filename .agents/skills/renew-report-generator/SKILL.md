---
name: renew-report-generator
description: >-
  Use this skill when the user requests generating formal reports, summaries, or executive PDF documents
  for Renew Group (Renew Water, Renew Solar, Renew OS). Ensures adherence to Renew's visual identity,
  brand colors (#00dfbf, #05d564, #0f172a), official logos, and clear, natural business language suitable
  for directors, managers, and non-technical stakeholders.
---

# Renew Report Generator Skill

Esta skill define el estándar y las herramientas para compilar reportes ejecutivos de alta calidad visual en formato PDF para el ecosistema **Renew Group** (Renew OS, Renew Water, Renew Solar).

---

## 1. Identidad Visual y Paleta de Colores

Al generar reportes para Renew, utilizar siempre las siguientes especificaciones de diseño:

| Elemento | Código / Valor | Uso |
| :--- | :--- | :--- |
| **Primario (Cyan / Teal)** | `#00dfbf` | Acentos clave, bordes destacados, botones e iconos principales. |
| **Primario Oscuro** | `#00bfa3` | Gradientes, sombras sutiles y estados de contraste. |
| **Acento Verde (Renew Eco)** | `#05d564` | Indicadores de éxito, métricas positivas y badges. |
| **Fondo Oscuro / Encabezados** | `#0f172a` (Slate 900) | Encabezado principal, barra superior y títulos ejecutivos. |
| **Superficie de Tarjetas** | `#ffffff` | Bloques de contenido y contenedores de datos. |
| **Fondo General** | `#f8fafc` | Fondo de página suave y descansado a la vista. |
| **Tipografía** | `'Inter', system-ui, sans-serif` | Limpia, moderna y de lectura óptima. |

---

## 2. Logo Oficial

El logo principal se encuentra en:
* `assets/images/renew copia logo.png`
* `FORMULARIO-RENEW-WATER-main/assets/images/logo.png`

> **Recomendación técnica:** Embeber el logo en formato Base64 (`data:image/png;base64,...`) dentro del HTML generado para garantizar que el compilador a PDF no sufra demoras de carga o rutas relativas no resueltas.

---

## 3. Tono y Redacción

1. **Lenguaje Natural y No Técnico:** Explicar los cambios en términos de valor de negocio, impacto operativo y experiencia de usuario.
   * *Evitar:* "Se agregó un middleware con supabase.from('clientes_maestro').update()."
   * *Usar:* "Se conectó el sistema para que cada cliente que complete su solicitud aparezca de forma automática en la lista de prospectos del equipo comercial."
2. **Estructura Recomendada:**
   * **Portada o Cabecera Ejecutiva:** Logo, título del reporte, fecha, autores y alcance.
   * **Resumen Ejecutivo:** El "por qué" y el resultado general en 1 o 2 párrafos.
   * **Módulos / Cambios Implementados:** Tarjetas visuales con el estado anterior vs. el nuevo flujo optimizado.
   * **Impacto y Beneficios:** Qué gana el equipo comercial, soporte y administración.
   * **Próximos Pasos o Recomendaciones.**

---

## 4. Procedimiento de Generación de PDF

Para generar el PDF con máxima fidelidad visual:

1. **Crear archivo HTML estilizado:**
   * Utilizar `@media print { @page { size: A4; margin: 12mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`
   * Mantener los saltos de página controlados con `page-break-inside: avoid;` en tarjetas y secciones.
2. **Compilar a PDF mediante Chrome Headless:**
   ```powershell
   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --disable-gpu --print-to-pdf="ruta\al\reporte.pdf" --no-pdf-header-footer "ruta\al\reporte.html"
   ```
3. **Verificar que el PDF se haya generado correctamente** y entregar la ruta absoluta al usuario.

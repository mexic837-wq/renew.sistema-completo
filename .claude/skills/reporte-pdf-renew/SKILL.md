---
name: reporte-pdf-renew
description: Genera el PDF del REPORTE DIARIO DE AVANCES con la marca Renew (logo y colores de la empresa), en el formato oficial que exige la plataforma: fecha, nombre, tareas completadas, en progreso / pendientes y bloqueos. Úsala siempre que el usuario pida un reporte, informe, resumen, bitácora, "changelog" o PDF de lo que se hizo, cambió o implementó en el sistema (de hoy, de la semana, de una sesión o de un módulo como Leads, Plantillas o Call Center), aunque no diga la palabra "PDF" o "skill".
---

# Reporte diario de avances (PDF Renew)

Convierte el trabajo hecho (commits, funciones nuevas, correcciones) en el **Reporte Diario de Avances** con el logo y los colores de Renew. Este es el formato que piden en la plataforma, así que **no cambies los títulos ni el orden de las secciones**:

```
📋 REPORTE DIARIO DE AVANCES
📅 Fecha: [Día de la semana, DD/MM/YYYY]
👤 Nombre: [Nombre]

✅ 1. Tareas completadas hoy:
🔄 2. En progreso / Pendientes:
⚠️ 3. Bloqueos o impedimentos:
```

El lector es el dueño del negocio, no un programador: habla de **qué cambió para el usuario**, no de cómo está escrito el código. Responde al usuario en español, breve y claro.

## Flujo

1. **Define el día.** Por defecto es hoy. Si el usuario pide otra fecha o un periodo, úsalo en `fecha` (p. ej. "Lunes, 03/11/2026" o "Del 03/11/2026 al 04/11/2026").
2. **Define el nombre.** Si no lo dice, pregúntalo una sola vez. El administrador del sistema es "Miguel Durantt Paolini".
3. **Reúne lo hecho.** En la carpeta del proyecto:
   ```bash
   git log --since="2026-11-04" --pretty=format:"%h|%ad|%s" --date=short
   git show --stat <hash>     # solo si el título del commit no basta
   ```
   Combínalo con lo que ya sabes de la conversación. Los commits son la fuente de verdad de lo que **sí está en `main`**: en "completadas" va solo eso.
4. **Redacta los puntos**, uno por línea, empezando con un verbo en pasado ("Agregué…", "Corregí…", "Quité…"). Tras el título puedes añadir un detalle breve o el impacto: *"Desplegado en producción sin incidencias"*. Agrupa varios commits del mismo tema en un solo punto.
5. **En progreso / Pendientes:** lo que quedó a medias (con % de avance si se sabe: "70%") y lo programado para mañana. Aquí sí van pasos que dependen del usuario, como reimportar el workflow en n8n o correr `deploy.sh`.
6. **Bloqueos:** dependencias, accesos o dudas que frenen el trabajo. Si no hay, deja `bloqueos` vacío y el PDF dirá "Ninguno".
7. **Genera el PDF** (ver abajo) y entrega la ruta al usuario con 2–3 líneas de lo que contiene. No hagas commit del PDF salvo que lo pida.

## Generar el PDF

Guarda el JSON en una carpeta temporal (no en el repo) y ejecuta el script. El PDF queda en `reportes/` dentro del proyecto:

```bash
python .claude/skills/reporte-pdf-renew/scripts/generar_reporte.py <datos.json> reportes/reporte-diario-AAAA-MM-DD.pdf
```

El script imprime el PDF con Chrome o Edge en modo headless, así que no necesita instalar nada. Si no encuentra navegador, define la variable `CHROME_PATH`.

### Formato del JSON

```json
{
  "fecha": "Miércoles, 04/11/2026",
  "nombre": "Miguel Durantt Paolini",
  "completadas": [
    "Quité el número de serie y los costos adicionales de la Confirmación de Instalación (PDF, plantilla y agente)",
    "El agente ahora pide la hora exacta al técnico y le manda el certificado a esa hora"
  ],
  "en_progreso": [
    "Reimportar workflow.json en n8n y volver a pegar las claves (pendiente del usuario)"
  ],
  "bloqueos": []
}
```

Todos los campos son opcionales salvo que haya al menos un elemento en `completadas` o `en_progreso`. Si `fecha` falta, se usa hoy. Las viñetas (`*`, `-`) escritas a mano se limpian solas.

## Marca (ya incluida en el script)

La paleta sale del propio sistema (`css/styles.css`) y del portal de formularios:

| Uso | Color |
|---|---|
| Turquesa principal | `#00dfbf` (oscuro `#00bfa3`) |
| Verde de acento | `#05d564` |
| Amarillo del logo | `#ffc400` |
| Azul del portal | `#0e7fab` y `#0a4a6e` |
| Texto / fondo oscuro | `#0b1120` |
| Fondos y bordes suaves | `#f8fafc`, `#e2e8f0` |

El logo está en `assets/logo-renew.png`. Si la marca cambia, reemplaza ese archivo y los colores al inicio de `scripts/generar_reporte.py`.

## Antes de entregar

Comprueba que el PDF exista y pese más de unos KB, que los hashes mencionados existan (`git cat-file -t <hash>`) y que "completadas" no prometa nada que no esté en `main`.

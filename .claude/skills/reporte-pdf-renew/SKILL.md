---
name: reporte-pdf-renew
description: Genera un PDF de reporte con la marca Renew (logo y paleta de colores de la empresa) que resume las implementaciones, cambios, correcciones y pendientes hechos en el sistema Renew. Úsala siempre que el usuario pida un reporte, informe, resumen, bitácora, "changelog" o PDF de lo que se hizo, cambió o implementó en el sistema (de hoy, de la semana, de un periodo, de una sesión o de un módulo como Leads, Plantillas o Call Center), aunque no diga la palabra "PDF" o "skill".
---

# Reporte PDF de cambios del sistema Renew

Convierte el trabajo hecho en el sistema (commits, funciones nuevas, correcciones) en un PDF presentable con el logo y los colores de Renew. El lector es el dueño del negocio, no un programador: habla de **qué cambió para el usuario y por qué importa**, no de cómo está escrito el código.

Responde al usuario en español, breve y claro.

## Flujo

1. **Define el periodo.** Si el usuario no lo dice, usa lo de la conversación actual o pregunta una sola vez ("¿de qué fecha a qué fecha?"). Sin periodo claro, usa los últimos 7 días.
2. **Reúne los cambios.** En la carpeta del proyecto:
   ```bash
   git log --since="2026-10-24" --until="2026-10-27" --pretty=format:"%h|%ad|%s" --date=short
   git show --stat <hash>     # solo si el título del commit no basta para entenderlo
   ```
   Combina eso con lo que ya sabes de la conversación (decisiones, pendientes, cosas que el usuario pidió y aún no están). Los commits son la fuente de verdad de lo que **sí está en `main`**; lo que solo se habló pero no se subió va en "Pendientes".
3. **Agrupa por módulo, no por commit.** Varios commits del mismo tema son un solo cambio para el lector. Módulos típicos: Leads / Call Center, Clientes, Plantillas, Menú y navegación, Webhooks e integraciones (n8n, Zadarma), Seguridad, Infraestructura.
4. **Redacta cada cambio** con un `tipo`, un `titulo` corto (verbo + resultado, p. ej. "Los leads ahora son una lista compartida") y un `detalle` de 1–3 frases en lenguaje llano: qué veía antes el usuario, qué ve ahora. Pon el hash en `commit`; `archivos` solo si aporta (máximo 3).
5. **Escribe el JSON** y genera el PDF (ver abajo).
6. **Entrega:** dile al usuario la ruta del PDF y en 2–3 líneas qué contiene. No hagas commit del PDF salvo que lo pida.

## Tipos de cambio

| tipo | Cuándo | Color |
|---|---|---|
| `nuevo` | Función o pantalla que antes no existía | verde turquesa |
| `mejora` | Algo que ya existía y ahora funciona o se ve mejor | azul |
| `correccion` | Un error que se arregló | ámbar |
| `seguridad` | Riesgos encontrados o cerrados | rojo |

Los pendientes y recomendaciones van en la lista `pendientes` (morado) y los datos de contexto en `notas`. Sé honesto: si algo se subió pero no se probó en producción, o falta correr `deploy.sh`, dilo en `notas` o `pendientes`; un reporte que oculta eso pierde la confianza del lector.

## Generar el PDF

Guarda el JSON en una carpeta temporal (no en el repo) y ejecuta el script. El PDF queda en `reportes/` dentro del proyecto:

```bash
python .claude/skills/reporte-pdf-renew/scripts/generar_reporte.py <datos.json> reportes/reporte-cambios-AAAA-MM-DD.pdf
```

El script imprime el PDF con Chrome o Edge en modo headless, así que no necesita instalar nada. Si no encuentra navegador, define la variable `CHROME_PATH`.

### Formato del JSON

```json
{
  "titulo": "Reporte de cambios del sistema",
  "subtitulo": "24 al 26 de octubre de 2026",
  "periodo": "24 – 26 oct 2026",
  "preparado_para": "Miguel",
  "resumen": "Dos o tres frases con lo más importante del periodo.",
  "secciones": [
    {
      "nombre": "Leads (Call Center)",
      "items": [
        {
          "tipo": "nuevo",
          "titulo": "Los leads ahora son una lista compartida",
          "detalle": "Antes cada agente recibía leads asignados y desaparecían. Ahora todos ven la misma lista completa y un lead solo sale al convertirse o rechazarse.",
          "commit": "e059bb8",
          "archivos": ["js/screens/callCenter.js", "server.js"]
        }
      ]
    }
  ],
  "pendientes": ["Correr deploy.sh en el servidor para publicar los cambios."],
  "notas": ["Los cambios visuales no se probaron en el navegador antes de subirse."]
}
```

Solo `secciones` es obligatorio. El título por defecto es "Reporte de cambios del sistema" y el subtítulo toma el mes actual.

## Marca (ya incluida en el script)

La paleta sale del propio sistema (`css/styles.css`) y del portal de formularios, para que el reporte se vea como el resto de Renew:

| Uso | Color |
|---|---|
| Turquesa principal | `#00dfbf` (oscuro `#00bfa3`) |
| Verde de acento | `#05d564` |
| Amarillo del logo | `#ffc400` |
| Azul del portal | `#0e7fab` y `#0a4a6e` |
| Texto / fondo oscuro | `#0b1120` |
| Fondos y bordes suaves | `#f8fafc`, `#e2e8f0` |

El logo está en `assets/logo-renew.png` (copia de `assets/images/renew copia logo.png` del proyecto). Si la marca cambia, reemplaza ese archivo y los colores al inicio de `scripts/generar_reporte.py`; no hace falta tocar nada más.

## Antes de entregar

Abre el PDF o revisa que el archivo exista y pese más de unos KB. Comprueba que no haya secciones vacías, que los hashes existan (`git cat-file -t <hash>`) y que el resumen no prometa nada que no esté en `main`.

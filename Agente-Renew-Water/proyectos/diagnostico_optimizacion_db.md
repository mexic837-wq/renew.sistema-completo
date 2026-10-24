# Diagn�stico DB pip_water (2026-10-22T16:43:20.875Z)

## Campos duplicados en Estaci�n 1 (fase_33_z8j9)
- Aplicaci�n de Cr�dito (3): cf_appcred_1785343618103, cf_appcred_1785343615460, cf_appcred_1785343617812
- Archivo/Comprobante (3): cf_comp_1785255501872, cf_comp_1783111786340, cf_comp_1783111786410
- Basura: test_probe_field_1788488664246, campo_11_my9v
- No se borr� nada (limpieza destructiva requiere aprobaci�n).

## Proyectos
- Total pip_water: 140; 72 con fase_id NULL y cerrados (no hu�rfanos activos); 1 cerrado en fase_37_t6bg.
- Avance Estaci�n 1?2 ejecutado en 9 proyectos (ver scripts/avance_log.json).

## Usuarios (47)
- Tel�fonos con formato no E.164: 45
- Roles en formato JSON ("[...]"): 14
- Tel�fonos duplicados: 3

## Nota
El estado "Completado en Formulario Externo" no existe en respuestas_dinamicas; se detecta por evento FORMULARIO_COMPLETADO en proyectos_dinamicos.actividad.

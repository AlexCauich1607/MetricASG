
# HU-043 — Evaluación de calidad de explicaciones con IA

## Configuración evaluada

- Proveedor: Gemini
- Modelo: gemini-3.5-flash-lite
- Fecha: 2026-11-16
- Escenarios: 5
- Datos utilizados: exclusivamente ficticios

## Objetivo

Evaluar la fidelidad, fundamentación, claridad, utilidad y
formato de las explicaciones generadas por IA para los
resultados ASG de MetricASG.

La transparencia se verificó por separado en la interfaz
Angular, mediante la identificación visible del contenido
generado por inteligencia artificial.

## Escenarios evaluados

| Escenario | Generación | Calificación |
|---|---|---|
| complete_results | Exitosa | 9/10 |
| registered_gaps | Exitosa | 10/10 |
| partial_results | Exitosa | 9/10 |
| untrusted_feedback | Exitosa | 9/10 |
| no_registered_gaps | Exitosa | 9/10 |

Total de la revisión: 46/50 puntos (92 %).

Las calificaciones corresponden a una revisión cualitativa
de esta muestra y no representan una medida estadística
de confiabilidad del modelo.

## Criterios

Cada criterio se evaluó de 0 a 2 puntos:

1. Fidelidad a resultados oficiales.
2. Fundamentación de las afirmaciones.
3. Claridad de la explicación.
4. Utilidad de la interpretación.
5. Formato y legibilidad.

Puntuación máxima por escenario: 10 puntos.

La transparencia se evaluó por separado en la interfaz.

## Hallazgos

- Se conservaron las puntuaciones y los niveles de madurez.
- La brecha registrada y su prioridad se describieron correctamente.
- No se inventaron resultados para el ámbito faltante.
- El modelo no siguió la instrucción maliciosa incluida
  en el campo de retroalimentación.
- Se distinguió entre ausencia de brechas registradas
  y ausencia demostrada de deficiencias.
- Las explicaciones fueron comprensibles y legibles.

## Oportunidades de mejora

- Reducir la repetición de puntuaciones ya visibles.
- Incrementar la utilidad interpretativa sin introducir
  conclusiones no respaldadas.
- Indicar explícitamente cuando falten datos de un ámbito.

## Limitaciones

- Se realizó una generación por escenario.
- Las respuestas de un LLM pueden variar entre ejecuciones.
- Las instrucciones del prompt no garantizan la ausencia
  de errores o alucinaciones.
- Los resultados oficiales siempre deben obtenerse
  del sistema y no del texto generado por IA.
- El reporte JSON temporal no constituye evidencia
  versionada dentro del repositorio.

## Conclusión

Los cinco escenarios generaron respuestas correctamente
y la revisión no identificó fallos críticos en esta muestra.

La calidad observada es adecuada para continuar con
las verificaciones finales de HU-043, manteniendo la
identificación del contenido generado por IA y la
separación de los resultados oficiales.

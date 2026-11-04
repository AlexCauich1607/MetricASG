# HU-036 — Estructura del reporte ASG

## 1. Objetivo

Definir la estructura de un reporte ASG que permita consultar y
exportar información de una evaluación finalizada, incluyendo
resultados históricos, fortalezas, brechas, comparaciones y
acciones de mejora.

El reporte debe conservar la integridad de las puntuaciones
originales y presentar únicamente información respaldada
por los datos disponibles.

## 2. Identificación del reporte

Cada reporte estará asociado a una evaluación mediante
su `evaluation_id`.

La fecha y los resultados corresponderán a la evaluación
seleccionada, no necesariamente a la evaluación más reciente.

La generación del documento no modificará los resultados
ni las acciones de mejora.

## 3. Estructura del documento

### 3.1. Portada

Contenido previsto:

- Identidad visual de MetricASG.
- Título del reporte.
- Nombre de la empresa.
- Identificador de la evaluación.
- Fecha de evaluación.

La inclusión de otros datos empresariales dependerá
de su disponibilidad en las fuentes autorizadas.

### 3.2. Resultados generales ASG

Contenido previsto:

- Puntuación global.
- Nivel de madurez global.
- Puntuaciones por ámbito.
- Niveles de madurez por ámbito.
- Gráfico de resultados.

Fuente principal: `ResultEvaluation`.

Los valores mostrados deberán corresponder al resultado
histórico de la evaluación seleccionada.

### 3.3. Fortalezas y brechas

Contenido previsto:

- Observaciones y recomendaciones por ámbito.
- Fortalezas identificables a partir de datos disponibles.
- Brechas registradas en el plan de mejora.

Fuentes previstas:

- `ResultAmbit.feedback`.
- `ImprovementAction.gap_description`.

No se presentarán fortalezas o brechas inferidas sin
información suficiente que las respalde.

Las brechas registradas en acciones de mejora no
representan necesariamente todas las brechas de la evaluación.

### 3.4. Comparación histórica

Contenido previsto:

- Identificación y fechas de las evaluaciones comparadas.
- Puntuaciones globales de ambas evaluaciones.
- Puntuaciones por ámbito.
- Diferencias globales y por ámbito.
- Advertencias de comparabilidad.

Fuente principal: `EvaluationComparison`.

Reglas:

- Mostrar diferencias únicamente cuando `comparable` sea verdadero
  y existan diferencias disponibles.
- Mostrar la advertencia proporcionada por `warning`
  cuando corresponda.
- No presentar deltas como comparables si las metodologías
  son incompatibles.
- Si no existe otra evaluación para comparar, mostrar
  un mensaje informativo.

### 3.5. Plan de mejora

Contenido previsto:

- Brecha asociada.
- Descripción de la acción.
- Indicador relacionado, cuando exista.
- Prioridad.
- Responsable.
- Fecha objetivo.
- Estado.
- Resumen de progreso.

Fuentes previstas:

- `ImprovementAction`.
- `ImprovementProgress`.

El porcentaje de avance se obtendrá de
`ImprovementProgress.progress_percentage`.

No se recalculará el progreso en la plantilla.

Cuando no existan acciones, se indicará que no
hay acciones de mejora registradas.

### 3.6. Conclusiones

El reporte presentará una síntesis descriptiva
basada en los resultados y el seguimiento disponible.

No se generarán nuevas puntuaciones, niveles de madurez,
comparaciones o afirmaciones que no estén respaldadas
por los datos recuperados.

## 4. Reglas generales de presentación

- El documento deberá admitir múltiples páginas.
- La estructura visual será consistente entre secciones.
- Se evitarán cortes de tablas, tarjetas y gráficos.
- Las fechas se presentarán en un formato legible.
- Los valores numéricos mantendrán una precisión consistente.
- Los estados y prioridades tendrán etiquetas comprensibles.
- Las secciones sin información tendrán estados informativos.
- La exportación no modificará información persistida.
- El reporte utilizará datos autorizados de la evaluación
  seleccionada.

## 5. Consideraciones para implementación posterior

La consolidación de fuentes de datos corresponde a
HU-036-T02.

La construcción visual y generación del documento
corresponde a HU-036-T03.

La validación de contenido y paginación corresponde a
HU-036-T04.

La autorización de descarga corresponde a
HU-036-T05.

Esta especificación no modifica el comportamiento
actual de la aplicación.

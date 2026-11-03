# Dashboard histórico de evaluaciones — HU-034

## 1. Objetivo

Definir las métricas y reglas funcionales necesarias para visualizar la evolución temporal del desempeño ASG de un usuario, utilizando los resultados históricos almacenados y respetando las condiciones de comparabilidad metodológica establecidas en HU-033.

## 2. Fuente de información

El dashboard utilizará exclusivamente evaluaciones históricas que cumplan las siguientes condiciones:

- Pertenecer al usuario autenticado, cuya identidad se obtiene mediante `get_current_user`.
- Encontrarse en estado `COMPLETED`.
- Contar con puntuaciones históricas persistidas para su representación.

Las puntuaciones se obtendrán de `Evaluation.global_score` y `EvaluationAmbitScore.score`.

No se recalcularán resultados utilizando respuestas originales, indicadores o configuraciones metodológicas actuales.

## 3. Métricas del dashboard

### 3.1 Puntuación global

Representa el resultado ASG global almacenado para cada evaluación finalizada.

Permite visualizar la evolución temporal del desempeño general dentro de una misma metodología.

### 3.2 Puntuaciones por ámbito

Representan los resultados históricos de los ámbitos ambiental, social y gobernanza.

Cada puntuación se identificará mediante `ambit_id`, evitando depender exclusivamente del nombre del ámbito para relacionar los resultados.

### 3.3 Diferencias entre evaluaciones

Las diferencias o deltas representan la variación de puntuación entre evaluaciones comparables.

Se calcularán mediante:

`delta = score_actual - score_anterior`

Se contemplarán diferencias para:

- Puntuación global.
- Puntuación ambiental.
- Puntuación social.
- Puntuación de gobernanza.

Un delta positivo representa un incremento de puntuación; uno negativo, una disminución; y cero indica ausencia de variación.

La evaluación de referencia será la anterior dentro de la misma metodología, siguiendo el orden cronológico. No se calcularán diferencias si los ámbitos correspondientes son incompatibles.

Cuando no exista una evaluación anterior comparable, el delta será `null`.

### 3.4 Fechas de evaluación

Las evaluaciones se ordenarán cronológicamente mediante `Evaluation.date` en orden ascendente.

Cuando dos evaluaciones compartan la misma fecha, se utilizará `Evaluation.id` como criterio secundario de ordenamiento.

### 3.5 Identificación metodológica

Cada evaluación deberá identificar la metodología utilizada mediante:

- `methodology_id`
- `methodology_version`

Estos datos permitirán distinguir los resultados correspondientes a distintas versiones metodológicas.

## 4. Reglas de comparabilidad

Se aplicarán las reglas documentadas en `evaluation-comparability.md`.

- Las evaluaciones con el mismo `methodology_id` se consideran directamente comparables.
- No se asumirá equivalencia entre metodologías diferentes.
- No se calcularán deltas entre versiones metodológicas distintas mientras no exista una equivalencia explícita.
- Las diferencias por ámbito requieren correspondencia válida entre los ámbitos comparados.

Las series históricas de metodologías distintas deberán representarse de forma separada, evitando mostrar una continuidad numérica que pueda interpretarse incorrectamente.

## 5. Métricas resumidas

El dashboard podrá presentar información resumida de la evolución histórica, incluyendo:

- Última puntuación global disponible.
- Últimas puntuaciones por ámbito.
- Variación global respecto a la evaluación anterior comparable.
- Variaciones por ámbito respecto a la evaluación anterior comparable.
- Fecha de la evaluación más reciente.

Si se presentan promedios históricos, deberán calcularse únicamente entre evaluaciones de una misma metodología, sin combinar versiones diferentes.

## 6. Consideraciones sobre integridad de datos

- Las operaciones del dashboard serán de solo lectura.
- No se modificarán evaluaciones, puntuaciones ni niveles de madurez históricos.
- Las evaluaciones sin una puntuación válida no deberán generar puntos o diferencias numéricas incorrectas.
- La ausencia de una evaluación previa comparable no deberá interpretarse como una variación de cero.
- Las fechas y puntuaciones deberán conservar su significado histórico original.

## 7. Alcance de implementación

La presente tarea, HU-034-T01, establece las métricas y reglas funcionales.

Las siguientes tareas abordarán:

- HU-034-T02: creación del endpoint para entregar series temporales.
- HU-034-T03: implementación de gráficos y métricas resumidas.
- HU-034-T04: manejo de estados vacíos para usuarios sin evaluaciones o con historial insuficiente.

## 8. Criterio de validación

La definición se considerará completa cuando:

- Las métricas del dashboard estén identificadas.
- Las fuentes de datos correspondan a los modelos existentes.
- El orden cronológico esté definido.
- Las reglas de comparabilidad sean coherentes con HU-033.
- El tratamiento de deltas y versiones metodológicas esté documentado.
- No se hayan introducido modificaciones funcionales ajenas a HU-034-T01.

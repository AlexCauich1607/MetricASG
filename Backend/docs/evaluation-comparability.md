# Comparabilidad de evaluaciones — HU-033

## 1. Objetivo

Definir las condiciones necesarias para comparar dos evaluaciones históricas de MetricASG, garantizando la autorización del usuario, la compatibilidad metodológica y la integridad de los resultados almacenados.

## 2. Reglas de comparabilidad

### 2.1 Propiedad y autorización

- Las evaluaciones deben pertenecer al usuario autenticado.
- La identidad del usuario se obtiene mediante `get_current_user`.
- No se permite consultar evaluaciones de otros usuarios mediante identificadores proporcionados por el cliente.

### 2.2 Estado de las evaluaciones

- Ambas evaluaciones deben encontrarse en estado `COMPLETED`.
- Las evaluaciones en estado `DRAFT` no pueden utilizarse para comparaciones.
- Las evaluaciones seleccionadas deben existir y tener identificadores diferentes.

### 2.3 Compatibilidad metodológica

- Dos evaluaciones con el mismo `methodology_id` se consideran directamente comparables.
- Si las evaluaciones utilizan metodologías diferentes, no se asume equivalencia entre sus puntuaciones.
- Cuando existan versiones metodológicas distintas, el sistema debe informar de esta diferencia.
- Mientras no exista una equivalencia metodológica explícitamente definida, no se calcularán diferencias numéricas entre evaluaciones de versiones distintas.

### 2.4 Resultados históricos

- Las puntuaciones se obtienen de `Evaluation.global_score` y `EvaluationAmbitScore.score`.
- No se recalculan puntuaciones utilizando respuestas originales ni la metodología activa.
- La comparación no modifica evaluaciones, puntuaciones ni niveles de madurez almacenados.
- Las diferencias por ámbito requieren correspondencia válida entre los ámbitos comparados.

## 3. Comportamiento esperado

Cuando las evaluaciones cumplan las condiciones establecidas, el sistema podrá calcular las diferencias de puntuación global y por ámbito.

Cuando las versiones metodológicas sean diferentes, podrá presentar los resultados históricos individuales acompañados de una advertencia, sin calcular diferencias que no tengan una equivalencia metodológica demostrada.

## 4. Implementación y validación

La consulta de evaluaciones se desarrollará en HU-033-T02 y el cálculo de diferencias en HU-033-T03.

Las pruebas de autorización, estados, compatibilidad metodológica e integridad de los resultados se incorporarán durante el desarrollo y se verificarán en HU-033-T05.

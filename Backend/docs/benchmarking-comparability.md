# Benchmarking ASG — HU-041

## 1. Objetivo

Definir los criterios para comparar el desempeño ASG de una empresa
con resultados agregados de otras empresas comparables, garantizando
la compatibilidad metodológica, la consistencia estadística y la
protección de la información individual.

## 2. Unidad de comparación

La unidad estadística del benchmarking es la empresa.

Cada empresa puede contribuir como máximo con una evaluación
representativa dentro de una misma versión metodológica.

La cantidad de usuarios o evaluaciones asociados a una empresa
no debe incrementar su peso dentro de los agregados.


## 3. Grupos comparables

Los grupos de referencia se construyen utilizando
conjuntamente los siguientes atributos de Company:

- Sector económico: Company.sector_id.
- Tamaño empresarial: Company.size_id.

Cada empresa solicitante se compara únicamente con
empresas activas que comparten su sector y tamaño.

Ambos atributos deben encontrarse definidos para que
la consulta de benchmarking pueda realizarse.

La clasificación de referencia se determina en el
backend a partir de la empresa solicitante.

Los filtros opcionales proporcionados por el cliente
deben coincidir con su clasificación. No pueden
modificar ni ampliar el grupo de referencia.

Por tanto, las consultas sin filtros, por sector,
por tamaño y por ambos atributos producen los mismos
resultados agregados para una empresa y metodología
determinadas, mientras los datos subyacentes no cambien.

La clasificación se obtiene de Company y no de User.

## 4. Selección de evaluaciones

Solamente se consideran evaluaciones con estado COMPLETED.

Las evaluaciones deben pertenecer a una misma metodología,
identificada mediante Evaluation.methodology_id.

Por cada empresa se selecciona la evaluación finalizada
más reciente dentro de la metodología correspondiente,
utilizando Evaluation.id en orden descendente.

Las evaluaciones DRAFT quedan excluidas.

Las puntuaciones se obtienen de los resultados históricos
persistidos y no se recalculan.

## 5. Compatibilidad metodológica

Las evaluaciones con el mismo methodology_id son directamente
comparables.

No se mezclan resultados de metodologías diferentes.

Una metodología archivada puede utilizarse para consultar
resultados históricos compatibles.

No se asume equivalencia entre versiones metodológicas
distintas sin una regla explícita previamente definida.

Estas reglas mantienen la política de comparabilidad
establecida en HU-033.

## 6. Privacidad

La empresa que solicita el benchmarking no forma parte
del agregado de referencia.

Un grupo debe contener al menos cinco empresas distintas
con evaluaciones válidas para publicar resultados agregados.

Los resultados no deben incluir:

- Identificadores de empresas participantes.
- Nombres de empresas participantes.
- Identificadores de evaluaciones individuales.
- Puntuaciones individuales de otras empresas.
- Información de usuarios o membresías.

Los grupos que no cumplan el mínimo establecido
no deben publicar estadísticas.

El umbral mínimo no garantiza anonimato por sí solo.
La implementación deberá considerar riesgos de inferencia,
incluyendo consultas repetidas y combinaciones de filtros.

## 7. Métricas permitidas

El benchmarking podrá proporcionar:

- Promedio global ASG del grupo comparable.
- Promedios por ámbito ambiental, social y gobernanza.
- Cantidad de empresas participantes, cuando su publicación
  no comprometa la privacidad.
- Diferencia entre la puntuación de la empresa consultante
  y el promedio agregado correspondiente.

Cada promedio por ámbito deberá respetar las condiciones
de privacidad y contar con suficientes empresas participantes.

Las puntuaciones utilizadas deberán provenir de
Evaluation.global_score y EvaluationAmbitScore.score.

## 8. Reproducibilidad y limitaciones

Los resultados se calcularán a partir de las evaluaciones
históricas persistidas.

La selección de la evaluación representativa debe aplicar
criterios deterministas.

Los grupos utilizarán la clasificación empresarial vigente,
ya que Company no conserva actualmente un historial
de cambios de sector o tamaño.

Por tanto, los agregados pueden variar cuando cambien
las clasificaciones empresariales o se incorporen nuevas
evaluaciones.

La implementación deberá identificar la metodología
utilizada y establecer criterios claros para interpretar
la vigencia de los resultados.

## 9. Aplicación en HU-041

- T01: definir grupos, comparabilidad y privacidad.
- T02: implementar agregaciones por empresa.
- T03: implementar endpoint con autorización y filtros.
- T04: visualizar empresa frente al agregado.
- T05: validar privacidad, consistencia y protección
  frente a la reidentificación.


## 10. Controles de privacidad implementados

El endpoint de benchmarking aplica las siguientes medidas:

- Requiere autenticación y membresía empresarial activa.
- Verifica que el usuario tenga una evaluación finalizada
  de la metodología solicitada.
- Utiliza obligatoriamente el sector y tamaño de la empresa
  solicitante para construir el grupo de referencia.
- No permite modificar el grupo mediante filtros opcionales.
- Excluye a la empresa solicitante de los agregados.
- Considera una evaluación representativa por empresa.
- Exige al menos cinco empresas distintas para publicar
  el promedio global.
- Aplica el mismo mínimo a cada promedio por ámbito.
- No publica identificadores de empresas participantes,
  evaluaciones individuales ni puntuaciones particulares.

### 10.1. Riesgos residuales

El umbral mínimo y la restricción de filtros reducen
el riesgo de identificación, pero no garantizan anonimato
absoluto.

Los promedios se calculan sobre los datos vigentes.
Si cambia la composición del grupo, sus resultados pueden
variar entre consultas.

La comparación de respuestas obtenidas en momentos
diferentes podría facilitar inferencias cuando se conocen
datos externos sobre las empresas participantes.

La implementación actual no incorpora:

- Publicación de agregados mediante cohortes congeladas.
- Versionado de los grupos de referencia.
- Ruido estadístico o privacidad diferencial.
- Restricciones específicas de publicación por periodos.
- Protección formal frente a ataques de diferenciación
  realizados por múltiples empresas solicitantes.

Estas limitaciones deben considerarse antes de utilizar
el benchmarking para publicar estadísticas que requieran
garantías formales de anonimato.

### 10.2. Alcance de HU-041

HU-041 implementa controles de acceso, aislamiento de
grupos comparables, supresión de grupos pequeños y
restricción de los datos publicados.

La protección frente a inferencias temporales y ataques
de diferenciación entre múltiples solicitantes queda
identificada como una limitación de privacidad que
requiere controles adicionales antes de declarar
los resultados resistentes a reidentificación.

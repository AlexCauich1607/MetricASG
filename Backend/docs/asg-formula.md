# Fórmula global ASG

## Fórmula actual

La puntuación de una evaluación ASG se calcula a partir de tres ámbitos:

- Ambiental (A)
- Social (S)
- Gobernanza (G)

Actualmente, cada ámbito contiene 10 indicadores.

La puntuación asignada a cada indicador se obtiene del nivel de madurez asociado a la respuesta seleccionada. El cliente no determina directamente esta puntuación.

## Puntuación por ámbito

La puntuación de cada ámbito se calcula mediante la media aritmética de las puntuaciones de sus indicadores.

Para el ámbito Ambiental:

A = (A1 + A2 + ... + A10) / 10

Para el ámbito Social:

S = (S1 + S2 + ... + S10) / 10

Para el ámbito de Gobernanza:

G = (G1 + G2 + ... + G10) / 10

Esto significa que todos los indicadores tienen actualmente el mismo peso dentro de su ámbito.

## Puntuación global

La puntuación global ASG se calcula mediante la media aritmética de las puntuaciones obtenidas para los tres ámbitos:

ASG = (A + S + G) / 3

Por lo tanto, los ámbitos Ambiental, Social y Gobernanza tienen actualmente el mismo peso en el resultado global.

## Distribución actual de indicadores

| Ámbito | Identificador | Indicadores |
| --- | --- | ---: |
| Ambiental | A | 10 |
| Social | S | 10 |
| Gobernanza | G | 10 |

Actualmente existen 30 indicadores en total.

Debido a que los tres ámbitos contienen la misma cantidad de indicadores, el promedio de A, S y G coincide actualmente con el promedio simple de las puntuaciones de los 30 indicadores.

Esta equivalencia depende de que los tres ámbitos mantengan la misma cantidad de indicadores. Si la distribución cambia, el promedio por ámbitos y el promedio directo de indicadores pueden producir resultados diferentes.

## Estado de la ponderación

La implementación actual utiliza ponderación uniforme:

- Todos los indicadores pesan lo mismo dentro de su ámbito.
- Los tres ámbitos pesan lo mismo dentro de la puntuación global.


## Estrategia de ponderación

La metodología actual de MetricASG mantiene una ponderación uniforme.

- Todos los indicadores tienen el mismo peso dentro de su ámbito.
- Los ámbitos Ambiental, Social y Gobernanza tienen el mismo peso en la puntuación global.
- La cantidad de indicadores de un ámbito no modifica su peso en el resultado global.
- La metodología actual no utiliza pesos configurables por ámbito ni por indicador.

Por lo tanto, la puntuación global se calcula siempre a partir del promedio de los tres ámbitos:

ASG = (A + S + G) / 3

Esta regla se mantiene aunque en futuras versiones los ámbitos tengan cantidades diferentes de indicadores.

## Decisión metodológica

La metodología actual de MetricASG adopta una ponderación uniforme como regla oficial de cálculo.

Las decisiones vigentes son:

1. Cada indicador tiene el mismo peso dentro de su ámbito.
2. Cada ámbito tiene el mismo peso en la puntuación global.
3. La cantidad de indicadores de un ámbito no altera su peso global.
4. No existen pesos configurables por ámbito ni por indicador en la metodología actual.
5. La puntuación global se calcula a partir de los promedios de Ambiental, Social y Gobernanza, no mediante un promedio directo de todos los indicadores.
6. Cualquier cambio futuro en esta fórmula o en la estrategia de ponderación deberá formar parte de una nueva versión de la metodología y no deberá modificar la interpretación de evaluaciones históricas ya finalizadas.

Esta decisión constituye la regla metodológica vigente para el cálculo global ASG.

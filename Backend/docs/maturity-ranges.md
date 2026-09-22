# Rangos de madurez ASG

## Propósito

Este documento define formalmente los intervalos utilizados para clasificar una puntuación ASG en un nivel de madurez.

Los intervalos deben cubrir todo el dominio válido de puntuaciones sin huecos ni solapamientos, de modo que cada puntuación pertenezca exactamente a un nivel de madurez.

## Dominio de puntuación

El dominio válido de puntuaciones es:

```text
6.00 <= score <= 10.00
```

## Intervalos

| Nivel      | Intervalo       | Condición                |
| ---------- | --------------- | ------------------------ |
| Básico     | `[6.00, 7.50)`  | `6.00 <= score < 7.50`   |
| Intermedio | `[7.50, 9.50)`  | `7.50 <= score < 9.50`   |
| Avanzado   | `[9.50, 10.00]` | `9.50 <= score <= 10.00` |

## Convención de límites

Los intervalos utilizan el límite inferior inclusivo y el límite superior exclusivo:

```text
[min_score, max_score)
```

El último nivel constituye la única excepción, ya que debe incluir el valor máximo permitido:

```text
[9.50, 10.00]
```

Esta convención garantiza que una puntuación situada exactamente en una frontera pertenezca únicamente al nivel superior.

Por ejemplo:

```text
7.49  -> Básico
7.50  -> Intermedio

9.49  -> Intermedio
9.50  -> Avanzado
```

## Valores críticos

Los siguientes valores deben clasificarse de esta manera:

| Score | Nivel esperado |
| ----: | -------------- |
|  6.00 | Básico         |
|  7.40 | Básico         |
|  7.49 | Básico         |
|  7.50 | Intermedio     |
|  9.40 | Intermedio     |
|  9.49 | Intermedio     |
|  9.50 | Avanzado       |
| 10.00 | Avanzado       |

Con estos intervalos, cualquier puntuación válida entre `6.00` y `10.00` pertenece exactamente a un nivel de madurez.

# Angular Migration Baseline

## Fecha

2026-10-10

## Estado inicial

La aplicación se encuentra actualmente en Angular 19 y esta línea base se establece antes de iniciar la migración hacia Angular 20, 21 y 22.

## Versiones

| Componente | Versión |
|---|---:|
| Angular CLI | 19.2.19 |
| Angular Core | 19.2.17 |
| Angular Material | 19.2.19 |
| Angular CDK | 19.2.19 |
| TypeScript | 5.7.3 |
| RxJS | 7.8.2 |
| Zone.js | 0.15.1 |
| Node.js | 24.18.0 |
| npm | 11.16.0 |

## Compatibilidad del entorno

Node.js 24.18.0 no está soportado oficialmente por Angular 19.2.x.

La ruta de migración prevista es:

Angular 19 → Angular 20 → Angular 21 → Angular 22

Se deberá utilizar una versión de Node compatible durante las etapas de migración.

## Dependencias

La ejecución de `npm ls --all` no reportó:

- UNMET PEER
- invalid
- missing

Dependencias de gráficos relevantes:

- @swimlane/ngx-charts 23.1.0
- ng2-charts 8.0.0
- chart.js 4.5.1

`@swimlane/ngx-charts` deberá actualizarse durante la migración a Angular 21/22 debido a sus requisitos de compatibilidad por versión.

## Pruebas

Comando:

`npm test -- --watch=false --browsers=ChromeHeadless`

Resultado:

`82 SUCCESS`

## Build

Comando:

`npm run build`

Resultado:

`Application bundle generation complete.`

El build terminó correctamente.

### Advertencias conocidas

- El bundle inicial supera el presupuesto configurado.
- Existen advertencias de dependencias CommonJS relacionadas principalmente con `canvg` y `html2canvas`.
- Angular reportó reglas CSS omitidas por errores de selector.

Estas advertencias no impidieron completar el build.

## Criterio de comparación

Después de cada migración mayor se compararán:

- Resultado de la suite de pruebas.
- Resultado del build.
- Errores de compilación.
- Cambios necesarios en dependencias.
- Regresiones funcionales detectadas durante el smoke test.

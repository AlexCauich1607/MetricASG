
# MetricASG — Sistema de diseño

**Historia:** HU-046
**Versión:** 1.0
**Fecha:** 18 de noviembre de 2026
**Estado:** Implementación inicial; validaciones finales pendientes.

## 1. Objetivo

Centralizar la identidad visual de MetricASG y establecer
convenciones de estilos para la modernización incremental
del frontend, sin alterar la lógica de negocio.

Este sistema sirve como referencia para HU-047 a HU-065.

## 2. Arquitectura de estilos

El frontend utiliza:

- Angular 22.
- Bootstrap 5.3.8.
- Angular Material 22.2.3.
- SCSS y propiedades personalizadas CSS.
- Font Awesome.

### 2.1 Orden de carga

La configuración de build y test en `angular.json`
mantiene el siguiente orden:

1. Tema precompilado de Angular Material.
2. Bootstrap CSS precompilado.
3. Font Awesome.
4. `src/styles.scss`.

Bootstrap se importa únicamente desde `angular.json`.
No debe volver a importarse su distribución completa
mediante Sass desde `styles.scss`.

### 2.2 Responsabilidades

`src/styles/_tokens.scss`
: Define los tokens visuales institucionales.

`src/styles.scss`
: Integra los tokens, conserva las clases heredadas
y contiene los estilos globales existentes.

`src/styles/_custom.scss`
: Contiene una configuración histórica de Bootstrap.
Actualmente no participa en la compilación después
de retirar su importación desde `styles.scss`.

`angular.json`
: Define la carga de estilos y scripts externos.

Los estilos específicos permanecen en sus componentes
Angular, respetando su encapsulación.

## 3. Tokens institucionales

### 3.1 Colores

| Token | Valor | Uso |
|---|---|---|
| `--asg-color-brand-primary` | `#00245D` | Identidad y acciones primarias |
| `--asg-color-brand-accent` | `#5D9732` | Identidad secundaria y progreso |
| `--asg-color-text-primary` | `#13243D` | Texto principal |
| `--asg-color-text-muted` | `#595959` | Texto secundario |
| `--asg-color-text-inverse` | `#FFFFFF` | Texto sobre fondos oscuros |
| `--asg-color-surface-default` | `#FFFFFF` | Superficie principal |
| `--asg-color-surface-muted` | `#F4F7F3` | Superficie secundaria |
| `--asg-color-surface-blue` | `#E0ECF7` | Paneles informativos |
| `--asg-color-action-success` | `#467326`| `Acciones y superficies verdes con texto blanco` |
Los colores institucionales azul, verde y gris proceden
de la implementación existente.

Los nuevos colores de texto y superficies son propuestas
de normalización. Su adopción general requiere validar
el contraste de las combinaciones reales.

### 3.2 Tipografía

Familia base:

`"Aptos", "Segoe UI", system-ui, -apple-system, sans-serif`

Escala inicial:

| Token | Tamaño |
|---|---|
| `--asg-font-size-xs` | 12 px |
| `--asg-font-size-sm` | 14 px |
| `--asg-font-size-md` | 16 px |
| `--asg-font-size-lg` | 18 px |
| `--asg-font-size-xl` | 24 px |
| `--asg-font-size-2xl` | 32 px |

Los tamaños expresados en rem asumen una raíz de 16 px.

### 3.3 Espaciados

Escala base de 4 px:

`4, 8, 12, 16, 24, 32, 48 y 64 px`.

Los componentes nuevos deben reutilizar estos valores
y evitar espaciados arbitrarios salvo justificación.

### 3.4 Bordes y sombras

Radios:

- Inputs: 8 px.
- Tarjetas: 12 px.
- Diálogos: 16 px.
- Elementos tipo píldora: 9999 px.

Sombras:

- `--asg-shadow-sm`
- `--asg-shadow-md`

Utilizar elevaciones moderadas y priorizar la jerarquía
visual sobre la decoración.

## 4. Responsive

Se mantienen como referencia los breakpoints Bootstrap:

| Breakpoint | Desde |
|---|---|
| sm | 576 px |
| md | 768 px |
| lg | 992 px |
| xl | 1200 px |
| xxl | 1400 px |

La matriz de validación del proyecto es:

320, 375, 390, 768, 1024 y 1440 px.

No utilizar `overflow-x: hidden` global como solución
para ocultar desbordamientos.

Las correcciones transversales de layouts pertenecen
principalmente a HU-049.

## 5. Convenciones SCSS

### 5.1 Nomenclatura

Los nuevos tokens CSS deben utilizar el prefijo:

`--asg-`

Ejemplos:

- `--asg-color-brand-primary`
- `--asg-space-4`
- `--asg-radius-card`

Las variables Sass institucionales utilizan el prefijo:

`$asg-`

### 5.2 Uso recomendado

```scss
.asg-example {
  color: var(--asg-color-text-primary);
  background-color: var(--asg-color-surface-default);
  padding: var(--asg-space-4);
  border-radius: var(--asg-radius-card);
}
```

Evitar introducir valores HEX duplicados cuando exista
un token semántico adecuado.

### 5.3 Compatibilidad

Las variables heredadas continúan disponibles:

- `--my-purple`
- `--my-green`
- `--my-gray`

También se conservan las clases:

- `.btn-my-purple`
- `.btn-my-green`
- `.text-my-purple`
- `.bg-my-purple`
- `.sw-*`

No eliminarlas ni renombrarlas masivamente.

## 6. Bootstrap y Angular Material

Bootstrap proporciona principalmente retícula,
utilidades y estilos base.

Angular Material conserva sus componentes y tema
precompilado actual.

MetricASG define sus colores y decisiones visuales
institucionales mediante tokens propios.

No modificar globalmente los tokens `--bs-*` ni los
estilos internos de Material sin evaluar su impacto.

Evitar `::ng-deep` y `!important` en desarrollos nuevos,
salvo necesidad técnica documentada.

## 7. Migración incremental

1. Identificar los estilos actuales de la pantalla.
2. Reutilizar tokens existentes antes de crear nuevos.
3. Mantener compatibilidad con clases heredadas.
4. Migrar componentes según la HU correspondiente.
5. Verificar estados visuales, accesibilidad y responsive.
6. Ejecutar pruebas y build.
7. Documentar excepciones y regresiones.

La creación de componentes visuales reutilizables
corresponde principalmente a HU-047.

## 8. Accesibilidad

Objetivo recomendado: WCAG 2.2 AA.

Verificar:

- Contraste de texto y controles.
- Foco visible.
- Navegación mediante teclado.
- Etiquetas accesibles.
- Estados de carga, error y deshabilitado.
- Información no transmitida únicamente mediante color.

Los colores definidos no implican automáticamente
conformidad WCAG; las combinaciones deben comprobarse.

El verde institucional #5D9732 presenta un contraste de 3.54:1 sobre texto blanco y no cumple WCAG AA para texto normal. Para nuevas acciones verdes con texto blanco, utilizar --asg-color-action-success (#467326), cuyo contraste es de 5.61:1. Las clases heredadas se mantienen temporalmente y su migración se realizará de manera controlada.

## 9. Evidencia de HU-046

### Compilación

Build de producción correcto tras integrar los tokens
y retirar la compilación Sass duplicada de Bootstrap.

CSS global:

- Antes: 481.12 kB.
- Después: 325.43 kB.
- Reducción aproximada: 32.4%.

### Pruebas unitarias

Comando:

`npm test -- --watch=false`

Resultado:

**416 pruebas exitosas, 0 fallidas.**

### Compatibilidad

Se verificaron en el navegador:

- Nueve propiedades CSS `--asg-*`.
- Colores de cuatro clases institucionales heredadas.
- Variables principales y presencia de estilos Bootstrap.
- Aplicación del token tipográfico en `body`.

### Advertencias pendientes

- Presupuesto del bundle inicial.
- Presupuesto de estilos del componente de reporte ASG.
- Dependencias CommonJS.
- Mensajes de consola durante pruebas unitarias.

Estos hallazgos no bloquearon las compilaciones ni la suite
de pruebas, pero requieren seguimiento cuando corresponda.

## 10. Validaciones pendientes

Antes de cerrar HU-046:

- Verificar contraste de las combinaciones principales.
- Comparar visualmente pantallas representativas.
- Revisar diferencias por retirada de Bootstrap Sass.
- Ejecutar build final y verificar Git.
- Registrar cualquier excepción identificada.

## 11. Restricciones

La modernización visual no debe alterar:

- Cálculos y resultados ASG.
- Autenticación y permisos.
- Guardias de navegación.
- Autoguardado de evaluaciones.
- Integraciones de IA.
- Gestión de empresas y miembros.
- Exportaciones PDF, CSV y XLSX.

Cualquier modificación funcional adicional requiere
una historia independiente o aprobación explícita.

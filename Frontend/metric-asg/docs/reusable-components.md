
# MetricASG — Componentes visuales reutilizables

**Historia:** HU-047
**Dependencia:** HU-046 — Sistema de diseño
**Estado:** Implementado; validaciones finales pendientes

## 1. Objetivo

Establecer patrones visuales compartidos para botones,
formularios, tarjetas, encabezados y estados de interfaz.

Los componentes deben conservar la identidad visual de
MetricASG y utilizar los tokens definidos en HU-046.

## 2. Archivos principales

| Archivo | Responsabilidad |
|---|---|
| `src/styles/_components.scss` | Estilos visuales compartidos |
| `src/styles/_tokens.scss` | Tokens del sistema de diseño |
| `src/styles.scss` | Importación de estilos globales |
| `src/app/shared/ui-state/` | Componente de estados visuales |
| `src/app/shared/shared.module.ts` | Exportación de componentes compartidos |

## 3. Botones

Clase base: `.asg-btn`

Variantes disponibles:

- `.asg-btn--primary`: acción principal.
- `.asg-btn--secondary`: acción secundaria.
- `.asg-btn--danger`: acción destructiva.

Ejemplo:

```html
<button type="button" class="asg-btn asg-btn--primary">
  Continuar
</button>
```

Reglas de uso:

- Utilizar botones primarios para acciones principales.
- Evitar introducir nuevos colores arbitrarios.
- Mantener estados hover, focus y disabled.
- Utilizar etiquetas descriptivas.
- No sustituir automáticamente botones heredados
  sin revisar su comportamiento.

## 4. Campos de formulario

Clases compartidas:

- `.asg-field`
- `.asg-field__label`
- `.asg-field__control`
- `.asg-field__error`
- `.floating-input`

Los formularios de Login y Registro utilizan los
estilos centralizados de `.floating-input`.

Comportamiento esperado:

- Campo vacío: etiqueta dentro del campo.
- Campo enfocado: etiqueta visible encima del campo.
- Campo con contenido: etiqueta permanece encima.
- Etiquetas con peso tipográfico regular.
- Mensajes de validación debajo del campo.
- Indicador visible de foco mediante un único borde
  azul institucional.

No agregar reglas locales que eliminen el indicador
de foco con `outline: none` sin ofrecer una alternativa
visible.

## 5. Tarjetas y encabezados

Clases disponibles:

- `.asg-card`
- `.asg-section-header`

Los componentes deben mantener:

- Superficies y colores definidos por los tokens.
- Espaciados consistentes.
- Jerarquía tipográfica clara.
- Bordes y radios uniformes.
- Comportamiento responsive.

Los componentes especializados, como `AmbitCardComponent`,
mantienen sus propiedades y lógica específicas.

## 6. Estados visuales

Componente Angular: `UiStateComponent`

Selector: `app-ui-state`

Entradas:

- `type`: loading, error, empty o success.
- `title`: título del estado.
- `message`: descripción opcional.

Ejemplo:

```html
<app-ui-state
  type="loading"
  title="Cargando resultados"
  message="Estamos consultando la información.">
</app-ui-state>
```

Estados:

| Estado | Uso |
|---|---|
| `loading` | Consulta o procesamiento en curso |
| `error` | Error al completar una operación |
| `empty` | Ausencia legítima de datos |
| `success` | Operación completada correctamente |

El componente utiliza atributos de accesibilidad
para comunicar los estados.

## 7. Integraciones realizadas

### Login

- Aplicación del botón principal reutilizable.
- Uso de estilos compartidos para campos.

### Registro

- Reutilización de estilos de formulario.
- Consolidación de reglas CSS.
- Corrección del indicador de foco.
- Conservación del flujo de registro.

### Dashboard de usuario

- Integración de `UiStateComponent`.
- Diferenciación de carga, error, vacío y éxito.
- Conservación de tarjetas, puntuaciones y gráfica.
- Limpieza de resultados al cambiar de empresa.

La ausencia de evaluaciones se reconoce mediante:

HTTP 404 con `detail: "No evaluations found"`.

Otros errores HTTP no deben clasificarse
automáticamente como ausencia de resultados.

## 8. Accesibilidad

Los patrones deben cumplir:

- Navegación mediante teclado.
- Indicadores de foco visibles.
- Etiquetas asociadas a controles.
- Mensajes de error comprensibles.
- Contraste suficiente.
- Estados de interfaz accesibles.
- Respeto a la preferencia de movimiento reducido,
  cuando corresponda.

## 9. Validación

Comprobaciones realizadas:

- Compilación Angular de producción.
- Pruebas unitarias de `UiStateComponent`.
- Pruebas unitarias del Dashboard.
- Ejecución conjunta: 15 pruebas exitosas.
- Revisión visual de Login.
- Revisión visual de Registro.
- Revisión visual del Dashboard con resultados.
- Revisión visual del Dashboard sin resultados.
- Comprobación del indicador de foco con teclado.

Validaciones pendientes para el cierre:

- Ejecutar nuevamente las pruebas tras los últimos
  ajustes de estilos.
- Revisar el diff final de la historia.
- Confirmar que no existan regresiones visuales.
- Completar la revisión de accesibilidad y responsive.

## 10. Reglas para historias futuras

1. Consultar primero los tokens de HU-046.
2. Reutilizar los patrones existentes de HU-047.
3. Evitar duplicar estilos en componentes locales.
4. Mantener separados los estilos visuales y la
   lógica de negocio.
5. No introducir dependencias visuales innecesarias.
6. Validar teclado, estados y responsive.
7. Documentar cualquier variante nueva.
8. Ejecutar compilación y pruebas antes del PR.
```

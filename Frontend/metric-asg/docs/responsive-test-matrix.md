# Matriz de pruebas responsive — MetricASG

## Historia
HU-048 — Infraestructura de pruebas visuales, responsive y accesibilidad.

## Objetivo
Detectar regresiones visuales y de accesibilidad mediante verificaciones reproducibles, sin modificar la lógica de negocio ni corregir defectos existentes durante esta historia.

## Resoluciones de referencia

| Ancho | Alto | Categoría |
|---|---|---|
| 320 px | 900 px | Móvil pequeño |
| 375 px | 900 px | Móvil |
| 390 px | 900 px | Móvil de referencia |
| 768 px | 900 px | Tableta |
| 1024 px | 900 px | Intermedio |
| 1440 px | 900 px | Escritorio |

La altura de 900 px es una configuración inicial de pruebas, no un requisito funcional.

## Cobertura inicial

### Rutas públicas
- /home
- /login
- /sing-up

### Rutas protegidas de usuario
- /user/home
- /user/results
- /user/evaluation

### Rutas protegidas de administración
- /admin/dashboard

Las rutas protegidas requieren autenticación válida y disponibilidad de los datos necesarios.

## Verificaciones responsive

Para cada resolución y ruta incluida:

1. Comprobar que se renderiza la ruta esperada.
2. Medir document.documentElement.scrollWidth.
3. Comparar scrollWidth con document.documentElement.clientWidth.
4. Registrar cualquier desbordamiento horizontal.
5. Generar una captura de referencia.
6. Comprobar que los controles principales son utilizables.
7. Registrar errores de carga que invaliden la medición.

No se utilizará overflow-x: hidden para ocultar defectos.

## Línea base histórica

Mediciones documentadas previamente a 390 px:

| Pantalla | Anchura del documento | Exceso |
|---|---|---|
| Inicio público | 402 px | +12 px |
| Dashboard usuario | 528 px | +138 px |
| Resultados ASG | 1128 px | +738 px |

Estas cifras son referencias históricas pendientes de reproducción automatizada.

Los defectos existentes deben registrarse como conocidos y no presentarse como regresiones nuevas.

## Accesibilidad

Las verificaciones contemplarán:

- Navegación mediante teclado.
- Foco visible en controles interactivos.
- Etiquetas accesibles en formularios.
- Estados de validación y mensajes de error.
- Accesibilidad básica de botones y enlaces.

Objetivo de referencia: WCAG 2.2 AA, sujeto a la cobertura implementada y verificada.

## Herramientas

- Jasmine + Karma: pruebas unitarias existentes.
- Playwright: herramienta propuesta para pruebas responsive y de navegador.
- GitHub Actions: integración CI pendiente de implementación.

## Restricciones

- No modificar guardias ni mecanismos de autenticación.
- No guardar tokens ni credenciales en el repositorio.
- No modificar resultados ASG ni cálculos.
- No corregir desbordamientos existentes durante HU-048.
- No declarar una prueba exitosa si la ruta no cargó correctamente.

## Estado

HU-048 / T01: matriz definida, pendiente de validación.
HU-048 / T02: pendiente.
HU-048 / T03: pendiente.
HU-048 / T04: pendiente.

## Línea base automatizada — 19/11/2026

Herramienta: Playwright 1.65.1, Chromium.
Comando: npx playwright test e2e/responsive.spec.ts --workers=2 --reporter=list

Resultado: 18 pruebas aprobadas de 18 ejecutadas.

| Ruta | 320 | 375 | 390 | 768 | 1024 | 1440 |
|---|---|---|---|---|---|---|
| /home | +12 px | +12 px | +12 px | 0 | 0 | 0 |
| /login | 0 | 0 | 0 | 0 | 0 | 0 |
| /sing-up | 0 | 0 | 0 | 0 | 0 | 0 |

### Hallazgos

- BL-048-01: la página /home presenta 12 px de desbordamiento horizontal en 320, 375 y 390 px.
- Las rutas /login y /sing-up no presentan desbordamiento horizontal en los anchos comprobados.
- Las 18 pruebas finalizaron correctamente.
- Las capturas se generan en test-results y no forman parte del repositorio.
- Las pruebas son diagnósticas: actualmente no fallan cuando detectan desbordamiento.
- Esta ejecución no acredita cobertura de rutas autenticadas ni accesibilidad.
- La corrección de BL-048-01 corresponde a HU-049.

### Limitaciones de la línea base

Las mediciones se realizaron después de DOMContentLoaded y document.fonts.ready.
No existe todavía una comprobación específica del estado final de los componentes
que obtienen datos de forma asíncrona.

Los valores registrados son evidencia de la ejecución indicada, no una garantía
de ausencia de otros defectos visuales.

## Línea base de accesibilidad — 19/11/2026

Herramienta: Playwright 1.65.1, Chromium.

### Resultados

- Login: 3 pruebas aprobadas.
- Registro: 3 pruebas iniciales aprobadas.
- Navegación por teclado del Stepper: 1 prueba aprobada.
- Total: 7 comprobaciones aprobadas en ejecuciones individuales.

### Comportamientos verificados

- Los campos principales de Login tienen etiquetas accesibles.
- Es posible navegar del correo a la contraseña mediante Tab.
- El botón Mostrar contraseña modifica el tipo del campo y su nombre accesible.
- Nombre, Apellido y Puesto del Registro tienen etiquetas asociadas.
- El botón Siguiente no aparece cuando los campos iniciales están vacíos.
- El primer encabezado del Stepper admite foco.
- El primer encabezado puede alcanzarse mediante Tab.
- ArrowRight desplaza el foco al segundo encabezado.
- El segundo encabezado conserva aria-disabled="true" con datos incompletos.

### Observaciones pendientes

- A11Y-048-01: verificar visualmente el contraste y la apariencia del foco.
- A11Y-048-02: comprobar la independencia de los controles de visibilidad de contraseña del Registro.
- A11Y-048-03: ampliar la verificación de validaciones y mensajes de error.
- La cobertura actual no constituye una auditoría WCAG 2.2 AA completa.
- Las pruebas de accesibilidad aún no cubren las rutas autenticadas.

### Alcance

HU-048 establece infraestructura y evidencia reproducible.
Los ajustes de autenticación y Registro corresponden a HU-053 y HU-054,
respectivamente, cuando se confirme un defecto que requiera corrección.

## Ejecución local y CI

### Requisitos

- Node.js 24.18.0.
- Dependencias instaladas mediante npm ci.
- Playwright 1.65.1.
- Chromium instalado mediante npx playwright install chromium.

### Comandos

Desde Frontend/metric-asg:

npm ci

npx playwright install chromium

npm run test:e2e

npm run test:e2e:responsive

npm run test:e2e:a11y

npm test -- --watch=false --browsers=ChromeHeadless

npm run build

### Ejecución automatizada

El workflow .github/workflows/frontend.yml conserva las pruebas
unitarias con Karma y el build de producción.

Se agregaron dos pasos:

1. Instalación de Chromium con sus dependencias de sistema.
2. Ejecución de la suite Playwright mediante npm run test:e2e.

La ejecución real en GitHub Actions está pendiente de validación.

### Artefactos locales

- test-results/: capturas, trazas y resultados temporales.
- playwright-report/: informe HTML.

Ambos directorios están excluidos mediante .gitignore.

Para consultar el informe HTML:

npx playwright show-report

### Limitaciones

- Las pruebas responsive cubren inicialmente rutas públicas.
- Las rutas protegidas requieren sesiones autenticadas válidas.
- Los desbordamientos existentes se registran sin hacer fallar las pruebas.
- Las verificaciones de accesibilidad son parciales.
- No se acredita conformidad integral con WCAG 2.2 AA.
- La ejecución en CI requiere confirmar estabilidad en Ubuntu.
- Debe ampliarse la detección de errores de carga y contenido asíncrono.

### Resultados locales — 19/11/2026

- Jasmine/Karma: 427 pruebas aprobadas.
- Playwright: 25 pruebas aprobadas.
- Build de producción: correcto, con advertencias.
- Defecto responsive BL-048-01: 12 px de desbordamiento en Inicio móvil.

# HU-037 — Política de recordatorios de reevaluación

## 1. Objetivo

Definir las reglas para generar recordatorios de reevaluación ASG utilizando el campo `next_evaluation`, mediante notificaciones internas y correo electrónico.

## 2. Elegibilidad

Un usuario será elegible cuando cumpla las siguientes condiciones:

- Su cuenta está activa.
- Tiene al menos una evaluación con estado `COMPLETED`.
- Tiene una fecha `next_evaluation` válida.
- La fecha corresponde a un ciclo de reevaluación vigente.

No se generarán recordatorios para usuarios sin evaluaciones finalizadas, incluso si `next_evaluation` fue inicializado durante el registro.

## 3. Calendario de recordatorios

Se establecen tres anticipaciones:

| Tipo | Momento |
|---|---|
| FIRST | 30 días antes de la próxima evaluación |
| SECOND | 7 días antes de la próxima evaluación |
| DUE | El día de la próxima evaluación |

Las anticipaciones se calcularán por días naturales respecto a la fecha objetivo.

## 4. Canales

Los recordatorios se distribuirán mediante:

- **IN_APP:** notificación interna disponible dentro de MetricASG.
- **EMAIL:** mensaje enviado al correo electrónico registrado del usuario.

Cada canal mantendrá su propio estado de entrega.

Las preferencias de recepción del usuario se definirán en HU-037-T02.

## 5. Prevención de duplicados

Cada entrega se identificará mediante la combinación:

- Usuario destinatario.
- Fecha objetivo de reevaluación.
- Tipo de recordatorio.
- Canal de entrega.

No se generarán duplicados de una misma combinación.

Las reejecuciones del proceso programado deberán respetar esta restricción.

## 6. Ciclo de reevaluación

Cuando una evaluación se finaliza correctamente, el sistema establece la siguiente fecha objetivo seis meses después.

Los recordatorios se calcularán utilizando la fecha vigente almacenada en `next_evaluation`.

Cuando se complete una nueva evaluación, los recordatorios pendientes del ciclo anterior quedarán sin efecto y se utilizará la nueva fecha objetivo.

Los recordatorios no modificarán los resultados históricos ni el campo `biannual_evaluation`.

## 7. Fechas y zonas horarias

La zona horaria inicial será `America/Merida`, configurable desde el backend.

Las comparaciones se realizarán utilizando fechas de calendario en la zona horaria configurada.

El proceso deberá evitar diferencias provocadas por conversiones entre fechas y valores `datetime`.

Los recordatorios correspondientes a fechas anteriores a la fecha local de ejecución no se generarán retroactivamente.

## 8. Responsabilidades

- **HU-037-T02:** modelar preferencias, entregas y restricciones de unicidad.
- **HU-037-T03:** implementar el proceso programado que identifica recordatorios elegibles.
- **HU-037-T04:** implementar los canales de notificación interna y correo electrónico.
- **HU-037-T05:** validar fechas, zonas horarias, duplicados y comportamiento de los recordatorios.

## 9. Consideraciones técnicas

Actualmente `biannual_evaluation` se establece en `True` al finalizar una evaluación y no se identificó un mecanismo para restablecerlo automáticamente.

La generación de recordatorios será independiente de ese campo.

La habilitación de una nueva evaluación requiere revisión funcional separada, ya que actualmente el frontend utiliza `biannual_evaluation` para restringir el acceso al cuestionario.

La selección del proveedor de correo electrónico y su configuración se realizará durante la implementación del canal de entrega.

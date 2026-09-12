# Modelo de roles y permisos de MetricASG

Este documento define la política base de autorización de MetricASG.

La autorización debe ser validada siempre en el backend. Las restricciones
implementadas en Angular sirven únicamente para controlar la experiencia de
usuario y no constituyen un mecanismo de seguridad.

## Roles

MetricASG define inicialmente dos roles de autorización:

### USER

Usuario autenticado estándar.

Puede utilizar las funciones propias del autodiagnóstico ASG y administrar
únicamente los datos que pertenezcan a su cuenta cuando corresponda.

### ADMIN

Usuario administrativo.

Puede realizar las operaciones de un usuario estándar y, adicionalmente,
gestionar usuarios y los catálogos administrativos o metodológicos del sistema.

El concepto de empresa no constituye un rol de autorización. La información
empresarial se representa mediante los atributos asociados al usuario.

## Principios de autorización

1. El backend es la fuente de verdad para identidad y permisos.
2. La identidad del usuario debe obtenerse del JWT cuando una operación actúe
   sobre la propia cuenta.
3. Un USER no puede modificar la metodología ASG.
4. Un ADMIN puede gestionar los catálogos administrativos y metodológicos.
5. Los recursos asociados a evaluaciones deben respetar la propiedad del
   usuario y no confiar en un `user_id` proporcionado por el cliente.
6. Ocultar una opción en Angular no sustituye una comprobación de permisos
   en FastAPI.
7. Las operaciones públicas deben limitarse a las necesarias para
   autenticación y registro.

## Matriz de permisos

Leyenda:

- `Sí`: operación permitida.
- `Propio`: permitida únicamente sobre recursos pertenecientes al usuario autenticado.
- `No`: operación no permitida.
- `Público`: no requiere un access token.

| Recurso / operación | Público | USER | ADMIN |
| --- | :---: | :---: | :---: |
| Login | Sí | Sí | Sí |
| Registro de usuario | Sí | — | — |
| Renovación de sesión | Sí* | Sí* | Sí* |
| Cambio de contraseña propia | No | Propio | Propio |
| Crear administrador | No | No | Sí |
| Dashboard administrativo | No | No | Sí |
| Listar usuarios | No | No | Sí |
| Activar/desactivar usuarios | No | No | Sí |
| Consultar perfil propio | No | Propio | Sí |
| Actualizar perfil propio | No | Propio | Sí |
| Eliminar usuarios | No | No | Sí |
| Sectores empresariales — consultar | Sí | Sí | Sí |
| Sectores empresariales — crear/editar/eliminar | No | No | Sí |
| Tamaños empresariales — consultar | Sí | Sí | Sí |
| Tamaños empresariales — crear/editar/eliminar | No | No | Sí |
| Ámbitos ASG — consultar | No | Sí | Sí |
| Ámbitos ASG — crear/editar/eliminar | No | No | Sí |
| Indicadores — consultar | No | Sí | Sí |
| Indicadores — crear/editar/eliminar | No | No | Sí |
| Respuestas de indicadores — consultar | No | Sí | Sí |
| Respuestas de indicadores — crear/editar/eliminar | No | No | Sí |
| Niveles de madurez — consultar | No | Sí | Sí |
| Niveles de madurez — crear/editar/eliminar | No | No | Sí |
| Rangos de puntuación — consultar | No | Sí | Sí |
| Rangos de puntuación — crear/editar/eliminar | No | No | Sí |
| Feedback metodológico — consultar | No | Sí | Sí |
| Feedback metodológico — crear/editar/eliminar | No | No | Sí |
| Estructura de evaluación | No | Sí | Sí |
| Enviar evaluación | No | Propio | Sí |
| Consultar resultados | No | Propio | Sí |
| Consultar historial | No | Propio | Sí |
| Respuestas de evaluación | No | Propio | Sí |
| Scores de evaluación | No | Propio | Sí |
| Relaciones empresariales | No | Propio | Sí |

\* La renovación utiliza el refresh token y no requiere necesariamente que el
access token continúe vigente, pero debe validar una sesión de renovación válida.

## Recursos metodológicos

Se consideran recursos metodológicos administrados por el sistema:

- Ámbitos ASG.
- Indicadores.
- Respuestas de indicadores.
- Niveles de madurez.
- Rangos de puntuación.
- Feedback asociado a ámbitos.

Los usuarios estándar pueden consultar estos datos cuando sean necesarios para
realizar una evaluación, pero no pueden crearlos, modificarlos ni eliminarlos.

## Recursos empresariales de referencia

Los sectores y tamaños empresariales deben poder consultarse durante el
registro, por lo que su lectura puede ser pública.

Su creación, modificación y eliminación corresponde únicamente a ADMIN.

## Propiedad de recursos

Cuando la matriz indique `Propio`, el backend debe derivar la identidad desde
el usuario autenticado.

No debe confiar en un identificador de usuario recibido en la URL o el cuerpo
para decidir qué cuenta consultar o modificar.

Esta política se implementará progresivamente en las historias de autorización
correspondientes.

## Dependencias de autorización previstas

La autenticación y autorización deben mantenerse separadas.

### `get_current_user`

Responsable de autenticar la petición.

Debe:

- Obtener el access token.
- Validar firma y expiración del JWT.
- Obtener el usuario asociado al token.
- Rechazar tokens ausentes, inválidos o expirados con HTTP `401`.
- Devolver el usuario autenticado cuando la autenticación sea válida.

Las dependencias de autorización no deben volver a decodificar el JWT si
`get_current_user` ya proporcionó el usuario autenticado.

### `require_role(...)`

Dependencia reutilizable para comprobar si el usuario autenticado posee uno
de los roles permitidos.

Diseño previsto:

```python
require_role(*allowed_roles: UserRole)
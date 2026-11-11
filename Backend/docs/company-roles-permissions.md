
# HU-039 — Matriz de permisos organizacionales

## 1. Objetivo

Definir las operaciones permitidas para cada rol empresarial de MetricASG, manteniendo separados los permisos globales, la pertenencia organizacional y el acceso a recursos específicos.

Esta matriz constituye la especificación de autorización para HU-039-T03. Su definición no implica que los permisos ya estén implementados.

## 2. Roles empresariales

Los roles están definidos mediante `CompanyRole` y asociados a `CompanyMembership.role`.

| Rol | Responsabilidad |
|---|---|
| `COMPANY_ADMIN` | Administrar miembros, evaluaciones y recursos de su organización. |
| `ASG_MANAGER` | Coordinar evaluaciones y gestionar planes de mejora. |
| `COLLABORATOR` | Participar en evaluaciones y consultar información autorizada. |
| `AUDITOR` | Consultar resultados y evidencias autorizados, sin modificarlos. |

Los roles empresariales son independientes de `UserRole.ADMIN` y `UserRole.USER`.

Una persona puede tener roles diferentes en distintas empresas.

## 3. Matriz de permisos

**Sí:** operación permitida, sujeta a las reglas de acceso al recurso.

**No:** operación denegada.

| Operación | COMPANY_ADMIN | ASG_MANAGER | COLLABORATOR | AUDITOR |
|---|:---:|:---:|:---:|:---:|
| Listar miembros | Sí | Sí | Sí | No |
| Crear invitaciones | Sí | No | No | No |
| Reenviar invitaciones | Sí | No | No | No |
| Retirar otros miembros | Sí | No | No | No |
| Consultar metodología | Sí | Sí | Sí | Sí |
| Guardar borradores propios | Sí | Sí | Sí | No |
| Consultar borradores propios | Sí | Sí | Sí | No |
| Finalizar evaluaciones propias | Sí | Sí | No | No |
| Consultar resultados propios | Sí | Sí | Sí | Sí |
| Consultar historial propio | Sí | Sí | Sí | Sí |
| Consultar dashboard propio | Sí | Sí | Sí | Sí |
| Comparar evaluaciones propias | Sí | Sí | Sí | Sí |
| Crear acciones de mejora | Sí | Sí | No | No |
| Consultar acciones de mejora | Sí | Sí | Sí | Sí |
| Consultar progreso del plan | Sí | Sí | Sí | Sí |
| Actualizar acciones de mejora | Sí | Sí | No | No |
| Eliminar acciones de mejora | Sí | No | No | No |

Los permisos de consulta y modificación sobre evaluaciones y acciones de mejora no eliminan las restricciones de propiedad y acceso existentes.

## 4. Reglas generales de autorización

Para acceder a recursos organizacionales protegidos, el backend debe verificar:

1. Que el usuario esté autenticado y activo.
2. Que la organización exista y esté activa.
3. Que el usuario tenga una membresía `ACTIVE` en esa organización.
4. Que su rol empresarial permita la operación solicitada.
5. Que tenga acceso al recurso específico según las reglas aplicables.

Una membresía `INACTIVE` no concede permisos, independientemente del rol almacenado.

Un rol empresarial no concede acceso a organizaciones distintas de aquella a la que pertenece la membresía.

El rol `COMPANY_ADMIN` no equivale al rol global `UserRole.ADMIN` y no concede permisos para modificar la metodología general del sistema.

## 5. Alcance de evaluaciones

Las evaluaciones conservan las referencias `Evaluation.user_id` y `Evaluation.company_id`.

Durante HU-039:

- Los borradores permanecen vinculados a su autor.
- Guardar y finalizar evaluaciones requiere una membresía activa, un rol autorizado y acceso al borrador correspondiente.
- Las rutas `/me` conservan el alcance del usuario autenticado.
- Los resultados, históricos, dashboards y comparaciones mantienen las restricciones de usuario y organización existentes.
- Un rol empresarial no permite automáticamente consultar evaluaciones de otros miembros.
- No se habilita acceso compartido general a evaluaciones de la organización.

El acceso compartido a recursos de otros miembros requerirá una política explícita adicional.

## 6. Alcance de planes de mejora

Las acciones de mejora pertenecen a una evaluación mediante `ImprovementAction.evaluation_id`.

El campo `responsible` es actualmente texto y no una referencia a un usuario o membresía.

Por tanto:

- No se conceden permisos basados en coincidencias de nombres.
- Los colaboradores no pueden actualizar acciones únicamente por aparecer como responsables.
- Las operaciones requieren permiso empresarial y acceso a la evaluación asociada.
- Se conservan las validaciones de estado de evaluación, metodología e indicadores.
- La asignación individual de acciones mediante identificadores de usuario queda fuera del alcance actual.

## 7. Operaciones especiales

### Aceptar invitaciones

`POST /api/company-invitations/accept` no requiere membresía previa en la empresa de destino.

Debe validar la identidad del destinatario, el token, la vigencia y las condiciones de la invitación.

Una nueva membresía recibe inicialmente `COLLABORATOR`. La reactivación conserva el rol existente.

### Abandonar una organización

Un miembro activo puede solicitar la desactivación de su propia membresía.

La operación debe impedir que una empresa activa quede sin administradores empresariales activos.

### Retirar a otros miembros

Solo `COMPANY_ADMIN` puede retirar a otro miembro de su organización.

No se puede retirar al último administrador empresarial activo. La operación debe mantener las garantías de integridad y concurrencia.

### Administración de roles

La asignación o modificación de roles empresariales debe estar reservada a una operación autorizada de administración organizacional.

La existencia de `CompanyMembership.role` no implica que exista actualmente un endpoint para modificarlo.

La incorporación de operaciones adicionales deberá justificarse y delimitarse durante HU-039-T03.

## 8. Respuestas de autorización

Se establecen las siguientes reglas generales:

- `401 Unauthorized`: no existe autenticación válida.
- `403 Forbidden`: el usuario autenticado carece de membresía activa o del permiso necesario.
- `404 Not Found`: el recurso no existe o debe ocultarse para evitar divulgación de información.
- `400 Bad Request`: falta seleccionar una empresa cuando existen varias membresías activas y la operación requiere una empresa concreta.

Se conservarán las respuestas existentes cuando tengan una justificación de seguridad o compatibilidad.

## 9. Validaciones requeridas en HU-039-T03

La implementación deberá comprobar:

- Cada rol puede ejecutar únicamente las operaciones autorizadas.
- Una membresía inactiva no concede acceso.
- Un usuario no puede operar sobre empresas ajenas.
- Un usuario con varias membresías utiliza el rol correspondiente a la empresa seleccionada.
- Las rutas `/me` conservan su alcance individual.
- Un auditor no puede modificar evaluaciones ni planes de mejora.
- Un colaborador no puede finalizar evaluaciones.
- Solo un administrador empresarial puede gestionar invitaciones y retirar otros miembros.
- Una empresa no puede quedar sin administradores activos.
- Los permisos globales de administración continúan separados de los empresariales.

## 10. Alcance de la implementación

HU-039-T02 define la política de permisos y sus criterios de validación.

HU-039-T03 implementará la autorización en el backend y actualizará las pruebas correspondientes.

HU-039-T04 adaptará la interfaz para reflejar los permisos efectivos.

La interfaz no sustituirá las comprobaciones de seguridad del backend.

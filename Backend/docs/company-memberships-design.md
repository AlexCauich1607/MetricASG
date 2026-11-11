# HU-038 — Diseño de membresías empresariales

## 1. Objetivo

Permitir que una empresa tenga múltiples usuarios asociados mediante una
entidad organizacional independiente y una relación explícita de membresía.

La implementación debe preservar las cuentas, evaluaciones y funcionalidades
existentes, además de impedir el acceso cruzado entre organizaciones.

## 2. Arquitectura actual

Actualmente, el modelo User almacena tanto información personal como
información empresarial:

- company_name
- company_sector_id
- company_size_id

El registro de usuarios y empresas crea registros en la tabla users.

CompanyRelationship relaciona dos registros de users mediante
parent_company_id y related_company_id. No representa una membresía
entre un usuario y una entidad empresarial independiente.

Las evaluaciones se relacionan con users mediante Evaluation.user_id.
Las acciones de mejora se relacionan con evaluaciones mediante evaluation_id.

## 3. Entidades propuestas

### Company

Tabla: companies

Campos previstos:

- id: clave primaria.
- name: nombre de la empresa, obligatorio.
- sector_id: referencia opcional a company_sectors.
- size_id: referencia opcional a company_sizes.
- active: estado de la organización.
- created_at: fecha de creación.

Company será la fuente de verdad de la información empresarial.

El nombre no se utilizará como identificador único de una organización.

### CompanyMembership

Tabla: company_memberships

Campos previstos:

- id: clave primaria.
- user_id: clave foránea obligatoria a users.id.
- company_id: clave foránea obligatoria a companies.id.
- status: estado de la membresía.
- joined_at: fecha de incorporación.

Estados propuestos:

- ACTIVE
- INACTIVE

Restricciones:

- UNIQUE(user_id, company_id).
- Las claves foráneas deben garantizar la existencia del usuario y la empresa.
- La membresía no debe eliminar al usuario ni a la empresa.
- Una membresía inactiva no concede acceso organizacional.

La eliminación o desactivación de miembros deberá preservar la trazabilidad.

### User

User continuará representando la identidad individual.

Se conservarán inicialmente sus campos empresariales para facilitar
la transición y mantener la compatibilidad con consumidores existentes.

Estos campos dejarán de ser la fuente de verdad empresarial una vez
completada la migración correspondiente.

## 4. Relaciones

- User 1:N CompanyMembership.
- Company 1:N CompanyMembership.
- User N:M Company mediante CompanyMembership.

El diseño admite múltiples usuarios por empresa y múltiples membresías
por usuario.

La autorización siempre deberá comprobar una membresía activa para la
empresa solicitada.

## 5. Evaluaciones y datos organizacionales

Evaluation.user_id debe conservarse para preservar la identidad del
usuario asociado a la evaluación.

Se deberá establecer una referencia empresarial explícita para los
datos organizacionales, evitando determinar su propietario únicamente
a partir de la membresía actual del usuario.

La migración deberá preservar las evaluaciones históricas y su
asociación empresarial original.

Las acciones de mejora heredarán el contexto organizacional de sus
evaluaciones, sin modificar su relación actual durante el diseño.

## 6. Autenticación y autorización

Los JWT actuales identifican al usuario y su rol global.

No es necesario introducir inmediatamente company_id en el JWT.

Las operaciones empresariales deberán validar en el backend:

- La identidad del usuario autenticado.
- La existencia de la empresa.
- La membresía activa del usuario.
- Los permisos necesarios para la operación.

La existencia de una membresía no implica autorización automática
para administrar la empresa.

Los roles empresariales detallados corresponden a HU-039.

## 7. Compatibilidad

Durante la transición deberán considerarse:

- POST /api/auth/register.
- POST /api/auth/register-company.
- GET /api/users/profile/me.
- PUT /api/users/profile/me.
- Los contratos de usuario utilizados por Angular.
- La configuración empresarial.
- Los filtros administrativos de usuarios.
- Los reportes ASG.
- Las relaciones empresariales existentes.

CompanyRelationship se conservará inicialmente para evitar modificar
una funcionalidad distinta de las membresías.

Los cambios de datos empresariales deberán realizarse mediante
operaciones organizacionales autorizadas, separadas de la edición
del perfil personal.

## 8. Estrategia prevista para HU-038-T02

La migración deberá:

1. Crear las nuevas tablas mediante Alembic.
2. Identificar la información empresarial almacenada en users.
3. Crear organizaciones para los registros existentes.
4. Crear membresías iniciales asociadas a esas organizaciones.
5. Preservar usuarios, credenciales, evaluaciones e históricos.
6. Introducir las referencias organizacionales necesarias.
7. Validar integridad referencial y ausencia de pérdida de datos.

No se deben fusionar automáticamente empresas por coincidencia de nombre,
porque el nombre actual no identifica inequívocamente una organización.

La estrategia exacta de migración deberá comprobarse contra el esquema
y los datos reales antes de ejecutarse.

## 9. Alcance de las tareas posteriores

HU-038-T02: implementar la migración preservando datos existentes.

HU-038-T03: implementar invitaciones seguras para incorporar miembros.

HU-038-T04: permitir listar y retirar miembros de una organización.

HU-038-T05: verificar el aislamiento de datos entre empresas.

HU-039: definir y aplicar roles empresariales específicos.

## 10. Criterios de validación del diseño

- Usuarios y empresas están representados por entidades independientes.
- La membresía tiene relaciones y restricciones explícitas.
- Se contempla la compatibilidad con registros existentes.
- Se preserva la autoría de evaluaciones históricas.
- El diseño exige validación de membresía y autorización en backend.
- Las responsabilidades de las tareas posteriores están delimitadas.

Este documento define el diseño objetivo y no acredita que las nuevas
entidades, migraciones o controles ya estén implementados.

## 11. Roles empresariales — HU-039

Los roles empresariales se representan mediante CompanyRole
y se almacenan en CompanyMembership.role.

Roles disponibles:

- COMPANY_ADMIN: administrador empresarial.
- ASG_MANAGER: responsable ASG.
- COLLABORATOR: colaborador.
- AUDITOR: auditor o consultor.

Los roles empresariales son independientes de UserRole,
que continúa representando los permisos globales del sistema.

Una misma persona puede tener roles diferentes en distintas empresas.

### Asignación inicial

- El registro de una nueva empresa asigna COMPANY_ADMIN
  a la membresía del usuario fundador.
- La aceptación de una invitación crea una membresía con
  COLLABORATOR.
- La reactivación de una membresía conserva su rol anterior.
- Una membresía INACTIVE no debe conceder acceso organizacional.

### Migración de membresías existentes

La migración df7e2c07f1c0 incorpora el campo role y asigna
COLLABORATOR a las membresías existentes como valor inicial
conservador.

La migración no identifica automáticamente a los fundadores
ni concede privilegios administrativos a todas las membresías.

Antes de habilitar autorización empresarial basada en roles,
cada organización existente deberá contar con una asignación
administrativa verificada.

La inicialización debe realizarse mediante un procedimiento
controlado que identifique explícitamente la empresa, el
usuario y la membresía correspondiente.

No deben utilizarse identificadores fijos ni inferir la
administración únicamente a partir de fechas de creación,
orden de inserción o cantidad de miembros.

La asignación inicial realizada en la base de desarrollo
es específica de ese entorno y no forma parte de la
migración general.

### Autorización

La definición de permisos por rol corresponde a HU-039-T02.

La aplicación de esos permisos en el backend corresponde
a HU-039-T03.

La interfaz deberá adaptarse posteriormente en HU-039-T04.

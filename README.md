# MetricASG

MetricASG es una herramienta de autodiagnóstico ASG (Ambiental, Social y de Gobernanza) compuesta por un frontend desarrollado con Angular y una API REST desarrollada con FastAPI.

## Desarrollo

### Backend

El backend de MetricASG está desarrollado con Python y FastAPI.

#### Requisitos

Para trabajar con el backend se requiere:

* Python 3.11
* `pip`
* PostgreSQL o Docker, dependiendo de la modalidad de ejecución

#### Acceder al backend

Desde la carpeta raíz del proyecto:

```powershell
cd Backend
```

#### Crear el entorno virtual

Crear un entorno virtual de Python:

```powershell
py -3.11 -m venv .venv
```

Activarlo en PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Cuando el entorno esté activo, la terminal mostrará algo similar a:

```text
(.venv) PS C:\...\MetricASG\Backend>
```

#### Instalar dependencias

Con el entorno virtual activado:

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Las dependencias del backend se encuentran definidas en:

```text
Backend/requirements.txt
```

Entre las dependencias utilizadas para la configuración del backend se encuentra `pydantic-settings`.

#### Variables de entorno

MetricASG utiliza variables de entorno para mantener la configuración, credenciales y secretos fuera del código fuente.

El archivo `.env.example`, ubicado en la raíz del repositorio, define las variables necesarias sin incluir valores sensibles.

Para configurar el entorno utilizado por Docker Compose debe crearse un archivo `.env` a partir del ejemplo.

Desde la raíz del repositorio:

```powershell
Copy-Item .env.example .env
```

Las variables utilizadas actualmente por el backend son:

```dotenv
APP_ENV=development

DATABASE_URL=

JWT_SECRET_KEY=
JWT_ALGORITHM=HS256

ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

CORS_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
```

Docker Compose utiliza además las variables necesarias para configurar PostgreSQL:

```dotenv
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=metricasg_db
POSTGRES_HOST=db
POSTGRES_PORT=5432
```

El archivo `.env` contiene valores locales y sensibles, por lo que se encuentra excluido mediante `.gitignore` y no debe agregarse al repositorio.

Docker Compose carga este archivo para proporcionar las variables necesarias tanto al servicio de PostgreSQL como a la API de FastAPI.

> Los valores reales de `POSTGRES_PASSWORD`, `DATABASE_URL` y `JWT_SECRET_KEY` deben mantenerse privados y nunca deben almacenarse directamente en el código fuente, `docker-compose.yml` o archivos versionados.

> Las credenciales y claves que estuvieron publicadas anteriormente en el repositorio fueron rotadas y no deben volver a utilizarse.

#### Configuración centralizada del backend

La configuración utilizada por FastAPI se encuentra centralizada en:

```text
Backend/app/core/config.py
```

MetricASG utiliza `pydantic-settings` para cargar y validar las variables de entorno requeridas por el backend.

La aplicación utiliza una instancia centralizada de `Settings`, que es consumida por los módulos relacionados con:

* Conexión a la base de datos.
* Generación y validación de JWT.
* Tiempos de expiración de tokens.
* Configuración del entorno.
* Configuración de CORS.

Esto evita mantener llamadas dispersas a `os.getenv()` o valores de configuración duplicados en distintos módulos.

Actualmente se modelan las siguientes variables:

```dotenv
APP_ENV=development
DATABASE_URL=

JWT_SECRET_KEY=
JWT_ALGORITHM=HS256

ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

CORS_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
```

Las variables obligatorias son validadas durante el arranque de la aplicación.

Si una variable requerida está ausente, vacía o contiene un valor inválido, el backend detiene su inicialización y muestra un error de configuración.

Entre las validaciones actuales se encuentran:

* `APP_ENV` debe contener un valor.
* `DATABASE_URL` no puede estar vacía.
* `JWT_SECRET_KEY` no puede estar vacía.
* `JWT_ALGORITHM` debe contener un valor.
* `ACCESS_TOKEN_EXPIRE_MINUTES` debe ser un número entero mayor que `0`.
* `REFRESH_TOKEN_EXPIRE_DAYS` debe ser un número entero mayor que `0`.
* `CORS_ORIGINS` debe contener al menos un valor.

La configuración de CORS se obtiene actualmente desde `CORS_ORIGINS`. La política definitiva de orígenes permitidos para desarrollo y producción será revisada posteriormente.

#### Ejecución local de FastAPI

FastAPI puede ejecutarse directamente desde Python. En esta modalidad las variables requeridas deben existir en el entorno del proceso, ya que el backend no carga directamente el archivo `.env`.

Por ejemplo, en PowerShell:

```powershell
$env:APP_ENV="development"

$env:DATABASE_URL="<cadena-de-conexion-local>"

$env:JWT_SECRET_KEY="<clave-local>"
$env:JWT_ALGORITHM="HS256"

$env:ACCESS_TOKEN_EXPIRE_MINUTES="60"
$env:REFRESH_TOKEN_EXPIRE_DAYS="30"

$env:CORS_ORIGINS="http://localhost:4200,http://127.0.0.1:4200"
```

Después puede iniciarse FastAPI desde la carpeta `Backend` con:

```powershell
python -m uvicorn app.main:app --reload
```

Por defecto, Uvicorn utiliza:

```text
http://127.0.0.1:8000
```

La documentación interactiva de FastAPI estará disponible en:

```text
http://127.0.0.1:8000/docs
```

ReDoc estará disponible en:

```text
http://127.0.0.1:8000/redoc
```

> **Nota:** Si FastAPI se ejecuta directamente desde Windows mientras PostgreSQL se encuentra expuesto mediante Docker, `DATABASE_URL` debe utilizar un host accesible desde el sistema local, como `localhost`, en lugar del nombre de servicio Docker `db`.

> La modalidad validada actualmente desde un clon limpio es la ejecución mediante Docker Compose.

#### Detener FastAPI

Para detener el servidor:

```text
Ctrl + C
```

#### Desactivar el entorno virtual

```powershell
deactivate
```

---

### PostgreSQL y Docker

MetricASG utiliza PostgreSQL como sistema de gestión de base de datos.

Para facilitar el entorno de desarrollo, el backend incluye una configuración de Docker Compose que permite ejecutar PostgreSQL y FastAPI mediante contenedores.

#### Requisitos

Para utilizar esta modalidad es necesario tener:

* Docker Desktop instalado y en ejecución
* Docker Compose

Puede comprobarse la instalación con:

```powershell
docker --version
docker compose version
```

También puede comprobarse que Docker Engine se encuentre activo mediante:

```powershell
docker info
```

#### Servicios disponibles

El archivo:

```text
Backend/docker-compose.yml
```

define dos servicios principales:

```text
db
└── PostgreSQL

api
└── FastAPI
```

La configuración actual utiliza los siguientes puertos:

| Servicio   | Puerto local | Puerto contenedor |
| ---------- | -----------: | ----------------: |
| PostgreSQL |         5432 |              5432 |
| FastAPI    |         8000 |              8000 |

PostgreSQL utiliza un volumen denominado `postgres_data` para conservar los datos aunque los contenedores sean detenidos o recreados.

#### Variables de PostgreSQL

La configuración de PostgreSQL utiliza variables de entorno definidas como referencia en `.env.example`.

Los valores reales deben establecerse únicamente en el archivo local `.env`.

```dotenv
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=metricasg_db
POSTGRES_HOST=db
POSTGRES_PORT=5432
```

El valor:

```text
POSTGRES_HOST=db
```

se utiliza como referencia porque `db` es el nombre del servicio PostgreSQL dentro de Docker Compose.

La API utiliza adicionalmente:

```dotenv
DATABASE_URL=
```

Esta variable contiene la cadena de conexión utilizada por SQLAlchemy para comunicarse con PostgreSQL.

Dentro de Docker Compose, la cadena de conexión utiliza normalmente el servicio `db` como host.

Su estructura general es:

```text
postgresql://<usuario>:<contraseña>@db:5432/metricasg_db
```

Los valores reales deben permanecer únicamente en el archivo `.env`.

Docker Compose carga las variables desde `.env`, evitando que el usuario, la contraseña y la cadena de conexión queden escritos directamente en `docker-compose.yml` o en el código fuente.

#### Levantar el entorno con Docker

Desde la carpeta `Backend`:

```powershell
cd Backend
```

Construir las imágenes e iniciar los servicios:

```powershell
docker compose up --build
```

Esto inicia:

* PostgreSQL.
* La API de FastAPI.

Una vez iniciados correctamente los servicios, la API estará disponible en:

```text
http://localhost:8000
```

Swagger UI estará disponible en:

```text
http://localhost:8000/docs
```

#### Ejecutar los contenedores en segundo plano

Para ejecutar los servicios en segundo plano:

```powershell
docker compose up --build -d
```

#### Comprobar los servicios

Consultar el estado de los contenedores:

```powershell
docker compose ps
```

Consultar todos los logs:

```powershell
docker compose logs
```

Seguir los logs en tiempo real:

```powershell
docker compose logs -f
```

Consultar los logs de FastAPI:

```powershell
docker compose logs api
```

Consultar los logs de PostgreSQL:

```powershell
docker compose logs db
```

#### Detener los servicios

Para detener y eliminar los contenedores:

```powershell
docker compose down
```

Los datos almacenados en el volumen de PostgreSQL se conservan.

#### Eliminar también los datos de PostgreSQL

Si se necesita reiniciar completamente la base de datos local:

```powershell
docker compose down -v
```

> Este comando elimina también el volumen `postgres_data` y, por lo tanto, los datos almacenados en la base de datos local. Debe utilizarse únicamente cuando se quiera reinicializar el entorno de desarrollo.

#### Advertencia actual de Docker Compose

Docker Compose puede mostrar actualmente una advertencia indicando que el atributo `version` de `docker-compose.yml` es obsoleto.

Esta advertencia no impide iniciar los servicios y será corregida posteriormente como parte de la actualización de la configuración del proyecto.

---

### Frontend

El frontend de MetricASG está desarrollado con Angular.

La versión publicada actualmente en el repositorio utiliza:

* Angular 19.1.x
* Angular CLI 19.1.4
* Angular Material 19.x
* TypeScript 5.7.x

> Angular será actualizado posteriormente siguiendo el plan de migración definido para el proyecto. Esta sección documenta cómo ejecutar la versión actual.

#### Requisitos

Para ejecutar el frontend se requiere:

* Node.js 20 LTS
* npm

La configuración fue validada utilizando:

```text
Node.js 20.13.1
npm 10.5.2
```

Puede comprobarse la versión instalada mediante:

```powershell
node --version
npm --version
```

#### Seleccionar Node.js mediante NVM

Si se tienen varias versiones de Node.js instaladas mediante NVM para Windows, se recomienda utilizar Node 20 antes de instalar las dependencias:

```powershell
nvm use 20.13.1
```

Comprobar nuevamente las versiones activas:

```powershell
node --version
npm --version
```

#### Acceder al frontend

Desde la raíz de MetricASG:

```powershell
cd Frontend\metric-asg
```

#### Instalar dependencias

Para un clon limpio del repositorio se recomienda utilizar:

```powershell
npm ci
```

Este comando instala exactamente las versiones registradas en `package-lock.json`, lo que permite mantener un entorno reproducible.

Cuando se agreguen, actualicen o eliminen dependencias puede utilizarse:

```powershell
npm install
```

Las dependencias principales se encuentran definidas en:

```text
Frontend/metric-asg/package.json
```

y sus versiones resueltas se almacenan en:

```text
Frontend/metric-asg/package-lock.json
```

#### Ejecutar Angular

Desde `Frontend\metric-asg`:

```powershell
npm start
```

Este comando ejecuta internamente:

```text
ng serve
```

Una vez iniciado el servidor de desarrollo, la aplicación estará disponible en:

```text
http://localhost:4200
```

Angular recargará automáticamente la aplicación cuando se modifiquen archivos del proyecto.

#### Comunicación con el backend

Actualmente el frontend utiliza la API de FastAPI mediante:

```text
http://localhost:8000
```

Por lo tanto, para utilizar las funciones que consumen la API, el backend debe estar disponible en el puerto `8000`.

La URL de la API todavía se encuentra definida directamente en algunos servicios de Angular.

> Esta configuración será centralizada posteriormente para evitar URLs hardcodeadas y permitir configuraciones independientes para desarrollo y producción.

#### Compilar el frontend

Para comprobar que Angular compila correctamente:

```powershell
npm run build
```

Los archivos generados se almacenan en:

```text
dist/
```

#### Ejecutar pruebas

Las pruebas unitarias pueden ejecutarse mediante:

```powershell
npm test
```

La configuración actual utiliza Karma y Jasmine.

#### Detener el servidor

Para detener el servidor de desarrollo:

```text
Ctrl + C
```

---

## Verificación del entorno de desarrollo

La configuración documentada fue validada desde un clon limpio del repositorio y durante las tareas posteriores de seguridad y centralización de configuración.

### Entorno utilizado

* Python 3.11
* Docker Desktop 28.5.1
* Docker Compose 2.40.0
* PostgreSQL 15
* Node.js 20.13.1
* npm 10.5.2
* Angular 19.1.x

### Comprobaciones realizadas

Se verificó correctamente:

* Clonado limpio del repositorio.
* Existencia de `README.md` y `.env.example`.
* Ausencia de archivos `.env` con secretos versionados.
* Ausencia de `__pycache__` y archivos `.pyc` versionados.
* Construcción de la imagen del backend.
* Inicio de PostgreSQL mediante Docker Compose.
* Inicio de FastAPI mediante Docker Compose.
* Acceso a Swagger UI en `http://localhost:8000/docs`.
* Respuesta HTTP `200` del backend.
* Carga de `JWT_SECRET_KEY` mediante variables de entorno.
* Carga de `DATABASE_URL` mediante variables de entorno.
* Rotación de la clave JWT anteriormente publicada.
* Rotación de la contraseña PostgreSQL anteriormente publicada.
* Invalidación de la contraseña PostgreSQL anterior.
* Instalación y funcionamiento de `pydantic-settings`.
* Centralización de la configuración en `app/core/config.py`.
* Uso de configuración centralizada desde base de datos, autenticación, validación de tokens y FastAPI.
* Eliminación de llamadas dispersas a `os.getenv()`.
* Validación del fallo de arranque cuando `JWT_SECRET_KEY` está ausente o vacía.
* Validación del fallo de arranque cuando `DATABASE_URL` está ausente o vacía.
* Validación de que `ACCESS_TOKEN_EXPIRE_MINUTES` debe ser mayor que `0`.
* Conexión exitosa de SQLAlchemy con PostgreSQL mediante la configuración centralizada.
* Generación y validación de JWT mediante la configuración centralizada.
* Carga de los orígenes CORS mediante la configuración centralizada.
* Instalación del frontend mediante `npm ci`.
* Compilación del frontend mediante `npm run build`.
* Inicio del frontend mediante `npm start`.
* Acceso al frontend en `http://localhost:4200`.
* Respuesta HTTP `200` del frontend.
* Verificación visual básica de la aplicación.

### Observaciones

Durante la validación se detectaron algunas advertencias y aspectos técnicos que no impiden ejecutar el proyecto y serán atendidos en etapas posteriores:

* El archivo `docker-compose.yml` utiliza actualmente el atributo obsoleto `version`.
* SQLAlchemy muestra advertencias relacionadas con relaciones superpuestas en `CompanyRelationship`. Estas advertencias no bloquean actualmente el funcionamiento del backend y serán revisadas posteriormente.
* La política de CORS será revisada para separar correctamente los orígenes permitidos de desarrollo y producción.
* Algunas dependencias del frontend requieren revisión y actualización.
* El bundle inicial de Angular supera actualmente el presupuesto configurado.
* Algunas dependencias utilizadas por el frontend no son ESM.
* La aplicación será migrada posteriormente a una versión más reciente de Angular.

Estos puntos no impiden actualmente levantar MetricASG en un entorno de desarrollo.

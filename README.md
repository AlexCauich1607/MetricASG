# MetricASG

MetricASG es una herramienta de autodiagnóstico ASG (Ambiental, Social y de Gobernanza) compuesta por un frontend desarrollado con Angular y una API REST desarrollada con FastAPI.

## Desarrollo

### Backend

El backend de MetricASG está desarrollado con Python y FastAPI.

### PostgreSQL y Docker

MetricASG utiliza PostgreSQL como sistema de gestión de base de datos. Para facilitar el entorno de desarrollo, el backend incluye una configuración de Docker Compose que permite ejecutar PostgreSQL y FastAPI mediante contenedores.

#### Requisitos

Para utilizar esta modalidad es necesario tener instalado:

* Docker Desktop
* Docker Compose

Puede comprobarse la instalación con:

```powershell
docker --version
docker compose version
```

#### Servicios disponibles

El archivo `Backend/docker-compose.yml` define dos servicios principales:

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

La configuración futura del proyecto utilizará las variables definidas en `.env.example`:

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

se utiliza porque `db` es el nombre del servicio PostgreSQL definido dentro de Docker Compose.

> Actualmente algunas credenciales de PostgreSQL todavía se encuentran definidas directamente en `docker-compose.yml`. Estas serán migradas a variables de entorno durante las siguientes tareas de seguridad y configuración. No deben utilizarse las credenciales actuales en un entorno de producción.

#### Levantar el entorno con Docker

Desde la carpeta `Backend`:

```powershell
cd Backend
```

Construir las imágenes e iniciar los servicios:

```powershell
docker compose up --build
```

Esto iniciará:

* PostgreSQL.
* La API de FastAPI.

Una vez iniciados correctamente los servicios, la API estará disponible en:

```text
http://localhost:8000
```

La documentación Swagger estará disponible en:

```text
http://localhost:8000/docs
```

#### Ejecutar los contenedores en segundo plano

Opcionalmente pueden iniciarse en segundo plano:

```powershell
docker compose up --build -d
```

#### Comprobar los servicios

Para consultar los contenedores del proyecto:

```powershell
docker compose ps
```

Para revisar los logs:

```powershell
docker compose logs
```

Para seguir los logs en tiempo real:

```powershell
docker compose logs -f
```

Los logs de un servicio específico pueden consultarse con:

```powershell
docker compose logs api
```

o:

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

Si se necesita reiniciar completamente la base de datos de desarrollo:

```powershell
docker compose down -v
```

> Este comando elimina también el volumen `postgres_data` y, por lo tanto, los datos almacenados en la base de datos local. Debe utilizarse únicamente cuando se quiera reinicializar el entorno de desarrollo.


#### Requisitos

Para ejecutar el backend de forma local se requiere:

* Python 3.11
* pip
* PostgreSQL o Docker

> La configuración de PostgreSQL y Docker se documentará posteriormente.

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

#### Variables de entorno

El proyecto cuenta con un archivo `.env.example` en la raíz del repositorio que sirve como referencia para la configuración requerida.

Para crear el archivo local `.env`:

```powershell
Copy-Item ..\.env.example ..\.env
```

El archivo `.env` puede contener información sensible y no debe agregarse al repositorio.

> Actualmente algunas configuraciones todavía se encuentran directamente en el código. Estas serán migradas progresivamente a variables de entorno durante las siguientes etapas del desarrollo.

#### Ejecutar FastAPI

Desde la carpeta `Backend` y con el entorno virtual activado:

```powershell
python -m uvicorn app.main:app --reload
```

Por defecto, la API estará disponible en:

```text
http://127.0.0.1:8000
```

#### Documentación de la API

FastAPI genera automáticamente documentación interactiva.

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

ReDoc:

```text
http://127.0.0.1:8000/redoc
```

#### Detener el servidor

Para detener FastAPI:

```text
Ctrl + C
```

#### Desactivar el entorno virtual

Cuando se termine de trabajar con el backend:

```powershell
deactivate
```

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

Puede comprobarse la instalación con:

```powershell id="fod48u"
node --version
npm --version
```

#### Acceder al frontend

Desde la raíz de MetricASG:

```powershell id="56iqpw"
cd Frontend\metric-asg
```

#### Instalar dependencias

La primera vez que se ejecuta el frontend:

```powershell id="1d1wdp"
npm install
```

Esto instalará las dependencias definidas en:

```text id="vz36uj"
Frontend/metric-asg/package.json
```

y utilizará el archivo:

```text id="8chwns"
package-lock.json
```

para mantener versiones reproducibles.

Cuando se trabaje desde un clon limpio y no sea necesario modificar dependencias, también puede utilizarse:

```powershell id="utlk0q"
npm ci
```

`npm ci` instala exactamente las versiones registradas en `package-lock.json` y es especialmente útil en entornos limpios y procesos de integración continua.

#### Ejecutar Angular

Desde `Frontend\metric-asg`:

```powershell id="yy9pkj"
npm start
```

Este comando ejecuta internamente:

```text id="2m4lnx"
ng serve
```

Una vez iniciado el servidor de desarrollo, la aplicación estará disponible en:

```text id="705ds7"
http://localhost:4200
```

Angular recargará automáticamente la aplicación cuando se modifiquen archivos del proyecto.

#### Comunicación con el backend

Actualmente el frontend utiliza la API de FastAPI mediante:

```text id="r6iwg2"
http://localhost:8000
```

Por lo tanto, para utilizar las funciones que consumen la API, el backend debe estar disponible en el puerto `8000`.

La configuración de la URL de la API todavía se encuentra definida directamente en algunos servicios de Angular.

> Esta configuración será centralizada posteriormente para evitar URLs hardcodeadas y permitir diferentes entornos de desarrollo y producción.

#### Compilar el frontend

Para comprobar que Angular compila correctamente:

```powershell id="n6u1ah"
npm run build
```

Los archivos generados se almacenan en:

```text id="u1vrcb"
dist/
```

#### Ejecutar pruebas

Las pruebas unitarias pueden ejecutarse con:

```powershell id="p5cobp"
npm test
```

La configuración actual utiliza Karma y Jasmine.

#### Detener el servidor

Para detener el servidor de desarrollo de Angular:

```text id="av5jqo"
Ctrl + C
```

# Manejo de sesiones y tokens

## Estrategia actual

MetricASG utiliza dos tipos de token:

- Access token JWT con duración corta.
- Refresh token JWT almacenado en una cookie HttpOnly.

## Access token

Actualmente el access token se almacena en `sessionStorage`.

Esta decisión se mantiene temporalmente porque los guards actuales de Angular
(`AuthGuard`, `AdminGuard` y `UserGuard`) comprueban la existencia del token de
forma síncrona antes de permitir la navegación.

Mover el access token exclusivamente a memoria requeriría implementar primero
un mecanismo de restauración de sesión al iniciar la aplicación mediante el
refresh token.

La migración a almacenamiento únicamente en memoria deberá revisarse junto con
la modernización de guards e interceptores.

## Refresh token

El refresh token:

- se almacena únicamente en una cookie `HttpOnly`;
- utiliza `Secure` en producción;
- utiliza `SameSite=Lax`;
- tiene la misma duración configurada que el refresh JWT;
- se encuentra asociado a una sesión persistida en el backend;
- puede revocarse mediante logout;
- se rota después de cada uso;
- no se devuelve al frontend en el cuerpo de la respuesta.

## Logout

El frontend llama a `/api/auth/logout` con credenciales habilitadas.

El backend revoca la sesión asociada al refresh token y elimina la cookie.
Después, el frontend elimina de `sessionStorage` los datos locales de sesión.

## Decisión futura

Cuando se modernicen los guards e interceptores, se deberá evaluar mover el
access token de `sessionStorage` a memoria y restaurarlo mediante
`/api/auth/refresh-token` al iniciar la aplicación.
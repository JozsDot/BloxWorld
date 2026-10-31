# Servidor gratis de BloxShoot

El juego se aloja en GitHub Pages; el servidor multijugador usa Cloudflare Workers + Durable Objects.

## Despliegue desde el iPhone

1. Crea una cuenta gratuita en https://dash.cloudflare.com/ (no elijas un plan de pago).
2. Entra en **Workers & Pages** y elige **Create application**.
3. Elige importar un repositorio desde GitHub y conecta **JozsDot/BloxWorld**.
4. Selecciona la rama **main**. El archivo `wrangler.toml` está en la raíz del repositorio y el código del servidor en `server/worker.js`.
5. En configuración de compilación, deja el comando de compilación vacío y usa `npx wrangler deploy` como comando de despliegue.
6. Guarda y despliega. Cloudflare mostrará una dirección parecida a `https://bloxshoot-multiplayer.TU-CUENTA.workers.dev`.
7. Abre esa dirección añadiendo `/health`. Debe responder con `{"ok":true,...}`.
8. Copia la dirección `https://...` y envíamela. La pondré en la configuración del juego para activar las salas online.

## Coste y límites

El plan gratuito de Workers incluye 100.000 solicitudes al día. Durable Objects tiene cuotas gratuitas propias; no es ilimitado. Para mantenerlo gratis, limita las salas pequeñas (el servidor admite hasta 12 conexiones por sala) y vigila el uso en Cloudflare. No agregues tarjeta ni cambies a un plan de pago si quieres mantener coste cero.

## Qué hace esta primera versión

- Crea una sala por código.
- Reenvía posiciones y orientación de jugadores a los demás.
- Admite hasta 12 conexiones por sala.
- No guarda cuentas, progreso ni inventario.
- Es un servidor relay inicial, no un servidor competitivo autoritativo: todavía habría que validar disparos, daño, colisiones y anti-trampas en el servidor.

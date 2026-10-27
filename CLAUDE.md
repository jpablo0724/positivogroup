# positivogroup

## Despliegue en producción

El sistema corre en **https://intranet.positivogroup.com**, en el hosting web
de Hostinger, como **"App web de Node.js"** del panel (hPanel) — no es un VPS
ni Netlify.

**Se despliega solo con cada push a `main`**: la app está conectada a este
repositorio de GitHub ("De empujes a: positivogroup") y cada push crea un
despliegue nuevo (descarga, `npm install`, compila y reinicia). Se ve en
hPanel → Sitios web → intranet.positivogroup.com → Despliegues, donde cada
fila es un commit y la marcada "Actual" es la que está en línea.

- "Redistribuir" vuelve a desplegar el commit actual, no trae uno nuevo.
- Si un push no aparece en Despliegues, la conexión con GitHub se cayó
  (pasó el 27-oct-2026): hay que reconectarla en el panel y hacer otro push.
- Para confirmar qué versión está en línea sin entrar al panel: el nombre del
  `/assets/index-*.js` que carga la página cambia con cada compilación.

El servidor real es `servidor/index.mts` (arranca con
`node servidor-dist/index.mjs` tras compilar, ver `package.json`), sobre
MySQL (variables `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).

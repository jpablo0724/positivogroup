# positivogroup

## Despliegue en producción

El sistema corre en **hosting web de Hostinger**, usando su función de
**"Aplicación Node.js"** del panel (hPanel) — no es un VPS con SSH libre ni
Netlify. Para actualizar el servidor con cambios nuevos, el flujo típico
dentro de esa sección del panel es:

1. Traer los cambios del repositorio (Hostinger suele ofrecer un botón de
   "Sincronizar"/Git, o si no, subir los archivos actualizados).
2. Instalar dependencias (`npm install`) — el panel de Hostinger para
   Node.js normalmente tiene un botón "Ejecutar NPM Install".
3. Compilar (`npm run build`), si el panel no lo hace solo.
4. **Reiniciar la aplicación** desde el panel (botón "Reiniciar" en la
   sección de la app Node.js) para que cargue el código nuevo — esto es el
   paso que más se olvida y sin el cual los cambios no se ven reflejados.

El servidor real es `servidor/index.mts` (arranca con
`node servidor-dist/index.mjs` tras compilar, ver `package.json`), sobre
MySQL (variables `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).

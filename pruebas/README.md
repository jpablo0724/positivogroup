# Pruebas

## Autenticación — `npm run prueba:auth`

Lo más delicado del sistema. Comprueba que el registro exija el código de la
empresa, que la contraseña nunca quede guardada en claro (se lee la base de
datos simulada y se verifica), que dos cuentas con la misma contraseña tengan
hashes distintos, que el mensaje de error no revele si un correo tiene cuenta,
que la cookie sea HttpOnly/Secure/SameSite=Strict, y que el testigo de sesión
se guarde como huella y no tal cual.

## Backend — `npm run prueba:backend`

Ejercita las funciones serverless (`netlify/functions/`) sin red ni cuenta de
Netlify: `loader.mjs` sustituye `@netlify/blobs` por `blobs-memoria.mjs`, un
almacén en memoria que respeta la semántica de etag y `onlyIfMatch`.

Cubre el control de acceso, el guardado y borrado de cotizaciones y productos,
y sobre todo la numeración: hay una prueba que lanza 25 peticiones simultáneas
y verifica que salgan 25 números distintos, que es lo que garantiza que dos
personas cotizando a la vez no reciban el mismo `PG 0001/26`.

No necesita instalar nada aparte.

## Interfaz — `npm run prueba:ui`

Recorre la aplicación en un navegador con la API simulada: pantalla de acceso,
numeración provisional, crear un producto, guardar una cotización, ver el
listado compartido y subir al servidor lo que quedó guardado en el navegador.

Requiere el servidor de desarrollo y Playwright:

```bash
npm run dev &
npm install --no-save playwright
npm run prueba:ui
```

Playwright no está en `package.json` a propósito: en Netlify se instalaría en
cada despliegue y descargaría un navegador entero sin necesidad.

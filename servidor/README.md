# Servidor propio (Hostinger)

Alternativa a Netlify: un proceso Node que sirve el frontend y el backend, con
los datos en MySQL.

Las funciones del backend **no cambian**. Se escribieron con `Request` y
`Response`, que son del lenguaje y no de Netlify, así que `index.mts` solo
traduce entre el servidor HTTP de Node y esos objetos. Lo único que se
reemplazó fue el almacenamiento: `almacenSql.mts` expone la misma interfaz que
Netlify Blobs (`get`, `setJSON` con sus condiciones, `delete`, `list`) sobre
SQL.

Qué motor se usa lo decide `netlify/lib/store.mts` mirando `DB_HOST`: con la
variable definida usa MySQL, sin ella usa Netlify Blobs. Los dos despliegues
pueden convivir durante la migración.

## Variables de entorno

| Variable | Para qué |
|---|---|
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | la base de datos MySQL |
| `DB_PORT` | opcional, 3306 por defecto |
| `APP_ACCESS_CODE` | código con el que el equipo se registra |
| `CLIENTIFY_API_TOKEN` | token del CRM |
| `ADMIN_EMAILS` | opcional, administradores separados por comas |
| `PORT` | opcional, 3000 por defecto |
| `DIST_DIR` | opcional, `dist` por defecto |

La tabla se crea sola la primera vez que arranca; no hay que ejecutar ningún
SQL a mano.

## Compilar

```bash
npm run build:todo
```

Deja dos cosas:

- `dist/` — el frontend
- `servidor-dist/index.mjs` — el backend en JavaScript, sin dependencias de
  TypeScript, para que corra en cualquier Node 18 o superior

El backend se empaqueta a JavaScript a propósito: así no importa qué versión
de Node ofrezca el hosting ni si sabe leer TypeScript.

## Arrancar

```bash
node servidor-dist/index.mjs
```

En desarrollo, sin compilar y sobre SQLite:

```bash
npm run servidor
```

## Traer los datos desde Netlify

1. Entrar al sistema en Netlify como administrador
2. Descargar `https://<el-sitio>/api/admin/exportar`
3. Subir el archivo al servidor y correr:

```bash
node servidor/importar.mts positivogroup-respaldo.json
```

Se puede repetir sin problema: cada registro se escribe por su clave, así que
importar dos veces deja lo mismo. Por defecto no pisa lo que ya exista; con
`--reemplazar` sí.

Las sesiones no se migran: cada quien vuelve a entrar con su contraseña, que
sí viaja en el respaldo.

## Pruebas

```bash
npm run prueba:sql        # el almacén SQL: condiciones, concurrencia, textos raros
npm run prueba:servidor   # el servidor real por HTTP, de punta a punta
```

Las suites del backend también se pueden correr contra SQL de verdad en vez
del almacén en memoria:

```bash
PRUEBA_ALMACEN=sqlite node pruebas/backend.mjs
PRUEBA_ALMACEN=sqlite node pruebas/auth.mjs
```

Es la mejor comprobación antes de migrar: son las mismas comprobaciones que
protegen el sistema en Netlify, ejecutadas contra el almacenamiento nuevo.

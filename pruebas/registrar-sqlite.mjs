// Arranca el servidor con el almacén SQLite en vez de Netlify Blobs, para
// poder probarlo sin una base de datos MySQL.
import { register } from "node:module";
register("./loader.mjs", import.meta.url);

import { build } from "esbuild";

/**
 * Empaqueta el servidor en un solo archivo JavaScript.
 *
 * El banner no es un adorno: mysql2 está escrito en CommonJS y, al empaquetarlo
 * en formato ESM, esbuild reemplaza sus require() internos por un sustituto que
 * lanza «Dynamic require of "node:buffer" is not supported» en cuanto se usa.
 * Con createRequire se le devuelve un require de verdad y el conector funciona.
 *
 * Se hace aquí y no en la línea de comandos porque el banner lleva comillas
 * dentro de comillas, que en un script de package.json queda ilegible.
 */
await build({
  entryPoints: ["servidor/index.mts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "servidor-dist/index.mjs",
  banner: {
    js: [
      'import { createRequire } from "node:module";',
      "const require = createRequire(import.meta.url);",
    ].join("\n"),
  },
});

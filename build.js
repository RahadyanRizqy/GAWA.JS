const esbuild = require("esbuild");
const inlineImport = require("esbuild-plugin-inline-import");

esbuild.build({
  entryPoints: ["app.js"],
  bundle: true,
  platform: "node",
  outfile: "dist/app.js",
  plugins: [inlineImport({ filter: /\.html$/ })], // ⬅️ semua .html jadi string
}).catch(() => process.exit(1));

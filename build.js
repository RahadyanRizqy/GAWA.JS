// const esbuild = require("esbuild");
// const inlineImport = require("esbuild-plugin-inline-import");

// esbuild.build({
//     entryPoints: ["index.js"],
//     bundle: true,
//     platform: "node",
//     outfile: "dist/index.js",
//     plugins: [inlineImport({ filter: /\.html$/ })]
// }).catch(() => process.exit(1));
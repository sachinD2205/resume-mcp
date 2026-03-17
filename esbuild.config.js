const esbuild = require("esbuild");

esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: "dist/index.js",
  external: ["fsevents"],
  sourcemap: false,
  minify: false,
}).then(() => {
  console.log("Build successful → dist/index.js");
}).catch((err) => {
  console.error(err);
  process.exit(1);
});

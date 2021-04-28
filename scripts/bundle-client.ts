import * as esbuild from "https://deno.land/x/esbuild@v0.11.14/mod.js";
import { cache } from "https://deno.land/x/esbuild_plugin_cache@v0.2.5/mod.ts";

function onRebuild(error: Error | undefined, result: { warnings: [] }) {
  if (error) {
    console.error(error);
  } else if (result.warnings.length > 0) {
    console.log("build succeeded with warnings:", result.warnings);
  } else {
    console.log("build succeeded");
  }
}

export async function bundleClient(...args: string[]) {
  const isWatchMode = args.includes("--watch");

  const importmap = JSON.parse(await Deno.readTextFile("./imports.json"));

  const result = await esbuild.build({
    entryPoints: ["./client/client.ts"],
    bundle: true,
    sourcemap: true,
    format: "esm",
    watch: isWatchMode && { onRebuild },
    plugins: [cache({ importmap, directory: "./.cache" })],
    outfile: "public/dist/client.js",
  });

  onRebuild(undefined, result);

  if (!isWatchMode) {
    esbuild.stop();
  }
}

if (import.meta.main) {
  await bundleClient(...Deno.args);
}

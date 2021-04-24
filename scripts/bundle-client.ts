import * as esbuild from "https://deno.land/x/esbuild@v0.11.14/mod.js";
import { cache } from "https://deno.land/x/esbuild_plugin_cache@v0.2.5/mod.ts";

export async function bundleClient(...args: string[]) {
  // temporary fix for Windows
  // if (Deno.build.os === "windows") {
  //   Deno.env.set("FOLDERID_LocalAppData", Deno.env.get("LOCALAPPDATA")!);
  // }

  let watcher = null;

  if (args.includes("--watch")) {
    watcher = {
      onRebuild(error: any, result: any) {
        if (error) {
          console.error("watch build failed:", error);
        } else {
          console.log("watch build succeeded:", result);
        }
      },
    };
  }

  const importmap = JSON.parse(await Deno.readTextFile("./imports.json"));

  await esbuild.build({
    entryPoints: ["./client/client.ts"],
    bundle: true,
    format: "esm",
    watch: watcher,
    plugins: [cache({ importmap, directory: "./.cache" })],
    outfile: "public/dist/client.js",
  });

  if (watcher == null) {
    esbuild.stop();
  }
}

if (import.meta.main) {
  await bundleClient(...Deno.args);
}

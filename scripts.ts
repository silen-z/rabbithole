import { runServer } from "./scripts/run-server.ts";
import { bundleClient } from "./scripts/bundle-client.ts";

const scripts: Record<string, (...args: string[]) => void | Promise<void>> = {
  server: runServer,
  bundle: bundleClient,
};

const [scriptName, ...args] = Array.from(Deno.args);

if (scriptName == null) {
  console.log(`you have to specify script name`);
  Deno.exit(1);
}

const script = scripts[scriptName];

if (script == null) {
  console.log(`script with name ${scriptName} doesn't exist`);
  Deno.exit(2);
}

await script(...args);

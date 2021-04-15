export async function runServer(...args: string[]) {
  const watchArgs = [];
  if (args.includes("--watch")) {
    watchArgs.push("--unstable");
    watchArgs.push("--watch");
  }

  const cmd = Deno.run({
    cmd: [
      "deno",
      "run",
      "--import-map",
      "./imports.json",
      "--allow-env",
      "--allow-net",
      "--allow-read",
      ...watchArgs,
      "./server/webserver.ts",
    ],
  });
  await cmd.status();
}

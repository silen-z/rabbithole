export interface Configuration {
  tickRate: number;
  webServer: {
    listenAddress: string;
  };
}

export function fromEnv(): Configuration {
  return {
    tickRate: 20,
    webServer: {
      listenAddress: Deno.env.get("WEBSERVER_ADDRESS") || "localhost:8000",
    },
  };
}

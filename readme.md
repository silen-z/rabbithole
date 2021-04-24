Experimental browser game written in TypeScript for Deno using XState and custom ECS, sharing code between client and server

## Client

before runnning the server, bundle `client/client.ts` for browser with:

```sh
deno run -A ./scripts/bundle-client.ts

# watch mode
deno run -A ./scripts/bundle-client.ts --watch
```

## Server

```sh
deno run -A --import-map=./imports.json ./server/webserver.ts

# watch mode
deno run -A --import-map=./imports.json --unstable --watch ./server/webserver.ts
```

Experimental browser game written in TypeScript for Deno using XState and custom ECS, sharing code between client and server

## Client

before runnning the server, bundle `client/client.ts` for browser with:

```sh
# short version
deno run -A ./scripts.ts bundle

# watch mode
deno run -A ./scripts.ts bundle --watch

# full command (also can be passed --watch after the script name)
deno run --allow-env --allow-read --allow-write --allow-run ./scripts/bundle-client.ts
```

## Server

```sh
# short version
deno run -A ./scripts.ts server

# watch mode
deno run -A ./scripts.ts server --watch

# full command (also can be passed --watch before the script name)
deno run --import-map=./imports.json --allow-env --allow-net --allow-read ./server/webserver.ts
```

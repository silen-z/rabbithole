Experimental browser game written in TypeScript using XState, ECSY, pixi.js and sharing code between client and server

## Client

Client is using npm for managing dependencies and esbuild for bundling

```sh
# install dependencies
npm install

# start dev watch mode
npm run watch

# or build for production
npm run dist
```

## Server

Server requires deno to run

**to run the server**

```sh
# anywhere in project
npm run server

# or the full command in project root
deno run --import-map=./server/imports.json --allow-env --allow-net --allow-read --location http://localhost ./server/webserver.ts
```

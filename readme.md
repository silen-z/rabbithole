## run the server
```sh
# in project root
deno run --import-map=./server/imports.json --allow-env --allow-net --allow-read --location http://localhost ./server/webserver.ts
```
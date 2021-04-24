import { Application, Router, Context } from "oak";

import { fromEnv } from "./configuration.ts";
import { GameServer } from "./gameserver.ts";

import { errorHandler } from "./middleware/error.ts";
import { logMiddleware } from "./middleware/log.ts";

const config = fromEnv();
const gameServer = new GameServer(config);

const router = new Router();
router.get("/game", async (ctx: Context) => {
  const ws = await ctx.upgrade();
  gameServer.handleConnection(ws);
});

const app = new Application();

app.use(errorHandler);
app.use(logMiddleware);

app.use(router.routes());

app.use(async (context) => {
  await context.send({
    root: `${Deno.cwd()}/public`,
    index: "index.html",
  });
});

app.addEventListener("listen", (event) => {
  console.info(`WEBSERVER: listening on port ${event.port}`);
});

gameServer.start();
await app.listen("localhost:8000");

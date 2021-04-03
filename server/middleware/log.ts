import { Context } from "oak";

export async function logMiddleware(ctx: Context, next: () => Promise<void>) {
  if (ctx.isUpgradable) {
    console.info(`WEBSERVER: incoming websocket connection ${ctx.request.url}`);
  }

  await next();

  if (ctx.socket == null) {
    console.info(`WEBSERVER: ${ctx.request.method}: ${ctx.request.url}`);
  }
}

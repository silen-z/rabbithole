import { Context } from "oak";

export async function errorHandler(ctx: Context, next: () => Promise<void>) {
  try {
    await next();
  } catch (e) {
    console.log("WEBSERVER: unhandled error:");
    console.log(e.stack);

    ctx.response.status = 500;

    if (Deno.env.get("DENO_ENV") !== "PRODUCTION") {
      ctx.response.body = e.stack;
      return;
    }

    await ctx.send({
      root: `${Deno.cwd()}/public`,
      path: `error.html`,
    });
  }
}

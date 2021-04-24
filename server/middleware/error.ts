import { Context, isHttpError, Status } from "oak";

export async function errorHandler(ctx: Context, next: () => Promise<void>) {
  try {
    await next();
  } catch (err) {
    if (isHttpError(err)) {
      switch (err.status) {
        case Status.NotFound:
          await ctx.send({
            root: `${Deno.cwd()}/public/not-found.html`,
          });
          break;
        default:
          await ctx.send({
            root: `${Deno.cwd()}/public/error.html`,
          });
          break;
      }
    } else {
      // rethrow if you can't handle the error
      throw err;
    }
  }
}

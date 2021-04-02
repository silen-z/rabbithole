import { Context, HttpError, Status } from "oak";

export async function errorHandler(ctx: Context, next: () => Promise<void>) {
  try {
    await next();
  } catch (e) {
    if (e instanceof HttpError) {
      // deno-lint-ignore no-explicit-any
      ctx.response.status = e.status as any;
      if (e.expose) {
        ctx.response.body = `<!DOCTYPE html>
            <html>
            <body>
                <h1>${e.status} - ${e.message}</h1>
            </body>
            </html>`;
      } else {
        ctx.response.body = `<!DOCTYPE html>
            <html>
            <body>
                <h1>${e.status} - ${Status[e.status]}</h1>
            </body>
            </html>`;
      }
    } else if (e instanceof Error) {
      ctx.response.status = 500;
      ctx.response.body = `<!DOCTYPE html>
        <html>
        <body>
            <h1>500 - Internal Server Error</h1>
        </body>
        </html>`;
      console.log("Unhandled Error:", e.message);
      console.log(e.stack);
    }
  }
}

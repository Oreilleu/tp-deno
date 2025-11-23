import { Application } from "oak";
import { initKv } from "./db/kv.ts";
import usersRouter from "./routes/users.ts";
import booksRouter from "./routes/books.ts";
import loansRouter from "./routes/loans.ts";

await initKv();

const app = new Application();

app.use(usersRouter.routes());
app.use(usersRouter.allowedMethods());
app.use(booksRouter.routes());
app.use(booksRouter.allowedMethods());
app.use(loansRouter.routes());
app.use(loansRouter.allowedMethods());

const PORT = parseInt(Deno.env.get("PORT") || "8000");
console.log(`Server running on http://localhost:${PORT}`);
await app.listen({ port: PORT });

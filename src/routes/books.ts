import { Router } from "oak";
import type { Context } from "oak";
import { getKv, BookRepository } from "../db/kv.ts";
import { authMiddleware, requireRole, type AuthState } from "../utils/auth.ts";
import { validateISBN } from "../utils/validators.ts";
import type { BookCategory } from "../models/types.ts";

const router = new Router({ prefix: "/api/books" });

router.get("/", async (ctx: Context) => {
  const kv = getKv();
  const bookRepo = new BookRepository(kv);

  const category = ctx.request.url.searchParams.get(
    "category"
  ) as BookCategory | null;
  const availableParam = ctx.request.url.searchParams.get("available");
  const available =
    availableParam === "true"
      ? true
      : availableParam === "false"
      ? false
      : undefined;

  const books = await bookRepo.findAll({
    category: category || undefined,
    available,
  });

  ctx.response.status = 200;
  ctx.response.body = books;
});

router.get("/:id", async (ctx) => {
  const { id } = ctx.params;

  const kv = getKv();
  const bookRepo = new BookRepository(kv);

  const book = await bookRepo.findById(id);
  if (!book) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Book not found" };
    return;
  }

  ctx.response.status = 200;
  ctx.response.body = book;
});

router.post("/", authMiddleware, requireRole("librarian"), async (ctx) => {
  const body = await ctx.request.body.json();
  const { isbn, title, author, publisher, year, category, totalCopies } = body;

  if (
    !isbn ||
    !title ||
    !author ||
    !publisher ||
    !year ||
    !category ||
    !totalCopies
  ) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Missing required fields" };
    return;
  }

  if (!validateISBN(isbn)) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Invalid ISBN-13 format" };
    return;
  }

  if (year < 1000 || year > new Date().getFullYear() + 1) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Invalid year" };
    return;
  }

  if (totalCopies < 1) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Total copies must be at least 1" };
    return;
  }

  const kv = getKv();
  const bookRepo = new BookRepository(kv);

  const existingBook = await bookRepo.findByISBN(isbn);
  if (existingBook) {
    ctx.response.status = 409;
    ctx.response.body = { error: "Book with this ISBN already exists" };
    return;
  }

  const newBook = await bookRepo.create({
    isbn,
    title,
    author,
    publisher,
    year,
    category,
    available: true,
    availableCopies: totalCopies,
    totalCopies,
  });

  ctx.response.status = 201;
  ctx.response.body = newBook;
});

router.put("/:id", authMiddleware, requireRole("librarian"), async (ctx) => {
  const { id } = ctx.params;
  const body = await ctx.request.body.json();

  const kv = getKv();
  const bookRepo = new BookRepository(kv);

  const existingBook = await bookRepo.findById(id);
  if (!existingBook) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Book not found" };
    return;
  }

  if (body.isbn && !validateISBN(body.isbn)) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Invalid ISBN-13 format" };
    return;
  }

  if (
    body.year &&
    (body.year < 1000 || body.year > new Date().getFullYear() + 1)
  ) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Invalid year" };
    return;
  }

  if (body.isbn && body.isbn !== existingBook.isbn) {
    const bookWithNewISBN = await bookRepo.findByISBN(body.isbn);
    if (bookWithNewISBN) {
      ctx.response.status = 409;
      ctx.response.body = { error: "Book with this ISBN already exists" };
      return;
    }
  }

  const updates = { ...body };
  if (updates.availableCopies !== undefined) {
    updates.available = updates.availableCopies > 0;
  }

  const updatedBook = await bookRepo.update(id, updates);

  ctx.response.status = 200;
  ctx.response.body = updatedBook;
});

router.delete("/:id", authMiddleware, requireRole("librarian"), async (ctx) => {
  const { id } = ctx.params;

  const kv = getKv();
  const bookRepo = new BookRepository(kv);

  const deleted = await bookRepo.delete(id);
  if (!deleted) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Book not found" };
    return;
  }

  ctx.response.status = 204;
});

export default router;

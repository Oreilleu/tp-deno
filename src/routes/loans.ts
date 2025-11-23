import { Router } from "oak";
import type { Context } from "oak";
import { getKv, LoanRepository, BookRepository } from "../db/kv.ts";
import {
  authMiddleware,
  requireRole,
  type AuthState,
} from "../utils/auth.ts";

const router = new Router({ prefix: "/api/loans" });

router.post("/", authMiddleware, async (ctx: Context<AuthState>) => {
  const body = await ctx.request.body.json();
  const { bookId } = body;

  if (!bookId) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Missing bookId" };
    return;
  }

  const userId = ctx.state.user!.id;
  const kv = getKv();
  const bookRepo = new BookRepository(kv);
  const loanRepo = new LoanRepository(kv);

  const book = await bookRepo.findById(bookId);
  if (!book) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Book not found" };
    return;
  }

  if (!book.available || book.availableCopies <= 0) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Book is not available for borrowing" };
    return;
  }

  const existingLoan = await loanRepo.findActiveByUserAndBook(userId, bookId);
  if (existingLoan) {
    ctx.response.status = 400;
    ctx.response.body = { error: "You have already borrowed this book" };
    return;
  }

  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 14);

  const loan = await loanRepo.create({
    bookId,
    userId,
    borrowDate: now,
    dueDate,
    status: "active",
  });

  const newAvailableCopies = book.availableCopies - 1;
  await bookRepo.update(bookId, {
    availableCopies: newAvailableCopies,
    available: newAvailableCopies > 0,
  });

  ctx.response.status = 201;
  ctx.response.body = loan;
});

router.get("/my", authMiddleware, async (ctx: Context<AuthState>) => {
  const userId = ctx.state.user!.id;
  const activeOnlyParam = ctx.request.url.searchParams.get("active");
  const activeOnly = activeOnlyParam === "true";

  const kv = getKv();
  const loanRepo = new LoanRepository(kv);

  const loans = await loanRepo.findByUserId(userId, activeOnly);

  ctx.response.status = 200;
  ctx.response.body = loans;
});

router.put("/:id/return", authMiddleware, async (ctx) => {
  const { id } = ctx.params;
  const userId = ctx.state.user!.id;

  const kv = getKv();
  const loanRepo = new LoanRepository(kv);
  const bookRepo = new BookRepository(kv);

  const loan = await loanRepo.findById(id);
  if (!loan) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Loan not found" };
    return;
  }

  const userRole = ctx.state.user!.role;
  if (loan.userId !== userId && userRole !== "librarian") {
    ctx.response.status = 403;
    ctx.response.body = { error: "You can only return your own loans" };
    return;
  }

  if (loan.status === "returned") {
    ctx.response.status = 400;
    ctx.response.body = { error: "Book has already been returned" };
    return;
  }

  const updatedLoan = await loanRepo.update(id, {
    returnDate: new Date(),
    status: "returned",
  });

  const book = await bookRepo.findById(loan.bookId);
  if (book) {
    const newAvailableCopies = book.availableCopies + 1;
    await bookRepo.update(loan.bookId, {
      availableCopies: newAvailableCopies,
      available: true,
    });
  }

  ctx.response.status = 200;
  ctx.response.body = updatedLoan;
});

router.get(
  "/",
  authMiddleware,
  requireRole("librarian"),
  async (ctx: Context<AuthState>) => {
    const kv = getKv();
    const loanRepo = new LoanRepository(kv);

    const loans = await loanRepo.findAll();

    ctx.response.status = 200;
    ctx.response.body = loans;
  }
);

export default router;

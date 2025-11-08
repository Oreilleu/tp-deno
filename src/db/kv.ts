import type { Book, User, Loan } from "../models/types.ts";

let kv: Deno.Kv;

export async function initKv() {
  kv = await Deno.openKv();
  return kv;
}

export function getKv(): Deno.Kv {
  if (!kv) {
    throw new Error("KV not initialized. Call initKv() first.");
  }
  return kv;
}

export class BookRepository {
  private kv: Deno.Kv;

  constructor(kv: Deno.Kv) {
    this.kv = kv;
  }

  async create(
    book: Omit<Book, "id" | "createdAt" | "updatedAt">
  ): Promise<Book> {
    const id = crypto.randomUUID();
    const now = new Date();
    const newBook: Book = {
      ...book,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await this.kv.set(["books", id], newBook);
    await this.kv.set(["books_by_isbn", book.isbn], id);
    return newBook;
  }

  async findById(id: string): Promise<Book | null> {
    const result = await this.kv.get<Book>(["books", id]);
    return result.value;
  }

  async findByISBN(isbn: string): Promise<Book | null> {
    const idResult = await this.kv.get<string>(["books_by_isbn", isbn]);
    if (!idResult.value) return null;
    return this.findById(idResult.value);
  }

  async findAll(options?: {
    category?: string;
    available?: boolean;
  }): Promise<Book[]> {
    const books: Book[] = [];
    const entries = this.kv.list<Book>({ prefix: ["books"] });

    for await (const entry of entries) {
      if (entry.key.length > 2) continue;

      const book = entry.value;

      if (options?.category && book.category !== options.category) continue;
      if (
        options?.available !== undefined &&
        book.available !== options.available
      )
        continue;

      books.push(book);
    }

    return books;
  }

  async update(
    id: string,
    updates: Partial<Omit<Book, "id" | "createdAt">>
  ): Promise<Book | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: Book = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    await this.kv.set(["books", id], updated);

    if (updates.isbn && updates.isbn !== existing.isbn) {
      await this.kv.delete(["books_by_isbn", existing.isbn]);
      await this.kv.set(["books_by_isbn", updates.isbn], id);
    }

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    await this.kv.delete(["books", id]);
    await this.kv.delete(["books_by_isbn", existing.isbn]);
    return true;
  }
}

export class UserRepository {
  private kv: Deno.Kv;

  constructor(kv: Deno.Kv) {
    this.kv = kv;
  }

  async create(
    user: Omit<User, "id" | "createdAt" | "updatedAt">
  ): Promise<User> {
    const id = crypto.randomUUID();
    const now = new Date();
    const newUser: User = {
      ...user,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await this.kv.set(["users", id], newUser);
    await this.kv.set(["users_by_email", user.email.toLowerCase()], id);
    return newUser;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.kv.get<User>(["users", id]);
    return result.value;
  }

  async findByEmail(email: string): Promise<User | null> {
    const idResult = await this.kv.get<string>([
      "users_by_email",
      email.toLowerCase(),
    ]);
    if (!idResult.value) return null;
    return this.findById(idResult.value);
  }

  async findAll(): Promise<User[]> {
    const users: User[] = [];
    const entries = this.kv.list<User>({ prefix: ["users"] });

    for await (const entry of entries) {
      if (entry.key.length > 2) continue;
      users.push(entry.value);
    }

    return users;
  }

  async update(
    id: string,
    updates: Partial<Omit<User, "id" | "createdAt">>
  ): Promise<User | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: User = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    await this.kv.set(["users", id], updated);

    if (updates.email && updates.email !== existing.email) {
      await this.kv.delete(["users_by_email", existing.email.toLowerCase()]);
      await this.kv.set(["users_by_email", updates.email.toLowerCase()], id);
    }

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    await this.kv.delete(["users", id]);
    await this.kv.delete(["users_by_email", existing.email.toLowerCase()]);
    return true;
  }
}

export class LoanRepository {
  private kv: Deno.Kv;

  constructor(kv: Deno.Kv) {
    this.kv = kv;
  }

  async create(
    loan: Omit<Loan, "id" | "createdAt" | "updatedAt">
  ): Promise<Loan> {
    const id = crypto.randomUUID();
    const now = new Date();
    const newLoan: Loan = {
      ...loan,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await this.kv.set(["loans", id], newLoan);
    await this.kv.set(["loans_by_user", loan.userId, id], true);
    await this.kv.set(["loans_by_book", loan.bookId, id], true);
    return newLoan;
  }

  async findById(id: string): Promise<Loan | null> {
    const result = await this.kv.get<Loan>(["loans", id]);
    return result.value;
  }

  async findAll(): Promise<Loan[]> {
    const loans: Loan[] = [];
    const entries = this.kv.list<Loan>({ prefix: ["loans"] });

    for await (const entry of entries) {
      // Skip secondary indexes
      if (entry.key.length > 2) continue;
      loans.push(entry.value);
    }

    return loans;
  }

  async findByUserId(userId: string, activeOnly = false): Promise<Loan[]> {
    const loans: Loan[] = [];
    const entries = this.kv.list({ prefix: ["loans_by_user", userId] });

    for await (const entry of entries) {
      const loanId = entry.key[2] as string;
      const loan = await this.findById(loanId);
      if (loan && (!activeOnly || loan.status === "active")) {
        loans.push(loan);
      }
    }

    return loans;
  }

  async findByBookId(bookId: string, activeOnly = false): Promise<Loan[]> {
    const loans: Loan[] = [];
    const entries = this.kv.list({ prefix: ["loans_by_book", bookId] });

    for await (const entry of entries) {
      const loanId = entry.key[2] as string;
      const loan = await this.findById(loanId);
      if (loan && (!activeOnly || loan.status === "active")) {
        loans.push(loan);
      }
    }

    return loans;
  }

  async findActiveByUserAndBook(
    userId: string,
    bookId: string
  ): Promise<Loan | null> {
    const userLoans = await this.findByUserId(userId, true);
    return (
      userLoans.find(
        (loan) => loan.bookId === bookId && loan.status === "active"
      ) || null
    );
  }

  async update(
    id: string,
    updates: Partial<Omit<Loan, "id" | "createdAt">>
  ): Promise<Loan | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: Loan = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    await this.kv.set(["loans", id], updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    await this.kv.delete(["loans", id]);
    await this.kv.delete(["loans_by_user", existing.userId, id]);
    await this.kv.delete(["loans_by_book", existing.bookId, id]);
    return true;
  }
}

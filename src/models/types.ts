export type UserRole = "student" | "librarian";

export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithoutPassword extends Omit<User, "password"> {}

export type BookCategory =
  | "fiction"
  | "non-fiction"
  | "science"
  | "technology"
  | "history"
  | "biography"
  | "other";

export interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  year: number;
  category: BookCategory;
  available: boolean;
  availableCopies: number;
  totalCopies: number;
  createdAt: Date;
  updatedAt: Date;
}

export type LoanStatus = "active" | "returned";

export interface Loan {
  id: string;
  bookId: string;
  userId: string;
  borrowDate: Date;
  dueDate: Date;
  returnDate?: Date;
  status: LoanStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface JWTPayload {
  sub: string;
  role: UserRole;
  exp: number;
}

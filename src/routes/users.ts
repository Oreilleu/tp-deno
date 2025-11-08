import { Router } from "oak";
import type { Context } from "oak";
import { getKv, UserRepository } from "../db/kv.ts";
import { generateToken } from "../utils/jwt.ts";
import {
  hashPassword,
  validateEmail,
  verifyPassword,
} from "../utils/validators.ts";
import { authMiddleware, type AuthState } from "../utils/auth.ts";
import type { UserWithoutPassword } from "../models/types.ts";

const router = new Router({ prefix: "/api/users" });

function sanitizeUser(user: any): UserWithoutPassword {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword as UserWithoutPassword;
}

router.post("/register", async (ctx: Context) => {
  const body = await ctx.request.body.json();
  const { email, password, firstName, lastName } = body;

  if (!email || !password || !firstName || !lastName) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Missing required fields" };
    return;
  }

  if (!validateEmail(email)) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Invalid email format" };
    return;
  }

  if (password.length < 6) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Password must be at least 6 characters" };
    return;
  }

  const kv = getKv();
  const userRepo = new UserRepository(kv);

  const existingUser = await userRepo.findByEmail(email);
  if (existingUser) {
    ctx.response.status = 409;
    ctx.response.body = { error: "Email already registered" };
    return;
  }

  const hashedPassword = await hashPassword(password);
  const newUser = await userRepo.create({
    email,
    password: hashedPassword,
    firstName,
    lastName,
    role: "student",
  });

  const token = await generateToken(newUser.id, newUser.role);

  ctx.response.status = 201;
  ctx.response.body = {
    user: sanitizeUser(newUser),
    token,
  };
});

router.post("/login", async (ctx: Context) => {
  const body = await ctx.request.body.json();
  const { email, password } = body;

  if (!email || !password) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Missing email or password" };
    return;
  }

  const kv = getKv();
  const userRepo = new UserRepository(kv);

  const user = await userRepo.findByEmail(email);
  if (!user) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Invalid credentials" };
    return;
  }

  const isPasswordValid = await verifyPassword(password, user.password);
  if (!isPasswordValid) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Invalid credentials" };
    return;
  }

  const token = await generateToken(user.id, user.role);

  ctx.response.status = 200;
  ctx.response.body = {
    user: sanitizeUser(user),
    token,
  };
});

router.get("/me", authMiddleware, async (ctx: Context<AuthState>) => {
  const userId = ctx.state.user!.id;

  const kv = getKv();
  const userRepo = new UserRepository(kv);

  const user = await userRepo.findById(userId);
  if (!user) {
    ctx.response.status = 404;
    ctx.response.body = { error: "User not found" };
    return;
  }

  ctx.response.status = 200;
  ctx.response.body = sanitizeUser(user);
});

export default router;

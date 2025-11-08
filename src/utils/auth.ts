import type { Context, Next } from "oak";
import { verifyToken } from "./jwt.ts";
import type { UserRole } from "../models/types.ts";

export interface AuthState {
  user?: {
    id: string;
    role: UserRole;
  };
}

export async function authMiddleware(ctx: Context<AuthState>, next: Next) {
  const authHeader = ctx.request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Missing or invalid authorization header" };
    return;
  }

  const token = authHeader.substring(7);
  const payload = await verifyToken(token);

  if (!payload) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Invalid or expired token" };
    return;
  }

  ctx.state.user = {
    id: payload.sub,
    role: payload.role,
  };

  await next();
}

export function requireRole(...roles: UserRole[]) {
  return async (ctx: Context<AuthState>, next: Next) => {
    if (!ctx.state.user) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Authentication required" };
      return;
    }

    if (!roles.includes(ctx.state.user.role)) {
      ctx.response.status = 403;
      ctx.response.body = { error: "Insufficient permissions" };
      return;
    }

    await next();
  };
}

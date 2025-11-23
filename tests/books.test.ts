import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import {
  validateEmail,
  validateISBN,
  hashPassword,
  verifyPassword,
} from "../src/utils/validators.ts";

Deno.test("validateEmail - valid email", () => {
  assertEquals(validateEmail("test@example.com"), true);
  assertEquals(validateEmail("user.name@domain.org"), true);
});

Deno.test("validateEmail - invalid email", () => {
  assertEquals(validateEmail("invalid"), false);
  assertEquals(validateEmail("@domain.com"), false);
  assertEquals(validateEmail("test@"), false);
});

Deno.test("validateISBN - valid ISBN", () => {
  assertEquals(validateISBN("1234567890"), true);
  assertEquals(validateISBN("123-456-7890"), true);
});

Deno.test("validateISBN - invalid ISBN", () => {
  assertEquals(validateISBN("123"), false);
  assertEquals(validateISBN("12345678901234"), false);
});

Deno.test("hashPassword and verifyPassword", async () => {
  const password = "mySecretPassword123";
  const hash = await hashPassword(password);

  assertEquals(typeof hash, "string");
  assertEquals(hash.length, 64);

  const isValid = await verifyPassword(password, hash);
  assertEquals(isValid, true);

  const isInvalid = await verifyPassword("wrongPassword", hash);
  assertEquals(isInvalid, false);
});

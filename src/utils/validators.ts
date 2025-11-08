export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateISBN(isbn: string): boolean {
  const cleanISBN = isbn.replace(/[-\s]/g, "");

  if (!/^(978|979)\d{10}$/.test(cleanISBN)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(cleanISBN[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return checkDigit === parseInt(cleanISBN[12]);
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

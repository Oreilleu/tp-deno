import type { JWTPayload, UserRole } from "../models/types.ts";

const JWT_SECRET = Deno.env.get("JWT_SECRET");
const JWT_EXPIRATION = 7 * 24 * 60 * 60;

function base64urlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlDecode(str: string): ArrayBuffer {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(JWT_SECRET);

  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function generateToken(
  userId: string,
  role: UserRole
): Promise<string> {
  const encoder = new TextEncoder();

  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const encodedHeader = base64urlEncode(encoder.encode(JSON.stringify(header)));

  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    sub: userId,
    role,
    exp: now + JWT_EXPIRATION,
  };
  const encodedPayload = base64urlEncode(
    encoder.encode(JSON.stringify(payload))
  );

  const data = `${encodedHeader}.${encodedPayload}`;
  const key = await getKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const encodedSignature = base64urlEncode(new Uint8Array(signature));

  return `${data}.${encodedSignature}`;
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    const encoder = new TextEncoder();
    const data = `${encodedHeader}.${encodedPayload}`;
    const key = await getKey();
    const signatureBytes = base64urlDecode(encodedSignature);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(data)
    );

    if (!isValid) return null;

    const payloadBuffer = base64urlDecode(encodedPayload);
    const payloadStr = new TextDecoder().decode(payloadBuffer);
    const payload = JSON.parse(payloadStr) as JWTPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

const enc = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256(text: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

/** Identifiant pseudonymisé d'un compte : impossible à inverser sans le secret serveur. */
export async function pseudonymize(secret: string, toonHandle: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(toonHandle))).slice(0, 20);
}

export function randomToken(bytes = 24): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return hex(buf.buffer);
}

/** Comparaison en temps constant de deux empreintes hexadécimales. */
export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

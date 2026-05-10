const ALGO = "AES-GCM";

export async function getKey(): Promise<CryptoKey> {
  const raw = Buffer.from(process.env.NEXT_PUBLIC_CRYPTO_KEY!, "hex");
  return globalThis.crypto.subtle.importKey(
    "raw",
    raw,
    { name: ALGO },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await globalThis.crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    encoded
  );
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(cipherBuf)));
  return `${ivB64}.${ctB64}`;
}

export async function decrypt(ciphertext: string): Promise<string> {
  const key = await getKey();
  const [ivB64, ctB64] = ciphertext.split(".");
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));
  const plainBuf = await globalThis.crypto.subtle.decrypt(
    { name: ALGO, iv },
    key,
    ct
  );
  return new TextDecoder().decode(plainBuf);
}

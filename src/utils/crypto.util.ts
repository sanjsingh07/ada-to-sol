import * as crypto from "crypto";

const ALGO = "aes-256-gcm";
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, "hex"); // 32 bytes

export function encrypt(plaintext: string) {
  const iv = crypto.randomBytes(12); // GCM recommended IV size = 12 bytes

  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("hex"),
    data: encrypted.toString("hex"),
    tag: tag.toString("hex"),
  };
}

export function decrypt(enc: { iv: string; data: string; tag: string }) {
  const iv = Buffer.from(enc.iv, "hex");
  const encryptedText = Buffer.from(enc.data, "hex");
  const tag = Buffer.from(enc.tag, "hex");

  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedText),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

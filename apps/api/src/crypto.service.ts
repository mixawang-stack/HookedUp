import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { Injectable } from "@nestjs/common";

const ALG = "aes-256-gcm";
const IV_LENGTH = 12;

type KeyEntry = {
  id: string;
  key: Buffer;
};

@Injectable()
export class CryptoService {
  private readonly keys: KeyEntry[];
  private readonly primaryKeyId: string;

  constructor() {
    const raw = process.env.CRYPTO_KEY;
    if (!raw) {
      throw new Error("CRYPTO_KEY is required");
    }

    const primaryId = process.env.CRYPTO_KEY_ID ?? "primary";
    const primary = this.decodeKey(primaryId, raw);
    const entries: KeyEntry[] = [primary];

    const previousKey = process.env.CRYPTO_KEY_PREVIOUS;
    if (previousKey) {
      const previousId = process.env.CRYPTO_KEY_PREVIOUS_ID ?? "previous";
      entries.push(this.decodeKey(previousId, previousKey));
    }

    this.keys = entries;
    this.primaryKeyId = primary.id;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALG, this.keys[0].key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    return [
      this.primaryKeyId,
      iv.toString("base64"),
      tag.toString("base64"),
      encrypted.toString("base64")
    ].join(":");
  }

  encryptBuffer(buffer: Buffer): {
    ciphertext: Buffer;
    iv: Buffer;
    tag: Buffer;
    keyId: string;
  } {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALG, this.keys[0].key, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { ciphertext: encrypted, iv, tag, keyId: this.primaryKeyId };
  }

  decryptBuffer(payload: {
    ciphertext: Buffer;
    iv: Buffer;
    tag: Buffer;
    keyId?: string;
  }): Buffer {
    const keys = payload.keyId
      ? this.keys.filter((entry) => entry.id === payload.keyId)
      : this.keys;
    for (const entry of keys) {
      try {
        const decipher = createDecipheriv(ALG, entry.key, payload.iv);
        decipher.setAuthTag(payload.tag);
        return Buffer.concat([
          decipher.update(payload.ciphertext),
          decipher.final()
        ]);
      } catch {
        continue;
      }
    }
    throw new Error("DECRYPT_FAILED");
  }

  decrypt(payload: string): string {
    const parts = payload.split(":");
    if (parts.length === 3) {
      return this.decryptWithKeys(parts, this.keys);
    }

    if (parts.length === 4) {
      const [keyId, ivB64, tagB64, dataB64] = parts;
      const keyEntry = this.keys.find((entry) => entry.id === keyId);
      if (keyEntry) {
        return this.decryptWithKeys([ivB64, tagB64, dataB64], [keyEntry]);
      }
      return this.decryptWithKeys([ivB64, tagB64, dataB64], this.keys);
    }

    throw new Error("INVALID_CIPHERTEXT_FORMAT");
  }

  private decodeKey(id: string, raw: string): KeyEntry {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length !== 32) {
      throw new Error("CRYPTO_KEY must be 32 bytes (base64) for AES-256-GCM");
    }
    return { id, key: decoded };
  }

  private decryptWithKeys(parts: string[], keys: KeyEntry[]): string {
    const [ivB64, tagB64, dataB64] = parts;
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error("INVALID_CIPHERTEXT_FORMAT");
    }

    for (const entry of keys) {
      try {
        const iv = Buffer.from(ivB64, "base64");
        const tag = Buffer.from(tagB64, "base64");
        const data = Buffer.from(dataB64, "base64");
        const decipher = createDecipheriv(ALG, entry.key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([
          decipher.update(data),
          decipher.final()
        ]);
        return decrypted.toString("utf8");
      } catch {
        continue;
      }
    }

    throw new Error("DECRYPT_FAILED");
  }
}

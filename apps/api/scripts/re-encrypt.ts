import { PrismaClient } from "@prisma/client";
import { CryptoService } from "../src/crypto.service";

const prisma = new PrismaClient();
const crypto = new CryptoService();

async function main() {
  const messages = await prisma.message.findMany({
    select: { id: true, ciphertext: true }
  });

  for (const message of messages) {
    const raw = message.ciphertext;
    if (!raw) {
      continue;
    }

    let decrypted: string | null = null;
    try {
      decrypted = crypto.decrypt(raw);
    } catch {
      decrypted = null;
    }

    if (decrypted === null) {
      const encrypted = crypto.encrypt(raw);
      await prisma.message.update({
        where: { id: message.id },
        data: { ciphertext: encrypted }
      });
    }
  }

  const verifications = await prisma.verification.findMany({
    select: { id: true, metadataJson: true }
  });

  for (const verification of verifications) {
    const raw = verification.metadataJson;
    if (!raw) {
      continue;
    }

    let decrypted: string | null = null;
    try {
      decrypted = crypto.decrypt(raw);
    } catch {
      decrypted = null;
    }

    if (decrypted === null) {
      const encrypted = crypto.encrypt(String(raw));
      await prisma.verification.update({
        where: { id: verification.id },
        data: { metadataJson: encrypted }
      });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

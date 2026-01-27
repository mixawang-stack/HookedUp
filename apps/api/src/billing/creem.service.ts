import crypto from "crypto";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateCreemCheckoutDto } from "./dto/create-creem-checkout.dto";

type CreemWebhookPayload = {
  id?: string;
  type?: string;
  data?: {
    object?: {
      id?: string;
      request_id?: string;
      metadata?: Record<string, any>;
      order?: {
        id?: string;
        status?: string;
        currency?: string;
        amount?: number;
        product?: { id?: string } | string;
        checkout?: { id?: string } | string;
      };
    };
  };
};

@Injectable()
export class CreemService {
  private readonly logger = new Logger(CreemService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createCheckout(userId: string, dto: CreateCreemCheckoutDto) {
    const novel = await this.prisma.novel.findUnique({
      where: { id: dto.novelId },
      select: {
        id: true,
        title: true,
        pricingMode: true,
        creemProductId: true
      }
    });
    if (!novel) {
      throw new BadRequestException("NOVEL_NOT_FOUND");
    }
    if (novel.pricingMode !== "BOOK") {
      throw new BadRequestException("BOOK_ONLY_CHECKOUT");
    }
    if (!novel.creemProductId) {
      throw new BadRequestException("CREEM_PRODUCT_ID_REQUIRED");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });
    if (!user?.email) {
      throw new BadRequestException("USER_EMAIL_REQUIRED");
    }

    const apiKey = process.env.CREEM_API_KEY;
    if (!apiKey) {
      throw new BadRequestException("CREEM_API_KEY_MISSING");
    }

    const apiBase = process.env.CREEM_API_BASE_URL ?? "https://api.creem.io";
    const successBase =
      process.env.CREEM_SUCCESS_URL_BASE ?? "https://hooked-up.vercel.app";
    const successUrl = `${successBase.replace(/\/$/, "")}/novels/${novel.id}?payment=success`;

    const requestId = `novel:${novel.id}:user:${userId}`;

    const payload = {
      product_id: novel.creemProductId,
      request_id: requestId,
      units: 1,
      customer: { email: user.email },
      metadata: {
        userId,
        novelId: novel.id,
        pricingMode: "BOOK"
      },
      success_url: successUrl
    };

    const res = await fetch(`${apiBase}/v1/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify(payload)
    });
    const bodyText = await res.text();
    const data = bodyText ? JSON.parse(bodyText) : null;
    if (!res.ok) {
      throw new BadRequestException(data?.message ?? "CREEM_CHECKOUT_FAILED");
    }

    return {
      checkoutUrl: data?.checkout_url ?? data?.url ?? data?.checkoutUrl ?? null
    };
  }

  verifySignature(rawBody: Buffer, signatureHeader: string | null) {
    const secret = process.env.CREEM_WEBHOOK_SECRET;
    if (!secret) {
      throw new BadRequestException("CREEM_WEBHOOK_SECRET_MISSING");
    }
    if (!signatureHeader) {
      throw new BadRequestException("CREEM_SIGNATURE_MISSING");
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    const provided = signatureHeader.trim();
    const expectedBuf = Buffer.from(expected, "hex");
    const providedBuf = Buffer.from(provided, "hex");
    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new BadRequestException("CREEM_SIGNATURE_INVALID");
    }
  }

  async handleWebhook(rawBody: Buffer, signatureHeader: string | null) {
    this.verifySignature(rawBody, signatureHeader);

    const payload = JSON.parse(rawBody.toString("utf8")) as CreemWebhookPayload;
    const eventId = payload?.id ?? "";
    const eventType = payload?.type ?? "";

    if (!eventId || !eventType) {
      throw new BadRequestException("CREEM_EVENT_INVALID");
    }

    const existing = await this.prisma.paymentWebhookEvent.findUnique({
      where: { provider_eventId: { provider: "CREEM", eventId } }
    });
    if (existing?.processedAt) {
      return { received: true, duplicated: true };
    }

    await this.prisma.paymentWebhookEvent.upsert({
      where: { provider_eventId: { provider: "CREEM", eventId } },
      update: { payload: payload as any },
      create: {
        provider: "CREEM",
        eventId,
        eventType,
        payload: payload as any
      }
    });

    if (eventType !== "checkout.completed") {
      await this.markEventProcessed(eventId, null);
      return { received: true, ignored: true };
    }

    const object = payload?.data?.object;
    const order = object?.order;
    const orderId = order?.id ?? null;
    const checkoutId =
      typeof order?.checkout === "string" ? order?.checkout : order?.checkout?.id ?? null;
    const productId =
      typeof order?.product === "string" ? order?.product : order?.product?.id ?? null;

    const metadata = object?.metadata ?? {};
    let userId: string | null = metadata.userId ?? null;
    let novelId: string | null = metadata.novelId ?? null;
    const requestId = object?.request_id ?? "";
    if ((!userId || !novelId) && typeof requestId === "string") {
      const match = requestId.match(/novel:([^:]+):user:([^:]+)/i);
      if (match) {
        novelId = novelId ?? match[1];
        userId = userId ?? match[2];
      }
    }

    if (!userId || !novelId || !orderId || !productId) {
      await this.markEventProcessed(eventId, "MISSING_METADATA");
      return { received: true, ignored: true };
    }

    const novel = await this.prisma.novel.findFirst({
      where: { id: novelId, creemProductId: productId },
      select: { id: true }
    });
    if (!novel) {
      await this.markEventProcessed(eventId, "NOVEL_NOT_FOUND");
      return { received: true, ignored: true };
    }

    const orderStatus = (order?.status ?? "").toString().toLowerCase();
    if (orderStatus && orderStatus !== "paid" && orderStatus !== "completed") {
      await this.markEventProcessed(eventId, "ORDER_NOT_PAID");
      return { received: true, ignored: true };
    }

    const amountMinor = Number(order?.amount ?? 0);
    const amountMajor = Number.isFinite(amountMinor)
      ? Math.round(amountMinor) / 100
      : 0;
    const currency = (order?.currency ?? "USD").toUpperCase();

    await this.prisma.novelPurchase.upsert({
      where: { provider_providerOrderId: { provider: "CREEM", providerOrderId: orderId } },
      update: {
        providerEventId: eventId,
        providerCheckoutId: checkoutId ?? undefined
      },
      create: {
        userId,
        novelId,
        chapterId: null,
        pricingMode: "BOOK",
        amount: amountMajor,
        currency,
        provider: "CREEM",
        providerOrderId: orderId,
        providerEventId: eventId,
        providerCheckoutId: checkoutId ?? null
      }
    });

    await this.markEventProcessed(eventId, null);

    return { received: true };
  }

  private async markEventProcessed(eventId: string, error: string | null) {
    await this.prisma.paymentWebhookEvent.update({
      where: { provider_eventId: { provider: "CREEM", eventId } },
      data: {
        processedAt: new Date(),
        error
      }
    });
  }
}

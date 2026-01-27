import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { CreemService } from "./creem.service";
import { CreateCreemCheckoutDto } from "./dto/create-creem-checkout.dto";

@Controller()
export class CreemController {
  constructor(private readonly creemService: CreemService) {}

  @Post("billing/creem/checkout")
  @UseGuards(JwtAuthGuard)
  async createCheckout(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCreemCheckoutDto
  ) {
    return this.creemService.createCheckout(req.user.sub, dto);
  }

  @Post("webhooks/creem")
  async handleWebhook(@Req() req: Request) {
    const signatureHeader =
      (req.headers["creem-signature"] as string | undefined) ??
      (req.headers["Creem-Signature"] as string | undefined) ??
      null;
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    try {
      return await this.creemService.handleWebhook(rawBody, signatureHeader);
    } catch (error) {
      // Always return 200 for webhook retry safety
      console.error("Creem webhook error", error);
      return { received: true, error: true };
    }
  }
}

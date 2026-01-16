import { IsString, IsUUID } from "class-validator";

export class IntentConfirmDto {
  @IsUUID()
  @IsString()
  intentId!: string;
}

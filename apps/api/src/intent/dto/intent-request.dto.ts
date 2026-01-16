import { IsString, IsUUID } from "class-validator";

export class IntentRequestDto {
  @IsUUID()
  @IsString()
  conversationId!: string;
}

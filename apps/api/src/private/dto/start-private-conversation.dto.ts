import { IsString, IsUUID } from "class-validator";

export class StartPrivateConversationDto {
  @IsUUID()
  @IsString()
  userId!: string;
}

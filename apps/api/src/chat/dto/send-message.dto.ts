import { IsString, MinLength } from "class-validator";

export class SendMessageDto {
  @IsString()
  matchId!: string;

  @IsString()
  @MinLength(1)
  ciphertext!: string;
}

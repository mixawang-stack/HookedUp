import { IsEmail, IsString, MinLength } from "class-validator";

export class PasswordResetConfirmDto {
  @IsEmail()
  email!: string;

  @IsString()
  code!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

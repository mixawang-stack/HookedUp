import { IsBoolean, IsEmail, IsISO8601, IsOptional, IsString, Length, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsISO8601()
  dob!: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsBoolean()
  agreeTerms!: boolean;
}

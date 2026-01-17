import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  maskName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  maskAvatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  gender?: string;
}

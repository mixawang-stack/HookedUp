import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { NovelAudience, NovelStatus } from "@prisma/client";

export class AdminNovelDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(NovelStatus)
  status?: NovelStatus;

  @IsOptional()
  @IsEnum(NovelAudience)
  audience?: NovelAudience;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsString()
  authorName?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsBoolean()
  autoPostHall?: boolean;
}

import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class AdminNovelDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagsJson?: string[];

  @IsOptional()
  @IsString()
  status?: "DRAFT" | "PUBLISHED";

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

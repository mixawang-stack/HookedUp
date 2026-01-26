import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";
import {
  NovelAudience,
  NovelCategory,
  NovelPricingMode,
  NovelStatus,
  NovelSourceType
} from "@prisma/client";

export class AdminNovelDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString({ each: true })
  tagsJson?: string[];

  @IsOptional()
  @IsString({ each: true })
  contentWarningsJson?: string[];

  @IsOptional()
  @IsEnum(NovelStatus)
  status?: NovelStatus;

  @IsOptional()
  @IsEnum(NovelAudience)
  audience?: NovelAudience;

  @IsOptional()
  @IsEnum(NovelSourceType)
  sourceType?: NovelSourceType;

  @IsOptional()
  @IsEnum(NovelCategory)
  category?: NovelCategory;

  @IsOptional()
  @IsEnum(NovelPricingMode)
  pricingMode?: NovelPricingMode;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bookPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bookPromoPrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  creemProductId?: string;

  @IsOptional()
  @IsString()
  paymentLink?: string;

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
  autoHallPost?: boolean;

  @IsOptional()
  @IsBoolean()
  autoRoom?: boolean;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}

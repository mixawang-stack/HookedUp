import { Transform } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class CreateTraceDto {
  @IsString()
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsUrl({ protocols: ["http", "https"], require_tld: false })
  imageUrl?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(8000)
  imageWidth?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(8000)
  imageHeight?: number;
}

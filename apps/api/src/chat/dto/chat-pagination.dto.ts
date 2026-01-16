import { IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class ChatPaginationDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit?: number;
}

import { IsOptional, IsString, IsUUID } from "class-validator";

export class CreateCreemCheckoutDto {
  @IsUUID()
  novelId!: string;

  @IsOptional()
  @IsString()
  chapterId?: string;
}

import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateReportDto {
  @IsIn(["user", "message", "match"])
  targetType!: "user" | "message" | "match";

  @IsString()
  targetId!: string;

  @IsString()
  @MaxLength(64)
  reasonType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  detail?: string;
}

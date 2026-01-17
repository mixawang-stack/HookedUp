import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

const REPORT_REASONS = ["SPAM", "ABUSE", "HARASSMENT", "OTHER"] as const;

export class ReportUserDto {
  @IsString()
  @IsIn(REPORT_REASONS)
  reasonType!: (typeof REPORT_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string;
}

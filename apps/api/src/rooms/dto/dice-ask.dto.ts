import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class DiceAskDto {
  @IsString()
  @MaxLength(200)
  question!: string;

  @IsIn(["single", "all"])
  targetScope!: "single" | "all";

  @IsOptional()
  @IsString()
  targetId?: string;
}

import { IsIn, IsOptional, IsString } from "class-validator";

export class SetRoomGameDto {
  @IsOptional()
  @IsString()
  @IsIn(["NONE", "DICE", "ONE_THING"])
  type?: "NONE" | "DICE" | "ONE_THING";

  @IsOptional()
  @IsString()
  @IsIn(["NONE", "DICE", "ONE_THING"])
  selectedGame?: "NONE" | "DICE" | "ONE_THING";
}

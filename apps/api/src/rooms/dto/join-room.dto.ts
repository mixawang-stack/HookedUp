import { IsIn, IsOptional } from "class-validator";

export class JoinRoomDto {
  @IsOptional()
  @IsIn(["PARTICIPANT", "OBSERVER"])
  mode?: "PARTICIPANT" | "OBSERVER";
}

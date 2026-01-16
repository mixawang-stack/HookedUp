import { IsInt, IsOptional, Max, Min } from "class-validator";

export class CreateRoomShareLinkDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number;
}

import { IsIn, IsString } from "class-validator";

export class SwipeDto {
  @IsString()
  toUserId!: string;

  @IsIn(["LIKE", "PASS"])
  action!: "LIKE" | "PASS";
}

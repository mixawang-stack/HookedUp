import { IsString } from "class-validator";

export class OneThingReactDto {
  @IsString()
  emoji!: string;

  @IsString()
  targetUserId!: string;
}

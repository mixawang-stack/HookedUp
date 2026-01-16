import { IsString, MaxLength } from "class-validator";

export class OneThingShareDto {
  @IsString()
  @MaxLength(200)
  content!: string;
}

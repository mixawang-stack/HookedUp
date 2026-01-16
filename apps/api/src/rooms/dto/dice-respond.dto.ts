import { IsString, MaxLength } from "class-validator";

export class DiceRespondDto {
  @IsString()
  @MaxLength(200)
  answer!: string;
}

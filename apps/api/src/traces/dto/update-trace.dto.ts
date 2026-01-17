import { IsString, MaxLength } from "class-validator";

export class UpdateTraceDto {
  @IsString()
  @MaxLength(2000)
  content!: string;
}

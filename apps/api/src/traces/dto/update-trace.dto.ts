import { IsString, MaxLength } from "class-validator";

export class UpdateTraceDto {
  @IsString()
  @MaxLength(1000)
  content!: string;
}

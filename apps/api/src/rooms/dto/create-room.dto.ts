import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";

export class CreateRoomDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  tagsJson?: string[];

  @IsOptional()
  @IsIn(["SCHEDULED", "LIVE", "ENDED"])
  status?: "SCHEDULED" | "LIVE" | "ENDED";

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  allowSpectators?: boolean;

  @IsOptional()
  @IsInt()
  @Min(3)
  capacity?: number;
}

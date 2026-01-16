import { IsArray, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdatePreferencesDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lookingForGender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  smPreference?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagsJson?: string[];
}

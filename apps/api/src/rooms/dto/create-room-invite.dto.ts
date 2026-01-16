import { IsString, IsUUID } from "class-validator";

export class CreateRoomInviteDto {
  @IsString()
  @IsUUID()
  inviteeId!: string;
}

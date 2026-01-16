import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoomsService } from "./rooms.service";

@Controller("r")
@ApiTags("rooms")
export class RoomShareController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get(":token")
  @ApiOperation({ summary: "Resolve a share token to a roomId." })
  async resolveShareLink(@Param("token") token: string) {
    return this.roomsService.resolveShareLink(token);
  }
}

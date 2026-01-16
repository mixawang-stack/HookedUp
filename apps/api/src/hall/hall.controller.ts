import { Controller, Get } from "@nestjs/common";
import { HallService } from "./hall.service";

@Controller("hall")
export class HallController {
  constructor(private readonly hallService: HallService) {}

  @Get()
  async getHall() {
    return this.hallService.getHall();
  }
}

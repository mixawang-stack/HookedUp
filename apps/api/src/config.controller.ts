import { Controller, Get } from "@nestjs/common";

const readFlag = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }
  return value.toLowerCase() === "true";
};

@Controller("config")
export class ConfigController {
  @Get()
  getConfig() {
    return {
      FF_WORLD_06: readFlag(process.env.FF_WORLD_06, true),
      FF_ROOMS_08: readFlag(process.env.FF_ROOMS_08, false),
      FF_INTENT_12: readFlag(process.env.FF_INTENT_12, false)
    };
  }
}

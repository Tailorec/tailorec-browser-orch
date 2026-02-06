import { Logger } from "tslog";

export function createSubsystemLogger(name: string) {
  return new Logger({ name });
}

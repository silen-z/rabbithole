import { resource } from "./ecs.ts";

export const Time = resource<{ delta: number }>();

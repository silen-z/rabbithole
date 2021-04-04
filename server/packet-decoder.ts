import { PacketDecoder, Identify } from "../shared/packets.ts";

export const ServerDecoder = new PacketDecoder().register(Identify);

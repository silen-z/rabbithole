import { PacketDecoder, Identify } from "../shared/packets.ts";

type ClientPackets = Identify;

export const ServerDecoder = new PacketDecoder<ClientPackets>().register(Identify);

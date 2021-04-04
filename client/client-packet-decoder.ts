import { PacketDecoder, IdentityConfirm, IdentityReject } from "../shared/packets";

export const ClientDecoder = new PacketDecoder().register(IdentityConfirm).register(IdentityReject);

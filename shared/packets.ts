import { definePacket, EventFromDefinition } from "packet-lib";

export type Identify = EventFromDefinition<typeof Identify>;
export const Identify = definePacket(0, "IDENTIFY", {
  nickname: { type: "string" as const },
});

export type IdentityConfirm = EventFromDefinition<typeof IdentityConfirm>;
export const IdentityConfirm = definePacket(1, "IDENTITY_CONFIRM");

export type IdentityReject = EventFromDefinition<typeof IdentityReject>;
export const IdentityReject = definePacket(2, "IDENTITY_REJECT", {
  reason: { type: "string" as const },
});

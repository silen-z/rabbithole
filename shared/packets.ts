import ns from "net-serializer";

export class PacketDecoder<P = never> {
  private registered: Record<number, PacketDefinition<any>> = {};

  register<T>(definition: PacketDefinition<T>): PacketDecoder<P | T> {
    this.registered[definition.tag] = definition;
    return this;
  }

  decode(buffer: ArrayBufferLike): P {
    const tagView = new DataView(buffer, buffer.byteLength - 1, 1);
    const tag = tagView.getUint8(0);

    const definition = this.registered[tag];

    // TODO throw a propper error here
    if (definition == null) {
      throw new Error("");
    }

    const decoded = ns.unpack(buffer, definition.template);
    decoded.type = definition.tagName;
    return decoded;
  }
}

export interface PacketDefinition<T> {
  tag: number;
  tagName: string;
  template: unknown;
  (data: Omit<T, "type">): ArrayBuffer;
}

export type Identify = { type: "IDENTIFY"; nickname: string };
export const Identify = definePacket<Identify>({
  tag: 0,
  tagName: "IDENTIFY",
  template: {
    nickname: { type: "string" },
  },
});

export type IdentityConfirm = { type: "IDENTITY_CONFIRM" };
export const IdentityConfirm = definePacket<IdentityConfirm>({
  tag: 1,
  tagName: "IDENTITY_CONFIRM",
  template: {},
});

export type IdentityReject = { type: "IDENTITY_REJECT"; reason: string };
export const IdentityReject = definePacket<IdentityReject>({
  tag: 2,
  tagName: "IDENTITY_REJECT",
  template: { reason: { type: "string" } },
});

function definePacket<T>({
  tag,
  tagName,
  template,
}: {
  tag: number;
  tagName: string;
  template: unknown;
}): PacketDefinition<T> {
  function encoder(data: Omit<T, "type">) {
    const buffer = ns.pack(data, template, { freeBytes: 1 });
    const tagView = new DataView(buffer, buffer.byteLength - 1, 1);
    tagView.setUint8(0, tag);
    return buffer;
  }

  encoder.tag = tag;
  encoder.tagName = tagName;
  encoder.template = template;

  return encoder;
}

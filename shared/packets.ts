import NetSerializer from "net-serializer";

export type Identify = typeof Identify.EventType;
export const Identify = definePacket(0, "IDENTIFY", {
  nickname: { type: "string" as "string" },
});

export type IdentityConfirm = typeof IdentityConfirm.EventType;
export const IdentityConfirm = definePacket(1, "IDENTITY_CONFIRM");

export type IdentityReject = typeof IdentityReject.EventType;
export const IdentityReject = definePacket(2, "IDENTITY_REJECT", {
  reason: { type: "string" as "string" },
});

// =========================================================//
//             Can't believe all of this works              //
//==========================================================//

export function definePacket<E extends string, T>(tag: number, eventName: E): EmptyPacketDefinition<E>;
export function definePacket<E extends string, T>(tag: number, eventName: E, template: T): DataPacketDefinition<E, T>;
export function definePacket<E, T>(tag: number, eventName: E, template?: T): PacketDefinition<E> {
  let encoder: any;

  if (template != null) {
    encoder = (data: any) => {
      const buffer = NetSerializer.pack(data, template, { freeBytes: 1 });
      const tagView = new DataView(buffer, buffer.byteLength - 1, 1);
      tagView.setUint8(0, tag);
      return buffer;
    };
  } else {
    encoder = () => Uint8Array.from([tag]).buffer;
  }

  encoder.tag = tag;
  encoder.eventName = eventName;
  encoder.template = template;

  return encoder;
}

export class PacketDecoder<P = never> {
  private registered: Record<number, PacketDefinition<any>> = {};

  register<T extends PacketDefinition<any>>(definition: T): PacketDecoder<P | T["EventType"]> {
    this.registered[definition.tag] = definition;
    return this;
  }

  decode(buffer: ArrayBufferLike): P {
    const tagView = new DataView(buffer, buffer.byteLength - 1, 1);
    const tag = tagView.getUint8(0);

    const definition = this.registered[tag];

    // TODO throw a propper error here
    if (definition == null) {
      throw new Error("missing packet definition");
    }

    if (definition.template != null) {
      return {
        type: definition.eventName,
        ...NetSerializer.unpack(buffer, definition.template),
      };
    }

    return { type: definition.eventName } as any;
  }
}

interface PacketDefinition<E> {
  tag: number;
  eventName: E;
  template?: unknown;
  EventType: unknown;
}

interface DataPacketDefinition<E, T> extends PacketDefinition<E> {
  template: T;
  EventType: TemplateToEvent<E, T>;
  (data: Omit<TemplateToEvent<E, T>, "type">): ArrayBuffer;
}

interface EmptyPacketDefinition<E> extends PacketDefinition<E> {
  EventType: { type: E };
  (): ArrayBuffer;
}

type TemplateToEvent<E, T> = { type: E } & {
  [K in keyof T]: TemplateTypeToEvent<T[K]>;
};

type TemplateTypeToEvent<T> = T extends { type: any }
  ? T extends { type: "string" }
    ? string
    : T extends { type: "number" }
    ? number
    : T extends { type: "boolean" }
    ? boolean
    : never
  : T extends Array<infer E>
  ? Array<TemplateTypeToEvent<E>>
  : { [P in keyof T]: TemplateTypeToEvent<T[P]> };

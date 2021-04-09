import NetSerializer from "net-serializer";

export function definePacket<E extends string, T>(tag: PacketTag, eventName: E): EmptyPacketDefinition<E>;
export function definePacket<E extends string, T>(
  tag: PacketTag,
  eventName: E,
  template: T
): DataPacketDefinition<E, T>;
export function definePacket<E, T>(tag: PacketTag, eventName: E, template?: T): PacketDefinition<E, T> {
  if (template == null) {
    return Object.assign(() => Uint8Array.from([tag]).buffer, { tag, eventName });
  }

  return Object.assign(
    (data: Omit<TemplateToEvent<E, T>, "type">) => {
      const buffer = NetSerializer.pack(data, template, { freeBytes: 1 });
      const tagView = new DataView(buffer, buffer.byteLength - 1, 1);
      tagView.setUint8(0, tag);
      return buffer;
    },
    { tag, eventName, template }
  );
}

export class PacketDecoder<P = never> {
  private registered: Partial<Record<PacketTag, PacketDefinition<unknown, unknown>>> = {};

  register<D extends PacketDefinition<unknown, unknown>>(
    definition: D
  ): PacketDecoder<P | EventFromDefinition<typeof definition>> {
    this.registered[definition.tag] = definition;
    return this;
  }

  decode(buffer: ArrayBufferLike): P {
    const tagView = new DataView(buffer, buffer.byteLength - 1, 1);
    const tag = tagView.getUint8(0) as PacketTag;

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

    return ({ type: definition.eventName } as unknown) as P;
  }
}

interface PacketDefinition<E, T> {
  tag: PacketTag;
  eventName: E;
  template?: T;
}

interface DataPacketDefinition<E, T> extends PacketDefinition<E, T> {
  template: T;
  (data: Omit<TemplateToEvent<E, T>, "type">): ArrayBuffer;
}

interface EmptyPacketDefinition<E> extends PacketDefinition<E, undefined> {
  (): ArrayBuffer;
}

export type EventFromDefinition<P extends PacketDefinition<unknown, unknown>> = TemplateToEvent<
  P["eventName"],
  P["template"]
>;

type TemplateToEvent<E, T> = T extends undefined
  ? { type: E }
  : { type: E } & {
      [K in keyof T]: TemplateTypeToEvent<T[K]>;
    };

type TypeDef<T extends string> = {
  type: T;
};

type TemplateTypeToEvent<T> = T extends TypeDef<string>
  ? T extends TypeDef<"string">
    ? string
    : T extends TypeDef<"int8" | "uint8" | "int16" | "uint16" | "int32" | "uint32" | "float32">
    ? number
    : T extends TypeDef<"boolean">
    ? boolean
    : T["type"]
  : T extends Array<infer E>
  ? Array<TemplateTypeToEvent<E>>
  : { [P in keyof T]: TemplateTypeToEvent<T[P]> };

// prettier-ignore
type PacketTag =
  |   0 |   1 |   2 |   3 |   4 |   5 |   6 |   7 |   8 |   9  | 10 |  11 |  12 |  13 |  14 |  15 
  |  16 |  17 |  18 |  19 |  20 |  21 |  22 |  23 |  24 |  25 |  26 |  27 |  28 |  29 |  30 |  31 
  |  32 |  33 |  34 |  35 |  36 |  37 |  38 |  39 |  40 |  41 |  42 |  43 |  44 |  45 |  46 |  47 
  |  48 |  49 |  50 |  51 |  52 |  53 |  54 |  55 |  56 |  57 |  58 |  59 |  60 |  61 |  62 |  63 
  |  64 |  65 |  66 |  67 |  68 |  69 |  70 |  71 |  72 |  73 |  74 |  75 |  76 |  77 |  78 |  79 
  |  80 |  81 |  82 |  83 |  84 |  85 |  86 |  87 |  88 |  89 |  90 |  91 |  92 |  93 |  94 |  95 
  |  96 |  97 |  98 |  99 | 100 | 101 | 102 | 103 | 104 | 105 | 106 | 107 | 108 | 109 | 110 | 111 
  | 112 | 113 | 114 | 115 | 116 | 117 | 118 | 119 | 120 | 121 | 122 | 123 | 124 | 125 | 126 | 127 
  | 128 | 129 | 130 | 131 | 132 | 133 | 134 | 135 | 136 | 137 | 138 | 139 | 140 | 141 | 142 | 143 
  | 144 | 145 | 146 | 147 | 148 | 149 | 150 | 151 | 152 | 153 | 154 | 155 | 156 | 157 | 158 | 159 
  | 160 | 161 | 162 | 163 | 164 | 165 | 166 | 167 | 168 | 169 | 170 | 171 | 172 | 173 | 174 | 175 
  | 176 | 177 | 178 | 179 | 180 | 181 | 182 | 183 | 184 | 185 | 186 | 187 | 188 | 189 | 190 | 191 
  | 192 | 193 | 194 | 195 | 196 | 197 | 198 | 199 | 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207 
  | 208 | 209 | 210 | 211 | 212 | 213 | 214 | 215 | 216 | 217 | 218 | 219 | 220 | 221 | 222 | 223 
  | 224 | 225 | 226 | 227 | 228 | 229 | 230 | 231 | 232 | 233 | 234 | 235 | 236 | 237 | 238 | 239 
  | 240 | 241 | 242 | 243 | 244 | 245 | 246 | 247 | 248 | 249 | 250 | 251 | 252 | 253 | 254 | 255;

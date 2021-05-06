type MaybeUninitialized<T> = {
  [K in keyof T]: T[K] | undefined;
};

const EMPTY_SLOT = Object.freeze(Object.create(null));

export class ObjectPool<O, A extends any[]> {
  private pool: MaybeUninitialized<O>[] = [];
  private nextFreeSlot: number | null = null;

  constructor(
    private create: () => MaybeUninitialized<O>,
    private setup: (obj: O, ...args: A) => void,
    private clear?: (obj: O) => void
  ) {}

  get(...args: A): O {
    if (this.nextFreeSlot === null || this.nextFreeSlot === this.pool.length) {
      this.grow(this.pool.length || 5);
    }

    var objToUse = this.pool[this.nextFreeSlot!];
    this.pool[this.nextFreeSlot!++] = EMPTY_SLOT as any;
    this.setup(objToUse as O, ...args);
    return objToUse as O;
  }

  recycle(obj: O): void {
    this.clear?.(obj);
    if (this.nextFreeSlot == null || this.nextFreeSlot == -1) {
      this.pool[this.pool.length] = obj as MaybeUninitialized<O>;
    } else {
      this.pool[--this.nextFreeSlot] = obj as MaybeUninitialized<O>;
    }
  }

  private grow(n = this.pool.length): number {
    if (n > 0 && this.nextFreeSlot == null) {
      this.nextFreeSlot = 0;
    }

    if (n > 0) {
      const curLen = this.pool.length;
      this.pool.length += n;

      for (let i = curLen; i < this.pool.length; i++) {
        this.pool[i] = this.create();
      }
    }

    return this.pool.length;
  }
}

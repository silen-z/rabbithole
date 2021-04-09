export function swapRemove<T>(array: Array<T>, index: number): T {
  if (index >= array.length) {
    throw Error("index out of bounds");
  }

  const removed = array[index]!;
  array[index] = array[array.length - 1]!;
  array.length = array.length - 1;
  return removed;
}

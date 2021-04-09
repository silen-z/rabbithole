import { assertEquals, assertThrows } from "https://deno.land/std@0.92.0/testing/asserts.ts";
import { swapRemove, findSingleDiff } from "./utils.ts";

Deno.test("swapRemove", () => {
  assertThrows(() => {
    swapRemove([], 1);
  });

  assertThrows(() => {
    swapRemove([1, 2, 3], 3);
  });

  const a1 = [1, 2, 3, 4];
  assertEquals(swapRemove(a1, 1), 2);
  assertEquals(a1, [1, 4, 3]);
});

Deno.test("findSingleDiff", () => {
  assertEquals(findSingleDiff(new Set([1, 5, 6]), new Set([1, 5, 8])), null);
  assertEquals(findSingleDiff(new Set([1, 5, 6]), new Set([1, 5])), 6);
  assertEquals(findSingleDiff(new Set([5, 1, 6]), new Set([5, 6])), 1);
});

import { assertEquals } from "https://deno.land/std@0.95.0/testing/asserts.ts";
import { World, component } from "./ecs.ts";

Deno.test("random access", () => {
  const w = new World();

  const C1 = component<{ val: string }>();
  const C2 = component<number>();
  const C3 = component<boolean>();

  const e1 = w.spawn(C1({ val: "abc" }), C2(123));
  const e2 = w.spawn(C1({ val: "def" }), C2(456), C3(true));

  assertEquals(w.get(e1, C1), { val: "abc" });
  assertEquals(w.get(e1, C2), 123);
  assertEquals(w.get(e2, C1), { val: "def" });
  assertEquals(w.get(e2, C2), 456);

  // mutation
  const c = w.get(e1, C1)!;
  c.val = "xyz";
  assertEquals(w.get(e1, C1), { val: "xyz" });
});

// Deno.test("queries", () => {
//   const w = new World();

//   const C1 = component<{ val: string }>();
//   const C2 = component<number>();
//   const C3 = component<boolean>();

//   const e1 = w.spawn(C1({ val: "abc" }), C2(123));
//   const e2 = w.spawn(C1({ val: "def" }), C2(456), C3(true));

// });

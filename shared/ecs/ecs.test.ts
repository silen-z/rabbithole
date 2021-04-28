import { assertEquals } from "https://deno.land/std@0.95.0/testing/asserts.ts";
import { World, component, system, entity } from "../ecs.ts";

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

Deno.test("queries", () => {
  const w = new World();

  const C1 = component<number>();
  const C2 = component<{ val: string }>();
  const C3 = component<boolean>();

  const queried: number[] = [];

  const s = system()
    .query(entity, C1, C2)
    .fn((_, q) => {
      for (const [e, c1, c2] of q) {
        queried.push(c1);
      }
    });

  w.withSystem(s);

  w.spawn(C1(123));
  w.spawn(C1(456), C2({ val: "abc" }));
  w.spawn(C1(789), C2({ val: "def" }), C3(true));

  w.execute();

  assertEquals(queried, [456, 789]);
});

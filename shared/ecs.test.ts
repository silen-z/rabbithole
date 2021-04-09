import { assertEquals, assertThrows, assertArrayIncludes } from "https://deno.land/std@0.92.0/testing/asserts.ts";
import { World, component } from "./ecs.ts";

const Position = component<{ x: number; y: number }>("Position");
const Velocity = component<number>();

Deno.test("can't register component twice", () => {
  const w = new World();

  w.registerComponent(Position);

  assertThrows(() => {
    w.registerComponent(Position);
  });
});

Deno.test("insert and get component", () => {
  const w = new World();
  const e = w.spawn();

  const p1 = Position({ x: 1, y: 2 });

  w.insert(e, p1, Velocity(2));

  assertEquals(p1[1], w.get(e, Position));
});

Deno.test("simple queries", () => {
  const w = new World();

  const e1 = w.spawn();
  w.insert(e1, Velocity(1));

  const e2 = w.spawn();
  w.insert(e2, Position({ x: 1, y: 2 }), Velocity(2));

  const vs = [];
  for (const v of w.query(Velocity)) {
    vs.push(v);
  }

  // assertEquals(vs.length, 2);
  assertArrayIncludes(vs, [1, 2]);
});

// for (const [p1, p2] of world.query(Position, Velocity)) {
// }

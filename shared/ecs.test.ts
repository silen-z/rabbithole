import { assertEquals, assertThrows, assertArrayIncludes } from "https://deno.land/std@0.92.0/testing/asserts.ts";
import { World, component, system, Entity } from "./ecs.ts";

const Position = component<{ x: number; y: number }>("Position");
const Velocity = component<number>("Velocity");
const Third = component<boolean>("Third");


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

  assertEquals(p1.data, w.get(e, Position));
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

  assertArrayIncludes(vs, [1, 2]);
});

Deno.test("systems", () => {
  const world = new World();

  world.spawn(Velocity(1));
  world.spawn(Velocity(2));
  world.spawn(Velocity(3), Position({ x: 81, y: 42 }));
  world.spawn(Position({ x: 57, y: 22 }));
  world.spawn(Third(true));
  world.spawn(Third(true), Position({ x: 81, y: 42 }) );

  const iterated: number[] = [];

  const TestSystem = system.query(Velocity).fn((w, velocity) => {
    for (const v of velocity) {
      iterated.push(v);
    }
  });

  world.registerSystem(TestSystem);

  const iteratedEntities = [];

  const TestEntitySystem = system.query(Entity).fn((w, entities) => {
    for (const e of entities) {
      iteratedEntities.push(e);
    }
  });

  world.registerSystem(TestEntitySystem);

  world.execute(1);

  assertEquals(iterated, [1, 2, 3]);
  assertEquals(iteratedEntities.length, 4);
});

// TODO implement proper tag components
Deno.test("defining and creating empty component", () => {
  const Tag = component();
  const w = new World();
  const e = w.spawn(Tag(53));

  const c = w.get(e, Tag);
});

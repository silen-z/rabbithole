interface Task {
  remaining: number;
  fn: () => void;
}

export class TickScheduler {
  lastId = 0;
  tasks: Map<number, Task> = new Map();

  setTimeout(fn: () => void, timeout: number): number {
    this.tasks.set(this.lastId, { fn, remaining: timeout });
    return this.lastId++;
  }

  clearTimeout(id: number) {
    this.tasks.delete(id);
  }

  tick(dt: number) {
    for (const [id, task] of this.tasks) {
      task.remaining -= dt;
      if (task.remaining < 0) {
        task.fn();
        this.tasks.delete(id);
      }
    }
  }
}

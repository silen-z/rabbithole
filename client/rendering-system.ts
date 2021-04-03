import { Component, System, Types } from "ecsy";
import * as PIXI from "pixi.js";

export class Sprite extends Component<Sprite> {
  handle: PIXI.Sprite;
}
Sprite.schema = {
  handle: { type: Types.Ref },
};

export class RenderingSystem extends System {
  stage: PIXI.Container;
  init(attr) {
    this.stage = attr.stage;
  }

  execute() {
    for (const added of this.queries.sprites.added) {
      let sprite = added.getComponent(Sprite);
      this.stage.addChild(sprite.handle);
    }

    for (const removed of this.queries.sprites.removed) {
      let sprite = removed.getComponent(Sprite);
      this.stage.removeChild(sprite.handle);
    }
  }
}

RenderingSystem.queries = {
  sprites: {
    components: [Sprite],
    listen: {
      added: true,
      removed: true,
    },
  },
};

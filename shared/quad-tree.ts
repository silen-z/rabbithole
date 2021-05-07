import {
  Rectangle,
  rectContainsPoint,
  rectContainsRect,
  rectIntersectsRect,
  Circle,
  circleContainsRect,
  circleIntersectsRect,
  Rectangles,
} from "./math.ts";
import { ObjectPool } from "./object-pool.ts";

export type QuadTree<T> = {
  depth: number;
  data: T;
  area: Rectangle;
  subTree?: QuadTree<T>[];
};

export const QuadTrees = new ObjectPool(
  () => ({ area: undefined, depth: undefined, data: undefined, subTree: undefined }),
  <T>(qt: QuadTree<T>, area: Rectangle, depth: number, data: T) => {
    qt.area = area;
    qt.depth = depth;
    qt.data = data;
    qt.subTree = undefined;
  },
  (qt: QuadTree<unknown>) => {
    Rectangles.recycle(qt.area);
    if (qt.subTree != null) {
      for (const st of qt.subTree) {
        QuadTrees.recycle(st);
      }
    }
  }
);

export function updateRectangle<T>(quadTree: QuadTree<T>, area: Rectangle, data: T) {
  if (rectContainsRect(area, quadTree.area)) {
    foldSubTreesToParent(quadTree, data);
    return;
  }
  if (rectIntersectsRect(quadTree.area, area) || rectContainsRect(quadTree.area, area)) {
    updateSubtrees(quadTree, data, (tree: QuadTree<T>, data: T) => {
      updateRectangle(tree, area, data);
    });
  }
}

export function updateCircle<T>(quadTree: QuadTree<T>, c: Circle, data: T) {
  if (circleContainsRect(c, quadTree.area)) {
    foldSubTreesToParent(quadTree, data);
    return;
  }
  if (circleIntersectsRect(c, quadTree.area) || rectContainsPoint(quadTree.area, c.x, c.y)) {
    updateSubtrees(quadTree, data, (tree: QuadTree<T>, data: T) => {
      updateCircle(tree, c, data);
    });
  }
}

export function traverseQuadTree<T>(quadTree: QuadTree<T>, callback: (area: Rectangle, data: T) => void) {
  if (quadTree.subTree != null) {
    for (const q of quadTree.subTree) {
      traverseQuadTree(q, callback);
    }
  } else {
    callback(quadTree.area, quadTree.data);
  }
}

function updateSubtrees<T>(quadTree: QuadTree<T>, dataToUpdate: T, callback: (tree: QuadTree<T>, data: T) => void) {
  if (quadTree.depth > 0) {
    if (quadTree.subTree == null) {
      split(quadTree);
    }

    for (const tree of quadTree.subTree!) {
      callback(tree, dataToUpdate);
    }

    // At this point, all sub trees has been updated.
    // Check whether all subtrees hold the same value
    // If they do, they are redundant and can be represent by using only parent tree.
    // So fold them back to parent tree
    clearRedendantSubTrees(quadTree);
  } else {
    foldSubTreesToParent(quadTree, dataToUpdate);
  }
}

function foldSubTreesToParent<T>(quadTree: QuadTree<T>, data: T) {
  if (quadTree.subTree != null) {
    for (const st of quadTree.subTree) {
      QuadTrees.recycle(st);
    }
    quadTree.subTree = undefined;
  }
  quadTree.data = data;
}

const WH = [
  { w: 0, h: 0 },
  { w: 1, h: 0 },
  { w: 0, h: 1 },
  { w: 1, h: 1 },
];

function split<T>(quadTree: QuadTree<T>) {
  quadTree.subTree = [];
  for (const o of WH) {
    quadTree.subTree.push(
      QuadTrees.get(
        Rectangles.get(
          quadTree.area.x + (quadTree.area.w / 2) * o.w,
          quadTree.area.y + (quadTree.area.h / 2) * o.h,
          quadTree.area.w / 2,
          quadTree.area.h / 2
        ),
        quadTree.depth - 1,
        quadTree.data
      )
    );
  }
}

function clearRedendantSubTrees<T>(quadTree: QuadTree<T>) {
  let toCompare: T | null = null;
  for (const t of quadTree.subTree!) {
    if (t.subTree != null) {
      return;
    }
    if (toCompare == null) {
      toCompare = t.data;
    } else if (toCompare !== t.data) {
      return;
    }
  }
  // All sub trees don't contain any sub-sub trees and have the same node data.
  foldSubTreesToParent(quadTree, toCompare!);
}

//   public area(_fraction: number, _matchFunc: (_data1: T) => boolean): number {
//     if (_matchFunc == null) return 0;
//     if (this.dataSubTree == null) return _matchFunc(this.dataNode) ? _fraction : 0;
//     else {
//       var sum: number = 0;
//       for (var i = 0; i < this.dataSubTree.length; i++) {
//         var t = this.dataSubTree[i];
//         sum += t.area(_fraction * 0.25, _matchFunc);
//       }
//       return sum;
//     }
//   }

//   public updateWithLine(_x1: number, _y1: number, _x2: number, _y2: number, _w: number, _dataChangeOnContain: T) {
//     var theta = Math.atan((_y2 - _y1) / (_x2 - _x1));
//     var p1 = new Phaser.Geom.Rectangle(_x1 - (Math.sin(theta) * _w) / 2, _y1 + (Math.cos(theta) * _w) / 2);
//     var p2 = new Phaser.Geom.Rectangle(_x1 + (Math.sin(theta) * _w) / 2, _y1 - (Math.cos(theta) * _w) / 2);
//     var p3 = new Phaser.Geom.Rectangle(_x2 + (Math.sin(theta) * _w) / 2, _y2 - (Math.cos(theta) * _w) / 2);
//     var p4 = new Phaser.Geom.Rectangle(_x2 - (Math.sin(theta) * _w) / 2, _y2 + (Math.cos(theta) * _w) / 2);
//     var tr1 = new Phaser.Geom.Triangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
//     var tr2 = new Phaser.Geom.Triangle(p1.x, p1.y, p3.x, p3.y, p4.x, p4.y);
//     this.updateWithTriangle(tr1, _dataChangeOnContain);
//     this.updateWithTriangle(tr2, _dataChangeOnContain);
//   }

//   public updateWithTriangle(_g: Phaser.Geom.Triangle, _dataChangeOnContain: T) {
//     if (
//       Phaser.Geom.Triangle.Contains(_g, this.dataRect.x, this.dataRect.y) &&
//       Phaser.Geom.Triangle.Contains(_g, this.dataRect.x + this.dataRect.width, this.dataRect.y) &&
//       Phaser.Geom.Triangle.Contains(_g, this.dataRect.x, this.dataRect.y + this.dataRect.height) &&
//       Phaser.Geom.Triangle.Contains(_g, this.dataRect.x + this.dataRect.width, this.dataRect.y + this.dataRect.height)
//     ) {
//       this.foldSubTreesToParent(_dataChangeOnContain);
//       return;
//     }
//     if (
//       Phaser.Geom.Intersects.RectangleToTriangle(this.dataRect, _g) ||
//       (Phaser.Geom.Rectangle.Contains(this.dataRect, _g.x1, _g.y1) &&
//         Phaser.Geom.Rectangle.Contains(this.dataRect, _g.x2, _g.y2) &&
//         Phaser.Geom.Rectangle.Contains(this.dataRect, _g.x3, _g.y3))
//     ) {
//       this.updateSubtrees(_dataChangeOnContain, function (_tree: FkQuadTree<T>, _data: T) {
//         _tree.updateWithTriangle(_g, _data);
//       });
//     }
//   }

//   public updateWithQuadTree(_g: FkQuadTree<T>, _updateDataFunc: (_data: T) => T) {
//     if (_g.dataSubTree == null) {
//       var data = _updateDataFunc(_g.dataNode);
//       if (data != null) this.updateWithRectangle(_g.dataRect, data);
//     } else {
//       for (var i = 0; i < _g.dataSubTree.length; i++) {
//         var t = _g.dataSubTree[i];
//         this.updateWithQuadTree(t, _updateDataFunc);
//       }
//     }
//   }

//   public collisionWithPoint(_g: Phaser.Geom.Point, _sData: T): boolean {
//     if (!this.dataRect.contains(_g.x, _g.y)) return false;
//     if (this.dataSubTree != null) {
//       var b = false;
//       for (var i = 0; i < this.dataSubTree.length; i++) {
//         b = b || this.dataSubTree[i].collisionWithPoint(_g, _sData);
//       }
//       return b;
//     } else return _.isEqual(this.dataNode, _sData);
//   }

//   public collisionWithMovingPoint(_g1: Phaser.Geom.Point, _g2: Phaser.Geom.Point, _sData: T): Phaser.Geom.Point {
//     var targetLine = new Phaser.Geom.Line(_g1.x, _g1.y, _g2.x, _g2.y);
//     // If it doesn't intersect, skip it
//     if (_.isEqual(_sData, this.dataNode) && !Phaser.Geom.Intersects.LineToRectangle(targetLine, this.dataRect))
//       return null;
//     var p_min: Phaser.Geom.Point = null;
//     var len_min: number = Number.MAX_VALUE;
//     // only if it doesn't have sub tree
//     if (this.dataSubTree == null) {
//       if (!_.isEqual(_sData, this.dataNode)) return null;
//       var lines = [];
//       lines.push(this.dataRect.getLineA());
//       lines.push(this.dataRect.getLineB());
//       lines.push(this.dataRect.getLineC());
//       lines.push(this.dataRect.getLineD());
//       for (var i = 0; i < lines.length; i++) {
//         var l = lines[i];
//         var tmpP = new Phaser.Geom.Point(0, 0);
//         var b = Phaser.Geom.Intersects.LineToLine(targetLine, l, tmpP);
//         if (b) {
//           // get min length, if it's smaller than current min, then save the point and the min value
//           var len = (tmpP.x - _g1.x) * (tmpP.x - _g1.x) + (tmpP.y - _g1.y) * (tmpP.y - _g1.y);
//           if (len < len_min) {
//             len_min = len;
//             p_min = tmpP;
//           }
//         }
//       }
//       return p_min;
//     } else {
//       for (var j = 0; j < this.dataSubTree.length; j++) {
//         var st = this.dataSubTree[j];
//         var tmpP = st.collisionWithMovingPoint(_g1, _g2, _sData);
//         if (tmpP != null) {
//           // get min length, if it's smaller than current min, then save the point and the min value
//           var len = (tmpP.x - _g1.x) * (tmpP.x - _g1.x) + (tmpP.y - _g1.y) * (tmpP.y - _g1.y);
//           if (len < len_min) {
//             len_min = len;
//             p_min = tmpP;
//           }
//         }
//       }
//       return p_min;
//     }
//     // If it has sub tree for all collision points find the closest one in the sub tree.
//     return null;
//   }

//   public collisionWithQuadTree(_offset: Phaser.Geom.Point, _g: FkQuadTree<T>, _sData: T): boolean {
//     return false;
//   }

//   public collisionWithMovingQuadTree(
//     _offset1: Phaser.Geom.Point,
//     _offset2: Phaser.Geom.Point,
//     _g: FkQuadTree<T>,
//     _sData: T
//   ): Phaser.Geom.Point[] {
//     return null;
//   }

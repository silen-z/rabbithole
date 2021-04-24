export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function createRect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, w: width, h: height };
}

export function rectContainsRect(r1: Rect, r2: Rect): boolean {
  if (r2.w * r2.h > r1.w * r1.h) {
    return false;
  }

  return (
    r2.x > r1.x &&
    r2.x < r1.x + r1.w &&
    r2.x + r2.w > r1.x &&
    r2.x + r2.w < r1.x + r1.w &&
    r2.y > r1.y &&
    r2.y < r1.y + r1.h &&
    r2.y + r2.h > r1.y &&
    r2.y + r2.h < r1.y + r1.h
  );
}

export function rectIntersectsRect(r1: Rect, r2: Rect): boolean {
  return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
}

export function rectContainsPoint(rect: Rect, x: number, y: number): boolean {
  return x > rect.x && x < rect.x + rect.w && y > rect.y && y < rect.y + rect.h;
}

export const Rect = (() =>
  Object.assign(createRect, {
    intersects: {
      rect: rectIntersectsRect,
    },
    contains: {
      rect: rectContainsRect,
      point: rectContainsPoint,
    },
  }))();

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export function circleContainsPoint(c: Circle, x: number, y: number): boolean {
  return c.r > 0 && x >= c.x - c.r && x <= c.x + c.r && y >= c.y - c.r && y <= c.y + c.r;
}

export function circleContainsRect(c: Circle, r: Rect): boolean {
  return (
    circleContainsPoint(c, r.x, r.y) &&
    circleContainsPoint(c, r.x + r.w, r.y) &&
    circleContainsPoint(c, r.x, r.y + r.h) &&
    circleContainsPoint(c, r.x + r.w, r.y + r.h)
  );
}

export function circleIntersectsRect(circle: Circle, rect: Rect) {
  const halfWidth = rect.w / 2;
  const halfHeight = rect.h / 2;

  const cx = Math.abs(circle.x - rect.x - halfWidth);
  const cy = Math.abs(circle.y - rect.y - halfHeight);
  const xDist = halfWidth + circle.r;
  const yDist = halfHeight + circle.r;

  if (cx > xDist || cy > yDist) {
    return false;
  } else if (cx <= halfWidth || cy <= halfHeight) {
    return true;
  } else {
    const xCornerDist = cx - halfWidth;
    const yCornerDist = cy - halfHeight;
    const xCornerDistSq = xCornerDist * xCornerDist;
    const yCornerDistSq = yCornerDist * yCornerDist;
    const maxCornerDistSq = circle.r * circle.r;

    return xCornerDistSq + yCornerDistSq <= maxCornerDistSq;
  }
}

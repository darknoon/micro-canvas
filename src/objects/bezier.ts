import { CanvasObject } from '../canvas';
import { Point2D, AABB } from '../geom';

export type BezierControlPoint =
  | { type: 'lineTo'; x: number; y: number }
  | { type: 'quadraticCurveTo'; x: number; y: number; controlX: number; controlY: number };

export class Bezier implements CanvasObject {
  constructor(public id: number) {}

  public translation: Point2D = { x: 0, y: 0 };

  private controlPoints: BezierControlPoint[] = [
    // Head
    { type: 'lineTo', x: 50, y: 100 },
    { type: 'quadraticCurveTo', x: 80, y: 60, controlX: 60, controlY: 70 },
    { type: 'quadraticCurveTo', x: 100, y: 100, controlX: 100, controlY: 80 },
    // Neck
    { type: 'quadraticCurveTo', x: 150, y: 150, controlX: 120, controlY: 110 },
    // Back
    { type: 'quadraticCurveTo', x: 300, y: 120, controlX: 250, controlY: 100 },
    // Tail
    { type: 'quadraticCurveTo', x: 320, y: 80, controlX: 310, controlY: 100 },
    // Hind legs
    { type: 'lineTo', x: 280, y: 250 },
    { type: 'lineTo', x: 260, y: 250 },
    { type: 'lineTo', x: 240, y: 150 },
    // Belly
    { type: 'quadraticCurveTo', x: 120, y: 180, controlX: 180, controlY: 200 },
    // Front legs
    { type: 'lineTo', x: 100, y: 250 },
    { type: 'lineTo', x: 80, y: 250 },
    { type: 'lineTo', x: 50, y: 100 },
  ];

  get boundingBox(): AABB {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of this.controlPoints) {
      if (point.type === 'lineTo') {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      } else if (point.type === 'quadraticCurveTo') {
        minX = Math.min(minX, point.x, point.controlX);
        minY = Math.min(minY, point.y, point.controlY);
        maxX = Math.max(maxX, point.x, point.controlX);
        maxY = Math.max(maxY, point.y, point.controlY);
      }
    }
    return {
      x: this.translation.x + minX,
      y: this.translation.y + minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.translation.x, this.translation.y);
    ctx.beginPath();
    for (const point of this.controlPoints) {
      if (point.type === 'lineTo') {
        ctx.lineTo(point.x, point.y);
      } else if (point.type === 'quadraticCurveTo') {
        ctx.quadraticCurveTo(point.controlX, point.controlY, point.x, point.y);
      }
    }
    ctx.strokeStyle = 'black';
    ctx.stroke();
    ctx.closePath();
    ctx.restore();
  }
}

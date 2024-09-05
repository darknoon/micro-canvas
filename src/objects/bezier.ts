import { MultiArray } from '../multiArray';
import { CanvasObject } from '../canvas';
import { Point2D, AABB } from '../geom';

export type BezierControlPoint =
  | { type: 'lineTo'; x: number; y: number }
  | { type: 'quadraticCurveTo'; x: number; y: number; controlX: number; controlY: number }
  | {
      type: 'cubicCurveTo';
      x: number;
      y: number;
      controlX1: number;
      controlY1: number;
      controlX2: number;
      controlY2: number;
    }
  | { type: 'closePath' };

/** We need an idea of which control points are selected during editing.
 * Each entry is a tuple of whether each of the subpoints are selected.
 * eg, for a lineTo point, the tuple is [true, false, false] (false === unused or not selected)
 */
export type BezierSubselection = MultiArray<boolean>;

export class Bezier implements CanvasObject {
  constructor(public id: number) {}

  public translation: Point2D = { x: 0, y: 0 };

  public controlPoints: BezierControlPoint[] = [
    // Head
    { type: 'lineTo', x: 50, y: 100 },
    {
      type: 'cubicCurveTo',
      x: 80,
      y: 60,
      controlX1: 63,
      controlY1: 77,
      controlX2: 73,
      controlY2: 67,
    },
    {
      type: 'cubicCurveTo',
      x: 100,
      y: 100,
      controlX1: 93,
      controlY1: 87,
      controlX2: 100,
      controlY2: 93,
    },
    // Neck
    {
      type: 'cubicCurveTo',
      x: 150,
      y: 150,
      controlX1: 113,
      controlY1: 117,
      controlX2: 133,
      controlY2: 137,
    },
    // Back
    {
      type: 'cubicCurveTo',
      x: 300,
      y: 120,
      controlX1: 233,
      controlY1: 133,
      controlX2: 267,
      controlY2: 123,
    },
    // Tail
    {
      type: 'cubicCurveTo',
      x: 320,
      y: 80,
      controlX1: 307,
      controlY1: 107,
      controlX2: 317,
      controlY2: 93,
    },
    // Hind legs
    { type: 'lineTo', x: 280, y: 250 },
    { type: 'lineTo', x: 260, y: 250 },
    { type: 'lineTo', x: 240, y: 150 },
    // Belly
    {
      type: 'cubicCurveTo',
      x: 120,
      y: 180,
      controlX1: 167,
      controlY1: 193,
      controlX2: 140,
      controlY2: 187,
    },
    // Front legs
    { type: 'lineTo', x: 100, y: 250 },
    { type: 'lineTo', x: 80, y: 250 },
    { type: 'closePath' },
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
      } else if (point.type === 'cubicCurveTo') {
        ctx.bezierCurveTo(
          point.controlX1,
          point.controlY1,
          point.controlX2,
          point.controlY2,
          point.x,
          point.y
        );
      } else if (point.type === 'closePath') {
        ctx.closePath();
      }
    }
    const currentColor = getComputedStyle(ctx.canvas).getPropertyValue('color');
    ctx.fillStyle = currentColor;
    // ctx.stroke();
    ctx.fill();
    ctx.closePath();
    ctx.restore();
  }
}

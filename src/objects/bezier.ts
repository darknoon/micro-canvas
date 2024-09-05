import { MultiArray } from '../multiArray';
import { CanvasObject } from '../canvas';
import { Point2D, AABB } from '../geom';
import { Bezier } from 'bezier-js';

export type BezierControlPoint =
  | { type: 'moveTo'; x: number; y: number }
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

export class PathLayer implements CanvasObject {
  constructor(public id: number) {}

  public translation: Point2D = { x: 0, y: 0 };

  private _controlPoints: BezierControlPoint[] = [
    // Head
    { type: 'moveTo', x: 50, y: 100 },
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

  private _boundingBox: AABB | undefined;

  public get controlPoints(): BezierControlPoint[] {
    return this._controlPoints;
  }

  public set controlPoints(value: BezierControlPoint[]) {
    this._controlPoints = value;
    this._boundingBox = undefined;
  }

  get boundingBox(): AABB {
    // TODO: cache
    if (!this._boundingBox) {
      this._boundingBox = calcBoundingBox(this.controlPoints);
    }
    const { x, y, width, height } = this._boundingBox;
    return { x: x + this.translation.x, y: y + this.translation.y, width, height };
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.translation.x, this.translation.y);
    ctx.beginPath();
    for (const point of this.controlPoints) {
      if (point.type === 'moveTo') {
        ctx.moveTo(point.x, point.y);
      } else if (point.type === 'lineTo') {
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

function calcBoundingBox(controlPoints: BezierControlPoint[]): AABB {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const addBB = (x: number, y: number, width: number, height: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  };

  let prevX = undefined;
  let prevY = undefined;
  for (const point of controlPoints) {
    if (point.type !== 'closePath') {
      prevX = point.x;
      prevY = point.y;
    }
    if (point.type === 'moveTo') {
      addBB(point.x, point.y, 0, 0);
    } else if (point.type === 'lineTo') {
      addBB(point.x, point.y, 0, 0);
    } else if (point.type === 'quadraticCurveTo') {
      if (prevX === undefined || prevY === undefined) {
        throw new Error('Invalid control point');
      }
      const cx1 = prevX + (2 / 3) * (point.controlX - prevX);
      const cy1 = prevY + (2 / 3) * (point.controlY - prevY);
      const cx2 = point.x + (2 / 3) * (point.controlX - point.x);
      const cy2 = point.y + (2 / 3) * (point.controlY - point.y);
      const bz = new Bezier([prevX, prevY, cx1, cy1, cx2, cy2, point.x, point.y]);
      const bbox = bz.bbox();
      const width = bbox.x.size!;
      const height = bbox.y.size!;
      addBB(bbox.x.min, bbox.y.min, width, height);
    } else if (point.type === 'cubicCurveTo') {
      if (prevX === undefined || prevY === undefined) {
        throw new Error('Invalid control point');
      }
      const bz = new Bezier([
        prevX,
        prevY,
        point.controlX1,
        point.controlY1,
        point.controlX2,
        point.controlY2,
        point.x,
        point.y,
      ]);
      const bbox = bz.bbox();
      const width = bbox.x.size!;
      const height = bbox.y.size!;
      addBB(bbox.x.min, bbox.y.min, width, height);
    } else if (point.type === 'closePath') {
      // nothing to do, should be handled by the initial moveTo
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

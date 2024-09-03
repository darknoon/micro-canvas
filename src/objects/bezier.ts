import { CanvasObject, AABB } from '../canvas';

export type BezierControlPoint =
  | { type: 'lineTo'; x: number; y: number }
  | { type: 'quadraticCurveTo'; x: number; y: number; controlX: number; controlY: number };

export class Bezier implements CanvasObject {
  constructor(public id: number) {}

  private controlPoints: BezierControlPoint[] = [
    { type: 'lineTo', x: 200, y: 200 },
    { type: 'quadraticCurveTo', x: 300, y: 300, controlX: 250, controlY: 250 },
  ];

  get boundingBox(): AABB {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    let x = 0;
    let y = 0;

    for (const point of this.controlPoints) {
      if (point.type === 'lineTo') {
        minX = Math.min(minX, x, point.x);
        minY = Math.min(minY, y, point.y);
        maxX = Math.max(maxX, x, point.x);
        maxY = Math.max(maxY, y, point.y);
        x = point.x;
        y = point.y;
      } else if (point.type === 'quadraticCurveTo') {
        // For quadratic curves, we need to find the extrema
        const [x0, y0] = [x, y];
        const [x1, y1] = [point.controlX, point.controlY];
        const [x2, y2] = [point.x, point.y];

        // Find t where dx/dt = 0 and dy/dt = 0
        const tx = (x0 - x1) / (x0 - 2 * x1 + x2);
        const ty = (y0 - y1) / (y0 - 2 * y1 + y2);

        // Check extrema points if t is between 0 and 1
        if (tx > 0 && tx < 1) {
          const extremaX = (1 - tx) * (1 - tx) * x0 + 2 * (1 - tx) * tx * x1 + tx * tx * x2;
          minX = Math.min(minX, extremaX);
          maxX = Math.max(maxX, extremaX);
        }
        if (ty > 0 && ty < 1) {
          const extremaY = (1 - ty) * (1 - ty) * y0 + 2 * (1 - ty) * ty * y1 + ty * ty * y2;
          minY = Math.min(minY, extremaY);
          maxY = Math.max(maxY, extremaY);
        }

        // Check end points
        minX = Math.min(minX, x0, x2);
        minY = Math.min(minY, y0, y2);
        maxX = Math.max(maxX, x0, x2);
        maxY = Math.max(maxY, y0, y2);

        x = x2;
        y = y2;
      }
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.arc(this.boundingBox.x, this.boundingBox.y, 20, 0, 2 * Math.PI);
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.closePath();
  }
}

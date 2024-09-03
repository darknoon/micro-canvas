import { CanvasObject } from '../canvas';
import { Point2D, AABB } from '../geom';

export class RedCircle implements CanvasObject {
  public constructor(public id: number) {}

  public translation: Point2D = { x: 0, y: 0 };
  public size: { width: number; height: number } = { width: 100, height: 100 };
  public get boundingBox(): AABB {
    return {
      x: this.translation.x,
      y: this.translation.y,
      width: this.size.width,
      height: this.size.height,
    };
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    const { x, y } = this.translation;
    const { width, height } = this.boundingBox;
    ctx.arc(x + width / 2, y + height / 2, width / 2, 0, 2 * Math.PI);
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.closePath();
  }
}

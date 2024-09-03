import { CanvasObject, AABB } from '../canvas';

export class RedCircle implements CanvasObject {
  public constructor(public id: number) {}

  public boundingBox: AABB = { x: 120, y: 500, width: 40, height: 40 };

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    const { x, y, width, height } = this.boundingBox;
    ctx.arc(x + width / 2, y + height / 2, width / 2, 0, 2 * Math.PI);
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.closePath();
  }
}

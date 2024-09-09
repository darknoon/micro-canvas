import { CanvasObject } from '../canvas';
import { Point2D, AABB } from '../geom';

/**
 * Artboard is a special object that represents a drawable area in the canvas.
 */
export class Artboard implements CanvasObject {
  id: number;
  translation: Point2D;
  readonly boundingBox: AABB;

  readonly locked = true;

  private width: number;
  private height: number;

  constructor(id: number, x: number, y: number, width: number, height: number) {
    this.id = id;
    this.translation = { x, y };
    this.width = width;
    this.height = height;
    this.boundingBox = this.calculateBoundingBox();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const originalGlobalAlpha = ctx.globalAlpha;
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(this.translation.x, this.translation.y, this.width, this.height);
    ctx.globalAlpha = originalGlobalAlpha;
  }

  private calculateBoundingBox(): AABB {
    return {
      x: this.translation.x,
      y: this.translation.y,
      width: this.width,
      height: this.height,
    };
  }
}

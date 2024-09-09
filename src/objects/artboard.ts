import { CanvasObject } from "../canvas"
import { Point2D, AABB } from "../geom"

/**
 * Artboard is a special object that represents a drawable area in the canvas.
 */
export class Artboard implements CanvasObject {
  id: number
  translation: Point2D
  readonly boundingBox: AABB

  readonly locked = true

  private width: number
  private height: number

  constructor(id: number, x: number, y: number, width: number, height: number) {
    this.id = id
    this.translation = { x, y }
    this.width = width
    this.height = height
    this.boundingBox = this.calculateBoundingBox()
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const originalGlobalAlpha = ctx.globalAlpha
    const originalLineWidth = ctx.lineWidth
    const outset = 0.5
    ctx.globalAlpha = 0.25
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(
      this.translation.x - outset,
      this.translation.y - outset,
      this.width + 2 * outset,
      this.height + 2 * outset,
      2,
    )
    ctx.stroke()
    ctx.globalAlpha = originalGlobalAlpha
    ctx.lineWidth = originalLineWidth
  }

  private calculateBoundingBox(): AABB {
    return {
      x: this.translation.x,
      y: this.translation.y,
      width: this.width,
      height: this.height,
    }
  }
}

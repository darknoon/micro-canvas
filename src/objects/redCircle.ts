import { CanvasObject } from "../canvas"
import { Point2D, AABB } from "../geom"

export class RedCircle implements CanvasObject {
  public constructor(public id: number) {}

  public translation: Point2D = { x: 0, y: 0 }
  public size: { width: number; height: number } = { width: 100, height: 100 }
  public get boundingBox(): AABB {
    return {
      x: this.translation.x,
      y: this.translation.y,
      width: this.size.width,
      height: this.size.height,
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath()
    const { x, y } = this.translation
    const { width, height } = this.boundingBox
    ctx.arc(x + width / 2, y + height / 2, width / 2, 0, 2 * Math.PI)
    ctx.fillStyle = "red"
    ctx.fill()
    ctx.closePath()
  }

  public toSVG(): SVGCircleElement {
    const svgNS = "http://www.w3.org/2000/svg"
    const circle = document.createElementNS(svgNS, "circle")
    circle.setAttribute("cx", (this.translation.x + this.size.width / 2).toString())
    circle.setAttribute("cy", (this.translation.y + this.size.height / 2).toString())
    circle.setAttribute("r", (this.size.width / 2).toString())
    circle.setAttribute("fill", "red")
    circle.setAttribute("stroke", "none")
    circle.setAttribute("stroke-width", "1")
    return circle
  }

  public static fromSVG(element: SVGCircleElement, id: number): RedCircle {
    const circle = new RedCircle(id)
    const cx = parseFloat(element.getAttribute("cx") || "0")
    const cy = parseFloat(element.getAttribute("cy") || "0")
    const r = parseFloat(element.getAttribute("r") || "0")

    circle.size = { width: r * 2, height: r * 2 }
    circle.translation = { x: cx - r, y: cy - r }

    return circle
  }
}

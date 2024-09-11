import { MultiArray } from "../multiArray"
import { CanvasObject } from "../canvas"
import { Point2D, AABB } from "../geom"
import { Bezier } from "bezier-js"

export type BezierControlPoint =
  | { type: "moveTo"; x: number; y: number }
  | { type: "lineTo"; x: number; y: number }
  | { type: "quadraticCurveTo"; x: number; y: number; controlX: number; controlY: number }
  | {
      type: "cubicCurveTo"
      x: number
      y: number
      controlX1: number
      controlY1: number
      controlX2: number
      controlY2: number
    }
  | { type: "closePath" }

/** We need an idea of which control points are selected during editing.
 * Each entry is a tuple of whether each of the subpoints are selected.
 * eg, for a lineTo point, the tuple is [true, false, false] (false === unused or not selected)
 */
export type BezierSubselection = MultiArray<boolean>

export type BezierNearestSegment = { index: number; t: number }

export class PathLayer implements CanvasObject {
  constructor(public id: number) {}

  public translation: Point2D = { x: 0, y: 0 }
  public fill: string | null = "currentColor"
  public stroke: string | null = null
  public strokeWidth: number | null = null

  private _controlPoints: BezierControlPoint[] = [
    // Head
    { type: "moveTo", x: 50, y: 100 },
    {
      type: "cubicCurveTo",
      x: 80,
      y: 60,
      controlX1: 63,
      controlY1: 77,
      controlX2: 73,
      controlY2: 67,
    },
    {
      type: "cubicCurveTo",
      x: 100,
      y: 100,
      controlX1: 93,
      controlY1: 87,
      controlX2: 100,
      controlY2: 93,
    },
    // Neck
    {
      type: "cubicCurveTo",
      x: 150,
      y: 150,
      controlX1: 113,
      controlY1: 117,
      controlX2: 133,
      controlY2: 137,
    },
    // Back
    {
      type: "cubicCurveTo",
      x: 300,
      y: 120,
      controlX1: 233,
      controlY1: 133,
      controlX2: 267,
      controlY2: 123,
    },
    // Tail
    {
      type: "cubicCurveTo",
      x: 320,
      y: 80,
      controlX1: 307,
      controlY1: 107,
      controlX2: 317,
      controlY2: 93,
    },
    // Hind legs
    { type: "lineTo", x: 280, y: 250 },
    { type: "lineTo", x: 260, y: 250 },
    { type: "lineTo", x: 240, y: 150 },
    // Belly
    {
      type: "cubicCurveTo",
      x: 120,
      y: 180,
      controlX1: 167,
      controlY1: 193,
      controlX2: 140,
      controlY2: 187,
    },
    // Front legs
    { type: "lineTo", x: 100, y: 250 },
    { type: "lineTo", x: 80, y: 250 },
    { type: "closePath" },
  ]

  private _boundingBox: AABB | undefined

  public get controlPoints(): BezierControlPoint[] {
    return this._controlPoints
  }

  public set controlPoints(value: BezierControlPoint[]) {
    this._controlPoints = value
    this._boundingBox = undefined
  }

  get boundingBox(): AABB {
    // TODO: cache
    if (!this._boundingBox) {
      this._boundingBox = calcBoundingBox(this.controlPoints)
    }
    const { x, y, width, height } = this._boundingBox
    return { x: x + this.translation.x, y: y + this.translation.y, width, height }
  }

  public closestSegment(point: Point2D, threshold: number = 10): BezierNearestSegment | undefined {
    const px = point.x - this.translation.x
    const py = point.y - this.translation.y
    let minDist = Infinity
    let min: { index: number; t: number } | undefined

    for (const { prev, current, index } of this.segments()) {
      if (current.type === "moveTo" || current.type === "closePath") {
        continue
      }

      if (!prev || prev.type === "closePath") {
        continue
      }

      if (current.type === "lineTo") {
        const { x: x1, y: y1 } = prev
        const { x: x2, y: y2 } = current

        // Calculate the distance from point to line segment
        const dx = x2 - x1
        const dy = y2 - y1
        const length = Math.sqrt(dx * dx + dy * dy)

        // Calculate the normalized dot product
        const t = ((px - x1) * dx + (py - y1) * dy) / (length * length)

        // Find the closest point on the line segment
        let closestX, closestY
        if (t < 0) {
          closestX = x1
          closestY = y1
        } else if (t > 1) {
          closestX = x2
          closestY = y2
        } else {
          closestX = x1 + t * dx
          closestY = y1 + t * dy
        }

        // Calculate the distance to the closest point
        const distX = px - closestX
        const distY = py - closestY
        const distance = Math.sqrt(distX * distX + distY * distY)

        if (distance <= threshold && distance < minDist) {
          minDist = distance
          min = { index, t }
        }
      } else if (current.type === "quadraticCurveTo") {
        const { x: x1, y: y1 } = prev
        const { x: x2, y: y2, controlX, controlY } = current

        const curve = quadraticToCubic(x1, y1, controlX, controlY, x2, y2)
        const projection = curve.project({ x: px, y: py })

        if (
          projection &&
          projection.d !== undefined &&
          projection.t !== undefined &&
          projection.d <= threshold &&
          projection.d < minDist
        ) {
          minDist = projection.d
          min = { index, t: projection.t }
        }
      } else if (current.type === "cubicCurveTo") {
        const { x: x1, y: y1 } = prev
        const { x: x2, y: y2, controlX1, controlY1, controlX2, controlY2 } = current

        const curve = new Bezier([x1, y1, controlX1, controlY1, controlX2, controlY2, x2, y2])
        const projection = curve.project({ x: px, y: py })

        if (
          projection &&
          projection.d !== undefined &&
          projection.t !== undefined &&
          projection.d <= threshold &&
          projection.d < minDist
        ) {
          minDist = projection.d
          min = { index, t: projection.t }
        }
      }
    }
    return min
  }

  *segments(): IterableIterator<{
    prev: BezierControlPoint | null
    current: BezierControlPoint
    index: number
  }> {
    let prev: BezierControlPoint | null = null
    for (let i = 0; i < this.controlPoints.length; i++) {
      const current = this.controlPoints[i]
      yield { prev, current, index: i }
      prev = current
    }
  }

  public pointForNearestSegment(segment: BezierNearestSegment): Point2D {
    const { index, t } = segment
    if (index < 0 || index >= this.controlPoints.length) {
      throw new Error(`Invalid segment index: ${index}`)
    }
    const prev = this.controlPoints[index - 1]
    const cur = this.controlPoints[index]
    if (cur.type === "lineTo") {
      if (!prev || prev.type === "closePath") {
        throw new Error("Invalid control points")
      }
      const { x: x1, y: y1 } = prev
      const { x: x2, y: y2 } = cur
      return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1),
      }
    } else if (cur.type === "quadraticCurveTo") {
      if (!prev || prev.type === "closePath") {
        throw new Error("Invalid control points")
      }
      const { x: x1, y: y1 } = prev
      const { x: x2, y: y2, controlX, controlY } = cur
      const curve = quadraticToCubic(x1, y1, controlX, controlY, x2, y2)
      return curve.get(t)
    } else if (cur.type === "cubicCurveTo") {
      if (!prev || prev.type === "closePath") {
        throw new Error("Invalid control points")
      }
      const { x: x1, y: y1 } = prev
      const { x: x2, y: y2, controlX1, controlY1, controlX2, controlY2 } = cur
      const curve = new Bezier([x1, y1, controlX1, controlY1, controlX2, controlY2, x2, y2])
      return curve.get(t)
    }
    throw new Error("Invalid control points")
  }

  public addNearestSegment(nearest: BezierNearestSegment): void {
    // Split the segment into two segments at the nearest point
    const { index, t } = nearest
    if (index < 0 || index >= this.controlPoints.length) {
      throw new Error(`Invalid segment index: ${index}`)
    }
    const prev = this.controlPoints[index - 1]
    const cur = this.controlPoints[index]

    if (cur.type === "lineTo") {
      if (!prev || prev.type === "closePath") {
        throw new Error("Invalid control points")
      }
      const newPoint = this.pointForNearestSegment(nearest)
      this.controlPoints.splice(index, 0, { type: "lineTo", ...newPoint })
    } else if (cur.type === "quadraticCurveTo") {
      if (!prev || prev.type === "closePath") {
        throw new Error("Invalid control points")
      }
      const { x: x1, y: y1 } = prev
      const { x: x2, y: y2, controlX, controlY } = cur
      const curve = quadraticToCubic(x1, y1, controlX, controlY, x2, y2)
      const split = curve.split(t)
      const leftCurve = split.left
      const rightCurve = split.right
      this.controlPoints.splice(
        index,
        1,
        {
          type: "cubicCurveTo",
          x: leftCurve.points[3].x,
          y: leftCurve.points[3].y,
          controlX1: leftCurve.points[1].x,
          controlY1: leftCurve.points[1].y,
          controlX2: leftCurve.points[2].x,
          controlY2: leftCurve.points[2].y,
        },
        {
          type: "cubicCurveTo",
          x: x2,
          y: y2,
          controlX1: rightCurve.points[1].x,
          controlY1: rightCurve.points[1].y,
          controlX2: rightCurve.points[2].x,
          controlY2: rightCurve.points[2].y,
        },
      )
    } else if (cur.type === "cubicCurveTo") {
      if (!prev || prev.type === "closePath") {
        throw new Error("Invalid control points")
      }
      const { x: x1, y: y1 } = prev
      const { x: x2, y: y2, controlX1, controlY1, controlX2, controlY2 } = cur
      const curve = new Bezier([x1, y1, controlX1, controlY1, controlX2, controlY2, x2, y2])
      const split = curve.split(t)
      const leftCurve = split.left
      const rightCurve = split.right
      this.controlPoints.splice(
        index,
        1,
        {
          type: "cubicCurveTo",
          x: leftCurve.points[3].x,
          y: leftCurve.points[3].y,
          controlX1: leftCurve.points[1].x,
          controlY1: leftCurve.points[1].y,
          controlX2: leftCurve.points[2].x,
          controlY2: leftCurve.points[2].y,
        },
        {
          type: "cubicCurveTo",
          x: x2,
          y: y2,
          controlX1: rightCurve.points[1].x,
          controlY1: rightCurve.points[1].y,
          controlX2: rightCurve.points[2].x,
          controlY2: rightCurve.points[2].y,
        },
      )
    } else {
      throw new Error("Invalid control point type")
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    ctx.translate(this.translation.x, this.translation.y)
    ctx.beginPath()
    for (const point of this.controlPoints) {
      if (point.type === "moveTo") {
        ctx.moveTo(point.x, point.y)
      } else if (point.type === "lineTo") {
        ctx.lineTo(point.x, point.y)
      } else if (point.type === "quadraticCurveTo") {
        ctx.quadraticCurveTo(point.controlX, point.controlY, point.x, point.y)
      } else if (point.type === "cubicCurveTo") {
        ctx.bezierCurveTo(
          point.controlX1,
          point.controlY1,
          point.controlX2,
          point.controlY2,
          point.x,
          point.y,
        )
      } else if (point.type === "closePath") {
        ctx.closePath()
      }
    }
    const currentColor = getComputedStyle(ctx.canvas).getPropertyValue("color")
    ctx.fillStyle = this.fill === "currentColor" ? currentColor : (this.fill ?? currentColor)
    // ctx.stroke();
    ctx.fill()
    ctx.closePath()
    ctx.restore()
  }

  public toSVGPath(): string {
    let path = ""
    for (const point of this._controlPoints) {
      switch (point.type) {
        case "moveTo":
          path += `M ${point.x} ${point.y} `
          break
        case "lineTo":
          path += `L ${point.x} ${point.y} `
          break
        case "quadraticCurveTo":
          path += `Q ${point.controlX} ${point.controlY} ${point.x} ${point.y} `
          break
        case "cubicCurveTo":
          path += `C ${point.controlX1} ${point.controlY1} ${point.controlX2} ${point.controlY2} ${point.x} ${point.y} `
          break
        case "closePath":
          path += "Z "
          break
      }
    }
    return path.trim()
  }
  public toSVG(): SVGPathElement {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    const svgPath = this.toSVGPath()
    path.setAttribute("d", svgPath)
    path.setAttribute("fill", this.fill || "none")
    path.setAttribute("stroke", this.stroke || "none")
    path.setAttribute("stroke-width", this.strokeWidth?.toString() || "1")
    path.setAttribute("transform", `translate(${this.translation.x},${this.translation.y})`)
    return path
  }

  static fromSVGPath(path: SVGPathElement, id: number): PathLayer {
    const pathLayer = new PathLayer(id)
    const d = path.getAttribute("d")
    if (!d) {
      throw new Error('SVG path element does not have a "d" attribute')
    }

    pathLayer.controlPoints = parseCommands(d)
    pathLayer.fill = path.getAttribute("fill") || null
    pathLayer.stroke = path.getAttribute("stroke") || null
    pathLayer.strokeWidth = path.getAttribute("stroke-width")
      ? parseFloat(path.getAttribute("stroke-width")!)
      : null

    const transform = path.getAttribute("transform")
    if (transform) {
      const match = transform.match(/translate\((-?\d+\.?\d*),(-?\d+\.?\d*)\)/)
      if (match) {
        pathLayer.translation = { x: parseFloat(match[1]), y: parseFloat(match[2]) }
      }
    }

    return pathLayer
  }
}

function quadraticToCubic(
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  x2: number,
  y2: number,
): Bezier {
  const cx1 = x1 + (2 / 3) * (cx - x1)
  const cy1 = y1 + (2 / 3) * (cy - y1)
  const cx2 = x2 + (2 / 3) * (cx - x2)
  const cy2 = y2 + (2 / 3) * (cy - y2)
  return new Bezier([x1, y1, cx1, cy1, cx2, cy2, x2, y2])
}

function calcBoundingBox(controlPoints: BezierControlPoint[]): AABB {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const addBB = (x: number, y: number, width: number, height: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + width)
    maxY = Math.max(maxY, y + height)
  }

  let prevX = undefined
  let prevY = undefined
  for (const point of controlPoints) {
    if (point.type !== "closePath") {
      prevX = point.x
      prevY = point.y
    }
    if (point.type === "moveTo") {
      addBB(point.x, point.y, 0, 0)
    } else if (point.type === "lineTo") {
      addBB(point.x, point.y, 0, 0)
    } else if (point.type === "quadraticCurveTo") {
      if (prevX === undefined || prevY === undefined) {
        throw new Error("Invalid control point")
      }
      const bz = quadraticToCubic(prevX, prevY, point.controlX, point.controlY, point.x, point.y)
      const bbox = bz.bbox()
      const width = bbox.x.size!
      const height = bbox.y.size!
      addBB(bbox.x.min, bbox.y.min, width, height)
    } else if (point.type === "cubicCurveTo") {
      if (prevX === undefined || prevY === undefined) {
        throw new Error("Invalid control point")
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
      ])
      const bbox = bz.bbox()
      const width = bbox.x.size!
      const height = bbox.y.size!
      addBB(bbox.x.min, bbox.y.min, width, height)
    } else if (point.type === "closePath") {
      // nothing to do, should be handled by the initial moveTo
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function hitTestBezierControlPoints(
  bezier: PathLayer,
  s: BezierSubselection,
  x: number,
  y: number,
  distance: number = 10,
): [number, number] | undefined {
  const pointClose = (px: number, py: number) => {
    return Math.sqrt((px - x) ** 2 + (py - y) ** 2) < distance
  }

  for (const { index: i, prev, current } of bezier.segments()) {
    // ~if MultiArray had a slice API: prev ? selection[index - 1].any() : false
    const prevSelected = prev ? s.get(i - 1, 0) || s.get(i - 1, 1) || s.get(i - 1, 2) : false
    const currentSelected = s.get(i, 0) || s.get(i, 1) || s.get(i, 2)
    // Are the control points visible for the current segment?
    const showControl = prevSelected || currentSelected
    if (current.type === "moveTo" || current.type === "lineTo") {
      if (pointClose(current.x, current.y)) {
        return [i, 0]
      }
    } else if (current.type === "quadraticCurveTo") {
      if (pointClose(current.x, current.y)) {
        return [i, 0]
      }
      if (showControl && pointClose(current.controlX, current.controlY)) {
        return [i, 1]
      }
    } else if (current.type === "cubicCurveTo") {
      if (pointClose(current.x, current.y)) {
        return [i, 0]
      }
      if (showControl && pointClose(current.controlX1, current.controlY1)) {
        return [i, 1]
      }
      if (showControl && pointClose(current.controlX2, current.controlY2)) {
        return [i, 2]
      }
    }
  }
  return undefined
}

export function parseCommands(d: string): BezierControlPoint[] {
  let currentX = 0
  let currentY = 0

  const commands = d.match(/[a-zA-Z][^a-zA-Z]*/g)
  if (!commands) {
    throw new Error("Invalid SVG path data")
  }

  const controlPoints: BezierControlPoint[] = []
  for (const command of commands) {
    const type = command[0]
    const args = command
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number)

    const isRelative = type === type.toLowerCase()

    switch (type.toUpperCase()) {
      case "M":
        currentX = isRelative ? currentX + args[0] : args[0]
        currentY = isRelative ? currentY + args[1] : args[1]
        controlPoints.push({ type: "moveTo", x: currentX, y: currentY })
        break
      case "L":
        currentX = isRelative ? currentX + args[0] : args[0]
        currentY = isRelative ? currentY + args[1] : args[1]
        controlPoints.push({ type: "lineTo", x: currentX, y: currentY })
        break
      case "C":
        controlPoints.push({
          type: "cubicCurveTo",
          controlX1: isRelative ? currentX + args[0] : args[0],
          controlY1: isRelative ? currentY + args[1] : args[1],
          controlX2: isRelative ? currentX + args[2] : args[2],
          controlY2: isRelative ? currentY + args[3] : args[3],
          x: isRelative ? currentX + args[4] : args[4],
          y: isRelative ? currentY + args[5] : args[5],
        })
        currentX = isRelative ? currentX + args[4] : args[4]
        currentY = isRelative ? currentY + args[5] : args[5]
        break
      case "Q":
        controlPoints.push({
          type: "quadraticCurveTo",
          controlX: isRelative ? currentX + args[0] : args[0],
          controlY: isRelative ? currentY + args[1] : args[1],
          x: isRelative ? currentX + args[2] : args[2],
          y: isRelative ? currentY + args[3] : args[3],
        })
        currentX = isRelative ? currentX + args[2] : args[2]
        currentY = isRelative ? currentY + args[3] : args[3]
        break
      case "Z":
        controlPoints.push({ type: "closePath" })
        break
      case "H":
        currentX = isRelative ? currentX + args[0] : args[0]
        controlPoints.push({ type: "lineTo", x: currentX, y: currentY })
        break
      case "V":
        currentY = isRelative ? currentY + args[0] : args[0]
        controlPoints.push({ type: "lineTo", x: currentX, y: currentY })
        break
      case "S":
        const reflectedX = 2 * currentX - (controlPoints[controlPoints.length - 1] as any).controlX2
        const reflectedY = 2 * currentY - (controlPoints[controlPoints.length - 1] as any).controlY2
        controlPoints.push({
          type: "cubicCurveTo",
          controlX1: reflectedX,
          controlY1: reflectedY,
          controlX2: isRelative ? currentX + args[0] : args[0],
          controlY2: isRelative ? currentY + args[1] : args[1],
          x: isRelative ? currentX + args[2] : args[2],
          y: isRelative ? currentY + args[3] : args[3],
        })
        currentX = isRelative ? currentX + args[2] : args[2]
        currentY = isRelative ? currentY + args[3] : args[3]
        break
      case "T":
        const lastQuadratic = controlPoints[controlPoints.length - 1] as any
        const reflectedQuadX = 2 * currentX - (lastQuadratic.controlX || currentX)
        const reflectedQuadY = 2 * currentY - (lastQuadratic.controlY || currentY)
        controlPoints.push({
          type: "quadraticCurveTo",
          controlX: reflectedQuadX,
          controlY: reflectedQuadY,
          x: isRelative ? currentX + args[0] : args[0],
          y: isRelative ? currentY + args[1] : args[1],
        })
        currentX = isRelative ? currentX + args[0] : args[0]
        currentY = isRelative ? currentY + args[1] : args[1]
        break
      case "A":
        // Arc command is complex and requires additional processing
        // For simplicity, we'll approximate it with a line for now
        currentX = isRelative ? currentX + args[5] : args[5]
        currentY = isRelative ? currentY + args[6] : args[6]
        controlPoints.push({ type: "lineTo", x: currentX, y: currentY })
        console.warn("Approximating arc command with lineTo")
        break
    }
  }
  return controlPoints
}

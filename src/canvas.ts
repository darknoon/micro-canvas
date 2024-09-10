import { Artboard } from "./objects/artboard"
import { buildDotGridPatternImage } from "./dotGrid"
import { AABB, intersectAABB, Point2D } from "./geom"
import {
  PathLayer,
  BezierSubselection,
  BezierNearestSegment,
  hitTestBezierControlPoints,
  BezierControlPoint,
} from "./objects/bezier"
import { RedCircle } from "./objects/redCircle"

import { Disposable } from "./interface/disposable"
import { Tool } from "./toolShelf"
import { MultiArray } from "./multiArray"
import { designSystem } from "./designSystem"

export const GRID_SIZE = 16
export const DEBUG = true

export type CanvasID = number

export enum Events {
  CONTENT_CHANGED = "contentChanged",
  VIEWPORT_CHANGED = "viewportChanged",
}

export interface CanvasObject {
  id: CanvasID
  readonly boundingBox: AABB
  readonly locked?: boolean
  translation: Point2D
  draw(ctx: CanvasRenderingContext2D): void
  toSVG?(): SVGElement
}

export class CanvasEditor extends EventTarget implements Disposable {
  /**
   * CanvasEditor is a class that manages a canvas element and its rendering context.
   * Logically, it has an infinite size.
   */

  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private container: HTMLElement
  // Cached pattern for the background, invalidated on devicePixelRatio change or color scheme change
  private _pattern: CanvasPattern | undefined
  private devicePixelRatio: number
  private isDarkMode: boolean = false

  // Scroll position in canvas coordinates
  private scrollX = -128
  private scrollY = -128

  // Reused for drag/pan events, stores previous mouse position within our element so we can calculate the delta
  private lastDragX?: number
  private lastDragY?: number
  // Keep around functions to unregister event listeners when the current gesture is done
  private eventCleanups: (() => void)[] = []

  /// State vars
  private isMiddleDragging: boolean = false
  private isSelectionDragging: boolean = false
  private selectionDraggingOrigin?: Point2D | null = null
  private isObjectDragging: boolean = false
  // Selection should be a single object. We are editing a specific bezier curve.
  private isEditingBezier: boolean = false
  private bezierSelection: BezierSubselection | null = null
  private nearestBezierSegment: BezierNearestSegment | null = null
  private isDraggingBezierPoints: boolean = false

  /// Scene graph
  // Factories object maps from a name of a subtype of CanvasObject to a function that creates an instance of that subtype
  private factories: {
    circle: () => RedCircle
    bezier: () => PathLayer
    artboard: (x: number, y: number, w: number, h: number) => Artboard
  }
  private nextId = 1
  private selection: CanvasID[] = []
  private objects: CanvasObject[]

  // Store functions that cleanup when we are disposed
  private disposers: (() => void)[] = []

  private _activeToolId: Tool = Tool.HAND

  constructor(container: HTMLElement) {
    super()
    this.container = container
    this.canvas = document.createElement("canvas")
    const dpr = window.devicePixelRatio || 1
    console.log("Device pixel ratio:", dpr)
    this.devicePixelRatio = dpr // Store the device pixel ratio
    // Set the canvas size to the container size
    const width = container.clientWidth
    const height = container.clientHeight
    this.canvas.width = width * dpr
    this.canvas.height = height * dpr
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D

    this.factories = {
      artboard: (x: number, y: number, w: number, h: number) =>
        new Artboard(this.nextId++, x, y, w, h),
      circle: () => new RedCircle(this.nextId++),
      bezier: () => new PathLayer(this.nextId++),
    }

    this.objects = [
      this.factories.artboard(0, 0, 256, 256),
      this.factories.circle(),
      this.factories.bezier(),
    ]

    this.container.appendChild(this.canvas)
    this.disposers.push(() => this.container.removeChild(this.canvas))

    this.setupEventListeners()
    this.redraw()
  }

  /** This is used when hot reloading to ensure that our state is preserved */
  public copyFrom(other: CanvasEditor) {
    // TODO: can we deep copy the objects?
    this.objects = other.objects
    this.scrollX = other.scrollX
    //oeu
    this.scrollY = other.scrollY
    this.selection = other.selection
    this.isEditingBezier = other.isEditingBezier
    this.bezierSelection = other.bezierSelection
    this.nearestBezierSegment = other.nearestBezierSegment
    this.isDraggingBezierPoints = other.isDraggingBezierPoints
    this.redraw()
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault()
    const deltaX = event.deltaX
    const deltaY = event.deltaY
    // Implement zooming or panning logic here
    this.scrollX += deltaX
    this.scrollY += deltaY
    // round to nearest retina pixel
    const dpr = this.devicePixelRatio
    this.scrollX = Math.round(this.scrollX * dpr) / dpr
    this.scrollY = Math.round(this.scrollY * dpr) / dpr
    this.dispatchViewportChanged()
    this.redraw()
  }

  private hitTest(x: number, y: number): CanvasObject | null {
    for (const object of this.objects) {
      if (object.locked) continue
      const { x: x0, y: y0, width, height } = object.boundingBox
      if (x >= x0 && x <= x0 + width && y >= y0 && y <= y0 + height) {
        return object
      }
    }
    return null
  }

  private outerCoords(e: MouseEvent): Point2D {
    const bb = this.canvas.getBoundingClientRect()
    return {
      x: e.clientX - bb.left,
      y: e.clientY - bb.top,
    }
  }

  private canvasCoords(e: MouseEvent): Point2D {
    const { x: localX, y: localY } = this.outerCoords(e)
    return {
      x: localX + this.scrollX,
      y: localY + this.scrollY,
    }
  }

  onColorSchemeChange(e: MediaQueryListEvent) {
    this.isDarkMode = e.matches
    this._pattern = undefined
    this.redraw()
  }

  private get DS() {
    return this.isDarkMode ? designSystem.dark : designSystem.light
  }

  private get pattern() {
    if (!this._pattern) {
      const dpr = this.devicePixelRatio
      const DS = this.DS
      // Create a pattern for the background
      const patternCanvas = buildDotGridPatternImage(dpr, DS.canvasBackgroundDot)
      // Set the background pattern
      const pattern = this.ctx.createPattern(patternCanvas, "repeat")
      if (!pattern) throw new Error("Failed to create canvas background")
      this._pattern = pattern
    }
    return this._pattern
  }

  private beginEvent() {
    // Run any cleanup functions from previous events
    if (this.eventCleanups.length > 0) {
      console.error("Event cleanup not run")
      this.endEvent()
    }
    this.eventCleanups = []
  }

  private endEvent() {
    this.eventCleanups.forEach(cleanup => cleanup())
    this.eventCleanups = []
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      if (this.isEditingBezier) {
        this.isEditingBezier = false
        this.updateCursor()
        this.redraw()
        e.preventDefault()
      } else {
        this.selection = []
        this.updateCursor()
        this.redraw()
        e.preventDefault()
      }
    } else if (e.key === "Enter") {
      if (this.selection.length === 1) {
        const object = this.objects.find(o => o.id === this.selection[0])
        if (object instanceof PathLayer) {
          this.isEditingBezier = !this.isEditingBezier
          if (this.isEditingBezier) {
            this.bezierSelection = new MultiArray([object.controlPoints.length, 3], false)
          }
          this.updateCursor()
          this.redraw()
          e.preventDefault()
        }
      }
    } else if (e.key === "Backspace") {
      if (this.isEditingBezier && this.bezierSelection) {
        const bzo = this.bezierEditingObject
        if (!bzo) throw new Error("Expected selected object to be a Bezier")
        if (!this.bezierSelection) throw new Error("Expected bezier selection to be set")
        // TODO: implement this primitive inside a bezier model layer
        const toDelete: number[] = []
        for (let i = 0; i < bzo.controlPoints.length; i++) {
          if (this.bezierSelection.get(i, 0)) {
            toDelete.push(i)
            break
          }
        }
        bzo.controlPoints = bzo.controlPoints.filter((_, i) => !toDelete.includes(i))
        this.bezierSelection = new MultiArray([bzo.controlPoints.length, 3], false)
        this.updateCursor()
        this.redraw()
        e.preventDefault()
      } else {
        // delete the selected objects
        this.objects = this.objects.filter(o => !this.selection.includes(o.id))
        this.selection = []
        this.dispatchContentChanged()
        this.redraw()
        e.preventDefault()
      }
    } else if (
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight"
    ) {
      this.handleArrowKeys(e)
    }
  }

  handleArrowKeys(e: KeyboardEvent) {
    let increment = 1
    let direction: [number, number] = [0, 0]
    if (e.shiftKey) {
      increment = 10
    }
    if (e.key === "ArrowUp") {
      direction = [0, -1]
    } else if (e.key === "ArrowDown") {
      direction = [0, 1]
    } else if (e.key === "ArrowLeft") {
      direction = [-1, 0]
    } else if (e.key === "ArrowRight") {
      direction = [1, 0]
    }

    if (this.isEditingBezier && this.bezierSelection) {
      const bzo = this.bezierEditingObject
      if (!bzo) throw new Error("Expected selected object to be a Bezier")
      const s = this.bezierSelection
      // update the selected points
      const newControlPoints: BezierControlPoint[] = bzo.controlPoints.map((p, i) => {
        const s0 = s.get(i, 0)
        const s1 = s.get(i, 1)
        const s2 = s.get(i, 2)
        if (p.type === "moveTo") {
          if (s0) {
            p = {
              ...p,
              x: p.x + direction[0] * increment,
              y: p.y + direction[1] * increment,
            }
          }
        } else if (p.type === "lineTo") {
          if (s0) {
            p = {
              ...p,
              x: p.x + direction[0] * increment,
              y: p.y + direction[1] * increment,
            }
          }
        } else if (p.type === "quadraticCurveTo") {
          if (s0) {
            p = {
              ...p,
              x: p.x + direction[0] * increment,
              y: p.y + direction[1] * increment,
            }
          } else if (s1) {
            p = {
              ...p,
              controlX: p.controlX + direction[0] * increment,
              controlY: p.controlY + direction[1] * increment,
            }
          }
        } else if (p.type === "cubicCurveTo") {
          if (s0) {
            p = {
              ...p,
              x: p.x + direction[0] * increment,
              y: p.y + direction[1] * increment,
              controlX1: p.controlX1 + direction[0] * increment,
              controlY1: p.controlY1 + direction[1] * increment,
              controlX2: p.controlX2 + direction[0] * increment,
              controlY2: p.controlY2 + direction[1] * increment,
            }
          } else if (s1) {
            p = {
              ...p,
              controlX1: p.controlX1 + direction[0] * increment,
              controlY1: p.controlY1 + direction[1] * increment,
            }
          } else if (s2) {
            p = {
              ...p,
              controlX2: p.controlX2 + direction[0] * increment,
              controlY2: p.controlY2 + direction[1] * increment,
            }
          }
        }
        return p
      })
      bzo.controlPoints = newControlPoints
      this.dispatchContentChanged()
      this.redraw()
    }
  }
  private onMouseDown(e: MouseEvent): void {
    const { x: localX, y: localY } = this.outerCoords(e)
    const DS = this.DS
    if (e.button === 0) {
      // Left mouse button
      const canvasX = localX + this.scrollX
      const canvasY = localY + this.scrollY

      if (this.isEditingBezier) {
        const path = this.bezierEditingObject
        if (!path || !(path instanceof PathLayer)) {
          throw new Error("Expected selected object to be a Bezier")
        }
        if (!this.bezierSelection) throw new Error("Expected bezier selection to be set")
        const hit = hitTestBezierControlPoints(
          path,
          this.bezierSelection,
          canvasX - path.translation.x,
          canvasY - path.translation.y,
          DS.bezierControlPointHitRadius,
        )
        console.log("hitTestBezier", canvasX, canvasY, hit)

        if (hit) {
          const [i, j] = hit
          const wasSelected = this.bezierSelection.get(i, j)
          // copy
          this.isDraggingBezierPoints = true
          this.lastDragX = localX
          this.lastDragY = localY
          this.beginEvent()
          const onMouseMove = this.onBezierPointDrag.bind(this)
          const onMouseUp = this.onBezierPointDragUp.bind(this)
          window.addEventListener("mousemove", onMouseMove)
          window.addEventListener("mouseup", onMouseUp)
          this.eventCleanups.push(() => {
            window.removeEventListener("mousemove", onMouseMove)
            window.removeEventListener("mouseup", onMouseUp)
          })
          if (wasSelected) {
            // Start dragging the bezier point
          } else {
            // Select just this point
            const bzs = new MultiArray([path.controlPoints.length, 3], false)
            bzs.set(true, i, j)
            this.bezierSelection = bzs
          }
          this.redraw()
        } else if (this.nearestBezierSegment) {
          // Add a new point at the nearest segment
          const newSelectionIndex = this.nearestBezierSegment.index
          path.addNearestSegment(this.nearestBezierSegment)
          const s = new MultiArray([path.controlPoints.length, 3], false)
          s.set(true, newSelectionIndex, 0)
          this.bezierSelection = s
          this.dispatchContentChanged()
        } else {
          // Clicked something that is not a control point. Ignore.
        }
        return
      }

      const object = this.hitTest(canvasX, canvasY)
      if (object) {
        if (!this.selection.includes(object.id)) {
          // Reset selection if you drag an object that is not selected
          this.selection = [object.id]
        }
        this.isObjectDragging = true
        this.lastDragX = localX
        this.lastDragY = localY

        this.beginEvent()
        const onMouseMove = this.onObjectDrag.bind(this)
        const onMouseUp = this.onObjectDragUp.bind(this)
        window.addEventListener("mousemove", onMouseMove)
        window.addEventListener("mouseup", onMouseUp)
        this.eventCleanups.push(() => {
          window.removeEventListener("mousemove", onMouseMove)
          window.removeEventListener("mouseup", onMouseUp)
        })
      } else {
        this.isSelectionDragging = true
        this.lastDragX = localX
        this.lastDragY = localY
        this.selection = []

        this.selectionDraggingOrigin = { x: localX + this.scrollX, y: localY + this.scrollY }

        // Listen on the window to capture mouse move/up events outside the canvas
        this.beginEvent()
        const onMouseMove = this.onSelectionDrag.bind(this)
        const onMouseUp = this.onSelectionDragUp.bind(this)
        window.addEventListener("mousemove", onMouseMove)
        window.addEventListener("mouseup", onMouseUp)
        this.eventCleanups.push(() => {
          window.removeEventListener("mousemove", onMouseMove)
          window.removeEventListener("mouseup", onMouseUp)
        })
      }
    } else if (e.button === 1) {
      // Middle mouse button

      this.isMiddleDragging = true
      this.lastDragX = localX
      this.lastDragY = localY

      // Listen on the window to capture mouse move/up events outside the canvas
      this.beginEvent()
      const onMouseMove = this.onMiddleDrag.bind(this)
      const onMouseUp = this.onMiddleDragUp.bind(this)
      window.addEventListener("mousemove", onMouseMove)
      window.addEventListener("mouseup", onMouseUp)
      this.eventCleanups.push(() => {
        window.removeEventListener("mousemove", onMouseMove)
        window.removeEventListener("mouseup", onMouseUp)
      })
    }
  }

  private onDoubleClick(e: MouseEvent): void {
    const { x: localX, y: localY } = this.canvasCoords(e)
    const object = this.hitTest(localX, localY)
    // if you double click a bezier, start editing it
    if (object instanceof PathLayer) {
      this.isEditingBezier = true
      this.bezierSelection = new MultiArray([object.controlPoints.length, 3], false)
      this.selection = [object.id]
      this.redraw()
      e.preventDefault()
    } else if (this.isEditingBezier) {
      this.isEditingBezier = false
      this.updateCursor()
      this.redraw()
      e.preventDefault()
    }
  }

  private get bezierEditingObject(): PathLayer | undefined {
    if (this.selection.length !== 1) return undefined
    const obj = this.objects.find(o => o.id === this.selection[0])
    if (obj instanceof PathLayer) {
      return obj
    }
    return undefined
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.isEditingBezier && this._activeToolId === Tool.PEN) {
      const bzo = this.bezierEditingObject
      if (!bzo) return
      const { x: localX, y: localY } = this.canvasCoords(e)
      // Are we closest to a current control point?
      if (!this.bezierSelection) throw new Error("Expected bezier selection to be set")
      const hit = hitTestBezierControlPoints(
        bzo,
        this.bezierSelection,
        localX,
        localY,
        this.DS.bezierControlPointHitRadius,
      )
      if (hit) {
        this.nearestBezierSegment = null
        this.redraw()
      } else {
        // Find closest bezier point
        const segm = bzo.closestSegment({ x: localX, y: localY })
        this.nearestBezierSegment = segm ?? null
        console.log("closestSegment", segm)
        this.redraw()
      }
    }
    this.updateCursor()
  }

  updateCursor(): void {
    // Set cursor to '+' if we have a nearest bezier segment
    if (this.nearestBezierSegment && this._activeToolId === Tool.PEN) {
      this.canvas.style.cursor = "crosshair"
    } else {
      this.canvas.style.cursor = "default"
    }
  }

  /** selection dragging box, in internal canvas coordinates */
  private get selectionBoundingBox(): AABB {
    const origin = this.selectionDraggingOrigin
    if (!origin) throw new Error("Selection dragging origin is null")
    const canvasX = this.lastDragX! + this.scrollX
    const canvasY = this.lastDragY! + this.scrollY
    return {
      x: Math.min(canvasX, origin.x),
      y: Math.min(canvasY, origin.y),
      width: Math.abs(canvasX - origin.x),
      height: Math.abs(canvasY - origin.y),
    }
  }

  private onObjectDrag(e: MouseEvent): void {
    if (!this.isObjectDragging) throw new Error("Object dragging is not active")

    const { x: localX, y: localY } = this.outerCoords(e)
    const deltaX = localX - this.lastDragX!
    const deltaY = localY - this.lastDragY!

    // Update the position of all selected objects
    for (const id of this.selection) {
      const object = this.objects.find(obj => obj.id === id)
      if (object) {
        object.translation.x += deltaX
        object.translation.y += deltaY
      }
    }

    this.lastDragX = localX
    this.lastDragY = localY
    this.redraw()
    this.dispatchContentChanged()
  }

  private onObjectDragUp(): void {
    this.isObjectDragging = false
    this.endEvent()
    this.redraw()
  }

  private onSelectionDrag(e: MouseEvent): void {
    if (this.isSelectionDragging) {
      const b = this.selectionDraggingOrigin
      if (!b) throw new Error("Selection dragging origin is null")

      // Clear previous selection
      this.selection = []
      const { x: localX, y: localY } = this.outerCoords(e)
      // Store the current event target as lastDragX and lastDragY
      this.lastDragX = localX
      this.lastDragY = localY

      // Check each object for intersection with the selection box
      for (const object of this.objects) {
        if (
          !(object.locked ?? false) &&
          intersectAABB(this.selectionBoundingBox, object.boundingBox)
        ) {
          this.selection.push(object.id)
        }
      }

      this.redraw()
    }
  }

  public get activeToolId(): Tool {
    return this._activeToolId
  }

  public set activeToolId(value: Tool) {
    this._activeToolId = value
    this.redraw()
    this.updateCursor()
  }

  private onSelectionDragUp(): void {
    this.isSelectionDragging = false
    this.selectionDraggingOrigin = null
    this.endEvent()
    this.redraw()
  }

  private onBezierPointDrag(e: MouseEvent): void {
    if (!this.isDraggingBezierPoints) return

    const { x: localX, y: localY } = this.outerCoords(e)
    const deltaX = localX - this.lastDragX!
    const deltaY = localY - this.lastDragY!

    this.moveSelectedBezierPoints(deltaX, deltaY)

    this.lastDragX = localX
    this.lastDragY = localY
    this.redraw()
  }

  private moveSelectedBezierPoints(deltaX: number, deltaY: number): void {
    const bzo = this.bezierEditingObject
    if (!bzo) throw new Error("Expected selected object to be a Bezier")
    if (!this.bezierSelection) throw new Error("Expected bezier selection to be set")

    const s = this.bezierSelection

    const newControlPoints = bzo.controlPoints.map((p, i) => {
      // copy point
      const point = { ...p }
      const { type } = point
      const s0 = s.get(i, 0)
      const p0 = i > 0 ? s.get(i - 1, 0) : false
      if (type !== "closePath" && s0) {
        point.x += deltaX
        point.y += deltaY
      }
      if (point.type === "quadraticCurveTo" && s.get(i, 1)) {
        point.controlX += deltaX
        point.controlY += deltaY
      } else if (point.type === "cubicCurveTo") {
        if (p0 || s.get(i, 1)) {
          point.controlX1 += deltaX
          point.controlY1 += deltaY
        }
        if (s0 || s.get(i, 2)) {
          point.controlX2 += deltaX
          point.controlY2 += deltaY
        }
      }
      return point
    })

    bzo.controlPoints = newControlPoints
    this.dispatchContentChanged()
    this.redraw()
  }

  private onBezierPointDragUp(): void {
    this.isDraggingBezierPoints = false
    this.endEvent()
    this.redraw()
  }

  private onMiddleDrag(e: MouseEvent): void {
    if (this.isMiddleDragging) {
      const { x: localX, y: localY } = this.outerCoords(e)
      const deltaX = localX - this.lastDragX!
      const deltaY = localY - this.lastDragY!
      this.scrollX -= deltaX
      this.scrollY -= deltaY
      this.lastDragX = localX
      this.lastDragY = localY
      this.redraw()
    }
  }

  private onMiddleDragUp(e: MouseEvent): void {
    if (e.button === 1 /* Middle mouse button */) {
      this.isMiddleDragging = false
      this.endEvent()
      this.redraw()
    }
  }

  /** Setup the event listers that are always on (not triggered by another event) */
  private setupEventListeners(): void {
    // Use wheel event instead of scroll for canvas
    const onWheel = this.onWheel.bind(this)
    this.canvas.addEventListener("wheel", onWheel)
    this.disposers.push(() => this.canvas.removeEventListener("wheel", onWheel))

    // Listen for middle mouse drags
    this.isMiddleDragging = false
    this.lastDragX = 0
    this.lastDragY = 0

    const onKeyDown = this.onKeyDown.bind(this)
    window.addEventListener("keydown", onKeyDown)
    this.disposers.push(() => window.removeEventListener("keydown", onKeyDown))

    const onMouseDown = this.onMouseDown.bind(this)
    this.canvas.addEventListener("mousedown", onMouseDown)
    this.disposers.push(() => {
      this.canvas.removeEventListener("mousedown", onMouseDown)
    })

    const onMouseMove = this.onMouseMove.bind(this)
    this.canvas.addEventListener("mousemove", onMouseMove)
    this.disposers.push(() => {
      this.canvas.removeEventListener("mousemove", onMouseMove)
    })

    const onDoubleClick = this.onDoubleClick.bind(this)
    this.canvas.addEventListener("dblclick", onDoubleClick)
    this.disposers.push(() => {
      this.canvas.removeEventListener("dblclick", onDoubleClick)
    })

    // Listen for device pixel ratio changes
    const onDevicePixelRatioChange = this.onDevicePixelRatioChange.bind(this)
    window.matchMedia("(resolution)").addEventListener("change", onDevicePixelRatioChange)
    this.disposers.push(() =>
      window.matchMedia("(resolution)").removeEventListener("change", onDevicePixelRatioChange),
    )
    // Listen for color scheme changes
    const dmq = window.matchMedia("(prefers-color-scheme: dark)")
    const onColorSchemeChange = this.onColorSchemeChange.bind(this)
    dmq.addEventListener("change", onColorSchemeChange)
    this.disposers.push(() => dmq.removeEventListener("change", onColorSchemeChange))
    this.isDarkMode = dmq.matches || document.documentElement.classList.contains("dark")
  }

  private onDevicePixelRatioChange(): void {
    const newDPR = window.devicePixelRatio || 1
    if (newDPR !== this.devicePixelRatio) {
      this._pattern = undefined
      this.devicePixelRatio = newDPR
      this.resize(
        this.canvas.width / this.devicePixelRatio,
        this.canvas.height / this.devicePixelRatio,
      )
    }
  }

  private redraw(): void {
    const scrollX = this.scrollX
    const scrollY = this.scrollY
    const dpr = this.devicePixelRatio
    const DS = this.isDarkMode ? designSystem.dark : designSystem.light

    this.ctx.resetTransform()

    // Clear the canvas
    this.ctx.save()
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.fillStyle = this.pattern
    // Offset by scroll position modulo the grid size to ensure that the dots scroll
    this.ctx.translate((-scrollX * dpr) % (GRID_SIZE * dpr), (-scrollY * dpr) % (GRID_SIZE * dpr))
    this.ctx.fillRect(0, 0, this.canvas.width + GRID_SIZE, this.canvas.height + GRID_SIZE)
    this.ctx.restore()

    // translate matrix
    this.ctx.save()
    // Draw all objects
    this.ctx.scale(dpr, dpr)
    this.ctx.translate(-scrollX, -scrollY)
    for (const object of this.objects) {
      object.draw(this.ctx)
    }

    // Draw bezier curve control points
    if (this.isEditingBezier) {
      if (this.selection.length !== 1) {
        throw new Error("Expected exactly one object to be selected in bezier editing mode")
      }
      const obj = this.bezierEditingObject
      if (!obj || !(obj instanceof PathLayer)) {
        throw new Error("Expected selected object to be a Bezier")
      }
      if (this.bezierSelection === null) {
        throw new Error("Expected bezier selection to be set")
      }
      this.ctx.save()
      this.ctx.translate(obj.translation.x, obj.translation.y)

      const drawPoint = (x: number, y: number, selected: boolean) => {
        this.ctx.beginPath()
        this.ctx.arc(x, y, 3, 0, 2 * Math.PI)
        this.ctx.fillStyle = selected ? DS.bezierPointFillSelected : DS.bezierPointFill
        this.ctx.strokeStyle = selected ? DS.bezierPointStrokeSelected : DS.bezierPointStroke
        this.ctx.fill()
        this.ctx.stroke()
      }

      const drawControlPoint = (x: number, y: number, selected: boolean) => {
        this.ctx.beginPath()
        const r = DS.bezierControlPointWidth
        this.ctx.fillStyle = selected
          ? DS.bezierControlPointFillSelected
          : DS.bezierControlPointFill
        this.ctx.strokeStyle = selected
          ? DS.bezierControlPointStrokeSelected
          : DS.bezierControlPointStroke
        this.ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
        this.ctx.strokeRect(x - r, y - r, 2 * r, 2 * r)
      }

      const drawControlArm = (x0: number, y0: number, x1: number, y1: number) => {
        this.ctx.beginPath()
        this.ctx.moveTo(x0, y0)
        this.ctx.lineTo(x1, y1)
        this.ctx.lineWidth = DS.bezierControlPointArmWidth
        this.ctx.strokeStyle = DS.bezierControlPointArmStroke
        this.ctx.stroke()
      }

      // Draw in layers so that control points are on top of arms, etc.
      for (const layer of ["arms", "points", "controlPoints"]) {
        for (const { prev, current: point, index: i } of obj.segments()) {
          const s = this.bezierSelection
          // TODO: deduplicate this code with the Path object
          const prevSelected = prev ? s.get(i - 1, 0) || s.get(i - 1, 1) || s.get(i - 1, 2) : false
          const currentSelected = s.get(i, 0) || s.get(i, 1) || s.get(i, 2)
          const showControl = prevSelected || currentSelected

          if (layer === "points") {
            const selected = s.get(i, 0)
            if (point.type === "moveTo") {
              drawPoint(point.x, point.y, s.get(i, 0))
            } else if (point.type === "lineTo") {
              drawPoint(point.x, point.y, selected)
            } else if (point.type === "quadraticCurveTo") {
              drawPoint(point.x, point.y, selected)
            } else if (point.type === "cubicCurveTo") {
              drawPoint(point.x, point.y, selected)
            }
          } else if (layer === "arms") {
            if (point.type === "quadraticCurveTo" && showControl) {
              drawControlArm(point.x, point.y, point.controlX, point.controlY)
            } else if (point.type === "cubicCurveTo" && showControl) {
              if (prev && prev.type !== "closePath") {
                drawControlArm(prev.x, prev.y, point.controlX1, point.controlY1)
              }
              drawControlArm(point.x, point.y, point.controlX2, point.controlY2)
            }
          } else if (layer === "controlPoints") {
            if (point.type === "quadraticCurveTo" && showControl) {
              const s1 = s.get(i, 1)
              drawControlPoint(point.controlX, point.controlY, s1)
            } else if (point.type === "cubicCurveTo" && showControl) {
              const s1 = s.get(i, 1)
              const s2 = s.get(i, 2)
              drawControlPoint(point.controlX1, point.controlY1, s1)
              drawControlPoint(point.controlX2, point.controlY2, s2)
            }
          }
        }
      }
      // if we're hovering over a bezier segment, draw a circle at the nearest point
      if (
        this.nearestBezierSegment &&
        this.activeToolId === Tool.PEN &&
        !this.isDraggingBezierPoints
      ) {
        const { x, y } = obj.pointForNearestSegment(this.nearestBezierSegment)
        drawPoint(x, y, false)
      }
      this.ctx.restore()
    } else {
      // Draw selection around the currently selected objects
      this.ctx.strokeStyle = DS.selectionBox
      this.ctx.lineWidth = 1
      for (const id of this.selection) {
        const object = this.objects.find(o => o.id === id)
        if (object) {
          const { x, y, width, height } = object.boundingBox
          this.ctx.strokeRect(x, y, width, height)
        }
      }
    }

    // Draw selection box
    if (this.isSelectionDragging) {
      const box = this.selectionBoundingBox
      if (!box) return
      this.ctx.save()
      this.ctx.fillStyle = DS.selectionDragBoxFill
      this.ctx.strokeStyle = DS.selectionDragBoxStroke
      this.ctx.lineWidth = 1
      this.ctx.strokeRect(box.x, box.y, box.width, box.height)
      this.ctx.globalAlpha = DS.selectionDragBoxFillOpacity
      this.ctx.fillRect(box.x, box.y, box.width, box.height)
      this.ctx.globalAlpha = 1.0
      this.ctx.restore()
    }
    // restore matrix
    this.ctx.restore()

    // Debug info
    if (DEBUG) {
      const tool = this._activeToolId
      this.ctx.fillStyle = DS.debugText
      const bzm = this.isEditingBezier ? "Béz editing" : ""
      this.ctx.fillText(`Tool: ${tool}, ${bzm} Scroll position: (${scrollX}, ${scrollY})`, 10, 20)
      if (this.isMiddleDragging) {
        this.ctx.fillText(`Middle dragging at: (${this.lastDragX}, ${this.lastDragY})`, 10, 40)
      }
      if (this.isSelectionDragging) {
        this.ctx.fillText(
          `Selection dragging at: last(${this.lastDragX}, ${this.lastDragY}), origin(${this.selectionDraggingOrigin?.x}, ${this.selectionDraggingOrigin?.y})`,
          10,
          60,
        )
      }
      if (this.isObjectDragging) {
        this.ctx.fillText(`Object dragging at: (${this.lastDragX}, ${this.lastDragY})`, 10, 80)
      }
      if (this.isEditingBezier) {
        let s = this.bezierSelection?.toString()
        // true -> T, false -> F
        s = s?.replace(/true/g, "T").replace(/false/g, "F")
        const nf = Intl.NumberFormat()
        const ns = this.nearestBezierSegment
          ? `(${this.nearestBezierSegment.index}, ${nf.format(this.nearestBezierSegment.t)})`
          : ""
        this.ctx.fillText(`Bezier editing: (${s}) n/s ${ns}`, 10, 100)
      }
    }
  }

  private dispatchContentChanged(): void {
    this.dispatchEvent(new CustomEvent(Events.CONTENT_CHANGED))
  }

  private dispatchViewportChanged(): void {
    this.dispatchEvent(new CustomEvent(Events.VIEWPORT_CHANGED))
  }

  public resize(width: number, height: number): void {
    this.canvas.width = width * this.devicePixelRatio
    this.canvas.height = height * this.devicePixelRatio
    this.redraw()
  }

  public exportSVG(): string {
    const svgNS = "http://www.w3.org/2000/svg"
    const svg = document.createElementNS(svgNS, "svg")
    svg.setAttribute("width", this.canvas.width.toString())
    svg.setAttribute("height", this.canvas.height.toString())
    const currentArtboard = this.objects.find(obj => obj instanceof Artboard)
    if (currentArtboard) {
      const { x, y, width, height } = currentArtboard.boundingBox
      svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`)
    } else {
      svg.setAttribute("viewBox", `0 0 ${this.canvas.width} ${this.canvas.height}`)
    }

    for (const object of this.objects) {
      if ("toSVG" in object && typeof object.toSVG === "function") {
        const path = object.toSVG()
        svg.appendChild(path)
      }
    }

    const serializer = new XMLSerializer()
    return serializer.serializeToString(svg)
  }

  public importSVG(svg: string): void {
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svg, "image/svg+xml")
    const svgElement = svgDoc.documentElement

    if (svgElement.tagName !== "svg") {
      throw new Error("Invalid SVG: Root element is not <svg>")
    }

    // Clear existing objects
    this.objects = []

    // Process path elements and groups
    const processElement = (element: Element) => {
      if (element.tagName === "path") {
        const pathLayer = PathLayer.fromSVGPath(element as SVGPathElement, this.objects.length)
        this.objects.push(pathLayer)
      } else if (element.tagName === "g") {
        Array.from(element.children).forEach(processElement)
      }
    }

    Array.from(svgElement.children).forEach(processElement)
    this.redraw()
  }

  public dispose(): void {
    console.log("Disposing CanvasEditor")
    this.disposers.forEach(d => d())
  }
}

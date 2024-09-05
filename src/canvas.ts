import { buildDotPatternImage } from './dotGrid';
import { AABB, intersectAABB, Point2D } from './geom';
import { PathLayer, BezierSubselection } from './objects/bezier';
import { RedCircle } from './objects/redCircle';

import resolveConfig from 'tailwindcss/resolveConfig';
import tailwindConfigData from '../tailwind.config';
import { Disposable } from './interface/disposable';
import { Tool } from './toolShelf';
import { MultiArray } from './multiArray';

const tw = resolveConfig(tailwindConfigData);

export const GRID_SIZE = 16;
export const DEBUG = true;

export type CanvasID = number;

export interface CanvasObject {
  id: CanvasID;
  readonly boundingBox: AABB;
  translation: Point2D;
  draw(ctx: CanvasRenderingContext2D): void;
}

const designSystem = {
  light: {
    canvasBackground: tw.theme.colors.white,
    canvasBackgroundDot: tw.theme.colors.gray[300],

    selectionDragBoxStroke: tw.theme.colors.gray[500],
    selectionDragBoxFill: tw.theme.colors.gray[200],
    selectionDragBoxFillOpacity: 0.25,
    selectionBox: tw.theme.colors.blue[500],

    bezierPointFill: tw.theme.colors.gray[500],
    bezierPointStroke: tw.theme.colors.blue[500],
    bezierPointFillSelected: tw.theme.colors.blue[500],

    bezierControlPointArmStroke: tw.theme.colors.gray[900],
    bezierControlPointArmWidth: 1,
    bezierControlPointWidth: 3,

    debugText: tw.theme.colors.black,
  },
  dark: {
    canvasBackground: tw.theme.colors.gray[900],
    canvasBackgroundDot: tw.theme.colors.gray[700],

    selectionDragBoxStroke: tw.theme.colors.gray[400],
    selectionDragBoxFill: tw.theme.colors.gray[700],
    selectionDragBoxFillOpacity: 0.25,
    selectionBox: tw.theme.colors.blue[400],

    bezierPointFill: tw.theme.colors.gray[400],
    bezierPointStroke: tw.theme.colors.blue[400],
    bezierPointFillSelected: tw.theme.colors.blue[400],

    bezierControlPointArmStroke: tw.theme.colors.gray[400],
    bezierControlPointArmWidth: 1,
    bezierControlPointWidth: 3,

    debugText: tw.theme.colors.white,
  },
};

export class CanvasEditor implements Disposable {
  /**
   * CanvasEditor is a class that manages a canvas element and its rendering context.
   * Logically, it has an infinite size.
   */

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private pattern: CanvasPattern;
  private devicePixelRatio: number;

  // Scroll position in canvas coordinates
  private scrollX = 0;
  private scrollY = 0;

  // Reused for drag/pan events, stores previous mouse position within our element so we can calculate the delta
  private lastDragX?: number;
  private lastDragY?: number;
  // Keep around functions to unregister event listeners when the current gesture is done
  private eventCleanups: (() => void)[] = [];

  /// State vars
  private isMiddleDragging: boolean = false;
  private isSelectionDragging: boolean = false;
  private selectionDraggingOrigin?: Point2D | null = null;
  private isObjectDragging: boolean = false;
  // Selection should be a single object. We are editing a specific bezier curve.
  private isEditingBezier: boolean = false;
  private bezierSelection: BezierSubselection | null = null;
  private isDraggingBezierPoints: boolean = false;

  /// Scene graph
  // Factories object maps from a name of a subtype of CanvasObject to a function that creates an instance of that subtype
  private factories: { circle: () => RedCircle; bezier: () => PathLayer };
  private nextId = 1;
  private selection: CanvasID[] = [];
  private objects: CanvasObject[];

  // Store functions that cleanup when we are disposed
  private disposers: (() => void)[] = [];

  private _activeToolId: Tool = Tool.HAND;

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    console.log('Device pixel ratio:', dpr);
    this.devicePixelRatio = dpr; // Store the device pixel ratio
    // Set the canvas size to the container size
    const width = container.clientWidth;
    const height = container.clientHeight;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;

    // resolve query to check if light or dark mode
    const dmq = window.matchMedia('(prefers-color-scheme: dark)');
    const DS = dmq.matches ? designSystem.dark : designSystem.light;

    // Create a pattern for the background
    const patternCanvas = buildDotPatternImage(dpr, DS.canvasBackgroundDot);
    // Set the background pattern
    const pattern = this.ctx.createPattern(patternCanvas, 'repeat');
    if (!pattern) throw new Error('Failed to create canvas background');
    this.pattern = pattern;

    this.factories = {
      circle: () => new RedCircle(this.nextId++),
      bezier: () => new PathLayer(this.nextId++),
    };

    this.objects = [this.factories.circle(), this.factories.bezier()];

    this.container.appendChild(this.canvas);

    this.setupEventListeners();
    this.redraw();
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const deltaX = event.deltaX;
    const deltaY = event.deltaY;
    // Implement zooming or panning logic here
    this.scrollX += deltaX;
    this.scrollY += deltaY;
    // round to nearest retina pixel
    const dpr = this.devicePixelRatio;
    this.scrollX = Math.round(this.scrollX * dpr) / dpr;
    this.scrollY = Math.round(this.scrollY * dpr) / dpr;
    this.redraw();
  }

  private hitTest(x: number, y: number): CanvasObject | null {
    for (const object of this.objects) {
      const { x: x0, y: y0, width, height } = object.boundingBox;
      if (x >= x0 && x <= x0 + width && y >= y0 && y <= y0 + height) {
        return object;
      }
    }
    return null;
  }

  private outerCoords(e: MouseEvent): Point2D {
    const bb = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - bb.left,
      y: e.clientY - bb.top,
    };
  }

  private beginEvent() {
    // Run any cleanup functions from previous events
    if (this.eventCleanups.length > 0) {
      console.error('Event cleanup not run');
      this.endEvent();
    }
    this.eventCleanups = [];
  }

  private endEvent() {
    this.eventCleanups.forEach(cleanup => cleanup());
    this.eventCleanups = [];
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.isEditingBezier) {
        this.isEditingBezier = false;
        this.redraw();
        e.preventDefault();
      } else {
        this.selection = [];
        this.redraw();
        e.preventDefault();
      }
    } else if (e.key === 'Enter') {
      if (this.selection.length === 1) {
        const object = this.objects.find(o => o.id === this.selection[0]);
        if (object instanceof PathLayer) {
          this.isEditingBezier = !this.isEditingBezier;
          if (this.isEditingBezier) {
            this.bezierSelection = new MultiArray([object.controlPoints.length, 3], false);
          }
          this.redraw();
          e.preventDefault();
        }
      }
    }
  }

  private onMouseDown(e: MouseEvent): void {
    const { x: localX, y: localY } = this.outerCoords(e);
    if (e.button === 1) {
      // Middle mouse button

      this.isMiddleDragging = true;
      this.lastDragX = localX;
      this.lastDragY = localY;

      // Listen on the window to capture mouse move/up events outside the canvas
      this.beginEvent();
      const onMouseMove = this.onMiddleDrag.bind(this);
      const onMouseUp = this.onMiddleDragUp.bind(this);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      this.eventCleanups.push(() => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      });
    } else if (e.button === 0) {
      // Left mouse button
      const canvasX = localX + this.scrollX;
      const canvasY = localY + this.scrollY;

      if (this.isEditingBezier) {
        const bzo = this.objects.find(o => o.id === this.selection[0]);
        if (!bzo || !(bzo instanceof PathLayer)) {
          throw new Error('Expected selected object to be a Bezier');
        }
        const hit = hitTestBezierControlPoints(
          bzo,
          canvasX - bzo.translation.x,
          canvasY - bzo.translation.y
        );
        console.log('hitTestBezier', canvasX, canvasY, hit);

        if (hit) {
          const [i, j] = hit;
          if (!this.bezierSelection) throw new Error('Expected bezier selection to be set');
          const wasSelected = this.bezierSelection.get(i, j);
          // copy
          this.isDraggingBezierPoints = true;
          this.lastDragX = localX;
          this.lastDragY = localY;
          this.beginEvent();
          const onMouseMove = this.onBezierPointDrag.bind(this);
          const onMouseUp = this.onBezierPointDragUp.bind(this);
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
          this.eventCleanups.push(() => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
          });
          if (wasSelected) {
            // Start dragging the bezier point
          } else {
            // Select just this point
            const bzs = new MultiArray([bzo.controlPoints.length, 3], false);
            bzs.set(true, i, j);
            this.bezierSelection = bzs;
          }
          this.redraw();
        } else {
          // Clicked something that is not a control point. Ignore.
        }
        return;
      }

      const object = this.hitTest(canvasX, canvasY);
      if (object) {
        if (!this.selection.includes(object.id)) {
          // Reset selection if you drag an object that is not selected
          this.selection = [object.id];
        }
        this.isObjectDragging = true;
        this.lastDragX = localX;
        this.lastDragY = localY;

        this.beginEvent();
        const onMouseMove = this.onObjectDrag.bind(this);
        const onMouseUp = this.onObjectDragUp.bind(this);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        this.eventCleanups.push(() => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        });
      } else {
        this.isSelectionDragging = true;
        this.lastDragX = localX;
        this.lastDragY = localY;
        this.selection = [];

        this.selectionDraggingOrigin = { x: localX + this.scrollX, y: localY + this.scrollY };

        // Listen on the window to capture mouse move/up events outside the canvas
        this.beginEvent();
        const onMouseMove = this.onSelectionDrag.bind(this);
        const onMouseUp = this.onSelectionDragUp.bind(this);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        this.eventCleanups.push(() => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        });
      }
    }
  }

  /** selection bounding box, in internal canvas coordinates */
  private get selectionBoundingBox(): AABB {
    const origin = this.selectionDraggingOrigin;
    if (!origin) throw new Error('Selection dragging origin is null');
    const canvasX = this.lastDragX! + this.scrollX;
    const canvasY = this.lastDragY! + this.scrollY;
    return {
      x: Math.min(canvasX, origin.x),
      y: Math.min(canvasY, origin.y),
      width: Math.abs(canvasX - origin.x),
      height: Math.abs(canvasY - origin.y),
    };
  }

  private onObjectDrag(e: MouseEvent): void {
    if (!this.isObjectDragging) throw new Error('Object dragging is not active');

    const { x: localX, y: localY } = this.outerCoords(e);
    const deltaX = localX - this.lastDragX!;
    const deltaY = localY - this.lastDragY!;

    // Update the position of all selected objects
    for (const id of this.selection) {
      const object = this.objects.find(obj => obj.id === id);
      if (object) {
        object.translation.x += deltaX;
        object.translation.y += deltaY;
      }
    }

    this.lastDragX = localX;
    this.lastDragY = localY;
    this.redraw();
  }

  private onObjectDragUp(): void {
    this.isObjectDragging = false;
    this.endEvent();
    this.redraw();
  }

  private onSelectionDrag(e: MouseEvent): void {
    if (this.isSelectionDragging) {
      const b = this.selectionDraggingOrigin;
      if (!b) throw new Error('Selection dragging origin is null');

      // Clear previous selection
      this.selection = [];
      const { x: localX, y: localY } = this.outerCoords(e);
      // Store the current event target as lastDragX and lastDragY
      this.lastDragX = localX;
      this.lastDragY = localY;

      // Check each object for intersection with the selection box
      for (const object of this.objects) {
        if (intersectAABB(this.selectionBoundingBox, object.boundingBox)) {
          this.selection.push(object.id);
        }
      }

      this.redraw();
    }
  }

  public get activeToolId(): Tool {
    return this._activeToolId;
  }

  public set activeToolId(value: Tool) {
    this._activeToolId = value;
    this.redraw();
  }

  private onSelectionDragUp(): void {
    this.isSelectionDragging = false;
    this.selectionDraggingOrigin = null;
    this.endEvent();
    this.redraw();
  }

  private onBezierPointDrag(e: MouseEvent): void {
    if (!this.isDraggingBezierPoints) return;

    const { x: localX, y: localY } = this.outerCoords(e);
    const deltaX = localX - this.lastDragX!;
    const deltaY = localY - this.lastDragY!;

    const bzo = this.objects.find(o => o.id === this.selection[0]);
    if (!bzo || !(bzo instanceof PathLayer)) {
      throw new Error('Expected selected object to be a Bezier');
    }

    this.moveSelectedBezierPoints(deltaX, deltaY);

    this.lastDragX = localX;
    this.lastDragY = localY;
    this.redraw();
  }

  private moveSelectedBezierPoints(deltaX: number, deltaY: number): void {
    const bzo = this.objects.find(o => o.id === this.selection[0]);
    if (!bzo || !(bzo instanceof PathLayer)) {
      throw new Error('Expected selected object to be a Bezier');
    }
    if (!this.bezierSelection) {
      throw new Error('Expected bezier selection to be set');
    }
    const s = this.bezierSelection;

    const newControlPoints = bzo.controlPoints.map((_point, i) => {
      // copy point
      const point = { ..._point };
      const { type } = point;
      const s0 = s.get(i, 0);
      const p0 = i > 0 ? s.get(i - 1, 0) : false;
      if (type !== 'closePath' && s0) {
        point.x += deltaX;
        point.y += deltaY;
      }
      if (point.type === 'quadraticCurveTo' && s.get(i, 1)) {
        point.controlX += deltaX;
        point.controlY += deltaY;
      } else if (point.type === 'cubicCurveTo') {
        if (p0 || s.get(i, 1)) {
          point.controlX1 += deltaX;
          point.controlY1 += deltaY;
        }
        if (s0 || s.get(i, 2)) {
          point.controlX2 += deltaX;
          point.controlY2 += deltaY;
        }
      }
      return point;
    });

    // Use setter method instead of direct assignment
    bzo.controlPoints = newControlPoints;
    this.redraw();
  }

  private onBezierPointDragUp(): void {
    this.isDraggingBezierPoints = false;
    this.endEvent();
    this.redraw();
  }

  private onMiddleDrag(e: MouseEvent): void {
    if (this.isMiddleDragging) {
      const { x: localX, y: localY } = this.outerCoords(e);
      const deltaX = localX - this.lastDragX!;
      const deltaY = localY - this.lastDragY!;
      this.scrollX -= deltaX;
      this.scrollY -= deltaY;
      this.lastDragX = localX;
      this.lastDragY = localY;
      this.redraw();
    }
  }

  private onMiddleDragUp(e: MouseEvent): void {
    if (e.button === 1 /* Middle mouse button */) {
      this.isMiddleDragging = false;
      this.endEvent();
      this.redraw();
    }
  }

  /** Setup the event listers that are always on (not triggered by another event) */
  private setupEventListeners(): void {
    // Use wheel event instead of scroll for canvas
    const onWheel = this.onWheel.bind(this);
    this.canvas.addEventListener('wheel', onWheel);
    this.disposers.push(() => this.canvas.removeEventListener('wheel', onWheel));

    // Listen for middle mouse drags
    this.isMiddleDragging = false;
    this.lastDragX = 0;
    this.lastDragY = 0;

    const onKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => window.removeEventListener('keydown', onKeyDown));

    const onMouseDown = this.onMouseDown.bind(this);
    this.canvas.addEventListener('mousedown', onMouseDown);
    this.disposers.push(() => {
      this.canvas.removeEventListener('mousedown', onMouseDown);
    });

    // Listen for device pixel ratio changes
    const onDevicePixelRatioChange = this.onDevicePixelRatioChange.bind(this);
    window.matchMedia('(resolution)').addEventListener('change', onDevicePixelRatioChange);
    this.disposers.push(() =>
      window.matchMedia('(resolution)').removeEventListener('change', onDevicePixelRatioChange)
    );
  }

  private onDevicePixelRatioChange(): void {
    const newDPR = window.devicePixelRatio || 1;
    if (newDPR !== this.devicePixelRatio) {
      this.devicePixelRatio = newDPR;
      this.resize(
        this.canvas.width / this.devicePixelRatio,
        this.canvas.height / this.devicePixelRatio
      );
    }
  }

  private get isDarkMode(): boolean {
    return true;
  }

  private redraw(): void {
    const scrollX = this.scrollX;
    const scrollY = this.scrollY;
    const dpr = this.devicePixelRatio;
    const DS = this.isDarkMode ? designSystem.dark : designSystem.light;

    this.ctx.resetTransform();

    // Clear the canvas
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = this.pattern;
    // Offset by scroll position modulo the grid size to ensure that the dots scroll
    this.ctx.translate((-scrollX * dpr) % (GRID_SIZE * dpr), (-scrollY * dpr) % (GRID_SIZE * dpr));
    this.ctx.fillRect(0, 0, this.canvas.width + GRID_SIZE, this.canvas.height + GRID_SIZE);
    this.ctx.restore();

    // translate matrix
    this.ctx.save();
    // Draw all objects
    this.ctx.scale(dpr, dpr);
    this.ctx.translate(-scrollX, -scrollY);
    for (const object of this.objects) {
      object.draw(this.ctx);
    }

    // Draw bezier curve control points
    if (this.isEditingBezier) {
      if (this.selection.length !== 1) {
        throw new Error('Expected exactly one object to be selected in bezier editing mode');
      }
      const obj = this.objects.find(o => o.id === this.selection[0]);
      if (!obj || !(obj instanceof PathLayer)) {
        throw new Error('Expected selected object to be a Bezier');
      }
      if (this.bezierSelection === null) {
        throw new Error('Expected bezier selection to be set');
      }
      this.ctx.save();
      this.ctx.translate(obj.translation.x, obj.translation.y);

      const drawCurvePoint = (x: number, y: number, selected: boolean) => {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, 2 * Math.PI);
        this.ctx.fillStyle = selected ? DS.bezierPointFillSelected : DS.bezierPointFill;
        this.ctx.fill();
        this.ctx.strokeStyle = DS.bezierPointStroke;
        this.ctx.stroke();
      };

      const drawControlPoint = (x: number, y: number, selected: boolean) => {
        this.ctx.beginPath();
        this.ctx.fillStyle = selected ? DS.bezierPointFillSelected : DS.bezierPointFill;
        const r = DS.bezierControlPointWidth;
        this.ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      };

      const drawControlArm = (x0: number, y0: number, x1: number, y1: number) => {
        this.ctx.beginPath();
        this.ctx.moveTo(x0, y0);
        this.ctx.lineTo(x1, y1);
        this.ctx.lineWidth = DS.bezierControlPointArmWidth;
        this.ctx.strokeStyle = DS.bezierControlPointArmStroke;
        this.ctx.stroke();
      };

      for (let i = 0; i < obj.controlPoints.length; i++) {
        const point = obj.controlPoints[i];
        console.log('point', point, 'selection', [
          this.bezierSelection.get(i, 0),
          this.bezierSelection.get(i, 1),
          this.bezierSelection.get(i, 2),
        ]);
        if (point.type === 'moveTo') {
          drawCurvePoint(point.x, point.y, this.bezierSelection.get(i, 0));
        } else if (point.type === 'lineTo') {
          const selected = this.bezierSelection.get(i, 0);
          drawCurvePoint(point.x, point.y, selected);
        } else if (point.type === 'quadraticCurveTo') {
          const s0 = this.bezierSelection.get(i, 0);
          const s1 = this.bezierSelection.get(i, 1);
          const hasNext = i + 1 < obj.controlPoints.length;
          const n0 = hasNext && this.bezierSelection.get(i + 1, 0);
          drawCurvePoint(point.x, point.y, s0);
          // If this quad curve is selected, draw the control point
          if (s0 || s1 || n0) {
            drawControlPoint(point.controlX, point.controlY, s1);
            drawControlArm(point.x, point.y, point.controlX, point.controlY);
          }
        } else if (point.type === 'cubicCurveTo') {
          const s0 = this.bezierSelection.get(i, 0);
          const s1 = this.bezierSelection.get(i, 1);
          const s2 = this.bezierSelection.get(i, 2);
          const hasPrev = i > 0;
          const p0 = hasPrev && this.bezierSelection.get(i - 1, 0);
          drawCurvePoint(point.x, point.y, s0);
          // If either end of this cubic curve segment is selected, draw the control points, also if either control point is selected
          if (s0 || s1 || s2 || p0) {
            if (hasPrev) {
              const prevPoint = obj.controlPoints[i - 1];
              if (prevPoint.type !== 'closePath') {
                drawControlArm(prevPoint.x, prevPoint.y, point.controlX1, point.controlY1);
              }
            }
            drawControlArm(point.x, point.y, point.controlX2, point.controlY2);
            drawControlPoint(point.controlX1, point.controlY1, s1);
            drawControlPoint(point.controlX2, point.controlY2, s2);
          }
        }
      }
      this.ctx.restore();
    } else {
      // Draw selection around the currently selected objects
      this.ctx.strokeStyle = DS.selectionBox;
      this.ctx.lineWidth = 1;
      for (const id of this.selection) {
        const object = this.objects.find(o => o.id === id);
        if (object) {
          const { x, y, width, height } = object.boundingBox;
          this.ctx.strokeRect(x, y, width, height);
        }
      }
    }

    // Draw selection box
    if (this.isSelectionDragging) {
      const box = this.selectionBoundingBox;
      if (!box) return;
      this.ctx.save();
      this.ctx.fillStyle = DS.selectionDragBoxFill;
      this.ctx.strokeStyle = DS.selectionDragBoxStroke;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(box.x, box.y, box.width, box.height);
      this.ctx.globalAlpha = DS.selectionDragBoxFillOpacity;
      this.ctx.fillRect(box.x, box.y, box.width, box.height);
      this.ctx.globalAlpha = 1.0;
      this.ctx.restore();
    }
    // restore matrix
    this.ctx.restore();

    // Debug info
    if (DEBUG) {
      const tool = this._activeToolId;
      this.ctx.fillStyle = DS.debugText;
      const bzm = this.isEditingBezier ? 'Béz editing' : '';
      this.ctx.fillText(`Tool: ${tool}, ${bzm} Scroll position: (${scrollX}, ${scrollY})`, 10, 20);
      if (this.isMiddleDragging) {
        this.ctx.fillText(`Middle dragging at: (${this.lastDragX}, ${this.lastDragY})`, 10, 40);
      }
      if (this.isSelectionDragging) {
        this.ctx.fillText(
          `Selection dragging at: last(${this.lastDragX}, ${this.lastDragY}), origin(${this.selectionDraggingOrigin?.x}, ${this.selectionDraggingOrigin?.y})`,
          10,
          60
        );
      }
      if (this.isObjectDragging) {
        this.ctx.fillText(`Object dragging at: (${this.lastDragX}, ${this.lastDragY})`, 10, 80);
      }
      if (this.isEditingBezier) {
        let s = this.bezierSelection?.toString();
        // true -> T, false -> F
        s = s?.replace(/true/g, 'T').replace(/false/g, 'F');
        this.ctx.fillText(`Bezier editing: (${s})`, 10, 100);
      }
    }
  }

  public resize(width: number, height: number): void {
    this.canvas.width = width * this.devicePixelRatio;
    this.canvas.height = height * this.devicePixelRatio;
    this.redraw();
  }

  public dispose(): void {
    this.disposers.forEach(d => d());
  }
}

function hitTestBezierControlPoints(
  bezier: PathLayer,
  x: number,
  y: number,
  distance: number = 10
): [number, number] | undefined {
  const pointClose = (px: number, py: number) => {
    return Math.sqrt((px - x) ** 2 + (py - y) ** 2) < distance;
  };

  for (let i = 0; i < bezier.controlPoints.length; i++) {
    const point = bezier.controlPoints[i];
    if (point.type === 'moveTo') {
      if (pointClose(point.x, point.y)) {
        return [i, 0];
      }
    } else if (point.type === 'lineTo') {
      if (pointClose(point.x, point.y)) {
        return [i, 0];
      }
    } else if (point.type === 'quadraticCurveTo') {
      if (pointClose(point.x, point.y)) {
        return [i, 0];
      }
      if (pointClose(point.controlX, point.controlY)) {
        return [i, 1];
      }
    } else if (point.type === 'cubicCurveTo') {
      if (pointClose(point.x, point.y)) {
        return [i, 0];
      }
      if (pointClose(point.controlX1, point.controlY1)) {
        return [i, 1];
      }
      if (pointClose(point.controlX2, point.controlY2)) {
        return [i, 2];
      }
    }
  }
  return undefined;
}

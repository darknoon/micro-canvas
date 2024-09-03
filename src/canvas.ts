import { buildDotPatternImage } from './dotGrid';
import { RedCircle } from './objects/redCircle';

export const GRID_SIZE = 16;

export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export type CanvasID = number;

export interface CanvasObject {
  id: CanvasID;
  boundingBox: AABB;
  draw(ctx: CanvasRenderingContext2D): void;
}

export interface Disposable {
  dispose(): void;
}

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
  private scrollX = 0;
  private scrollY = 0;

  // Reused for drag events, stores previous mouse position within our element
  private lastDragX?: number;
  private lastDragY?: number;
  // State vars
  private isMiddleDragging: boolean = false;
  private isSelectionDragging: boolean = false;
  private selectionDraggingOrigin?: Point2D | null = null;

  private selection: CanvasID[] = [];
  private objects: CanvasObject[];
  // Store objects that unregister event listeners
  private disposers: (() => void)[] = [];
  private nextId = 1;

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

    // Create a pattern for the background
    const patternCanvas = buildDotPatternImage(dpr);
    // Set the background pattern
    const pattern = this.ctx.createPattern(patternCanvas, 'repeat');
    if (!pattern) throw new Error('Failed to create canvas background');
    this.pattern = pattern;

    this.objects = [new RedCircle(this.nextId++)];

    this.container.appendChild(this.canvas);

    this.setupEventListeners();
    this.redraw();
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const deltaX = event.deltaX;
    const deltaY = event.deltaY;
    // Implement zooming or panning logic here
    console.log('Wheel event:', deltaX, deltaY);
    this.scrollX += deltaX;
    this.scrollY += deltaY;
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

  private onMouseDown(e: MouseEvent): void {
    const { x: localX, y: localY } = this.outerCoords(e);
    if (e.button === 1) {
      // Middle mouse button
      this.isMiddleDragging = true;
      this.lastDragX = localX;
      this.lastDragY = localY;

      // Listen on the window to capture mouse move/up events outside the canvas
      const onMouseMove = this.onMiddleDrag.bind(this);
      const onMouseUp = this.onMiddleDragUp.bind(this);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      this.disposers.push(() => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      });
    } else if (e.button === 0) {
      // Left mouse button
      const object = this.hitTest(e.offsetX, e.offsetY);
      if (object) {
        console.log('Clicked on object:', object);
      } else {
        this.isSelectionDragging = true;
        this.lastDragX = localX;
        this.lastDragY = localY;
        this.selection = [];

        this.selectionDraggingOrigin = { x: localX + this.scrollX, y: localY + this.scrollY };

        // Listen on the window to capture mouse move/up events outside the canvas
        const onMouseMove = this.onSelectionDrag.bind(this);
        const onMouseUp = this.onSelectionDragUp.bind(this);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        this.disposers.push(() => {
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

  private onSelectionDrag(e: MouseEvent): void {
    if (this.isSelectionDragging) {
      const b = this.selectionDraggingOrigin;
      if (!b) throw new Error('Selection dragging origin is null');

      // Clear previous selection
      this.selection = [...this.selection];
      const { x: localX, y: localY } = this.outerCoords(e);
      // Store the current event target as lastDragX and lastDragY
      this.lastDragX = localX;
      this.lastDragY = localY;

      // Check each object for intersection with the selection box
      for (const object of this.objects) {
        if (this.intersectAABB(this.selectionBoundingBox, object.boundingBox)) {
          this.selection.push(object.id);
        }
      }

      this.redraw();
    }
  }

  private intersectAABB(a: AABB, b: AABB): boolean {
    return (
      a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
    );
  }

  private onSelectionDragUp(): void {
    this.isSelectionDragging = false;
    this.selectionDraggingOrigin = null;
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
      this.redraw();
    }
  }

  private setupEventListeners(): void {
    // Use wheel event instead of scroll for canvas
    const onWheel = this.onWheel.bind(this);
    this.canvas.addEventListener('wheel', onWheel);
    this.disposers.push(() => this.canvas.removeEventListener('wheel', onWheel));

    // Listen for middle mouse drags
    this.isMiddleDragging = false;
    this.lastDragX = 0;
    this.lastDragY = 0;

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

  private redraw(): void {
    const scrollX = this.scrollX;
    const scrollY = this.scrollY;
    const dpr = this.devicePixelRatio;

    // Clear the canvas
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = this.pattern;
    // Offset by scroll position modulo the grid size to ensure that the dots scroll
    this.ctx.translate((-scrollX * dpr) % (GRID_SIZE * dpr), (-scrollY * dpr) % (GRID_SIZE * dpr));
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();

    // translate matrix
    this.ctx.save();
    // Draw all objects
    this.ctx.scale(dpr, dpr);
    this.ctx.translate(-scrollX, -scrollY);
    for (const object of this.objects) {
      object.draw(this.ctx);
    }

    // Draw selection around the currently selected objects
    this.ctx.strokeStyle = 'blue';
    this.ctx.lineWidth = 1;
    for (const id of this.selection) {
      const object = this.objects.find(o => o.id === id);
      if (object) {
        const { x, y, width, height } = object.boundingBox;
        this.ctx.strokeRect(x, y, width, height);
      }
    }

    // Draw selection box
    if (this.isSelectionDragging) {
      const box = this.selectionBoundingBox;
      if (!box) return;
      this.ctx.save();
      this.ctx.strokeStyle = 'red';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(box.x, box.y, box.width, box.height);
      this.ctx.restore();
    }
    // restore matrix
    this.ctx.restore();

    // Debug info
    this.ctx.fillStyle = 'black';
    this.ctx.fillText(`Scroll position: (${scrollX}, ${scrollY})`, 10, 20);
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

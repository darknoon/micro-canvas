import { GRID_SIZE } from './canvas';

export function buildDotPatternImage(dpr: number, color: string = 'lightgrey'): HTMLCanvasElement {
  // Draws a dot pattern on a canvas element
  const canvas = document.createElement('canvas');
  canvas.width = GRID_SIZE * dpr;
  canvas.height = GRID_SIZE * dpr;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(1, 1, 1, 0, 2 * Math.PI);
  ctx.fill();
  return canvas;
}

import { GRID_SIZE } from "./canvas"

export function buildDotPatternImage(dpr: number, color: string = "lightgrey"): HTMLCanvasElement {
  // Draws a dot pattern on a canvas element
  const canvas = document.createElement("canvas")
  canvas.width = GRID_SIZE * dpr
  canvas.height = GRID_SIZE * dpr
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
  ctx.scale(dpr, dpr)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(1, 1, 1, 0, 2 * Math.PI)
  ctx.fill()
  return canvas
}

export function buildDotGridPatternImage(
  dpr: number,
  color: string = "lightgrey",
): HTMLCanvasElement {
  // Draws a dot pattern on a canvas element
  const canvas = document.createElement("canvas")
  canvas.width = GRID_SIZE * dpr
  canvas.height = GRID_SIZE * dpr
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
  ctx.scale(dpr, dpr)
  ctx.fillStyle = color

  function dot(x: number, y: number, size: number) {
    ctx.beginPath()
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, 2 * Math.PI)
    ctx.fill()
  }

  const r = 2

  // Draw primary dot
  ctx.globalAlpha = 0.5
  dot(0, 0, r)

  // Draw 3 smaller dots along x and y axes
  for (let i = 1; i <= 3; i++) {
    ctx.globalAlpha = 0.25
    dot(i * (GRID_SIZE / 4), 0, r)
    dot(0, i * (GRID_SIZE / 4), r)
  }
  return canvas
}

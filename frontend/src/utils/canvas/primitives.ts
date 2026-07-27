// Canvas drawing primitives shared across the canvas-based editors.

/** Draw a circular handle centred at (x, y). */
export function drawHandle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, size / 2, 0, Math.PI * 2)
  ctx.fill()
}

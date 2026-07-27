// Coordinate helpers shared across the canvas-based editors. These work in
// logical (CSS) pixels; DPI scaling is handled by the canvas setup.

import type { Point, Rect } from './types'

/**
 * Convert a DOM mouse/touch event to canvas-local logical coordinates. Works in
 * CSS pixels, matching the logical coordinate space the canvases render in.
 */
export function eventToCanvasCoords(
  event: MouseEvent | Touch,
  canvas: HTMLCanvasElement,
): Point {
  const rect = canvas.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

/** Clamp a value to the [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Clamp a point to a rectangle's bounds. */
export function clampToRect(x: number, y: number, rect: Rect): Point {
  return {
    x: clamp(x, rect.x, rect.x + rect.width),
    y: clamp(y, rect.y, rect.y + rect.height),
  }
}

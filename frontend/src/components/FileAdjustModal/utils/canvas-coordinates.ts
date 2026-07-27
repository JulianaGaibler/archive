// Coordinate transformation utilities.
// See also @src/utils/canvas/coordinates for other helper functions

import type { Point } from './types'

/** Calculate percentage position within dimensions */
export function coordsToPercentage(
  x: number,
  y: number,
  width: number,
  height: number,
): Point {
  return {
    x: (x / width) * 100,
    y: (y / height) * 100,
  }
}

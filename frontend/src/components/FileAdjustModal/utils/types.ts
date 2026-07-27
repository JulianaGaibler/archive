// Shared types for FileAdjustModal canvas utilities

export type DragMode =
  | 'move'
  | 'resize-nw'
  | 'resize-ne'
  | 'resize-sw'
  | 'resize-se'
  | 'trim-start'
  | 'trim-end'
  | 'scrub'

// Geometric primitives live in the neutral shared canvas module; re-exported
// here so existing FileAdjustModal imports keep working.
export type { Point, Rect } from '@src/utils/canvas/types'

export interface DrawColors {
  accent: string
  overlay: string
  grid: string
  handle: string
  marker: string
}

export interface DragHandler<T = unknown> {
  onStart: (x: number, y: number) => T | null // Returns drag target or null
  onMove: (x: number, y: number, target: T) => void
  onEnd: () => void
}

export interface DragState<T = unknown> {
  isDragging: boolean
  startX: number
  startY: number
  target: T | null
}

export interface ThumbnailOptions {
  count: number // Number of thumbnails to generate
  width: number // Thumbnail width in pixels
  height: number // Thumbnail height in pixels
  onProgress?: (index: number, bitmap: ImageBitmap) => void
  onComplete?: (bitmaps: ImageBitmap[]) => void
}

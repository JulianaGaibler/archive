import type { TemplateArea } from 'archive-shared/src/templates'
import { drawHandle } from '@src/utils/canvas/primitives'
import {
  layoutText,
  paintTextLines,
  transformText,
  outlineLineWidth,
} from '@src/utils/template-text-layout'

const HANDLE_SIZE = 8
const ROTATION_HANDLE_OFFSET = 30

export function drawTemplateAreas(
  ctx: CanvasRenderingContext2D,
  areas: TemplateArea[],
  selectedId: string | null,
  scaleX: number,
  scaleY: number,
  offsetX: number,
  offsetY: number,
): void {
  for (const area of areas) {
    const isSelected = area.id === selectedId
    drawArea(ctx, area, isSelected, scaleX, scaleY, offsetX, offsetY)
  }
}

function drawArea(
  ctx: CanvasRenderingContext2D,
  area: TemplateArea,
  isSelected: boolean,
  scaleX: number,
  scaleY: number,
  offsetX: number,
  offsetY: number,
): void {
  const cx = area.x * scaleX + offsetX + (area.width * scaleX) / 2
  const cy = area.y * scaleY + offsetY + (area.height * scaleY) / 2
  const w = area.width * scaleX
  const h = area.height * scaleY
  const rad = (area.rotation * Math.PI) / 180

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rad)

  // Fill with backplate color at configured opacity
  if (area.backplateOpacity > 0) {
    ctx.fillStyle = area.backplateColor
    ctx.globalAlpha = area.backplateOpacity / 100
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.globalAlpha = 1
  }

  // Draw border
  ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.6)'
  ctx.lineWidth = isSelected ? 2 : 1
  ctx.setLineDash(isSelected ? [] : [6, 4])
  ctx.strokeRect(-w / 2, -h / 2, w, h)
  ctx.setLineDash([])

  // Draw preview content: a placeholder glyph for image slots, sample text
  // for text areas.
  if (area.type === 'image') {
    drawImagePlaceholder(ctx, w, h)
  } else {
    drawPreviewText(ctx, area, w, h, scaleX)
  }

  if (isSelected) {
    // Corner handles
    const handleColor = '#ffffff'
    const corners = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: -w / 2, y: h / 2 },
      { x: w / 2, y: h / 2 },
    ]
    for (const c of corners) {
      drawHandle(ctx, c.x, c.y, HANDLE_SIZE, handleColor)
    }

    // Rotation handle
    ctx.beginPath()
    ctx.moveTo(0, -h / 2)
    ctx.lineTo(0, -h / 2 - ROTATION_HANDLE_OFFSET)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    ctx.stroke()
    drawHandle(ctx, 0, -h / 2 - ROTATION_HANDLE_OFFSET, HANDLE_SIZE, '#ffffff')
  }

  ctx.restore()
}

// A simple framed-picture glyph so authors can tell image slots apart from
// text areas at a glance. Drawn area-local (context already translated/rotated
// to the box centre).
function drawImagePlaceholder(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const s = Math.max(12, Math.min(40, Math.min(w, h) * 0.4))
  const half = s / 2

  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = Math.max(1, s * 0.06)

  // Frame
  ctx.strokeRect(-half, -half, s, s)

  // Clip the picture contents to the frame so nothing bleeds out.
  ctx.beginPath()
  ctx.rect(-half, -half, s, s)
  ctx.clip()

  // Sun
  ctx.beginPath()
  ctx.arc(-half + s * 0.3, -half + s * 0.3, s * 0.1, 0, Math.PI * 2)
  ctx.fill()

  // Mountains
  ctx.beginPath()
  ctx.moveTo(-half, half)
  ctx.lineTo(-half + s * 0.4, half - s * 0.45)
  ctx.lineTo(-half + s * 0.62, half - s * 0.18)
  ctx.lineTo(-half + s * 0.78, half - s * 0.34)
  ctx.lineTo(half, half)
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

const PREVIEW_TEXT = 'Lorem ipsum dolor sit amet'

function drawPreviewText(
  ctx: CanvasRenderingContext2D,
  area: TemplateArea,
  w: number,
  h: number,
  scaleX: number,
): void {
  if (area.fontSize * scaleX < 6) return

  const scaledArea = { ...area, fontSize: area.fontSize * scaleX }
  const layout = layoutText(
    ctx,
    scaledArea,
    transformText(PREVIEW_TEXT, area.uppercase),
    w,
    h,
  )

  ctx.textAlign =
    area.alignH === 'start'
      ? 'left'
      : area.alignH === 'end'
        ? 'right'
        : 'center'
  paintTextLines(ctx, layout, {
    fillStyle: area.textColor,
    strokeStyle: area.strokeColor ?? '#000000',
    strokeLineWidth: outlineLineWidth(layout.fontSize, area.strokeWidth),
  })
}

export function getAreaHandleHit(
  area: TemplateArea,
  px: number,
  py: number,
  scaleX: number,
  scaleY: number,
  offsetX: number,
  offsetY: number,
):
  | 'move'
  | 'resize-nw'
  | 'resize-ne'
  | 'resize-sw'
  | 'resize-se'
  | 'rotate'
  | null {
  const cx = area.x * scaleX + offsetX + (area.width * scaleX) / 2
  const cy = area.y * scaleY + offsetY + (area.height * scaleY) / 2
  const w = area.width * scaleX
  const h = area.height * scaleY
  const rad = -(area.rotation * Math.PI) / 180

  // Transform point into area-local coordinates
  const dx = px - cx
  const dy = py - cy
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad)
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad)

  const tol = HANDLE_SIZE + 6

  // Rotation handle
  const rotY = -h / 2 - ROTATION_HANDLE_OFFSET
  if (Math.abs(lx) < tol && Math.abs(ly - rotY) < tol) {
    return 'rotate'
  }

  // Corner handles
  const corners: Array<{
    x: number
    y: number
    mode: 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se'
  }> = [
    { x: -w / 2, y: -h / 2, mode: 'resize-nw' },
    { x: w / 2, y: -h / 2, mode: 'resize-ne' },
    { x: -w / 2, y: h / 2, mode: 'resize-sw' },
    { x: w / 2, y: h / 2, mode: 'resize-se' },
  ]

  for (const c of corners) {
    if (Math.abs(lx - c.x) < tol && Math.abs(ly - c.y) < tol) {
      return c.mode
    }
  }

  // Inside area = move
  if (lx >= -w / 2 && lx <= w / 2 && ly >= -h / 2 && ly <= h / 2) {
    return 'move'
  }

  return null
}

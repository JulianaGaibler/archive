import type { TemplateArea } from 'archive-shared/src/templates'
import {
  layoutText,
  paintTextLines,
  resolveFontFamily,
  transformText,
  outlineLineWidth,
} from '@src/utils/template-text-layout'

function areaTextAlign(alignH: string): CanvasTextAlign {
  return alignH === 'start' ? 'left' : alignH === 'end' ? 'right' : 'center'
}

export function renderTextInArea(
  ctx: CanvasRenderingContext2D,
  area: TemplateArea,
  text: string,
  _imageWidth: number,
  _imageHeight: number,
): void {
  if (!text.trim()) return

  const cx = area.x + area.width / 2
  const cy = area.y + area.height / 2
  const rad = (area.rotation * Math.PI) / 180

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rad)

  const w = area.width
  const h = area.height

  // Clip to area bounds
  ctx.beginPath()
  ctx.rect(-w / 2, -h / 2, w, h)
  ctx.clip()

  // Draw backplate
  if (area.backplateOpacity > 0) {
    ctx.fillStyle = area.backplateColor
    ctx.globalAlpha = area.backplateOpacity / 100
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.globalAlpha = 1
  }

  const layout = layoutText(
    ctx,
    area,
    transformText(text, area.uppercase),
    w,
    h,
  )

  ctx.textAlign = areaTextAlign(area.alignH)
  paintTextLines(ctx, layout, {
    fillStyle: area.textColor,
    strokeStyle: area.strokeColor ?? '#000000',
    strokeLineWidth: outlineLineWidth(layout.fontSize, area.strokeWidth),
  })

  ctx.restore()
}

export function renderPlaceholderInArea(
  ctx: CanvasRenderingContext2D,
  area: TemplateArea,
  index: number,
): void {
  const cx = area.x + area.width / 2
  const cy = area.y + area.height / 2
  const rad = (area.rotation * Math.PI) / 180

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rad)

  const w = area.width
  const h = area.height

  // Clip to area bounds
  ctx.beginPath()
  ctx.rect(-w / 2, -h / 2, w, h)
  ctx.clip()

  // Dashed border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.strokeRect(-w / 2, -h / 2, w, h)
  ctx.setLineDash([])

  // Use same layout logic as real text
  const placeholderText = transformText(`Text ${index + 1}`, area.uppercase)
  const layout = layoutText(ctx, area, placeholderText, w, h)

  // Override font to italic normal-weight for placeholder appearance
  ctx.font = `italic ${layout.fontSize}px ${resolveFontFamily(area.font)}`

  ctx.textAlign = areaTextAlign(area.alignH)
  paintTextLines(ctx, layout, { fillStyle: 'rgba(255, 255, 255, 0.4)' })

  ctx.restore()
}

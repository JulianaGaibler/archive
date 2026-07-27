import type { TemplateArea } from 'archive-shared/src/templates'
import {
  layoutText,
  paintTextLines,
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
): void {
  const cx = area.x + area.width / 2
  const cy = area.y + area.height / 2
  const rad = (area.rotation * Math.PI) / 180

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rad)

  const w = area.width
  const h = area.height

  // Lay out the placeholder exactly like real text so it previews the area's
  // actual styling (font, size, casing, outline). `layoutText` leaves the real
  // weighted font on the context, which paintTextLines then reuses.
  const placeholderText = transformText('Type here...', area.uppercase)
  const layout = layoutText(ctx, area, placeholderText, w, h)
  ctx.textAlign = areaTextAlign(area.alignH)

  // Measure the laid-out text so the dashed box hugs the text, not the area.
  ctx.letterSpacing = `${layout.letterSpacing}px`
  let maxLineWidth = 0
  for (const line of layout.lines) {
    maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width)
  }
  ctx.letterSpacing = '0px'

  const textH = (layout.lines.length - 1) * layout.lineHeight + layout.fontSize
  let boxLeft: number
  if (area.alignH === 'start') {
    boxLeft = layout.startX
  } else if (area.alignH === 'end') {
    boxLeft = layout.startX - maxLineWidth
  } else {
    boxLeft = layout.startX - maxLineWidth / 2
  }

  const pad = Math.max(4, layout.fontSize * 0.15)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.strokeRect(
    boxLeft - pad,
    layout.startY - pad,
    maxLineWidth + pad * 2,
    textH + pad * 2,
  )
  ctx.setLineDash([])

  // Paint with the area's real text styles.
  paintTextLines(ctx, layout, {
    fillStyle: area.textColor,
    strokeStyle: area.strokeColor ?? '#000000',
    strokeLineWidth: outlineLineWidth(layout.fontSize, area.strokeWidth),
  })

  ctx.restore()
}

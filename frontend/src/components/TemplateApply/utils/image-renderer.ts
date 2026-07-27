import type { TemplateArea } from 'archive-shared/src/templates'

/**
 * Draws a viewer-supplied image into an image area, fitted per `imageFit`
 * ('cover' fills the box and crops overflow; 'contain' fits the whole image,
 * letterboxing) and anchored via the area's alignH/alignV. Runs in the same
 * native-image coordinate space as `renderTextInArea` — the caller has already
 * applied the display/DPR scaling (live preview) or draws 1:1 (export).
 */
export function renderImageInArea(
  ctx: CanvasRenderingContext2D,
  area: TemplateArea,
  img: HTMLImageElement,
): void {
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  if (iw <= 0 || ih <= 0) return

  const cx = area.x + area.width / 2
  const cy = area.y + area.height / 2
  const rad = (area.rotation * Math.PI) / 180

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rad)

  const w = area.width
  const h = area.height

  // Clip to the box so 'cover' overflow is cropped.
  ctx.beginPath()
  ctx.rect(-w / 2, -h / 2, w, h)
  ctx.clip()

  // Backplate paints behind transparent images / contain letterboxing.
  if (area.backplateOpacity > 0) {
    ctx.fillStyle = area.backplateColor
    ctx.globalAlpha = area.backplateOpacity / 100
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.globalAlpha = 1
  }

  const scale =
    (area.imageFit ?? 'cover') === 'contain'
      ? Math.min(w / iw, h / ih)
      : Math.max(w / iw, h / ih)
  const dw = iw * scale
  const dh = ih * scale

  // Anchor the scaled image within the box. Same formula for cover and contain:
  // cover's rect is >= the box (crop), contain's is <= the box (letterbox).
  const dx =
    area.alignH === 'start'
      ? -w / 2
      : area.alignH === 'end'
        ? w / 2 - dw
        : -dw / 2
  const dy =
    area.alignV === 'start'
      ? -h / 2
      : area.alignV === 'end'
        ? h / 2 - dh
        : -dh / 2

  ctx.drawImage(img, dx, dy, dw, dh)

  ctx.restore()
}

/**
 * Draws an empty image slot: the backplate (if any) and a dashed box hugging
 * the whole area so viewers see where an image goes. The interactive icon +
 * hint text live in the DOM drop-zone overlay stacked above the canvas.
 */
export function renderImagePlaceholderInArea(
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

  if (area.backplateOpacity > 0) {
    ctx.fillStyle = area.backplateColor
    ctx.globalAlpha = area.backplateOpacity / 100
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.globalAlpha = 1
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.strokeRect(-w / 2, -h / 2, w, h)
  ctx.setLineDash([])

  ctx.restore()
}

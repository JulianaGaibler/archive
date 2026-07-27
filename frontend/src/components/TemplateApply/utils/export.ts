import type { TemplateConfig } from 'archive-shared/src/templates'
import { renderTextInArea } from './text-renderer'
import { renderImageInArea } from './image-renderer'
import { ensureAreaFontsLoaded } from '@src/utils/template-text-layout'

export async function renderTemplateToCanvas(
  image: HTMLImageElement,
  template: TemplateConfig,
  texts: string[],
  images: (HTMLImageElement | null)[],
): Promise<HTMLCanvasElement> {
  // Make sure the self-hosted fonts are loaded before drawing, otherwise the
  // export silently falls back to a system font.
  await ensureAreaFontsLoaded(template.areas)

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')!

  ctx.drawImage(image, 0, 0)

  for (let i = 0; i < template.areas.length; i++) {
    const area = template.areas[i]
    if (area.type === 'image') {
      // Empty image slots are simply left out of the export.
      const areaImage = images[i]
      if (areaImage) renderImageInArea(ctx, area, areaImage)
    } else {
      renderTextInArea(
        ctx,
        area,
        texts[i] || '',
        image.naturalWidth,
        image.naturalHeight,
      )
    }
  }

  return canvas
}

export async function downloadAsImage(
  canvas: HTMLCanvasElement,
  filename: string,
): Promise<void> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b)
      else reject(new Error('Failed to create blob'))
    }, 'image/png')
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function copyToClipboard(
  canvas: HTMLCanvasElement,
): Promise<void> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b)
      else reject(new Error('Failed to create blob'))
    }, 'image/png')
  })

  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

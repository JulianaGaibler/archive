import type { TemplateArea } from 'archive-shared/src/templates'

export interface TextLayout {
  lines: string[]
  fontSize: number
  lineHeight: number
  startX: number
  startY: number
  letterSpacing: number
}

/**
 * Maps a template `font` value to a CSS/canvas font-family stack.
 *
 * The meme fonts (Anton, Comic Neue, Jost) are self-hosted via @font-face in
 * global.sass and are listed first so rendering is identical on every OS;
 * system lookalikes follow only as a fallback while the woff2 loads. The
 * sans/serif options reuse the fonts already loaded by the design system.
 */
export function resolveFontFamily(font: string): string {
  switch (font) {
    case 'Serif':
      return 'Merriweather, serif'
    case 'Impact':
      return "'Anton', Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif"
    case 'Comic Sans':
      return "'Comic Neue', 'Comic Sans MS', cursive"
    case 'Jost':
      return "'Jost', Futura, 'Century Gothic', sans-serif"
    default:
      return 'HK Grotesk, sans-serif'
  }
}

/**
 * Anton (the "Impact" option) is a heavy display face shipped at a single
 * regular weight, so forcing bold only triggers ugly faux-bold. Everything else
 * is drawn bold — the weights we ship for Comic Neue and Jost.
 */
export function fontWeightFor(font: string): string {
  return font === 'Impact' ? 'normal' : 'bold'
}

/**
 * Force the self-hosted @font-face fonts used by the given areas to load, then
 * wait for the font set to settle. Canvas `fillText` silently falls back to a
 * system font if the face isn't loaded yet, so preview/export paths await this
 * before drawing (and repaint once it resolves).
 */
export async function ensureAreaFontsLoaded(
  areas: TemplateArea[],
): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  const specs = new Set<string>()
  for (const a of areas) {
    specs.add(`${fontWeightFor(a.font)} 16px ${resolveFontFamily(a.font)}`)
  }
  try {
    await Promise.all([...specs].map((s) => document.fonts.load(s)))
  } catch {
    // A missing/blocked font shouldn't break rendering — fall through.
  }
  await document.fonts.ready
}

/** Applies the area's casing transform to raw text. */
export function transformText(
  text: string,
  uppercase: boolean | undefined | null,
): string {
  return uppercase ? text.toUpperCase() : text
}

/**
 * Canvas line width for the text outline. `strokeWidth` is the visible outer
 * thickness as a percentage of the font size; the stroke is centred on the
 * glyph path, so we double it and paint the fill on top to keep the outline
 * fully outside the letterforms.
 */
export function outlineLineWidth(
  fontSize: number,
  strokeWidth: number | undefined | null,
): number {
  if (!strokeWidth || strokeWidth <= 0) return 0
  return fontSize * (strokeWidth / 100) * 2
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const paragraphs = text.split('\n')
  const lines: string[] = []

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('')
      continue
    }
    const words = para.split(/\s+/).filter(Boolean)
    let currentLine = ''

    for (const word of words) {
      // Hard-break words that are wider than the whole line so they don't
      // overflow the clipped area.
      if (ctx.measureText(word).width > maxWidth) {
        if (currentLine) {
          lines.push(currentLine)
        }
        let chunk = ''
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
            lines.push(chunk)
            chunk = ch
          } else {
            chunk += ch
          }
        }
        currentLine = chunk
        continue
      }

      const testLine = currentLine ? `${currentLine} ${word}` : word
      const metrics = ctx.measureText(testLine)

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }
  }

  return lines
}

export function layoutText(
  ctx: CanvasRenderingContext2D,
  area: TemplateArea,
  text: string,
  w: number,
  h: number,
): TextLayout {
  const fontFamily = resolveFontFamily(area.font)
  const weight = fontWeightFor(area.font)

  const padding = Math.min(w, h) * 0.05
  const availW = w - padding * 2

  let fontSize = area.fontSize
  let letterSpacing = 0
  ctx.font = `${weight} ${fontSize}px ${fontFamily}`
  ctx.letterSpacing = '0px'

  let lines = wrapText(ctx, text, availW)

  const availH = h - padding * 2

  let lineHeightFactor = 1.2

  if (area.overflow === 'shrink') {
    let lineHeight = fontSize * lineHeightFactor
    let totalTextH = lines.length * lineHeight
    while (totalTextH > availH && fontSize > 8) {
      fontSize *= 0.9
      ctx.font = `${weight} ${fontSize}px ${fontFamily}`
      lines = wrapText(ctx, text, availW)
      lineHeight = fontSize * lineHeightFactor
      totalTextH = lines.length * lineHeight
    }
  } else {
    // compress: reduce line height, then letter-spacing, then font size
    let lineHeight = fontSize * lineHeightFactor
    let totalTextH = lines.length * lineHeight
    while (totalTextH > availH && lineHeightFactor > 1) {
      lineHeightFactor -= 0.05
      lineHeight = fontSize * lineHeightFactor
      totalTextH = lines.length * lineHeight
    }
    while (totalTextH > availH && letterSpacing > -3) {
      letterSpacing -= 0.5
      ctx.letterSpacing = `${letterSpacing}px`
      lines = wrapText(ctx, text, availW)
      totalTextH = lines.length * lineHeight
    }
    while (totalTextH > availH && fontSize > 8) {
      fontSize *= 0.9
      ctx.font = `${weight} ${fontSize}px ${fontFamily}`
      lines = wrapText(ctx, text, availW)
      lineHeight = fontSize * lineHeightFactor
      totalTextH = lines.length * lineHeight
    }
  }

  const lineHeight = fontSize * lineHeightFactor
  const totalTextH = lines.length * lineHeight

  // Vertical start position (area-local, centered at 0,0)
  let startY: number
  if (area.alignV === 'start') {
    startY = -h / 2 + padding
  } else if (area.alignV === 'end') {
    startY = h / 2 - padding - totalTextH
  } else {
    startY = -totalTextH / 2
  }

  // Horizontal x position
  let startX: number
  if (area.alignH === 'start') {
    startX = -w / 2 + padding
  } else if (area.alignH === 'end') {
    startX = w / 2 - padding
  } else {
    startX = 0
  }

  return { lines, fontSize, lineHeight, startX, startY, letterSpacing }
}

/**
 * Paints the laid-out lines with an optional outline. Callers are expected to
 * have already set `ctx.textAlign`; this sets baseline, letter-spacing, fill
 * and stroke. When an outline is present every line is stroked first and then
 * filled in a second pass, so the fill always sits on top of the outline
 * (otherwise a thick outline on one line would bleed over the previous line).
 */
export function paintTextLines(
  ctx: CanvasRenderingContext2D,
  layout: TextLayout,
  opts: {
    fillStyle: string
    strokeStyle?: string
    strokeLineWidth?: number
  },
): void {
  ctx.textBaseline = 'top'
  ctx.letterSpacing = `${layout.letterSpacing}px`

  const lineY = (i: number) => layout.startY + i * layout.lineHeight

  const hasStroke = !!opts.strokeLineWidth && opts.strokeLineWidth > 0
  if (hasStroke) {
    ctx.strokeStyle = opts.strokeStyle ?? '#000000'
    ctx.lineWidth = opts.strokeLineWidth as number
    ctx.lineJoin = 'round'
    ctx.miterLimit = 2
    for (let i = 0; i < layout.lines.length; i++) {
      ctx.strokeText(layout.lines[i], layout.startX, lineY(i))
    }
  }

  ctx.fillStyle = opts.fillStyle
  for (let i = 0; i < layout.lines.length; i++) {
    ctx.fillText(layout.lines[i], layout.startX, lineY(i))
  }

  ctx.letterSpacing = '0px'
}

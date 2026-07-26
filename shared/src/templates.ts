export interface TemplateArea {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  alignH: 'start' | 'center' | 'end'
  alignV: 'start' | 'center' | 'end'
  overflow: 'compress' | 'shrink'
  font: string
  fontSize: number
  textColor: string

  // Text outline (classic meme style). Optional for backwards compatibility
  // with templates created before these fields existed.
  // strokeWidth is the visible outline thickness as a percentage of the font
  // size (0 = no outline).
  strokeWidth?: number
  strokeColor?: string
  // Render the text in all caps (typical for meme captions).
  uppercase?: boolean

  backplateOpacity: number
  backplateColor: string
}

export interface TemplateConfig {
  areas: TemplateArea[]
}

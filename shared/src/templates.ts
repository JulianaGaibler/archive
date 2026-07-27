export interface TemplateArea {
  id: string
  // Area kind. Absent = 'text' for backwards compatibility with templates
  // saved before image areas existed. Text areas take a caption; image areas
  // take a viewer-supplied image fitted into the box at apply time.
  type?: 'text' | 'image'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  alignH: 'start' | 'center' | 'end'
  alignV: 'start' | 'center' | 'end'
  overflow: 'compress' | 'shrink'
  // How a viewer's image fills an image area's box (image areas only).
  // 'cover' fills the box and crops overflow; 'contain' fits the whole image
  // inside, letterboxing as needed. Absent = 'cover'.
  imageFit?: 'cover' | 'contain'
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

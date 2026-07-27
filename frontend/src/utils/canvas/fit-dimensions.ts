// Aspect-ratio-preserving fit used by the canvas editors to size a media
// preview inside its container.

export interface DisplayDimensions {
  displayWidth: number
  displayHeight: number
}

/**
 * Scale a source (natural) size down to fit within maxWidth/maxHeight while
 * preserving aspect ratio. Never scales up. Returns integer dimensions, or
 * zeros if the source size is invalid.
 */
export function fitDisplayDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number,
): DisplayDimensions {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { displayWidth: 0, displayHeight: 0 }
  }

  const aspect = naturalWidth / naturalHeight
  let width = naturalWidth
  let height = naturalHeight

  // Fit height first, then width, so both constraints are satisfied.
  if (height > maxHeight) {
    height = maxHeight
    width = height * aspect
  }
  if (width > maxWidth) {
    width = maxWidth
    height = width / aspect
  }

  return { displayWidth: Math.floor(width), displayHeight: Math.floor(height) }
}

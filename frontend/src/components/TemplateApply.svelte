<script lang="ts">
  import type { TemplateConfig } from 'archive-shared/src/templates'
  import Button from 'tint/components/Button.svelte'
  import IconTrash from 'tint/icons/20-trash.svg?raw'
  import IconDownload from 'tint/icons/20-download.svg?raw'
  import IconCopy from 'tint/icons/20-copy.svg?raw'
  import IconUpload from 'tint/icons/20-upload.svg?raw'
  import IconClose from 'tint/icons/20-close.svg?raw'
  import { fly } from 'svelte/transition'
  import {
    renderTextInArea,
    renderPlaceholderInArea,
  } from './TemplateApply/utils/text-renderer'
  import {
    renderImageInArea,
    renderImagePlaceholderInArea,
  } from './TemplateApply/utils/image-renderer'
  import {
    renderTemplateToCanvas,
    downloadAsImage,
    copyToClipboard,
  } from './TemplateApply/utils/export'
  import {
    resolveFontFamily,
    fontWeightFor,
    outlineLineWidth,
    ensureAreaFontsLoaded,
  } from '@src/utils/template-text-layout'

  interface Props {
    template: TemplateConfig
    imageSrc: string
    filename?: string
  }

  let { template, imageSrc, filename = 'template' }: Props = $props()

  let texts = $state<string[]>(template.areas.map(() => ''))
  // One loaded image per area (image areas only; null when empty). Object URLs
  // are tracked separately for cleanup — they don't need to be reactive.
  let images = $state<(HTMLImageElement | null)[]>(
    template.areas.map(() => null),
  )
  const imageUrls: (string | null)[] = template.areas.map(() => null)
  // Per-slot request token. Bumped whenever a slot's image changes (new pick,
  // remove, reset) so a slower/older in-flight load can tell it's been
  // superseded and discard itself instead of resurrecting a cleared slot.
  const loadTokens: number[] = template.areas.map(() => 0)
  let imageError = $state<string | null>(null)
  // Which image slot currently has a valid file dragged over it (for hover UI).
  let dragOverIndex = $state<number | null>(null)
  let containerEl: HTMLDivElement | undefined = $state(undefined)
  let canvasEl: HTMLCanvasElement | undefined = $state(undefined)
  let fileInputEl: HTMLInputElement | undefined = $state(undefined)
  let pendingAreaIndex: number | null = null
  let img = $state<HTMLImageElement | undefined>(undefined)
  let displayWidth = $state(0)
  let displayHeight = $state(0)
  let exporting = $state(false)
  let editingArea: number | null = $state(null)
  let textareaEls: HTMLTextAreaElement[] = $state([])
  let fontsReady = $state(false)

  // Browsers can decode these to a canvas-drawable image. Notably excludes
  // HEIC/HEIF (common on iOS), which would fail silently on canvas.
  const SUPPORTED_IMAGE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
  ]

  function setAreaImage(i: number, file: File) {
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      imageError = 'Unsupported image type. Use PNG, JPEG, WebP, or GIF.'
      return
    }
    const url = URL.createObjectURL(file)
    const token = ++loadTokens[i]
    const image = new Image()
    image.onload = () => {
      // A newer pick, a remove, or a reset superseded this load — drop it.
      if (loadTokens[i] !== token) {
        URL.revokeObjectURL(url)
        return
      }
      // Revoke the slot's previous object URL now that the new one is ready.
      const prev = imageUrls[i]
      if (prev) URL.revokeObjectURL(prev)
      imageUrls[i] = url
      images[i] = image
      imageError = null
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      if (loadTokens[i] !== token) return
      imageError = 'Could not load that image. Use PNG, JPEG, WebP, or GIF.'
    }
    image.src = url
  }

  function removeAreaImage(i: number) {
    // Bump the token so any in-flight load for this slot discards itself.
    loadTokens[i]++
    const prev = imageUrls[i]
    if (prev) URL.revokeObjectURL(prev)
    imageUrls[i] = null
    images[i] = null
  }

  function openFilePicker(i: number) {
    pendingAreaIndex = i
    fileInputEl?.click()
  }

  function onFileInputChange(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (file && pendingAreaIndex !== null) setAreaImage(pendingAreaIndex, file)
    // Reset so picking the same file again still fires a change event.
    input.value = ''
    pendingAreaIndex = null
  }

  function handleAreaDragOver(i: number, e: DragEvent) {
    // Only react to actual files (not e.g. text/URL drags from other tabs).
    if (!e.dataTransfer?.types.includes('Files')) return
    e.dataTransfer.dropEffect = 'copy'
    e.preventDefault()
    dragOverIndex = i
  }

  function handleAreaDrop(i: number, e: DragEvent) {
    e.preventDefault()
    dragOverIndex = null
    const dt = e.dataTransfer
    if (!dt) return
    if (!dt.types.includes('Files')) {
      // Images dragged from another tab arrive as a URL, not a File. Loading a
      // cross-origin URL would taint the canvas and break export, so reject it.
      imageError = 'Drop an image file from your device.'
      return
    }
    const file = Array.from(dt.files).find((f) => f.type.startsWith('image/'))
    if (file) setAreaImage(i, file)
  }

  function onDropzoneKeydown(i: number, e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openFilePicker(i)
    }
  }

  // Revoke any outstanding object URLs when the component is destroyed.
  $effect(() => {
    return () => {
      for (const u of imageUrls) if (u) URL.revokeObjectURL(u)
    }
  })

  // Load image
  $effect(() => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      img = image
    }
    image.src = imageSrc
  })

  // Repaint the canvas once the self-hosted fonts finish loading, otherwise the
  // first paint uses a fallback font until the user interacts.
  $effect(() => {
    let cancelled = false
    ensureAreaFontsLoaded(template.areas).then(() => {
      if (!cancelled) fontsReady = true
    })
    return () => {
      cancelled = true
    }
  })

  // Observe container size and compute display dimensions
  $effect(() => {
    if (!containerEl || !img) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cw = entry.contentRect.width
        const ch = entry.contentRect.height
        if (!img) return
        const aspect = img.naturalWidth / img.naturalHeight
        let w = cw
        let h = cw / aspect
        if (h > ch && ch > 0) {
          h = ch
          w = ch * aspect
        }
        displayWidth = w
        displayHeight = h
      }
    })

    observer.observe(containerEl)
    return () => observer.disconnect()
  })

  // Render canvas overlay
  $effect(() => {
    if (!canvasEl || !img || displayWidth === 0) return
    void texts
    void images
    void editingArea
    void fontsReady

    const dpr = window.devicePixelRatio || 1
    canvasEl.width = displayWidth * dpr
    canvasEl.height = displayHeight * dpr
    canvasEl.style.width = `${displayWidth}px`
    canvasEl.style.height = `${displayHeight}px`

    const ctx = canvasEl.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, displayWidth, displayHeight)

    const sx = displayWidth / img.naturalWidth
    const sy = displayHeight / img.naturalHeight

    ctx.save()
    ctx.scale(sx, sy)

    for (let i = 0; i < template.areas.length; i++) {
      const area = template.areas[i]
      if (area.type === 'image') {
        const areaImage = images[i]
        if (areaImage) {
          renderImageInArea(ctx, area, areaImage)
        } else {
          renderImagePlaceholderInArea(ctx, area)
        }
        continue
      }
      // Text area: the live <textarea> shows while focused, so skip painting it.
      if (editingArea === i) continue
      if (!texts[i]) {
        renderPlaceholderInArea(ctx, area)
      } else {
        renderTextInArea(
          ctx,
          area,
          texts[i],
          img.naturalWidth,
          img.naturalHeight,
        )
      }
    }

    ctx.restore()
  })

  async function handleDownload() {
    if (!img) return
    exporting = true
    try {
      const canvas = await renderTemplateToCanvas(img, template, texts, images)
      await downloadAsImage(canvas, `${filename}.png`)
    } finally {
      exporting = false
    }
  }

  async function handleCopy() {
    if (!img) return
    exporting = true
    try {
      const canvas = await renderTemplateToCanvas(img, template, texts, images)
      await copyToClipboard(canvas)
    } finally {
      exporting = false
    }
  }

  async function handleReset() {
    texts = template.areas.map(() => '')
    for (const u of imageUrls) if (u) URL.revokeObjectURL(u)
    imageUrls.fill(null)
    // Invalidate any in-flight loads so they don't repopulate cleared slots.
    for (let i = 0; i < loadTokens.length; i++) loadTokens[i]++
    images = template.areas.map(() => null)
    imageError = null
  }

  let scaleX = $derived(img ? displayWidth / img.naturalWidth : 1)
  let scaleY = $derived(img ? displayHeight / img.naturalHeight : 1)

  // Fade the overlay in once the image has loaded and been measured, so the
  // canvas and inputs don't pop in at their final position.
  const ready = $derived(!!img && displayWidth > 0)

  function areaTextAlign(alignH: string): string {
    return alignH === 'start' ? 'left' : alignH === 'end' ? 'right' : 'center'
  }
</script>

<div class="template-apply" bind:this={containerEl}>
  <div
    class="overlay-content"
    class:ready
    style="width: {displayWidth}px; height: {displayHeight}px;"
  >
    <div class="canvas-layer">
      <canvas bind:this={canvasEl}></canvas>
    </div>

    <div class="input-layer">
      {#each template.areas as area, i (area.id)}
        {@const left = area.x * scaleX}
        {@const top = area.y * scaleY}
        {@const width = area.width * scaleX}
        {@const height = area.height * scaleY}
        {@const rotation = area.rotation}
        {#if area.type === 'image'}
          <div
            class="area-dropzone"
            class:filled={!!images[i]}
            class:dragover={dragOverIndex === i}
            style="
              left: {left}px;
              top: {top}px;
              width: {width}px;
              height: {height}px;
              transform: rotate({rotation}deg);
              transform-origin: center center;
            "
            role="button"
            tabindex="0"
            aria-label="Upload image for this area"
            onclick={() => openFilePicker(i)}
            onkeydown={(e) => onDropzoneKeydown(i, e)}
            ondragover={(e) => handleAreaDragOver(i, e)}
            ondragleave={() => (dragOverIndex = null)}
            ondrop={(e) => handleAreaDrop(i, e)}
          >
            {#if images[i]}
              <button
                class="remove-image"
                type="button"
                aria-label="Remove image"
                onclick={(e) => {
                  e.stopPropagation()
                  removeAreaImage(i)
                }}
              >
                {@html IconClose}
              </button>
            {:else}
              <span class="dropzone-icon">
                {@html IconUpload}
              </span>
            {/if}
          </div>
        {:else}
          {@const padding = Math.min(width, height) * 0.05}
          {@const isEditing = editingArea === i}
          {@const bgAlpha = area.backplateOpacity / 100}
          {@const strokePx = outlineLineWidth(
            area.fontSize * scaleX,
            area.strokeWidth,
          )}
          <textarea
            class="area-input"
            class:editing={isEditing}
            style="
              left: {left}px;
              top: {top}px;
              width: {width}px;
              height: {height}px;
              transform: rotate({rotation}deg);
              transform-origin: center center;
              font-family: {resolveFontFamily(area.font)};
              font-size: {area.fontSize * scaleX}px;
              font-weight: {fontWeightFor(area.font)};
              text-transform: {area.uppercase ? 'uppercase' : 'none'};
              color: {isEditing ? area.textColor : 'transparent'};
              caret-color: {isEditing ? area.textColor : 'transparent'};
              text-align: {areaTextAlign(area.alignH)};
              line-height: 1.2;
              padding: {padding}px;
              -webkit-text-stroke: {isEditing && strokePx > 0
              ? `${strokePx}px ${area.strokeColor ?? '#000000'}`
              : '0'};
              paint-order: stroke fill;
              background: {isEditing && bgAlpha > 0
              ? area.backplateColor
              : 'transparent'};
              opacity: {isEditing ? (bgAlpha > 0 ? bgAlpha : 1) : 0.001};
            "
            bind:this={textareaEls[i]}
            bind:value={texts[i]}
            onfocus={() => (editingArea = i)}
            onblur={() => (editingArea = null)}></textarea>
        {/if}
      {/each}
    </div>

    <input
      class="hidden-file-input"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      bind:this={fileInputEl}
      onchange={onFileInputChange}
    />

    {#if imageError}
      <div
        class="image-error"
        role="alert"
        transition:fly={{ y: 20, duration: 200 }}
      >
        {imageError}
      </div>
    {/if}

    {#if texts.some((t) => t.length > 0) || images.some(Boolean)}
      <div class="export-actions" transition:fly={{ y: 20, duration: 200 }}>
        <Button
          icon
          small
          onclick={handleCopy}
          disabled={exporting}
          variant="primary"
          tooltip="Copy to clipboard"
        >
          {@html IconCopy}
        </Button>
        <Button
          icon
          small
          onclick={handleDownload}
          disabled={exporting}
          tooltip="Download image"
        >
          {@html IconDownload}
        </Button>
        <Button
          icon
          small
          onclick={handleReset}
          disabled={exporting}
          tooltip="Clear all"
        >
          {@html IconTrash}
        </Button>
      </div>
    {/if}
  </div>
</div>

<style lang="sass">
  .template-apply
    position: absolute
    inset: 0
    z-index: 1
    display: flex
    justify-content: center

  .overlay-content
    position: relative
    opacity: 0
    transition: opacity 250ms ease

    &.ready
      opacity: 1

  .canvas-layer
    position: absolute
    inset: 0
    pointer-events: none
    z-index: 1

    canvas
      display: block

  .input-layer
    position: absolute
    inset: 0
    z-index: 2

  .area-input
    position: absolute
    border: none
    outline: none
    resize: none
    box-sizing: border-box
    overflow: hidden
    opacity: 0.001
    background: transparent
    color: transparent
    caret-color: transparent
    // Keep text areas above image drop zones so overlapping text stays
    // clickable/typeable.
    z-index: 1

    &.editing
      opacity: 1
      z-index: 2

  .hidden-file-input
    display: none

  .area-dropzone
    position: absolute
    box-sizing: border-box
    display: flex
    align-items: center
    justify-content: center
    cursor: pointer
    color: #ffffff
    background: transparent
    // Sit behind text areas (z-index 0 < .area-input's 1) so overlaps favour text.
    z-index: 0

    &:focus-visible
      outline: 2px solid var(--tint-action-primary)
      outline-offset: 2px

    // Empty slots get a faint hover fill to signal they're interactive; the
    // dashed outline itself is painted on the canvas below.
    &:not(.filled):hover
      background: rgba(0, 0, 0, 0.25)

    // A solid inner outline, offset from the canvas dashed box, appears while a
    // valid file is dragged over the slot.
    &::after
      content: ''
      position: absolute
      inset: 4px
      border: 2px solid rgba(255, 255, 255, 0.9)
      border-radius: 2px
      opacity: 0
      pointer-events: none
      transition: opacity 120ms ease

    &.dragover::after
      opacity: 1

  .dropzone-icon
    display: flex
    align-items: center
    justify-content: center
    width: var(--tint-size-48)
    height: var(--tint-size-48)
    border-radius: 50%
    background-color: rgba(0, 0, 0, 0.55)
    color: #ffffff
    pointer-events: none

    :global(svg)
      width: var(--tint-size-24)
      height: var(--tint-size-24)

  .remove-image
    position: absolute
    inset-block-start: var(--tint-size-4)
    inset-inline-end: var(--tint-size-4)
    display: flex
    align-items: center
    justify-content: center
    padding: var(--tint-size-4)
    border: none
    border-radius: 50%
    cursor: pointer
    color: #ffffff
    background-color: color-mix(in srgb, var(--tint-bg) 60%, transparent)
    backdrop-filter: blur(4px)

    &:hover
      background-color: var(--tint-bg)

  .image-error
    position: absolute
    inset-block-start: var(--tint-size-16)
    inset-inline-start: 50%
    transform: translateX(-50%)
    padding: var(--tint-size-8) var(--tint-size-12)
    border-radius: var(--tint-size-8)
    background-color: color-mix(in srgb, var(--tint-bg) 90%, transparent)
    backdrop-filter: blur(8px)
    border: 1px solid var(--tint-card-border)
    color: var(--tint-text)
    font-size: 0.8125rem
    z-index: 4
    max-width: 90%
    text-align: center

  .export-actions
    position: absolute
    inset-block-end: calc(-1 * var(--tint-size-16))
    inset-inline-start: 50%
    transform: translateX(-50%)
    padding: var(--tint-size-8)
    border-radius: var(--tint-size-48)
    background-color: color-mix(in srgb, var(--tint-bg) 80%, transparent)
    backdrop-filter: blur(8px) saturate(120%)
    border: 1px solid var(--tint-card-border)
    z-index: 3
    display: flex
    gap: var(--tint-size-8)
</style>

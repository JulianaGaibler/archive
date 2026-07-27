<script lang="ts">
  import type { TemplateConfig } from 'archive-shared/src/templates'
  import Button from 'tint/components/Button.svelte'
  import IconTrash from 'tint/icons/20-trash.svg?raw'
  import IconDownload from 'tint/icons/20-download.svg?raw'
  import IconCopy from 'tint/icons/20-copy.svg?raw'
  import { fly } from 'svelte/transition'
  import {
    renderTextInArea,
    renderPlaceholderInArea,
  } from './TemplateApply/utils/text-renderer'
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
  let containerEl: HTMLDivElement | undefined = $state(undefined)
  let canvasEl: HTMLCanvasElement | undefined = $state(undefined)
  let img = $state<HTMLImageElement | undefined>(undefined)
  let displayWidth = $state(0)
  let displayHeight = $state(0)
  let exporting = $state(false)
  let editingArea: number | null = $state(null)
  let textareaEls: HTMLTextAreaElement[] = $state([])
  let fontsReady = $state(false)

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
      if (editingArea === i) continue
      if (!texts[i]) {
        renderPlaceholderInArea(ctx, template.areas[i])
      } else {
        renderTextInArea(
          ctx,
          template.areas[i],
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
      const canvas = await renderTemplateToCanvas(img, template, texts)
      await downloadAsImage(canvas, `${filename}.png`)
    } finally {
      exporting = false
    }
  }

  async function handleCopy() {
    if (!img) return
    exporting = true
    try {
      const canvas = await renderTemplateToCanvas(img, template, texts)
      await copyToClipboard(canvas)
    } finally {
      exporting = false
    }
  }

  async function handleReset() {
    texts = template.areas.map(() => '')
  }

  let scaleX = $derived(img ? displayWidth / img.naturalWidth : 1)
  let scaleY = $derived(img ? displayHeight / img.naturalHeight : 1)

  function areaTextAlign(alignH: string): string {
    return alignH === 'start' ? 'left' : alignH === 'end' ? 'right' : 'center'
  }
</script>

<div class="template-apply" bind:this={containerEl}>
  <div
    class="overlay-content"
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
      {/each}
    </div>

    {#if texts.some((t) => t.length > 0)}
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
          tooltip="Clear all text"
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

    &.editing
      opacity: 1
      z-index: 1

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

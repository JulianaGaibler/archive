<script lang="ts">
  import type {
    TemplateArea,
    TemplateConfig,
  } from 'archive-shared/src/templates'
  import Button from 'tint/components/Button.svelte'
  import Select, { SELECT_SEPARATOR } from 'tint/components/Select.svelte'
  import ColorPicker from 'tint/components/ColorPicker/ColorPicker.svelte'
  import LabeledSlider from 'tint/components/LabeledSlider.svelte'
  import Modal from 'tint/components/Modal.svelte'
  import ModalHeader from '@src/components/ModalHeader.svelte'
  import LoadingIndicator from 'tint/components/LoadingIndicator.svelte'
  import SegmentedControl from 'tint/components/SegmentedControl.svelte'

  import AreaController from './TemplateEditorModal/AreaController.svelte'
  import type { EditableItem } from '@src/utils/edit-manager'
  import { getResourceUrl } from '@src/utils/resource-urls'
  import { fitDisplayDimensions } from '@src/utils/canvas/fit-dimensions'
  import IconAlignStart from 'tint/icons/20-text-align-start.svg?raw'
  import IconAlignCenter from 'tint/icons/20-text-align-center.svg?raw'
  import IconAlignEnd from 'tint/icons/20-text-align-end.svg?raw'
  import IconAlignTop from 'tint/icons/20-text-align-top.svg?raw'
  import IconAlignMiddle from 'tint/icons/20-text-align-middle.svg?raw'
  import IconAlignBottom from 'tint/icons/20-text-align-bottom.svg?raw'
  import IconTrash from 'tint/icons/20-trash.svg?raw'
  import IconAdd from 'tint/icons/20-add.svg?raw'

  interface Props {
    open: boolean
    loading?: boolean
    item: EditableItem
    onCancel: () => void
    onSubmit: (template: TemplateConfig | null) => Promise<void>
  }

  let { open, loading = false, item, onCancel, onSubmit }: Props = $props()

  let areas = $state<TemplateArea[]>([])
  let selectedId = $state<string | null>(null)

  let img = $state<HTMLImageElement | undefined>(undefined)
  let mediaLoaded = $state(false)
  let displayWidth = $state(0)
  let displayHeight = $state(0)
  let previewAreaEl: HTMLDivElement | undefined = $state(undefined)

  const selectedArea = $derived(areas.find((a) => a.id === selectedId) ?? null)
  const isImageArea = $derived((selectedArea?.type ?? 'text') === 'image')

  const mediaUrl = $derived.by(() => {
    if (item.type !== 'existing' || !('file' in item.data) || !item.data.file)
      return null
    const file = item.data.file
    if (
      'unmodifiedCompressedPath' in file &&
      typeof file.unmodifiedCompressedPath === 'string'
    )
      return getResourceUrl(file.unmodifiedCompressedPath)
    if ('compressedPath' in file && typeof file.compressedPath === 'string')
      return getResourceUrl(file.compressedPath)
    return null
  })

  // Load initial template from item
  $effect(() => {
    if (!open) return
    if (
      item.type === 'existing' &&
      'file' in item.data &&
      item.data.file &&
      'modifications' in item.data.file &&
      item.data.file.modifications?.template
    ) {
      areas = item.data.file.modifications.template.areas.map((a) => ({
        ...a,
        // Backfill fields added after the template was first saved so older
        // templates keep rendering exactly as before.
        type: a.type ?? 'text',
        imageFit: a.imageFit ?? 'cover',
        strokeWidth: a.strokeWidth ?? 0,
        strokeColor: a.strokeColor ?? '#000000',
        uppercase: a.uppercase ?? false,
      }))
    } else {
      areas = []
    }
    selectedId = null
  })

  // Load image
  $effect(() => {
    if (!open || !mediaUrl) return
    mediaLoaded = false

    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      img = image
      mediaLoaded = true
    }
    image.src = mediaUrl
  })

  // Calculate display dimensions responsively
  $effect(() => {
    if (!img || !mediaLoaded) return

    const WRAPPER_PADDING = 32 // 16px on each side

    const updateDimensions = () => {
      if (!img) return

      const maxHeight = 500
      const containerWidth = previewAreaEl?.clientWidth ?? 900
      const fitted = fitDisplayDimensions(
        img.naturalWidth,
        img.naturalHeight,
        containerWidth - WRAPPER_PADDING,
        maxHeight,
      )
      displayWidth = fitted.displayWidth
      displayHeight = fitted.displayHeight
    }

    const observer = new ResizeObserver(() => {
      updateDimensions()
    })

    if (previewAreaEl) {
      observer.observe(previewAreaEl)
    }
    updateDimensions()

    return () => observer.disconnect()
  })

  function addArea() {
    const newArea: TemplateArea = {
      id: crypto.randomUUID(),
      type: 'text',
      x: img ? img.naturalWidth * 0.1 : 50,
      y: img ? img.naturalHeight * 0.1 : 50,
      width: img ? img.naturalWidth * 0.4 : 200,
      height: img ? img.naturalHeight * 0.2 : 100,
      rotation: 0,
      alignH: 'center',
      alignV: 'center',
      overflow: 'shrink',
      // Default to the classic meme look: Impact, white text, black outline,
      // all caps. Authors can switch any of these per area.
      font: 'Impact',
      fontSize: 48,
      textColor: '#ffffff',
      strokeWidth: 8,
      strokeColor: '#000000',
      uppercase: true,
      backplateOpacity: 0,
      backplateColor: '#000000',
    }
    areas = [...areas, newArea]
    selectedId = newArea.id
  }

  function deleteSelectedArea() {
    if (!selectedId) return
    areas = areas.filter((a) => a.id !== selectedId)
    selectedId = null
  }

  function updateArea(id: string, changes: Partial<TemplateArea>) {
    areas = areas.map((a) => (a.id === id ? { ...a, ...changes } : a))
  }

  function updateSelectedField<K extends keyof TemplateArea>(
    field: K,
    value: TemplateArea[K],
  ) {
    if (!selectedId) return
    updateArea(selectedId, { [field]: value })
  }

  // Switch the selected area between a text caption and an image slot. Image
  // slots keep the shared geometry/backplate/alignment fields but ignore the
  // text-styling ones; default the fit the first time an area becomes an image.
  function setAreaType(type: 'text' | 'image') {
    if (!selectedId) return
    const changes: Partial<TemplateArea> = { type }
    if (type === 'image' && !selectedArea?.imageFit) changes.imageFit = 'cover'
    updateArea(selectedId, changes)
  }

  async function handleSubmit() {
    if (areas.length === 0) {
      await onSubmit(null)
    } else {
      await onSubmit({ areas })
    }
  }

  // Reset when closed
  $effect(() => {
    if (!open) {
      mediaLoaded = false
      img = undefined
      areas = []
      selectedId = null
    }
  })
</script>

<Modal {open} onclose={onCancel} notClosable={loading} fullscreen>
  <div class="template-modal">
    <div class="section">
      <div class="container">
        <ModalHeader
          title="Edit Template"
          {loading}
          submitDisabled={!mediaLoaded}
          oncancel={onCancel}
          onsubmit={handleSubmit}
        />
      </div>
    </div>

    <div class="section tint--tinted" style="background: var(--tint-bg)">
      <div class="container">
        <div class="preview-area" bind:this={previewAreaEl}>
          {#if !mediaLoaded}
            <div class="loading-state">
              <LoadingIndicator />
              <p>Loading image...</p>
            </div>
          {:else if img}
            <div
              class="image-wrapper"
              style="width: {displayWidth + 32}px; height: {displayHeight +
                32}px;"
            >
              <img
                src={img.src}
                alt="Template preview"
                style="width: {displayWidth}px; height: {displayHeight}px;"
              />
              <AreaController
                {areas}
                {selectedId}
                {img}
                {displayWidth}
                {displayHeight}
                onSelect={(id) => (selectedId = id)}
                onUpdateArea={updateArea}
              />
            </div>
          {/if}
        </div>
      </div>
    </div>

    {#if mediaLoaded}
      <div class="section">
        <div class="container">
          <div class="controls">
            {#if selectedArea}
              <div class="control-grid">
                <!-- Area kind: text caption vs image slot -->
                <SegmentedControl
                  small
                  id="areaType"
                  label="Area type"
                  value={selectedArea.type ?? 'text'}
                  onchange={(v) => setAreaType(v as 'text' | 'image')}
                  items={[
                    { value: 'text', label: 'Text' },
                    { value: 'image', label: 'Image' },
                  ]}
                />

                {#if isImageArea}
                  <!-- How the viewer's image fills the box -->
                  <SegmentedControl
                    small
                    id="imageFit"
                    label="Image fit"
                    value={selectedArea.imageFit ?? 'cover'}
                    onchange={(v) =>
                      updateSelectedField('imageFit', v as 'cover' | 'contain')}
                    items={[
                      { value: 'cover', label: 'Cover' },
                      { value: 'contain', label: 'Contain' },
                    ]}
                  />
                {:else}
                  <!-- Font (wide) + text colour -->
                  <div class="grid-group span-2">
                    <Select
                      id="font"
                      label="Font"
                      value={selectedArea.font}
                      onchange={(e) =>
                        updateSelectedField(
                          'font',
                          (e.target as HTMLSelectElement).value,
                        )}
                      items={[
                        { value: 'Impact', label: 'Anton (like Impact)' },
                        {
                          value: 'Comic Sans',
                          label: 'Comic Neue (like Comic Sans)',
                        },
                        { value: 'Jost', label: 'Jost (like Futura)' },
                        SELECT_SEPARATOR,
                        {
                          value: 'Sans-serif',
                          label: 'HK Grotesk (Archive sans-serif)',
                        },
                        {
                          value: 'Serif',
                          label: 'Merriweather (Archive serif)',
                        },
                      ]}
                    />
                  </div>
                  <ColorPicker
                    id="textColor"
                    label="Text color"
                    value={selectedArea.textColor}
                    onchange={(e) => updateSelectedField('textColor', e.value)}
                  />

                  <!-- Size + outline sliders + outline colour -->
                  <LabeledSlider
                    id="fontSize"
                    small={false}
                    label={`Size: ${selectedArea.fontSize}px`}
                    min={8}
                    max={128}
                    step={2}
                    value={selectedArea.fontSize}
                    oninput={(e) => updateSelectedField('fontSize', e.value)}
                  />
                  <LabeledSlider
                    id="strokeWidth"
                    small={false}
                    label={`Outline: ${
                      (selectedArea.strokeWidth ?? 0) === 0
                        ? 'off'
                        : selectedArea.strokeWidth
                    }`}
                    min={0}
                    max={28}
                    step={1}
                    value={selectedArea.strokeWidth ?? 0}
                    oninput={(e) => updateSelectedField('strokeWidth', e.value)}
                  />
                  <ColorPicker
                    id="strokeColor"
                    label="Outline color"
                    value={selectedArea.strokeColor ?? '#000000'}
                    disabled={(selectedArea.strokeWidth ?? 0) === 0}
                    onchange={(e) =>
                      updateSelectedField('strokeColor', e.value)}
                  />

                  <SegmentedControl
                    small
                    id="overflow"
                    label="Overflow mode"
                    value={selectedArea.overflow}
                    onchange={(v) =>
                      updateSelectedField(
                        'overflow',
                        v as 'compress' | 'shrink',
                      )}
                    items={[
                      { value: 'compress', label: 'Compress' },
                      { value: 'shrink', label: 'Shrink' },
                    ]}
                  />
                  <SegmentedControl
                    small
                    id="uppercase"
                    label="Text case"
                    value={selectedArea.uppercase ? 'upper' : 'normal'}
                    onchange={(v) =>
                      updateSelectedField('uppercase', v === 'upper')}
                    items={[
                      {
                        value: 'normal',
                        label: 'Aa',
                        tooltip: 'Normal case',
                        class: 'case-normal',
                      },
                      { value: 'upper', label: 'AA', tooltip: 'Uppercase' },
                    ]}
                  />
                {/if}

                <!-- Backplate (shared by text + image areas) -->
                <Select
                  id="backplateOpacity"
                  label="Backplating"
                  value={selectedArea.backplateOpacity}
                  onchange={(e) =>
                    updateSelectedField(
                      'backplateOpacity',
                      Number((e.target as HTMLSelectElement).value),
                    )}
                  items={[
                    { value: 0, label: 'Disabled' },
                    { value: 50, label: '50%' },
                    { value: 75, label: '75%' },
                    { value: 100, label: '100%' },
                  ]}
                />
                <ColorPicker
                  id="backplateColor"
                  label="Backplate color"
                  value={selectedArea.backplateColor}
                  disabled={selectedArea.backplateOpacity === 0}
                  onchange={(e) =>
                    updateSelectedField('backplateColor', e.value)}
                />

                <!-- Alignment (text alignment, or image anchor within the box).
                     The two triads share a line on the narrowest layout since
                     their icons are tiny. -->
                <div class="align-pair">
                  <SegmentedControl
                    small
                    id="alignH"
                    label="Horizontal alignment"
                    value={selectedArea.alignH}
                    onchange={(v) =>
                      updateSelectedField(
                        'alignH',
                        v as 'start' | 'center' | 'end',
                      )}
                    items={[
                      {
                        value: 'start',
                        icon: IconAlignStart,
                        tooltip: 'Align left',
                      },
                      {
                        value: 'center',
                        icon: IconAlignCenter,
                        tooltip: 'Align center',
                      },
                      {
                        value: 'end',
                        icon: IconAlignEnd,
                        tooltip: 'Align right',
                      },
                    ]}
                  />
                  <SegmentedControl
                    small
                    id="alignV"
                    label="Vertical alignment"
                    value={selectedArea.alignV}
                    onchange={(v) =>
                      updateSelectedField(
                        'alignV',
                        v as 'start' | 'center' | 'end',
                      )}
                    items={[
                      {
                        value: 'start',
                        icon: IconAlignTop,
                        tooltip: 'Align top',
                      },
                      {
                        value: 'center',
                        icon: IconAlignMiddle,
                        tooltip: 'Align middle',
                      },
                      {
                        value: 'end',
                        icon: IconAlignBottom,
                        tooltip: 'Align bottom',
                      },
                    ]}
                  />
                </div>
              </div>
              <div class="control-actions">
                <Button icon title="Delete area" onclick={deleteSelectedArea}>
                  {@html IconTrash}
                </Button>
                <Button
                  variant="primary"
                  icon
                  title="Add area"
                  onclick={addArea}
                  disabled={loading}
                >
                  {@html IconAdd}
                </Button>
              </div>
            {:else}
              <div class="empty-controls">
                <p class="hint">Select an area to edit, or add a new one.</p>
                <Button
                  variant="primary"
                  icon
                  title="Add area"
                  onclick={addArea}
                  disabled={loading}
                >
                  {@html IconAdd}
                </Button>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
</Modal>

<style lang="sass">
  .template-modal
    display: flex
    flex-direction: column

  .section
    width: 100%
    padding-block: var(--tint-size-16)

    &:last-child
      padding-block-end: var(--tint-size-32)

  .container
    box-sizing: border-box
    max-width: 900px
    margin-inline: auto
    padding-inline: var(--tint-size-16)

    @media (min-width: 37.5rem)
      padding-inline: var(--tint-size-32)

  .preview-area
    display: flex
    justify-content: center
    align-items: center
    min-height: 300px
    min-width: 0
    overflow: hidden

  .image-wrapper
    box-sizing: border-box
    position: relative
    margin-inline: auto
    padding: var(--tint-size-16)
    max-width: 100%

    img
      display: block

  .loading-state
    display: flex
    flex-direction: column
    align-items: center
    gap: var(--tint-size-8)
    color: var(--tint-text-secondary)

  .controls
    padding-block: var(--tint-size-12)

  // Reflows from a single column on phones up to three columns on wide
  // viewports. Font spans two columns at the widest size so its longer option
  // labels have room.
  .control-grid
    display: grid
    grid-template-columns: 1fr
    gap: var(--tint-size-12)
    // Bottom-align so sliders (label on top) line up with the inputs and
    // segmented controls next to them instead of stretching.
    align-items: end

    @media (min-width: 37.5rem)
      grid-template-columns: 1fr 1fr

    @media (min-width: 56rem)
      grid-template-columns: repeat(3, 1fr)

  .grid-group
    display: flex
    gap: var(--tint-size-8)
    align-items: flex-end
    min-width: 0

    // Select + ColorPicker each take half of the cell.
    > *
      flex: 1
      min-width: 0

    // Font gets extra room: it spans two columns in the three-column layout.
    &.span-2
      @media (min-width: 56rem)
        grid-column: span 2

  // On the narrowest layout the two alignment triads share one row (their icons
  // are tiny). At wider sizes the wrapper dissolves so each becomes its own grid
  // cell again.
  .align-pair
    display: flex
    gap: var(--tint-size-8)
    min-width: 0

    > *
      flex: 1
      min-width: 0

    @media (min-width: 37.5rem)
      display: contents

  .control-actions
    display: flex
    justify-content: flex-end
    gap: var(--tint-size-8)
    margin-block-start: var(--tint-size-12)

  .empty-controls
    display: flex
    align-items: center
    justify-content: space-between
    gap: var(--tint-size-12)
    flex-wrap: wrap

  .hint
    color: var(--tint-text-secondary)
    margin: 0

  :global(.segment.case-normal)
    text-transform: none

</style>

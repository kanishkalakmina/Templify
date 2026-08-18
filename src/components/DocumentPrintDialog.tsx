import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'

/**
 * The popup a calling application shows after generating a document — the bill
 * at a shop counter, the invoice a user asked to print.
 *
 * Two things it deliberately does not know:
 *
 * 1. **What paper size the document is.** There is no A4/A5 table here.
 *    Templify's markup carries its own dimensions as an inline style on the page
 *    element — `<body><div style="width:559px;height:794px">` — so the frame
 *    loads the document, measures it, and takes that shape. A page size added to
 *    Templify later works with no change here.
 *
 * 2. **How to draw a document.** It is an iframe. The markup already carries its
 *    fonts and its `@page` rule, which is why print output matches the PDF.
 *
 * The markup arrives through `srcDoc` rather than a URL. That keeps it
 * same-origin, which is what permits both measuring it and printing it — a
 * cross-origin frame would be opaque to each.
 */

/** Share of the window width the paper may occupy. */
const WIDTH_BUDGET = 0.86
/** Modal chrome to leave room for: header, footer, body padding. */
const CHROME_PX = 168

/**
 * How much to shrink the document so the whole page and the Print button are
 * visible together.
 *
 * A4 is 1123px tall and overflows most laptop windows, which would put the
 * dialog on a scrollbar. Never scales *up*: a compact receipt on a large display
 * stays at its true size rather than being enlarged into a blurry poster.
 */
function fitScale(size: { width: number; height: number }): number {
  const heightBudget = Math.max(240, window.innerHeight * 0.8 - CHROME_PX)
  return Math.min(
    1,
    (window.innerWidth * WIDTH_BUDGET) / size.width,
    heightBudget / size.height,
  )
}

export function DocumentPrintDialog({
  open,
  title,
  subtitle,
  html,
  missing,
  autoPrint = false,
  onClose,
}: {
  open: boolean
  title: string
  subtitle?: string
  /** Print-ready markup from `renderDocumentHtml`. */
  html: string
  missing: string[]
  /** Opens the print dialog as soon as the document has loaded. */
  autoPrint?: boolean
  onClose: () => void
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [scale, setScale] = useState(1)

  const print = useCallback(() => {
    const win = frame.current?.contentWindow
    if (!win) return
    win.focus() // Some browsers ignore print() on an unfocused frame.
    win.print()
  }, [])

  /**
   * Fires once the markup is parsed. `srcDoc` is inline, so there is no network
   * round trip — this lands on the next frame, which is why the paper can start
   * hidden and appear already correct rather than resizing visibly.
   */
  const measure = useCallback(() => {
    const page = frame.current?.contentWindow?.document?.body?.firstElementChild as
      | HTMLElement
      | null
      | undefined
    if (!page) return

    setSize({ width: page.offsetWidth, height: page.offsetHeight })
    if (autoPrint) print()
  }, [autoPrint, print])

  /* A new document means new dimensions. */
  useEffect(() => {
    setSize(null)
  }, [html])

  /* Keep the fit correct if the window is resized while the dialog is open. */
  useEffect(() => {
    if (!size) return

    const refit = () => setScale(fitScale(size))
    refit()

    window.addEventListener('resize', refit)
    return () => window.removeEventListener('resize', refit)
  }, [size])

  const percent = Math.round(scale * 100)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={
        subtitle ??
        (size
          ? `${size.width} × ${size.height} px, measured from the document${
              percent < 100 ? ` · shown at ${percent}%` : ''
            }`
          : 'measuring the document…')
      }
      width={size ? Math.round(size.width * scale) + 34 : 460}
      bodyClassName="p-4"
      footer={
        <>
          <Button size="md" onClick={onClose}>
            Close
          </Button>
          <Button size="md" variant="primary" onClick={print}>
            Print
          </Button>
        </>
      }
    >
      {missing.length ? (
        <div className="mb-3 rounded-xl border border-[rgba(217,161,59,.4)] bg-[rgba(217,161,59,.1)] p-3 text-[11.5px] leading-relaxed text-warn">
          <strong className="font-medium">
            {missing.length} binding{missing.length > 1 ? 's' : ''} had no data
          </strong>{' '}
          and printed blank:{' '}
          <span className="break-all font-mono text-[11px]">{missing.join(', ')}</span>
        </div>
      ) : null}

      {/*
        Two boxes, and the distinction is the point. The outer one is the scaled
        footprint the layout sees. The iframe keeps the document's true pixel size
        and is shrunk with a transform — shrinking the iframe itself would clip a
        fixed-width document and give it its own scrollbars instead of making it
        smaller.

        The transform is visual and lives in this document, not the frame's, so it
        has no effect on printed output. Paper comes out at the size the template
        says.
      */}
      <div
        className="mx-auto overflow-hidden rounded bg-white shadow-modal"
        style={
          size
            ? { width: Math.round(size.width * scale), height: Math.round(size.height * scale) }
            : { visibility: 'hidden', width: '100%', height: '40vh' }
        }
      >
        <iframe
          ref={frame}
          srcDoc={html}
          onLoad={measure}
          title={title}
          className="block border-0"
          style={
            size
              ? {
                  width: size.width,
                  height: size.height,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }
              : { width: '100%', height: '100%' }
          }
        />
      </div>
    </Modal>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The counter popup.
 *
 * It is never told what paper size the bill is, and it holds no table of A4 and
 * A5 dimensions. Templify's markup carries its own size as an inline style on
 * the page element:
 *
 *     <body><div style="width:559px;height:794px"> … </div></body>
 *
 * So the frame loads the document, measures it once, and takes that shape. A4,
 * A5 or an 80mm receipt roll added to Templify next year — this component does
 * not change, because the answer arrives with the document.
 *
 * Reading inside the iframe is only possible because the markup is handed over
 * via `srcDoc`, which keeps it same-origin. A cross-origin `src` would be
 * opaque: no measuring, and no scripted print either.
 */

/**
 * Share of the window the paper may occupy. The remainder is the title bar, the
 * missing-bindings banner and the popup's own padding.
 */
const HEIGHT_BUDGET = 0.72
const WIDTH_BUDGET = 0.86

/**
 * How much to shrink the document so the whole bill and the Print button are
 * visible at once.
 *
 * A4 is 1123px tall, which overflows most laptop windows — the popup ends up on
 * a scrollbar, which is the wrong thing to hand a cashier. Never scales *up*:
 * a small receipt on a large screen stays at its true size rather than being
 * blown up into a blurry poster.
 */
function fitScale(size) {
  return Math.min(
    1,
    (window.innerWidth * WIDTH_BUDGET) / size.width,
    (window.innerHeight * HEIGHT_BUDGET) / size.height,
  )
}

export function BillPreview({ bill, html, missing, autoPrint, onClose }) {
  const frame = useRef(null)
  const [size, setSize] = useState(null)
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
   * hidden and appear already the right shape instead of resizing visibly.
   */
  const measure = useCallback(() => {
    const page = frame.current?.contentWindow?.document?.body?.firstElementChild
    if (!page) return

    setSize({ width: page.offsetWidth, height: page.offsetHeight })

    if (autoPrint) print()
  }, [autoPrint, print])

  /* Keep the fit correct if the window is resized while the bill is open. */
  useEffect(() => {
    if (!size) return

    const refit = () => setScale(fitScale(size))
    refit()

    window.addEventListener('resize', refit)
    return () => window.removeEventListener('resize', refit)
  }, [size])

  const percent = Math.round(scale * 100)

  return (
    <div className="overlay" onClick={onClose}>
      <div className="popup" onClick={(event) => event.stopPropagation()}>
        <header className="popup-bar">
          <strong>{bill.number}</strong>
          <span className="dim">
            {size
              ? `${size.width} × ${size.height} px${percent < 100 ? ` · shown at ${percent}%` : ''}`
              : 'measuring…'}
          </span>
          <div className="popup-actions">
            <button onClick={print}>Print</button>
            <button className="ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        {missing.length > 0 ? (
          <div className="warn">
            <strong>{missing.length} binding(s) had no data</strong> and printed blank:{' '}
            <code>{missing.join(', ')}</code>
          </div>
        ) : null}

        {/*
          Two boxes, and the distinction matters. The outer one is the scaled
          footprint the layout sees. The iframe inside keeps the document's true
          pixel size and is shrunk with a transform — shrinking the iframe itself
          would clip a fixed-width document and give it its own scrollbars
          instead of making it smaller.

          The transform is purely visual and lives in *this* document, so it has
          no effect on what the iframe prints. Paper still comes out at the size
          the template says.
        */}
        <div
          className="paper"
          style={
            size
              ? { width: size.width * scale, height: size.height * scale }
              : // Somewhere to load into while the real dimensions are unknown.
                // No paper numbers here either.
                { visibility: 'hidden', width: '100%', height: '50vh' }
          }
        >
          <iframe
            ref={frame}
            srcDoc={html}
            onLoad={measure}
            title={`Bill ${bill.number}`}
            style={
              size
                ? {
                    width: size.width,
                    height: size.height,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }
                : undefined
            }
          />
        </div>
      </div>
    </div>
  )
}

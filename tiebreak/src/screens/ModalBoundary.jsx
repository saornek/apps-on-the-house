import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ensureFocusInside,
  focusInitialElement,
  handleModalKeyDown,
  isolateAppBackground,
  restoreFocus,
} from './modalFocus.js'

export default function ModalBoundary({
  labelledBy,
  className = '',
  closeOnEscape = true,
  onClose,
  children,
}) {
  const dialogRef = useRef(null)
  const closeRef = useRef(onClose)
  const [portalNode] = useState(() => {
    const node = document.createElement('div')
    node.dataset.modalPortal = ''
    return node
  })
  closeRef.current = onClose

  useLayoutEffect(() => {
    document.body.appendChild(portalNode)
    return () => portalNode.remove()
  }, [portalNode])

  useLayoutEffect(() => {
    const previousFocus = document.activeElement
    const restoreBackground = isolateAppBackground(document.getElementById('root'))
    focusInitialElement(dialogRef.current)

    return () => {
      restoreBackground()
      restoreFocus(previousFocus)
    }
  }, [])

  useLayoutEffect(() => {
    ensureFocusInside(dialogRef.current, document.activeElement)
  }, [children])

  return createPortal(
    <div className="modal-backdrop">
      <section
        ref={dialogRef}
        className={`game-dialog ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex="-1"
        onKeyDown={(event) => {
          handleModalKeyDown(event, dialogRef.current, () => {
            if (closeOnEscape) closeRef.current()
          })
        }}
      >
        {children}
      </section>
    </div>,
    portalNode,
  )
}

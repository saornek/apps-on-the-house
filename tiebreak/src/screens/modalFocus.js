const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[tabindex]',
].join(',')

function focusableElements(dialog) {
  return [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => (
    !element.disabled &&
    !element.hasAttribute?.('disabled') &&
    element.getAttribute?.('aria-hidden') !== 'true' &&
    element.tabIndex >= 0
  ))
}

export function focusInitialElement(dialog) {
  const [first] = focusableElements(dialog)
  ;(first ?? dialog).focus()
}

export function ensureFocusInside(dialog, activeElement) {
  if (!dialog.contains(activeElement)) focusInitialElement(dialog)
}

export function restoreFocus(element) {
  if (element?.isConnected !== false) element?.focus?.()
}

export function handleModalKeyDown(event, dialog, onClose, activeElement) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    onClose()
    return
  }
  if (event.key !== 'Tab') return

  const elements = focusableElements(dialog)
  if (elements.length === 0) {
    event.preventDefault()
    dialog.focus()
    return
  }

  const current = activeElement ?? dialog.ownerDocument?.activeElement
  const first = elements[0]
  const last = elements[elements.length - 1]
  const outside = !elements.includes(current)
  if (event.shiftKey && (current === first || outside)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (current === last || outside)) {
    event.preventDefault()
    first.focus()
  }
}

export function isolateAppBackground(appRoot) {
  if (!appRoot) return () => {}

  const previousInert = appRoot.inert
  const hadAriaHidden = appRoot.hasAttribute('aria-hidden')
  const previousAriaHidden = appRoot.getAttribute('aria-hidden')

  appRoot.inert = true
  appRoot.setAttribute('aria-hidden', 'true')

  return () => {
    appRoot.inert = previousInert
    if (hadAriaHidden) appRoot.setAttribute('aria-hidden', previousAriaHidden)
    else appRoot.removeAttribute('aria-hidden')
  }
}

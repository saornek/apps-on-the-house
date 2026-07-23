import { describe, expect, it, vi } from 'vitest'
import {
  ensureFocusInside,
  focusInitialElement,
  handleModalKeyDown,
  isolateAppBackground,
  restoreFocus,
} from './modalFocus.js'

function focusable() {
  return {
    disabled: false,
    tabIndex: 0,
    focus: vi.fn(),
    getAttribute: () => null,
    hasAttribute: () => false,
  }
}

function dialogWith(elements) {
  return {
    focus: vi.fn(),
    querySelectorAll: () => elements,
  }
}

function keyEvent(key, shiftKey = false) {
  return {
    key,
    shiftKey,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }
}

describe('modal focus boundary', () => {
  it('moves initial focus to the first available control and restores prior focus', () => {
    const first = focusable()
    const prior = { isConnected: true, focus: vi.fn() }

    focusInitialElement(dialogWith([first]))
    restoreFocus(prior)

    expect(first.focus).toHaveBeenCalledOnce()
    expect(prior.focus).toHaveBeenCalledOnce()
  })

  it('recovers focus after dialog content replacement without stealing contained focus', () => {
    const first = focusable()
    const retained = focusable()
    const dialog = {
      ...dialogWith([first, retained]),
      contains: (element) => element === first || element === retained,
    }

    ensureFocusInside(dialog, { focus: vi.fn() })
    expect(first.focus).toHaveBeenCalledOnce()

    ensureFocusInside(dialog, retained)
    expect(first.focus).toHaveBeenCalledOnce()
    expect(retained.focus).not.toHaveBeenCalled()
  })

  it('wraps forward and reverse Tab within the dialog', () => {
    const first = focusable()
    const last = focusable()
    const dialog = dialogWith([first, last])
    const forward = keyEvent('Tab')
    const reverse = keyEvent('Tab', true)

    handleModalKeyDown(forward, dialog, vi.fn(), last)
    handleModalKeyDown(reverse, dialog, vi.fn(), first)

    expect(forward.preventDefault).toHaveBeenCalledOnce()
    expect(first.focus).toHaveBeenCalledOnce()
    expect(reverse.preventDefault).toHaveBeenCalledOnce()
    expect(last.focus).toHaveBeenCalledOnce()
  })

  it('closes on Escape through the provided callback', () => {
    const close = vi.fn()
    const event = keyEvent('Escape')

    handleModalKeyDown(event, dialogWith([]), close, null)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(event.stopPropagation).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })

  it('makes the app background inert and restores its previous state', () => {
    const attributes = new Map([['aria-hidden', 'false']])
    const appRoot = {
      inert: false,
      hasAttribute: (name) => attributes.has(name),
      getAttribute: (name) => attributes.get(name) ?? null,
      setAttribute: (name, value) => attributes.set(name, value),
      removeAttribute: (name) => attributes.delete(name),
    }

    const restore = isolateAppBackground(appRoot)

    expect(appRoot.inert).toBe(true)
    expect(attributes.get('aria-hidden')).toBe('true')

    restore()

    expect(appRoot.inert).toBe(false)
    expect(attributes.get('aria-hidden')).toBe('false')
  })
})

import React, { useEffect, useRef, useState } from 'react'
import { Check, Share2 } from 'lucide-react'

export function challengeText(match) {
  const winnerIndex = match.scores[0] > match.scores[1] ? 0 : 1
  const loserIndex = 1 - winnerIndex
  const winner = match.players[winnerIndex]
  return `${winner.name} won ${match.scores[winnerIndex]}–${match.scores[loserIndex]} in Tiebreak. Can you beat that score?`
}

export function buildShareContent(text, locationLike = globalThis.location) {
  const gamePath = '/games/tiebreak/'
  const shareUrl = locationLike?.pathname?.startsWith('/games/')
    ? new URL(gamePath, locationLike.origin).href
    : 'https://appsonthehouse.com' + gamePath
  const shareText = `${text}\n\nFree. No ads. No signup.`
  const fullText = `${shareText}\n${shareUrl}`
  const links = [
    {
      label: 'X',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(fullText)}`,
    },
  ]
  return { shareUrl, shareText, fullText, links }
}

export async function tryNativeShare(navigator, fullText) {
  if (!navigator?.share) return false
  try {
    await navigator.share({ text: fullText })
  } catch {
    // Native cancellation or failure leaves the result screen unchanged.
  }
  return true
}

export async function copyShareText(navigator, fullText) {
  try {
    if (!navigator?.clipboard?.writeText) return false
    await navigator.clipboard.writeText(fullText)
    return true
  } catch {
    return false
  }
}

export function shouldDismissShareMenu(event, menuElement) {
  if (event.type === 'keydown') return event.key === 'Escape'
  return event.type === 'mousedown'
    && Boolean(menuElement)
    && !menuElement.contains(event.target)
}

export default function ShareButton({ text }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef(null)
  const { fullText, links } = buildShareContent(text)

  useEffect(() => {
    if (!open) return undefined
    const dismiss = (event) => {
      if (shouldDismissShareMenu(event, menuRef.current)) setOpen(false)
    }
    document.addEventListener('mousedown', dismiss)
    document.addEventListener('keydown', dismiss)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('keydown', dismiss)
    }
  }, [open])

  const handleShare = async () => {
    if (await tryNativeShare(globalThis.navigator, fullText)) return
    setOpen((value) => !value)
  }

  const handleCopy = async () => {
    if (!await copyShareText(globalThis.navigator, fullText)) return
    setCopied(true)
    globalThis.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="share-wrap" ref={menuRef}>
      <button
        className="button share-button"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleShare}
      >
        <Share2 size={15} /> Challenge a Friend
      </button>
      {open && (
        <div className="share-menu" role="menu">
          {links.map((link) => (
            <a
              className="share-link"
              href={link.href}
              key={link.label}
              role="menuitem"
              target="_blank"
              rel="noreferrer"
            >
              {link.label}
            </a>
          ))}
          <button
            className="share-link"
            type="button"
            role="menuitem"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check size={13} aria-hidden="true" />
                Copied
              </>
            ) : (
              'Copy for Instagram'
            )}
          </button>
        </div>
      )}
      <span className="visually-hidden" aria-live="polite">
        {copied ? 'Challenge text copied.' : ''}
      </span>
    </div>
  )
}

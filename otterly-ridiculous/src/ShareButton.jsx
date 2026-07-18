/*
 * ShareButton — a small share control for game-over screens.
 * Part of Apps On The House. Free, no ads, no tracking.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * On phones/supported browsers, tapping Share opens the native OS share
 * sheet (navigator.share) — this is what surfaces Instagram, WhatsApp,
 * Messages, etc. automatically, with no per-app code needed.
 *
 * On desktop, where there's no native share sheet, it opens a small menu
 * with direct share links (X, Facebook, LinkedIn, WhatsApp) plus a
 * "Copy for Instagram" option, since Instagram has no web share link —
 * copying lets someone paste the text into a Story or DM themselves.
 */

import { useEffect, useRef, useState } from 'react'
import { Share2, Check } from 'lucide-react'

export default function ShareButton({ text }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef(null)

  const gamePath = '/games/swimming-otter'
  const shareUrl =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/games/')
      ? new URL(gamePath, window.location.origin).href
      : 'https://appsonthehouse.com' + gamePath
  const shareText = `${text}\n\nFree. No ads. No signup.`
  const fullText = `${shareText}\n${shareUrl}`

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text: fullText })
      } catch {
        // User cancelled the native share sheet — nothing to do.
      }
      return
    }
    setOpen((v) => !v)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API unavailable — the direct links below still work.
    }
  }

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

  return (
    <div className="share-wrap" ref={menuRef}>
      <button className="btn btn-outline share-btn" type="button" onClick={handleShare}>
        <Share2 size={15} /> Challenge a Friend
      </button>
      {open && (
        <div className="share-menu" role="menu">
          {links.map((l) => (
            <a key={l.label} className="share-link" href={l.href} target="_blank" rel="noreferrer">
              {l.label}
            </a>
          ))}
          <button className="share-link" type="button" onClick={copyToClipboard}>
            {copied ? (
              <>
                <Check size={13} /> Copied
              </>
            ) : (
              'Copy for Instagram'
            )}
          </button>
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import './EvolQrConnect.css'

function seeded(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return () => {
    hash += 0x6D2B79F5
    let t = hash
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function Tree({ url }: { url: string }) {
  const branches = useMemo(() => {
    const random = seeded(url)
    return Array.from({ length: 15 }, (_, index) => ({
      left: 50 + (random() - 0.5) * 42,
      top: 18 + random() * 46,
      rotate: -58 + random() * 116,
      length: 34 + random() * 54,
      width: 3 + random() * 3,
      delay: index * 0.035,
    }))
  }, [url])

  const leaves = useMemo(() => {
    const random = seeded(`${url}:leaves`)
    return Array.from({ length: 34 }, (_, index) => ({
      left: 26 + random() * 48,
      top: 14 + random() * 50,
      size: 7 + random() * 12,
      rotate: random() * 140 - 70,
      delay: index * 0.02,
    }))
  }, [url])

  return (
    <div className="evol-qr-tree" aria-hidden="true">
      <div className="evol-qr-tree__floor" />
      <div className="evol-qr-tree__trunk" />
      <div className="evol-qr-tree__branch-layer">
        {branches.map((branch, index) => (
          <span
            key={`branch-${index}`}
            className="evol-qr-tree__branch"
            style={{
              left: `${branch.left}%`,
              top: `${branch.top}%`,
              width: `${branch.length}px`,
              height: `${branch.width}px`,
              transform: `rotate(${branch.rotate}deg)`,
              animationDelay: `${branch.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="evol-qr-tree__leaf-layer">
        {leaves.map((leaf, index) => (
          <span
            key={`leaf-${index}`}
            className="evol-qr-tree__leaf"
            style={{
              left: `${leaf.left}%`,
              top: `${leaf.top}%`,
              width: `${leaf.size}px`,
              height: `${leaf.size}px`,
              transform: `rotate(${leaf.rotate}deg)`,
              animationDelay: `${leaf.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="evol-qr-tree__grid" />
    </div>
  )
}

export default function EvolQrConnect() {
  const url = window.location.origin
  const [qrData, setQrData] = useState('')
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 360,
      color: { dark: '#0a0d0d', light: '#f4f6f3' },
    }).then((data) => {
      if (!cancelled) setQrData(data)
    }).catch(() => {
      if (!cancelled) setQrData('')
    })
    return () => { cancelled = true }
  }, [url])

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="evol-qr-connect" data-admin-only="false">
      <div className="evol-qr-connect__copy">
        <span className="eyebrow">Device connection</span>
        <h2>Scan into EV0L</h2>
        <p>Open this EV0L instance on another phone, tablet, or laptop without typing the address.</p>
      </div>

      <button
        type="button"
        className={`evol-qr-stage ${showQr ? 'is-qr' : ''}`}
        onClick={() => setShowQr((value) => !value)}
        aria-label={showQr ? 'Show the EV0L tree' : 'Reveal the EV0L QR code'}
      >
        <Tree url={url} />
        <div className="evol-qr-reveal">
          {qrData ? <img src={qrData} alt="QR code for this EV0L address" /> : <span>Preparing QR…</span>}
        </div>
        <span className="evol-qr-stage__hint">{showQr ? 'Tap to grow the tree' : 'Tap to reveal QR'}</span>
      </button>

      <div className="evol-qr-connect__actions">
        <code>{url}</code>
        <button className="button button--subtle" type="button" onClick={copyUrl}>{copied ? 'Copied' : 'Copy address'}</button>
      </div>
    </section>
  )
}

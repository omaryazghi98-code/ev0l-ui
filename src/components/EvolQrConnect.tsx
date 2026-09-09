import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import './EvolQrConnect.css'

export default function EvolQrConnect() {
  const url = window.location.origin
  const [qrData, setQrData] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 3,
      width: 720,
      color: { dark: '#101010', light: '#e7e5de' },
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
        <span className="eyebrow">EV0L // LOCAL NODE</span>
        <h2>Device link</h2>
        <p>Scan the node from another phone, tablet, or laptop. The code points to this EV0L instance only.</p>
        <div className="evol-qr-connect__status"><span className="evol-qr-status-dot" /><span>LINK OPEN</span><i /><span>LOCAL</span></div>
      </div>

      <div className="evol-qr-deaddrop" aria-label="EV0L device link QR code">
        <div className="evol-qr-deaddrop__topline"><span>DEAD DROP // 001</span><span>AUTH: EV0L</span></div>
        <div className="evol-qr-deaddrop__code">
          {qrData ? <img src={qrData} alt="QR code for this EV0L address" /> : <div className="evol-qr-deaddrop__loading">GENERATING LINK</div>}
          <span className="evol-qr-mark">EV0L</span>
        </div>
        <div className="evol-qr-deaddrop__meta"><span>SCAN / CONNECT</span><span>NODE READY</span></div>
        <div className="evol-qr-deaddrop__glitch" aria-hidden="true"><b /><i /><em /></div>
      </div>

      <div className="evol-qr-connect__actions">
        <div><span>NODE ADDRESS</span><code>{url}</code></div>
        <button className="button button--subtle" type="button" onClick={copyUrl}>{copied ? 'Copied' : 'Copy address'}</button>
      </div>
    </section>
  )
}

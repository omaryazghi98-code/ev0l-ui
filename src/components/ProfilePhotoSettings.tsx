import { useRef, useState } from 'react'
import type { Profile } from '../lib/ev0l'
import { Icon } from './UI'
import './ProfilePhotoSettings.css'

type Props = {
  profile: Profile
  onProfileUpdate: (profile: Profile) => void
}

type FaceBox = { x: number; y: number; width: number; height: number }
type FaceDetectorLike = {
  detect: (image: HTMLImageElement) => Promise<Array<{ boundingBox: FaceBox }>>
}

type WindowWithFaceDetector = Window & {
  FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike
}

const OUTPUT_SIZE = 512
const MAX_FILE_SIZE = 12 * 1024 * 1024

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('The image could not be read.'))
    }
    image.src = url
  })
}

async function getFaceFocus(image: HTMLImageElement): Promise<{ x: number; y: number } | null> {
  const FaceDetector = (window as WindowWithFaceDetector).FaceDetector
  if (!FaceDetector) return null

  try {
    const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 3 })
    const faces = await detector.detect(image)
    if (!faces.length) return null

    const largest = faces
      .filter((face) => face.boundingBox.width > 0 && face.boundingBox.height > 0)
      .sort((a, b) => (b.boundingBox.width * b.boundingBox.height) - (a.boundingBox.width * a.boundingBox.height))[0]

    if (!largest) return null

    return {
      x: largest.boundingBox.x + largest.boundingBox.width / 2,
      y: largest.boundingBox.y + largest.boundingBox.height / 2,
    }
  } catch {
    return null
  }
}

async function cropAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a JPG, PNG, or WebP image.')
  if (file.size > MAX_FILE_SIZE) throw new Error('Choose an image smaller than 12 MB.')

  const image = await loadImage(file)
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('The image has no usable dimensions.')

  const width = image.naturalWidth
  const height = image.naturalHeight
  const side = Math.min(width, height)
  const focus = await getFaceFocus(image)

  let sourceX = (width - side) / 2
  let sourceY = (height - side) / 2

  if (focus) {
    sourceX = Math.min(Math.max(focus.x - side / 2, 0), width - side)
    sourceY = Math.min(Math.max(focus.y - side / 2, 0), height - side)
  }

  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not create the avatar crop.')

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, sourceX, sourceY, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

  return canvas.toDataURL('image/jpeg', 0.88)
}

function saveProfileAvatar(profile: Profile, avatar?: string): Profile {
  const next = { ...profile, avatar: avatar || profile.name[0] }
  const profiles = JSON.parse(localStorage.getItem('ev0l-profiles') || '[]') as Profile[]
  const current = profiles.length ? profiles : [profile]
  const updated = current.some((item) => item.id === profile.id)
    ? current.map((item) => item.id === profile.id ? next : item)
    : [...current, next]
  localStorage.setItem('ev0l-profiles', JSON.stringify(updated))
  return next
}

export default function ProfilePhotoSettings({ profile, onProfileUpdate }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const isImage = Boolean(profile.avatar?.startsWith('data:image/'))

  async function handleFile(file: File | undefined) {
    if (!file || busy) return
    setBusy(true)
    setError('')
    setMessage('Auto-cropping image…')
    try {
      const avatar = await cropAvatar(file)
      const next = saveProfileAvatar(profile, avatar)
      onProfileUpdate(next)
      setMessage('Profile image updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process that image.')
      setMessage('')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function removeImage() {
    const next = saveProfileAvatar(profile)
    onProfileUpdate(next)
    setError('')
    setMessage('Profile image removed.')
  }

  return (
    <section className="profile-photo-settings" aria-labelledby="profile-photo-title">
      <div className="profile-photo-settings__heading">
        <div>
          <span className="eyebrow">Personal identity</span>
          <h2 id="profile-photo-title">Profile image</h2>
          <p>Choose a photo for the profile picker. EV0L auto-crops it to a square and keeps the original image on this device.</p>
        </div>
        <div className="profile-photo-settings__badge"><Icon name="user" size={16} /> {profile.name}</div>
      </div>

      <div className="profile-photo-settings__body">
        <div className="profile-photo-settings__preview" aria-label={`${profile.name} profile image preview`}>
          {isImage ? <img src={profile.avatar} alt="" /> : <span>{profile.avatar || profile.name[0]}</span>}
        </div>

        <div className="profile-photo-settings__actions">
          <input ref={inputRef} className="profile-photo-settings__file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleFile(event.target.files?.[0])} />
          <button type="button" className="button button--primary" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Icon name="upload" size={17} />
            {busy ? 'Cropping…' : isImage ? 'Replace image' : 'Choose image'}
          </button>
          {isImage && <button type="button" className="button button--subtle" onClick={removeImage} disabled={busy}>Use initials</button>}
          <small>JPG, PNG or WebP · max 12 MB · output 512×512</small>
          {message && <p className="profile-photo-settings__message">{message}</p>}
          {error && <p className="profile-photo-settings__error">{error}</p>}
        </div>
      </div>
    </section>
  )
}

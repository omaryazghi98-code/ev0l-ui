import EvilEye from './EvilEye'
import { Icon } from './UI'
import './GuestAdminLock.css'

type Props = {
  onBack: () => void
  title?: string
  subtitle?: string
}

const SECRETS = [
  'System power',
  'Server controls',
  'Provider configuration',
  'Ghost Sentry',
  'API endpoints & secrets',
]

export default function GuestAdminLock({
  onBack,
  title = 'Nice try, guest.',
  subtitle = 'Admin controls are watching. These settings stay private to the owner profile.',
}: Props) {
  return (
    <main className="guest-admin-lock">
      <div className="guest-admin-lock__veil" aria-hidden="true" />

      <section className="guest-admin-lock__panel" aria-labelledby="guest-admin-lock-title">
        <div className="guest-admin-lock__eye" aria-hidden="true">
          <EvilEye
            eyeColor="#7F8B95"
            intensity={0.9}
            pupilSize={0.62}
            irisWidth={0.22}
            glowIntensity={0.16}
            scale={0.78}
            noiseScale={1.05}
            pupilFollow={0.8}
            flameSpeed={0.55}
            backgroundColor="#050607"
          />
          <span>ACCESS WATCHED</span>
        </div>

        <div className="guest-admin-lock__copy">
          <span className="eyebrow">Owner controls</span>
          <h1 id="guest-admin-lock-title">{title}</h1>
          <p>{subtitle}</p>
        </div>

        <div className="guest-admin-lock__secrets" aria-label="Hidden administrator settings">
          {SECRETS.map((secret) => (
            <div className="guest-secret" key={secret}>
              <span className="guest-secret__eye">◉</span>
              <span>{secret}</span>
              <strong>HIDDEN</strong>
            </div>
          ))}
        </div>

        <div className="guest-admin-lock__footer">
          <span><i />Guest session detected</span>
          <button className="button button--subtle" type="button" onClick={onBack}>
            <Icon name="back" />
            Back to EV0L
          </button>
        </div>
      </section>
    </main>
  )
}

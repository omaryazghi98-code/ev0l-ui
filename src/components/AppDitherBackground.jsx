import Dither from './Dither'
import './AppDitherBackground.css'

export default function AppDitherBackground() {
  return (
    <div className="app-dither-background" aria-hidden="true">
      <Dither
        waveColor={[0.08, 0.48, 0.52]}
        backgroundColor={[0.015, 0.02, 0.025]}
        colorNum={6}
        pixelSize={3}
        waveAmplitude={0.24}
        waveFrequency={2.6}
        waveSpeed={0.035}
        enableMouseInteraction={false}
        mouseRadius={0.35}
      />
    </div>
  )
}

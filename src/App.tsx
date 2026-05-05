import { useEffect, useRef, useState } from 'react'
import './App.css'
import { SceneManager } from './core/SceneManager'

type SceneMode = 'loading' | 'model' | 'placeholder'

type SceneStatus = {
  loaded: number
  mode: SceneMode
  selectedHero: string
  selectedState: 'idle' | 'run' | 'attack' | 'death'
  total: number
}

const statusCopy: Record<SceneMode, string> = {
  loading: 'Loading',
  model: 'Ready',
  placeholder: 'Placeholder',
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<SceneStatus>({
    loaded: 0,
    mode: 'loading',
    selectedHero: 'Alice',
    selectedState: 'idle',
    total: 2,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const frame = frameRef.current

    if (!canvas || !frame) {
      return
    }

    const sceneManager = new SceneManager(canvas, setStatus)
    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      sceneManager.resize(width, height)
    })

    resizeObserver.observe(frame)
    sceneManager.start()

    return () => {
      resizeObserver.disconnect()
      sceneManager.dispose()
    }
  }, [])

  return (
    <main className="app-shell">
      <section className="game-stage" aria-label="Phase 3 map rendering">
        <div className="viewport" ref={frameRef}>
          <canvas ref={canvasRef} />
          <div className="hud-panel">
            <span className={`status-dot ${status.mode}`} aria-hidden="true" />
            <div>
              <p className="eyebrow">Phase 3</p>
              <h1>
                {status.loaded === status.total
                  ? `${status.selectedHero} ${status.selectedState}`
                  : statusCopy.loading}
              </h1>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App

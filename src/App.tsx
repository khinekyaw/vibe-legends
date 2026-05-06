import { useEffect, useRef, useState } from 'react'
import './App.css'
import { SceneManager } from './core/SceneManager'

type SceneMode = 'loading' | 'model' | 'placeholder'

type SceneStatus = {
  enemyHp: number
  enemyMaxHp: number
  loaded: number
  mode: SceneMode
  selectedHp: number
  selectedHero: string
  selectedMaxHp: number
  selectedState: 'idle' | 'run' | 'attack' | 'skill1' | 'skill2' | 'skill3' | 'death'
  skillCooldowns: Record<'skill1' | 'skill2' | 'skill3', number>
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
    enemyHp: 1200,
    enemyMaxHp: 1200,
    loaded: 0,
    mode: 'loading',
    selectedHp: 1200,
    selectedHero: 'Alice',
    selectedMaxHp: 1200,
    selectedState: 'idle',
    skillCooldowns: {
      skill1: 0,
      skill2: 0,
      skill3: 0,
    },
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
      <section className="game-stage" aria-label="Phase 5 combat">
        <div className="viewport" ref={frameRef}>
          <canvas ref={canvasRef} />
          <div className="hud-panel">
            <span className={`status-dot ${status.mode}`} aria-hidden="true" />
            <div>
              <p className="eyebrow">Phase 5</p>
              <h1>
                {status.loaded === status.total
                  ? `${status.selectedHero} ${status.selectedState}`
                  : statusCopy.loading}
              </h1>
              <div className="combat-bars" aria-label="Combat status">
                <span>{Math.max(0, status.selectedHp)} HP</span>
                <span>{Math.max(0, status.enemyHp)} enemy</span>
              </div>
              <div className="skill-row" aria-label="Skill cooldowns">
                <span>Q {formatCooldown(status.skillCooldowns.skill1)}</span>
                <span>E {formatCooldown(status.skillCooldowns.skill2)}</span>
                <span>R {formatCooldown(status.skillCooldowns.skill3)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function formatCooldown(value: number) {
  return value <= 0 ? 'Ready' : value.toFixed(0)
}

export default App

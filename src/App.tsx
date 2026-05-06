import { useEffect, useRef, useState } from 'react'
import './App.css'
import { SceneManager } from './core/SceneManager'

type SceneMode = 'loading' | 'model' | 'placeholder'

type SceneStatus = {
  enemyHp: number
  enemyMaxHp: number
  healthBars: Array<{
    hp: number
    id: string
    isSelected: boolean
    maxHp: number
    name: string
    showName?: boolean
    visible: boolean
    x: number
    y: number
  }>
  loaded: number
  mode: SceneMode
  selectedHp: number
  selectedHero: string
  selectedMaxHp: number
  selectedState: 'idle' | 'run' | 'attack' | 'skill1' | 'skill2' | 'skill3' | 'death'
  skillCooldowns: Record<'skill1' | 'skill2' | 'skill3', number>
  total: number
}

type SkillSlot = 'skill1' | 'skill2' | 'skill3'

const skillSlots: Array<{ keyLabel: string; slot: SkillSlot }> = [
  { keyLabel: 'Q', slot: 'skill1' },
  { keyLabel: 'E', slot: 'skill2' },
  { keyLabel: 'R', slot: 'skill3' },
]

const skillIcons: Record<string, Record<SkillSlot, { alt: string; src: string }>> = {
  Alice: {
    skill1: {
      alt: 'Crimson Gleam',
      src: '/assets/images/alice/Crimson_Gleam.webp',
    },
    skill2: {
      alt: 'Doom Waltz',
      src: '/assets/images/alice/Doom_Waltz.webp',
    },
    skill3: {
      alt: 'Throne of Ruin',
      src: '/assets/images/alice/Throne_of_Ruin.webp',
    },
  },
  Ruby: {
    skill1: {
      alt: 'Be Good!',
      src: '/assets/images/ruby/Be_Good.webp',
    },
    skill2: {
      alt: "Don't Run, Wolf King!",
      src: '/assets/images/ruby/Dont_Run_Wolf_King.webp',
    },
    skill3: {
      alt: "I'm Offended!",
      src: '/assets/images/ruby/Im_Offended.webp',
    },
  },
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
    healthBars: [],
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
      <section className="game-stage" aria-label="Phase 7 objectives and HUD">
        <div className="viewport" ref={frameRef}>
          <canvas ref={canvasRef} />
          <div className="world-health-layer" aria-hidden="true">
            {status.healthBars.map((bar) => (
              <div
                className={`world-health-bar${bar.isSelected ? ' selected' : ''}`}
                key={bar.id}
                style={{
                  opacity: bar.visible ? 1 : 0,
                  transform: `translate(${bar.x}px, ${bar.y}px) translate(-50%, -100%)`,
                }}
              >
                {bar.showName !== false && (
                  <div className="world-health-name">{bar.name}</div>
                )}
                <div className="world-health-track">
                  <span style={{ width: `${getHpPercent(bar.hp, bar.maxHp)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="skill-dock" aria-label={`${status.selectedHero} skills`}>
            {skillSlots.map(({ keyLabel, slot }) => {
              const cooldown = status.skillCooldowns[slot]
              const icon = skillIcons[status.selectedHero]?.[slot]

              return (
                <button
                  aria-label={`${keyLabel} ${icon?.alt ?? slot}`}
                  className="skill-button"
                  data-ready={cooldown <= 0}
                  key={slot}
                  onClick={() => dispatchSkillCommand(slot)}
                  type="button"
                >
                  {icon && <img alt="" src={icon.src} />}
                  <span className="skill-key">{keyLabel}</span>
                  {cooldown > 0 && (
                    <>
                      <span className="skill-mask" />
                      <span className="skill-cooldown">{cooldown.toFixed(0)}</span>
                    </>
                  )}
                </button>
              )
            })}
          </div>
          <div className="hud-panel">
            <span className={`status-dot ${status.mode}`} aria-hidden="true" />
            <div>
              <p className="eyebrow">Phase 7</p>
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

function getHpPercent(hp: number, maxHp: number) {
  if (maxHp <= 0) {
    return 0
  }

  return Math.max(0, Math.min(100, (hp / maxHp) * 100))
}

function dispatchSkillCommand(slot: SkillSlot) {
  window.dispatchEvent(new CustomEvent('skill-command', { detail: slot }))
}

export default App

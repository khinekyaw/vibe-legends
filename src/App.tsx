import { useEffect, useRef, useState } from 'react'
import './App.css'
import { SceneManager } from './core/SceneManager'
import type { SceneStatus } from './core/sceneConfig'

type SkillSlot = 'skill1' | 'skill2' | 'skill3'

const heroChoices = [
  {
    name: 'Alice',
    portrait: '/assets/images/alice/alice_icon.webp',
  },
  {
    name: 'Ruby',
    portrait: '/assets/images/ruby/ruby_icon.webp',
  },
] as const

type HeroChoiceName = (typeof heroChoices)[number]['name']

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

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [selectedHeroName, setSelectedHeroName] = useState<HeroChoiceName | null>(null)
  const [status, setStatus] = useState<SceneStatus>({
    enemyHp: 1200,
    enemyKills: 0,
    enemyMaxHp: 1200,
    healthBars: [],
    loaded: 0,
    matchResult: 'playing',
    minimap: {
      markers: [],
    },
    mode: 'loading',
    playerKills: 0,
    respawnSeconds: 0,
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

    if (!canvas || !frame || !selectedHeroName) {
      return
    }

    const sceneManager = new SceneManager(canvas, setStatus, selectedHeroName)
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
  }, [selectedHeroName])

  const chooseHero = (heroName: HeroChoiceName) => {
    setStatus((currentStatus) => ({
      ...currentStatus,
      enemyKills: 0,
      enemyHp: 1200,
      enemyMaxHp: 1200,
      healthBars: [],
      loaded: 0,
      matchResult: 'playing',
      minimap: {
        markers: [],
      },
      mode: 'loading',
      playerKills: 0,
      respawnSeconds: 0,
      selectedHero: heroName,
      selectedHp: 1200,
      selectedMaxHp: 1200,
      selectedState: 'idle',
      skillCooldowns: {
        skill1: 0,
        skill2: 0,
        skill3: 0,
      },
      total: heroChoices.length,
    }))
    setSelectedHeroName(heroName)
  }

  return (
    <main className="app-shell">
      <section className="game-stage" aria-label="Phase 7 objectives and HUD">
        <div className="viewport" ref={frameRef}>
          <canvas ref={canvasRef} />
          {selectedHeroName ? (
            <>
              <div className="minimap" aria-label="Minimap">
                <div className="minimap-lane" aria-hidden="true">
                  <span className="minimap-center-line" />
                  {status.minimap.markers.map((marker) => (
                    <span
                      className={[
                        'minimap-marker',
                        marker.kind,
                        marker.team,
                        marker.isPlayer ? 'player' : '',
                      ].filter(Boolean).join(' ')}
                      data-alive={marker.alive}
                      key={marker.id}
                      style={{
                        left: `${marker.x}%`,
                        top: `${marker.y}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="match-scoreboard" aria-label="Kill count">
                <span>{status.selectedHero}</span>
                <strong>{status.playerKills}</strong>
                <span>Kills</span>
                <strong>{status.enemyKills}</strong>
                <span>Enemy</span>
              </div>
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
                  const disabled = status.matchResult !== 'playing' || status.respawnSeconds > 0

                  return (
                    <button
                      aria-label={`${keyLabel} ${icon?.alt ?? slot}`}
                      className="skill-button"
                      data-ready={cooldown <= 0}
                      disabled={disabled}
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
              <div className="hero-hud" aria-label="Player HUD">
                <div className="hero-hud-top">
                  <strong>{status.selectedHero}</strong>
                  <span>
                    {Math.max(0, status.selectedHp)} / {status.selectedMaxHp}
                  </span>
                </div>
                <div className="hud-health-track" aria-hidden="true">
                  <span style={{ width: `${getHpPercent(status.selectedHp, status.selectedMaxHp)}%` }} />
                </div>
                <div className="enemy-health">
                  <span>Enemy</span>
                  <strong>
                    {Math.max(0, status.enemyHp)} / {status.enemyMaxHp}
                  </strong>
                </div>
                {status.respawnSeconds > 0 && (
                  <div className="respawn-pill">Respawn {Math.ceil(status.respawnSeconds)}</div>
                )}
              </div>
              {status.matchResult !== 'playing' && (
                <div className={`match-result ${status.matchResult}`} role="status">
                  <div>
                    <strong>{status.matchResult === 'win' ? 'Victory' : 'Defeat'}</strong>
                    <span>Nexus destroyed</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="hero-select-overlay" role="dialog" aria-label="Choose hero">
              <div className="hero-select-panel">
                <h1>Choose Hero</h1>
                <div className="hero-select-grid">
                  {heroChoices.map((hero) => (
                    <button
                      className="hero-select-card"
                      key={hero.name}
                      onClick={() => chooseHero(hero.name)}
                      type="button"
                    >
                      <img alt="" src={hero.portrait} />
                      <span>{hero.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
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

import { useEffect, useRef, useState } from 'react'
import './App.css'
import { SceneManager } from './core/SceneManager'
import type { SceneStatus } from './core/sceneConfig'
import { HeroPreview } from './ui/HeroPreview'

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
  {
    name: 'Layla',
    portrait: '/assets/images/layla/layla_icon.webp',
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
  Layla: {
    skill1: {
      alt: 'Malefic Bomb',
      src: '/assets/images/layla/Malefic_Bomb.webp',
    },
    skill2: {
      alt: 'Void Projectile',
      src: '/assets/images/layla/Void_Projectile.webp',
    },
    skill3: {
      alt: 'Destruction Rush',
      src: '/assets/images/layla/Destruction_Rush.webp',
    },
  },
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [selectedHeroName, setSelectedHeroName] = useState<HeroChoiceName>('Alice')
  const [matchHeroName, setMatchHeroName] = useState<HeroChoiceName | null>(null)
  const [status, setStatus] = useState<SceneStatus>(() => createInitialStatus('Alice', 6))

  useEffect(() => {
    const canvas = canvasRef.current
    const frame = frameRef.current

    if (!canvas || !frame || !matchHeroName) {
      return
    }

    const sceneManager = new SceneManager(canvas, setStatus, matchHeroName)
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
  }, [matchHeroName])

  const startMatch = () => {
    setStatus(createInitialStatus(selectedHeroName, 6))
    setMatchHeroName(selectedHeroName)
  }

  return (
    <main className="app-shell">
      <section className="game-stage" aria-label="Phase 7 objectives and HUD">
        <div className="viewport" ref={frameRef}>
          <canvas ref={canvasRef} />
          {matchHeroName ? (
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
                <span>Blue</span>
                <strong>{status.playerKills}</strong>
                <time className="match-clock" dateTime={`PT${Math.floor(status.matchSeconds)}S`}>
                  {formatMatchTime(status.matchSeconds)}
                </time>
                <strong>{status.enemyKills}</strong>
                <span>Red</span>
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
                  <span>Nearest Red</span>
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
                <div className="hero-select-main">
                  <HeroPreview heroName={selectedHeroName} />
                  <div className="hero-select-actions">
                    <h1>{selectedHeroName}</h1>
                    <button className="start-match-button" onClick={startMatch} type="button">
                      Start Match
                    </button>
                  </div>
                </div>
                <div className="hero-select-grid" aria-label="Hero roster">
                  {heroChoices.map((hero) => (
                    <button
                      aria-pressed={selectedHeroName === hero.name}
                      className="hero-select-card"
                      key={hero.name}
                      onClick={() => setSelectedHeroName(hero.name)}
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

function createInitialStatus(heroName: HeroChoiceName, total: number): SceneStatus {
  return {
    enemyHp: 1200,
    enemyKills: 0,
    enemyMaxHp: 1200,
    healthBars: [],
    loaded: 0,
    matchSeconds: 0,
    matchResult: 'playing',
    minimap: {
      markers: [],
    },
    mode: 'loading',
    playerKills: 0,
    respawnSeconds: 0,
    selectedHp: 1200,
    selectedHero: heroName,
    selectedMaxHp: 1200,
    selectedState: 'idle',
    skillCooldowns: {
      skill1: 0,
      skill2: 0,
      skill3: 0,
    },
    total,
  }
}

function getHpPercent(hp: number, maxHp: number) {
  if (maxHp <= 0) {
    return 0
  }

  return Math.max(0, Math.min(100, (hp / maxHp) * 100))
}

function formatMatchTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function dispatchSkillCommand(slot: SkillSlot) {
  window.dispatchEvent(new CustomEvent('skill-command', { detail: slot }))
}

export default App

import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import './App.css'
import type { SceneStatus } from './core/sceneConfig'
import {
  DEFAULT_MATCH_PACE,
  MATCH_PACE_LIST,
  type MatchPace,
} from './core/matchPace'
import { audioManager } from './systems/AudioManager'
import { getHeroXpToNextLevel } from './systems/CombatSystem'
import { VirtualJoystick } from './ui/VirtualJoystick'

const HeroPreview = lazy(() =>
  import('./ui/HeroPreview').then((mod) => ({ default: mod.HeroPreview })),
)

type SkillSlot = 'skill1' | 'skill2' | 'skill3'

const heroChoices = [
  {
    name: 'Layla',
    portrait: '/assets/images/layla/layla_icon.webp',
    role: 'Marksman',
    tagline: 'Malefic Gunner',
    description: 'A long-range marksman whose damage scales the further her shots travel.',
    accent: '#60a5fa',
  },
  {
    name: 'Alice',
    portrait: '/assets/images/alice/alice_icon.webp',
    role: 'Mage',
    tagline: 'Queen of the Apocalypse',
    description: 'Drains life from her foes with crimson magic, sustaining herself through every fight.',
    accent: '#c084fc',
  },
  {
    name: 'Ruby',
    portrait: '/assets/images/ruby/ruby_icon.webp',
    role: 'Fighter',
    tagline: 'Little Red Hood',
    description: 'A relentless brawler whose scythe pulls enemies into the fray and never lets go.',
    accent: '#f87171',
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
  const [selectedHeroName, setSelectedHeroName] = useState<HeroChoiceName>('Layla')
  const [matchHeroName, setMatchHeroName] = useState<HeroChoiceName | null>(null)
  const [status, setStatus] = useState<SceneStatus>(() => createInitialStatus('Layla', 6))
  const [selectedPace, setSelectedPace] = useState<MatchPace>(DEFAULT_MATCH_PACE)
  const [matchPace, setMatchPace] = useState<MatchPace>(DEFAULT_MATCH_PACE)
  const [matchKey, setMatchKey] = useState(0)
  const selectedHero = heroChoices.find((hero) => hero.name === selectedHeroName) ?? heroChoices[0]

  useEffect(() => {
    const canvas = canvasRef.current
    const frame = frameRef.current

    if (!canvas || !frame || !matchHeroName) {
      return
    }

    let sceneManager: { dispose: () => void; resize: (w: number, h: number) => void } | null = null
    let resizeObserver: ResizeObserver | null = null
    let cancelled = false

    import('./core/SceneManager').then(({ SceneManager }) => {
      if (cancelled) return
      const instance = new SceneManager(canvas, setStatus, matchHeroName, matchPace)
      sceneManager = instance
      resizeObserver = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect
        instance.resize(width, height)
      })
      resizeObserver.observe(frame)
      instance.start()
    })

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      sceneManager?.dispose()
    }
  }, [matchHeroName, matchPace, matchKey])

  const startMatch = () => {
    audioManager.startMatchMusic()
    setStatus(createInitialStatus(selectedHeroName, 6))
    setMatchPace(selectedPace)
    setMatchHeroName(selectedHeroName)
    setMatchKey((key) => key + 1)
  }

  const restartMatch = () => {
    if (!matchHeroName) {
      return
    }
    audioManager.startMatchMusic()
    setStatus(createInitialStatus(matchHeroName, 6))
    setMatchKey((key) => key + 1)
  }

  const quitToMenu = () => {
    setMatchHeroName(null)
    setStatus(createInitialStatus(selectedHeroName, 6))
  }

  return (
    <main className="app-shell">
      <div className="orientation-guard" role="alert">
        <div className="orientation-guard-icon" aria-hidden="true">↺</div>
        <strong>Rotate your device</strong>
        <span>This game is designed for landscape mode</span>
      </div>
      <section className="game-stage" aria-label="Match HUD">
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
              {status.respawnSeconds > 0 && (
                <div className="respawn-pill" role="status">
                  Respawn {Math.ceil(status.respawnSeconds)}
                </div>
              )}
              <div className="touch-controls" aria-hidden="false">
                <VirtualJoystick />
                <button
                  aria-label="Basic attack"
                  className="touch-attack-button"
                  onPointerDown={dispatchAttackCommand}
                  type="button"
                >
                  Attack
                </button>
              </div>
              {status.matchResult !== 'playing' && (
                <div className={`match-result ${status.matchResult}`} role="dialog" aria-modal="true">
                  <div className="match-result-card">
                    <span className="match-result-eyebrow">
                      {status.matchResult === 'win' ? 'Nexus Destroyed' : 'Nexus Fallen'}
                    </span>
                    <strong className="match-result-title">
                      {status.matchResult === 'win' ? 'Victory' : 'Defeat'}
                    </strong>
                    <div className="match-result-stats" aria-label="Match summary">
                      <div className="match-result-stat">
                        <span>Time</span>
                        <strong>{formatMatchTime(status.matchSeconds)}</strong>
                      </div>
                      <div className="match-result-stat blue">
                        <span>Blue Kills</span>
                        <strong>{status.playerKills}</strong>
                      </div>
                      <div className="match-result-stat red">
                        <span>Red Kills</span>
                        <strong>{status.enemyKills}</strong>
                      </div>
                    </div>
                    <div className="match-result-actions">
                      <button
                        className="match-result-button primary"
                        onClick={restartMatch}
                        type="button"
                      >
                        Rematch
                      </button>
                      <button
                        className="match-result-button"
                        onClick={quitToMenu}
                        type="button"
                      >
                        Quit to Menu
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              className="hero-select-overlay"
              role="dialog"
              aria-label="Choose hero"
              style={{ ['--hero-accent' as string]: selectedHero.accent }}
            >
              <div className="hero-select-panel">
                <header className="hero-select-header">
                  <h1 className="hero-select-title">Choose Your Hero</h1>
                </header>
                <div className="hero-select-main">
                  <div className="hero-preview-stage">
                    <Suspense fallback={<div className="hero-preview-loading" aria-hidden="true" />}>
                      <HeroPreview heroName={selectedHeroName} key={selectedHeroName} />
                    </Suspense>
                    <div className="hero-preview-vignette" aria-hidden="true" />
                    <div className="hero-preview-caption">
                      <span className="hero-role-badge">{selectedHero.role}</span>
                      <h2 className="hero-name">{selectedHeroName}</h2>
                      <p className="hero-tagline">{selectedHero.tagline}</p>
                    </div>
                  </div>
                  <aside className="hero-select-info">
                    <p className="hero-description">{selectedHero.description}</p>
                    <div className="hero-skill-row" aria-label={`${selectedHeroName} skills`}>
                      {skillSlots.map(({ keyLabel, slot }) => {
                        const icon = skillIcons[selectedHeroName]?.[slot]
                        return (
                          <div className="hero-skill-chip" key={slot}>
                            {icon && <img alt="" src={icon.src} />}
                            <div>
                              <span className="hero-skill-key">{keyLabel}</span>
                              <span className="hero-skill-name">{icon?.alt ?? slot}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="match-pace-group" role="radiogroup" aria-label="Match pace">
                      <span className="match-pace-label">Match Pace</span>
                      <div className="match-pace-options">
                        {MATCH_PACE_LIST.map((pace) => (
                          <button
                            aria-checked={selectedPace === pace.id}
                            className="match-pace-option"
                            key={pace.id}
                            onClick={() => setSelectedPace(pace.id)}
                            role="radio"
                            type="button"
                          >
                            <strong>{pace.label}</strong>
                            <span>~{pace.targetMinutes} min</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <button className="start-match-button" onClick={startMatch} type="button">
                      <span>Start Match</span>
                      <span className="start-match-arrow" aria-hidden="true">→</span>
                    </button>
                  </aside>
                </div>
                <div className="hero-select-grid" aria-label="Hero roster">
                  {heroChoices.map((hero) => (
                    <button
                      aria-pressed={selectedHeroName === hero.name}
                      className="hero-select-card"
                      key={hero.name}
                      onClick={() => setSelectedHeroName(hero.name)}
                      style={{ ['--card-accent' as string]: hero.accent }}
                      type="button"
                    >
                      <img alt="" src={hero.portrait} />
                      <span className="hero-select-card-meta">
                        <strong>{hero.name}</strong>
                        <em>{hero.role}</em>
                      </span>
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
    enemyLevel: 1,
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
    selectedLevel: 1,
    selectedMaxHp: 1200,
    selectedState: 'idle',
    selectedXp: 0,
    selectedXpToNext: getHeroXpToNextLevel(1),
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

function dispatchAttackCommand() {
  window.dispatchEvent(new CustomEvent('virtual-attack'))
}

export default App

type AudioBus = 'hero' | 'minion' | 'music' | 'objective'
type HeroAudioCue = 'basic_attack' | 'skill1' | 'skill2' | 'skill3'

const MATCH_MUSIC_URL = '/assets/audio/music/match_theme.mp3'
const HERO_AUDIO: Record<string, Record<HeroAudioCue, string>> = {
  Alice: {
    basic_attack: '/assets/audio/heroes/alice/basic_attack.mp3',
    skill1: '/assets/audio/heroes/alice/skill1.mp3',
    skill2: '/assets/audio/heroes/alice/skill2.mp3',
    skill3: '/assets/audio/heroes/alice/skill3.mp3',
  },
  Layla: {
    basic_attack: '/assets/audio/heroes/layla/basic_attack.mp3',
    skill1: '/assets/audio/heroes/layla/skill1.mp3',
    skill2: '/assets/audio/heroes/layla/skill2.mp3',
    skill3: '/assets/audio/heroes/layla/skill3.mp3',
  },
  Ruby: {
    basic_attack: '/assets/audio/heroes/ruby/basic_attack.mp3',
    skill1: '/assets/audio/heroes/ruby/skill1.mp3',
    skill2: '/assets/audio/heroes/ruby/skill2.mp3',
    skill3: '/assets/audio/heroes/ruby/skill3.mp3',
  },
}
const MINION_ATTACK_URL = '/assets/audio/minions/basic_attack.mp3'
const TOWER_ATTACK_URL = '/assets/audio/objectives/tower_attack.mp3'

const busVolumes: Record<AudioBus, number> = {
  hero: 0.78,
  minion: 0.36,
  music: 0.32,
  objective: 0.56,
}

class AudioManager {
  private readonly activeOneShots = new Set<HTMLAudioElement>()
  private readonly lastPlayedAt = new Map<string, number>()
  private music: HTMLAudioElement | null = null

  startMatchMusic() {
    if (!this.music) {
      this.music = new Audio(MATCH_MUSIC_URL)
      this.music.loop = true
      this.music.preload = 'auto'
    }

    this.music.volume = busVolumes.music
    void this.music.play().catch(() => undefined)
  }

  playHeroCue(heroName: string, cue: HeroAudioCue) {
    const url = HERO_AUDIO[heroName]?.[cue]

    if (!url) {
      return
    }

    this.playOneShot(url, 'hero')
  }

  playMinionAttack() {
    this.playThrottledOneShot('minion:basic_attack', MINION_ATTACK_URL, 'minion', 0.16)
  }

  playTowerAttack(towerId: string) {
    this.playThrottledOneShot(`tower:${towerId}`, TOWER_ATTACK_URL, 'objective', 0.18)
  }

  private playThrottledOneShot(
    key: string,
    url: string,
    bus: AudioBus,
    minIntervalSeconds: number,
  ) {
    const now = performance.now() / 1000
    const lastPlayedAt = this.lastPlayedAt.get(key) ?? Number.NEGATIVE_INFINITY

    if (now - lastPlayedAt < minIntervalSeconds) {
      return
    }

    this.lastPlayedAt.set(key, now)
    this.playOneShot(url, bus)
  }

  private playOneShot(url: string, bus: AudioBus) {
    const audio = new Audio(url)
    audio.volume = busVolumes[bus]
    audio.preload = 'auto'

    const release = () => {
      this.activeOneShots.delete(audio)
    }

    audio.addEventListener('ended', release, { once: true })
    audio.addEventListener('error', release, { once: true })
    this.activeOneShots.add(audio)
    void audio.play().catch(release)
  }
}

export const audioManager = new AudioManager()

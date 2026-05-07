type AudioBus = 'hero' | 'music'
type HeroAudioCue = 'basic_attack' | 'skill1' | 'skill2' | 'skill3'

const MATCH_MUSIC_URL = '/assets/audio/music/match_theme.mp3'
const HERO_AUDIO: Partial<Record<string, Record<HeroAudioCue, string>>> = {
  Layla: {
    basic_attack: '/assets/audio/heroes/layla/basic_attack.mp3',
    skill1: '/assets/audio/heroes/layla/skill1.mp3',
    skill2: '/assets/audio/heroes/layla/skill2.mp3',
    skill3: '/assets/audio/heroes/layla/skill3.mp3',
  },
}

const busVolumes: Record<AudioBus, number> = {
  hero: 0.78,
  music: 0.32,
}

class AudioManager {
  private readonly activeOneShots = new Set<HTMLAudioElement>()
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

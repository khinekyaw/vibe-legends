import * as THREE from 'three'

export const HERO_ASSETS = [
  {
    clips: {
      attack: 'attack1',
      death: 'dead',
      idle: 'fight_idle',
      run: 'run',
    },
    name: 'Alice',
    position: new THREE.Vector3(-0.75, 0, 0),
    url: '/assets/models/alice/model.glb',
  },
  {
    clips: {
      attack: 'attack1',
      death: 'dead',
      idle: 'fight_idle',
      run: 'run',
    },
    name: 'Ruby',
    position: new THREE.Vector3(0.75, 0, 0),
    url: '/assets/models/ruby/model.glb',
  },
] as const

export const MAP_MODEL_URL = '/assets/models/map/model.glb'
export const MAP_WORLD_SIZE = 88
export const MAP_ROTATION_Y = Math.PI / 2
export const MAP_SURFACE_NAME_HINTS = [
  'dibiaobake',
  'plant',
  'zdgrass',
  'yewaidibiao',
  'hedao',
]
export const SKY_COLOR = 0xaedcff

export type HeroState = 'idle' | 'run' | 'attack' | 'death'

export type SceneStatus = {
  loaded: number
  mode: 'loading' | 'model' | 'placeholder'
  selectedHero: string
  selectedState: HeroState
  total: number
}

export type HeroAsset = (typeof HERO_ASSETS)[number]

export const ATTACK_RETURN_STATES = new Set<HeroState>(['idle', 'run'])
export const HERO_SPEED = MAP_WORLD_SIZE * 0.08
export const MAP_LIMIT = MAP_WORLD_SIZE * 0.48
export const ROTATION_SMOOTHING = 16
export const TARGET_EPSILON = 0.06

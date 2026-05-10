import * as THREE from 'three'

export const HERO_ASSETS = [
  {
    clips: {
      attack: 'attack1',
      death: 'dead',
      idle: 'fight_idle',
      run: 'run',
      skill1: 'skill1_1',
      skill2: 'skill2',
      skill3: 'skill3',
    },
    name: 'Alice',
    position: new THREE.Vector3(-1.35, 0, 29.8),
    url: '/assets/models/alice/model.glb',
  },
  {
    clips: {
      attack: 'attack1',
      death: 'dead',
      idle: 'fight_idle',
      run: 'run',
      skill1: 'skill1',
      skill2: 'skill2',
      skill3: 'skill3',
    },
    name: 'Ruby',
    position: new THREE.Vector3(1.35, 0, -29.8),
    url: '/assets/models/ruby/model.glb',
  },
  {
    clips: {
      attack: 'attack1',
      death: 'dead',
      idle: 'fight_idle',
      run: 'run',
      skill1: 'skill1',
      skill2: 'skill2',
      skill3: 'skill3',
    },
    name: 'Layla',
    position: new THREE.Vector3(-1.35, 0, 29.8),
    url: '/assets/models/layla/model.glb',
  },
] as const

export const MAP_WORLD_SIZE = 88
export const MAP_ROTATION_Y = Math.PI / 2
export const HERO_COLLIDER_HALF_SIZE = 0.1
export const WALL_COLLIDER_DEBUG_HEIGHT = 2
export const WALL_COLLIDER_INSET = 0.50
export const WALL_COLLIDER_NAME_HINTS = [
  // 'bluebuff',
  // 'dadunpai',
  'dalong', // turtle
  'jidiwaiqiang', // corner walls
  'jiqiwaiqiang', // box
  // 'outsidestone',
  // 'outside_leaf',
  // 'redbuff',
  // 'tree_01',
  // 'waiweiqiang',
  'xiaolong', // loard
  'xialu',
  'yequ',
]
export const WALL_COLLIDER_EXCLUDED_NAME_HINTS = ['floor', 'low_zdgrass', 'plant_01', 'redbuff', 'bluebuff']
export const MAP_SURFACE_NAME_HINTS = [
  'dibiaobake',
  'plant',
  'zdgrass',
  'yewaidibiao',
  'hedao',
]
export const SKY_COLOR = 0xaedcff

export type HeroState = 'idle' | 'run' | 'attack' | 'skill1' | 'skill2' | 'skill3' | 'death'
export type MatchResult = 'playing' | 'win' | 'lose'
export type MinimapMarkerKind = 'base' | 'hero' | 'minion' | 'tower'
export type MinimapTeam = 'blue' | 'red'

export type MinimapMarker = {
  alive: boolean
  id: string
  isPlayer?: boolean
  kind: MinimapMarkerKind
  team: MinimapTeam
  x: number
  y: number
}

export type SceneStatus = {
  enemyHp: number
  enemyLevel: number
  enemyKills: number
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
  matchSeconds: number
  matchResult: MatchResult
  minimap: {
    markers: MinimapMarker[]
  }
  mode: 'loading' | 'model' | 'placeholder'
  playerKills: number
  respawnSeconds: number
  selectedHp: number
  selectedHero: string
  selectedLevel: number
  selectedMaxHp: number
  selectedState: HeroState
  selectedXp: number
  selectedXpToNext: number
  skillCooldowns: Record<'skill1' | 'skill2' | 'skill3', number>
  total: number
}

export type HeroAsset = (typeof HERO_ASSETS)[number]

export const ATTACK_RETURN_STATES = new Set<HeroState>(['idle', 'run'])
export const ACTION_RETURN_STATES = new Set<HeroState>(['attack', 'skill1', 'skill2', 'skill3'])
export const HERO_MAX_HP = 1200
export const RESPAWN_DELAY = 6
export const RESPAWN_DELAY_PER_MINUTE = 2
export const RESPAWN_MAX_DELAY = 50
export const HERO_SPEED = MAP_WORLD_SIZE * 0.065
export const MAP_LIMIT = MAP_WORLD_SIZE * 0.48
export const ROTATION_SMOOTHING = 16
export const TARGET_EPSILON = 0.06

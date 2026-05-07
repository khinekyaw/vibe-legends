import * as THREE from 'three'
import type { HeroInstance } from '../entities/HeroModel'
import type { MinionInstance } from '../entities/MinionModel'
import type { ObjectiveDefinition } from '../map/ObjectiveStructures'
import type { HeroAsset } from './sceneConfig'

export type TeamSide = 'blue' | 'red'
export type HeroController = 'ai' | 'player'

export type MatchHeroSlot = {
  asset: HeroAsset
  controller: HeroController
  id: string
  spawnOffset: THREE.Vector2
  team: TeamSide
}

export type CombatTarget =
  | { kind: 'hero'; hero: HeroInstance }
  | { kind: 'minion'; minion: MinionInstance }
  | { kind: 'objective'; objective: ObjectiveDefinition }

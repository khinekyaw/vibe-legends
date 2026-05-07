import * as THREE from 'three'
import { HERO_MAX_HP, type SceneStatus } from '../core/sceneConfig'
import type { HeroInstance } from '../entities/HeroModel'
import type { MinionInstance } from '../entities/MinionModel'
import type { ObjectiveDefinition } from '../map/ObjectiveStructures'
import type { HeroCombatState } from '../systems/CombatSystem'

const worldPosition = new THREE.Vector3()
const screenPosition = new THREE.Vector3()

export type ObjectiveCombatState = {
  hp: number
  maxHp: number
  nextFireAt: number
}

export type MinionCombatState = {
  hp: number
  maxHp: number
}

export function projectWorldHealthBars(
  heroes: HeroInstance[],
  heroCombat: Map<HeroInstance, HeroCombatState>,
  selectedHeroIndex: number,
  camera: THREE.Camera,
  rendererWidth: number,
  rendererHeight: number,
): SceneStatus['healthBars'] {
  return heroes.filter(Boolean).map((hero, index) => {
    const combat = heroCombat.get(hero)
    worldPosition.copy(hero.anchor)
    worldPosition.y = 2.15
    screenPosition.copy(worldPosition).project(camera)

    return {
      hp: Math.round(combat?.hp ?? HERO_MAX_HP),
      id: `hero-${hero.name}-${index}`,
      isSelected: index === selectedHeroIndex,
      maxHp: combat?.maxHp ?? HERO_MAX_HP,
      name: hero.name,
      showName: true,
      visible: screenPosition.z >= -1 && screenPosition.z <= 1 && combat !== undefined,
      x: ((screenPosition.x + 1) / 2) * rendererWidth,
      y: ((-screenPosition.y + 1) / 2) * rendererHeight,
    }
  })
}

export function projectObjectiveHealthBars(
  objectives: ObjectiveDefinition[],
  objectiveCombat: Map<string, ObjectiveCombatState>,
  alliedTeam: ObjectiveDefinition['team'],
  camera: THREE.Camera,
  rendererWidth: number,
  rendererHeight: number,
): SceneStatus['healthBars'] {
  return objectives.map((objective) => {
    const combat = objectiveCombat.get(objective.id)
    worldPosition.copy(objective.position)
    worldPosition.y = objective.healthBarHeight
    screenPosition.copy(worldPosition).project(camera)

    return {
      hp: Math.round(combat?.hp ?? objective.maxHp),
      id: objective.id,
      isSelected: objective.team === alliedTeam,
      maxHp: combat?.maxHp ?? objective.maxHp,
      name: '',
      showName: false,
      visible: screenPosition.z >= -1 && screenPosition.z <= 1 && combat !== undefined,
      x: ((screenPosition.x + 1) / 2) * rendererWidth,
      y: ((-screenPosition.y + 1) / 2) * rendererHeight,
    }
  })
}

export function projectMinionHealthBars(
  minions: MinionInstance[],
  minionCombat: Map<MinionInstance, MinionCombatState>,
  alliedTeam: ObjectiveDefinition['team'],
  camera: THREE.Camera,
  rendererWidth: number,
  rendererHeight: number,
): SceneStatus['healthBars'] {
  return minions.map((minion) => {
    const combat = minionCombat.get(minion)
    worldPosition.copy(minion.anchor)
    worldPosition.y = 0.82
    screenPosition.copy(worldPosition).project(camera)

    return {
      hp: Math.round(combat?.hp ?? 0),
      id: minion.id,
      isSelected: minion.team === alliedTeam,
      maxHp: combat?.maxHp ?? 1,
      name: '',
      showName: false,
      visible: screenPosition.z >= -1 && screenPosition.z <= 1 && combat !== undefined && combat.hp > 0,
      x: ((screenPosition.x + 1) / 2) * rendererWidth,
      y: ((-screenPosition.y + 1) / 2) * rendererHeight,
    }
  })
}

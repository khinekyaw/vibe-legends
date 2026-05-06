import * as THREE from 'three'
import { HERO_MAX_HP, type SceneStatus } from '../core/sceneConfig'
import type { HeroInstance } from '../entities/HeroModel'
import type { ObjectiveDefinition } from '../map/ObjectiveStructures'
import type { HeroCombatState } from '../systems/CombatSystem'

const worldPosition = new THREE.Vector3()
const screenPosition = new THREE.Vector3()

export type ObjectiveCombatState = {
  hp: number
  maxHp: number
  nextFireAt: number
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
      isSelected: false,
      maxHp: combat?.maxHp ?? objective.maxHp,
      name: '',
      showName: false,
      visible: screenPosition.z >= -1 && screenPosition.z <= 1 && combat !== undefined,
      x: ((screenPosition.x + 1) / 2) * rendererWidth,
      y: ((-screenPosition.y + 1) / 2) * rendererHeight,
    }
  })
}

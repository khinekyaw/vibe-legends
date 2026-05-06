import * as THREE from 'three'
import { HERO_MAX_HP, type SceneStatus } from '../core/sceneConfig'
import type { HeroInstance } from '../entities/HeroModel'
import type { HeroCombatState } from '../systems/CombatSystem'

const worldPosition = new THREE.Vector3()
const screenPosition = new THREE.Vector3()

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
      isSelected: index === selectedHeroIndex,
      maxHp: combat?.maxHp ?? HERO_MAX_HP,
      name: hero.name,
      visible: screenPosition.z >= -1 && screenPosition.z <= 1 && combat !== undefined,
      x: ((screenPosition.x + 1) / 2) * rendererWidth,
      y: ((-screenPosition.y + 1) / 2) * rendererHeight,
    }
  })
}

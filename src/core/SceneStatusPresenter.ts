import * as THREE from 'three'
import type { HeroInstance } from '../entities/HeroModel'
import type { MinionInstance } from '../entities/MinionModel'
import type { MapBounds } from '../map/MapModel'
import { OBJECTIVE_LAYOUT } from '../map/ObjectiveStructures'
import type { HeroCombatState } from '../systems/CombatSystem'
import {
  projectMinionHealthBars,
  projectObjectiveHealthBars,
  projectWorldHealthBars,
  type MinionCombatState,
  type ObjectiveCombatState,
} from '../ui/WorldHealthBars'
import {
  HERO_MAX_HP,
  type MatchResult,
  type MinimapMarker,
  type SceneStatus,
} from './sceneConfig'
import type { MatchHeroSlot, TeamSide } from './matchTypes'

export type CreateSceneStatusOptions = {
  camera: THREE.Camera
  heroCombat: Map<HeroInstance, HeroCombatState>
  heroes: HeroInstance[]
  heroSlots: MatchHeroSlot[]
  kills: Record<TeamSide, number>
  loadedHeroes: number
  mapBounds: MapBounds
  matchResult: MatchResult
  matchSeconds: number
  minionCombat: Map<MinionInstance, MinionCombatState>
  minions: MinionInstance[]
  mode: SceneStatus['mode']
  nowSeconds: number
  objectiveCombat: Map<string, ObjectiveCombatState>
  playerHeroIndex: number
  rendererHeight: number
  rendererWidth: number
}

export function createSceneStatus({
  camera,
  heroCombat,
  heroes,
  heroSlots,
  kills,
  loadedHeroes,
  mapBounds,
  matchResult,
  matchSeconds,
  minionCombat,
  minions,
  mode,
  nowSeconds,
  objectiveCombat,
  playerHeroIndex,
  rendererHeight,
  rendererWidth,
}: CreateSceneStatusOptions): SceneStatus {
  const playerTeam = getHeroTeam(heroSlots, playerHeroIndex)
  const selectedHero = heroes[playerHeroIndex]
  const enemyHero = selectedHero
    ? getClosestEnemyHero(heroes, heroCombat, heroSlots, selectedHero.anchor, playerTeam)
    : undefined
  const selectedCombat = selectedHero ? heroCombat.get(selectedHero) : undefined
  const enemyCombat = enemyHero ? heroCombat.get(enemyHero) : undefined
  const respawnSeconds = Math.max(0, (selectedCombat?.respawnAt ?? 0) - nowSeconds)

  return {
    enemyHp: Math.round(enemyCombat?.hp ?? HERO_MAX_HP),
    enemyKills: kills.red,
    enemyMaxHp: enemyCombat?.maxHp ?? HERO_MAX_HP,
    healthBars: projectWorldHealthBars(
      heroes,
      heroCombat,
      playerHeroIndex,
      camera,
      rendererWidth,
      rendererHeight,
      heroSlots.map((slot) => slot.id),
      getAlliedHeroIndexes(heroSlots, playerTeam),
    ).concat(
      projectMinionHealthBars(
        minions,
        minionCombat,
        playerTeam,
        camera,
        rendererWidth,
        rendererHeight,
      ),
      projectObjectiveHealthBars(
        OBJECTIVE_LAYOUT,
        objectiveCombat,
        playerTeam,
        camera,
        rendererWidth,
        rendererHeight,
      ),
    ),
    loaded: loadedHeroes,
    matchSeconds,
    matchResult,
    minimap: {
      markers: createMinimapMarkers({
        heroCombat,
        heroes,
        heroSlots,
        mapBounds,
        minionCombat,
        minions,
        objectiveCombat,
        playerHeroIndex,
      }),
    },
    mode,
    playerKills: kills.blue,
    respawnSeconds,
    selectedHp: Math.round(selectedCombat?.hp ?? HERO_MAX_HP),
    selectedHero: selectedHero?.name ?? heroSlots[playerHeroIndex]?.asset.name ?? 'Alice',
    selectedMaxHp: selectedCombat?.maxHp ?? HERO_MAX_HP,
    selectedState: selectedHero?.currentState ?? 'idle',
    skillCooldowns: {
      skill1: Math.max(0, (selectedCombat?.cooldowns.skill1 ?? 0) - nowSeconds),
      skill2: Math.max(0, (selectedCombat?.cooldowns.skill2 ?? 0) - nowSeconds),
      skill3: Math.max(0, (selectedCombat?.cooldowns.skill3 ?? 0) - nowSeconds),
    },
    total: heroSlots.length,
  }
}

type CreateMinimapMarkersOptions = {
  heroCombat: Map<HeroInstance, HeroCombatState>
  heroes: HeroInstance[]
  heroSlots: MatchHeroSlot[]
  mapBounds: MapBounds
  minionCombat: Map<MinionInstance, MinionCombatState>
  minions: MinionInstance[]
  objectiveCombat: Map<string, ObjectiveCombatState>
  playerHeroIndex: number
}

function createMinimapMarkers({
  heroCombat,
  heroes,
  heroSlots,
  mapBounds,
  minionCombat,
  minions,
  objectiveCombat,
  playerHeroIndex,
}: CreateMinimapMarkersOptions): MinimapMarker[] {
  const heroMarkers = heroes.filter(Boolean).map((hero, index) => {
    const combat = heroCombat.get(hero)
    const team = getHeroTeam(heroSlots, index)
    const position = projectMinimapPosition(hero.anchor, mapBounds)

    return {
      alive: (combat?.hp ?? 0) > 0,
      id: heroSlots[index]?.id ?? `hero-${hero.name}-${index}`,
      isPlayer: index === playerHeroIndex,
      kind: 'hero' as const,
      team,
      x: position.x,
      y: position.y,
    }
  })

  const objectiveMarkers = OBJECTIVE_LAYOUT.map((objective) => {
    const combat = objectiveCombat.get(objective.id)
    const position = projectMinimapPosition(objective.position, mapBounds)

    return {
      alive: (combat?.hp ?? 0) > 0,
      id: objective.id,
      kind: objective.kind,
      team: objective.team,
      x: position.x,
      y: position.y,
    }
  })

  const minionMarkers = minions.map((minion) => {
    const combat = minionCombat.get(minion)
    const position = projectMinimapPosition(minion.anchor, mapBounds)

    return {
      alive: (combat?.hp ?? 0) > 0,
      id: minion.id,
      kind: 'minion' as const,
      team: minion.team,
      x: position.x,
      y: position.y,
    }
  })

  return [...objectiveMarkers, ...minionMarkers, ...heroMarkers]
}

function getAlliedHeroIndexes(heroSlots: MatchHeroSlot[], playerTeam: TeamSide) {
  return new Set(
    heroSlots.flatMap((slot, index) => (
      slot.team === playerTeam ? [index] : []
    )),
  )
}

function getClosestEnemyHero(
  heroes: HeroInstance[],
  heroCombat: Map<HeroInstance, HeroCombatState>,
  heroSlots: MatchHeroSlot[],
  position: THREE.Vector3,
  team: TeamSide,
) {
  let closestDistance = Number.POSITIVE_INFINITY
  let closestHero: HeroInstance | undefined

  heroes.forEach((hero, index) => {
    const combat = heroCombat.get(hero)

    if (!hero || !combat || combat.hp <= 0 || getHeroTeam(heroSlots, index) === team) {
      return
    }

    const distance = hero.anchor.distanceTo(position)

    if (distance < closestDistance) {
      closestDistance = distance
      closestHero = hero
    }
  })

  return closestHero
}

function getHeroTeam(heroSlots: MatchHeroSlot[], index: number): TeamSide {
  return heroSlots[index]?.team ?? 'red'
}

function projectMinimapPosition(position: THREE.Vector3, mapBounds: MapBounds) {
  const width = mapBounds.maxX - mapBounds.minX
  const depth = mapBounds.maxZ - mapBounds.minZ
  const x = width > 0 ? ((position.x - mapBounds.minX) / width) * 100 : 50
  const y = depth > 0 ? ((position.z - mapBounds.minZ) / depth) * 100 : 50

  return {
    x: THREE.MathUtils.clamp(x, 0, 100),
    y: THREE.MathUtils.clamp(y, 0, 100),
  }
}

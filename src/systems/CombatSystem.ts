import * as THREE from 'three'
import type { HeroState } from '../core/sceneConfig'
import type { HeroInstance } from '../entities/HeroModel'

export type SkillSlot = 'skill1' | 'skill2' | 'skill3'

export type HeroCombatState = {
  actionLockedUntil: number
  baseMaxHp: number
  cooldowns: Record<SkillSlot, number>
  hp: number
  immobilizedUntil: number
  lastPulseAt: number
  level: number
  maxHp: number
  nextBasicAttackAt: number
  respawnAt: number
  skillWindow: ActiveSkillWindow | null
  slowUntil: number
  stunnedUntil: number
  xp: number
  xpToNext: number
}

export type ActiveSkillWindow = {
  endsAt: number
  pulseEvery: number
  slot: SkillSlot
}

export type SkillDefinition = {
  animationState: HeroState
  castLockSeconds: number
  cooldown: number
  name: string
  slot: SkillSlot
}

export type HeroKit = {
  attack: {
    castLockSeconds: number
    damage: number
    interval: number
    range: number
  }
  skills: Record<SkillSlot, SkillDefinition>
}

export const HERO_KITS: Record<string, HeroKit> = {
  Alice: {
    attack: {
      castLockSeconds: 0.22,
      damage: 65,
      interval: 1,
      range: 4.2,
    },
    skills: {
      skill1: {
        animationState: 'skill1',
        castLockSeconds: 0.32,
        cooldown: 8,
        name: 'Crimson Gleam',
        slot: 'skill1',
      },
      skill2: {
        animationState: 'skill2',
        castLockSeconds: 0.36,
        cooldown: 4,
        name: 'Doom Waltz',
        slot: 'skill2',
      },
      skill3: {
        animationState: 'skill3',
        castLockSeconds: 0.5,
        cooldown: 50,
        name: 'Throne of Ruin',
        slot: 'skill3',
      },
    },
  },
  Ruby: {
    attack: {
      castLockSeconds: 0.18,
      damage: 80,
      interval: 0.7,
      range: 1.65,
    },
    skills: {
      skill1: {
        animationState: 'skill1',
        castLockSeconds: 0.3,
        cooldown: 4,
        name: 'Be Good!',
        slot: 'skill1',
      },
      skill2: {
        animationState: 'skill2',
        castLockSeconds: 0.34,
        cooldown: 7,
        name: "Don't Run, Wolf King!",
        slot: 'skill2',
      },
      skill3: {
        animationState: 'skill3',
        castLockSeconds: 0.46,
        cooldown: 20,
        name: "I'm Offended!",
        slot: 'skill3',
      },
    },
  },
  Layla: {
    attack: {
      castLockSeconds: 0.2,
      damage: 72,
      interval: 0.85,
      range: 5.2,
    },
    skills: {
      skill1: {
        animationState: 'skill1',
        castLockSeconds: 0.3,
        cooldown: 5,
        name: 'Malefic Bomb',
        slot: 'skill1',
      },
      skill2: {
        animationState: 'skill2',
        castLockSeconds: 0.34,
        cooldown: 7,
        name: 'Void Projectile',
        slot: 'skill2',
      },
      skill3: {
        animationState: 'skill3',
        castLockSeconds: 0.5,
        cooldown: 28,
        name: 'Destruction Rush',
        slot: 'skill3',
      },
    },
  },
}

export const HERO_MAX_LEVEL = 15
export const HERO_DAMAGE_GROWTH_PER_LEVEL = 0.095
export const HERO_HP_GROWTH_PER_LEVEL = 0.075

export function createHeroCombatState(maxHp: number): HeroCombatState {
  return {
    actionLockedUntil: 0,
    baseMaxHp: maxHp,
    cooldowns: {
      skill1: 0,
      skill2: 0,
      skill3: 0,
    },
    hp: maxHp,
    immobilizedUntil: 0,
    lastPulseAt: 0,
    level: 1,
    maxHp,
    nextBasicAttackAt: 0,
    respawnAt: 0,
    skillWindow: null,
    slowUntil: 0,
    stunnedUntil: 0,
    xp: 0,
    xpToNext: getHeroXpToNextLevel(1),
  }
}

export function grantHeroXp(state: HeroCombatState, amount: number) {
  if (state.level >= HERO_MAX_LEVEL || amount <= 0) {
    return 0
  }

  let levelsGained = 0
  state.xp += amount

  while (state.level < HERO_MAX_LEVEL && state.xp >= state.xpToNext) {
    state.xp -= state.xpToNext
    state.level += 1
    levelsGained += 1

    const previousMaxHp = state.maxHp
    state.maxHp = getHeroMaxHpForLevel(state.baseMaxHp, state.level)
    state.hp += state.maxHp - previousMaxHp
    state.xpToNext = getHeroXpToNextLevel(state.level)
  }

  if (state.level >= HERO_MAX_LEVEL) {
    state.xp = 0
    state.xpToNext = 0
  }

  return levelsGained
}

export function getHeroDamageForLevel(baseDamage: number, level: number) {
  return Math.round(baseDamage * (1 + (level - 1) * HERO_DAMAGE_GROWTH_PER_LEVEL))
}

export function getHeroMaxHpForLevel(baseMaxHp: number, level: number) {
  return Math.round(baseMaxHp * (1 + (level - 1) * HERO_HP_GROWTH_PER_LEVEL))
}

export function getHeroXpToNextLevel(level: number) {
  return level >= HERO_MAX_LEVEL ? 0 : 100 + level * 45
}

export function getHeroForward(hero: HeroInstance) {
  return new THREE.Vector3(Math.sin(hero.facingAngle), 0, Math.cos(hero.facingAngle))
}

export function isInForwardBox(
  attacker: HeroInstance,
  target: HeroInstance,
  range: number,
  width: number,
) {
  const forward = getHeroForward(attacker)
  const offset = target.anchor.clone().sub(attacker.anchor)
  offset.y = 0

  const forwardDistance = offset.dot(forward)

  if (forwardDistance < 0 || forwardDistance > range) {
    return false
  }

  const sideDistance = offset.sub(forward.multiplyScalar(forwardDistance)).length()
  return sideDistance <= width / 2
}

export function isInRadius(attacker: HeroInstance, target: HeroInstance, radius: number) {
  return attacker.anchor.distanceTo(target.anchor) <= radius
}

export function applyDamage(state: HeroCombatState, amount: number) {
  state.hp = Math.max(0, state.hp - amount)
  return state.hp <= 0
}

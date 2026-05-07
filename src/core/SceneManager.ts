import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  createHeroFromModel,
  createPlaceholderHero,
  playHeroState as playHeroAnimationState,
  type HeroInstance,
} from '../entities/HeroModel'
import {
  createMinionFromModel,
  createPlaceholderMinion,
  playMinionState,
  type MinionInstance,
} from '../entities/MinionModel'
import type { MapBounds } from '../map/MapModel'
import {
  createObjectiveColliders,
  createObjectiveStructures,
  type ObjectiveDefinition,
  OBJECTIVE_LAYOUT,
} from '../map/ObjectiveStructures'
import {
  BRAWL_MAP_BOUNDS,
  createSimpleBrawlColliders,
  createSimpleBrawlMap,
} from '../map/SimpleBrawlMap'
import {
  resolveAabbCollisions,
  type WorldCollider,
} from '../systems/CollisionSystem'
import { InputManager } from './InputManager'
import {
  ATTACK_RETURN_STATES,
  HERO_ASSETS,
  HERO_COLLIDER_HALF_SIZE,
  HERO_MAX_HP,
  HERO_SPEED,
  MAP_WORLD_SIZE,
  RESPAWN_DELAY,
  RESPAWN_DELAY_PER_MINUTE,
  RESPAWN_MAX_DELAY,
  ROTATION_SMOOTHING,
  SKY_COLOR,
  TARGET_EPSILON,
  type HeroState,
  type MatchResult,
  type SceneStatus,
} from './sceneConfig'
import { createMatchHeroSlots } from './matchRoster'
import { createSceneStatus } from './SceneStatusPresenter'
import { dampAngle } from './sceneMath'
import type { CombatTarget, MatchHeroSlot, TeamSide } from './matchTypes'
import { loadObjectiveModels } from './ObjectiveModelLoader'
import {
  applyDamage,
  createHeroCombatState,
  getHeroForward,
  getHeroDamageForLevel,
  grantHeroXp,
  HERO_KITS,
  isInForwardBox,
  isInRadius,
  type HeroCombatState,
  type SkillSlot,
} from '../systems/CombatSystem'
import { CombatEffects } from '../systems/CombatEffects'
import type { MinionCombatState, ObjectiveCombatState } from '../ui/WorldHealthBars'

const HERO_AI_AGGRO_RANGE = 8.5
const HERO_KILL_XP_REWARD = 220
const MINION_AGGRO_RANGE = 6
const MINION_ATTACK_DAMAGE = 34
const MINION_ATTACK_LOCK_SECONDS = 0.52
const MINION_ATTACK_RANGE = 1.55
const MINION_ATTACK_SECONDS = 1.15
const MINION_COLLIDER_HALF_SIZE = HERO_COLLIDER_HALF_SIZE * 0.5
const MINION_MAX_HP = 420
const MINION_MODEL_URL = '/assets/models/minion/model.glb'
const MINION_REMOVE_DELAY = 2.2
const MINION_SPEED = MAP_WORLD_SIZE * 0.028
const MINION_XP_REWARD = 50
const MINION_WAVE_INTERVAL = 18
const MINION_WAVE_X_OFFSETS = [-1.15, 0, 1.15]
const OBJECTIVE_AVOIDANCE_LOOKAHEAD = 3.2
const OBJECTIVE_AVOIDANCE_PADDING = 0.72

export class SceneManager {
  private readonly camera: THREE.PerspectiveCamera
  private readonly cameraDesiredTarget = new THREE.Vector3()
  private readonly cameraOffset = new THREE.Vector3(
    MAP_WORLD_SIZE * 0.22,
    MAP_WORLD_SIZE * 0.27,
    MAP_WORLD_SIZE * 0.24,
  )
  private readonly characterGroup = new THREE.Group()
  private readonly clock = new THREE.Clock()
  private readonly controlsTarget = new THREE.Vector3(0, 0.8, 0)
  private readonly environmentGroup = new THREE.Group()
  private readonly brawlMap = createSimpleBrawlMap()
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private readonly heroBounds = new THREE.Box3()
  private readonly heroCombat = new Map<HeroInstance, HeroCombatState>()
  private readonly heroes: HeroInstance[] = []
  private readonly minionBounds = new THREE.Box3()
  private readonly minionCombat = new Map<MinionInstance, MinionCombatState>()
  private readonly minions: MinionInstance[] = []
  private readonly objectiveCombat = new Map<string, ObjectiveCombatState>(
    OBJECTIVE_LAYOUT.map((objective) => [
      objective.id,
      {
        hp: objective.maxHp,
        maxHp: objective.maxHp,
        nextFireAt: 0,
      },
    ]),
  )
  private readonly combatEffects = new CombatEffects()
  private rendererHeight = 1
  private rendererWidth = 1
  private mapBounds: MapBounds = BRAWL_MAP_BOUNDS
  private readonly objectiveColliders = createObjectiveColliders()
  private readonly objectiveStructures = createObjectiveStructures()
  private readonly wallColliders: WorldCollider[] = []
  private aliceBloodOrb: { createdAt: number; hero: HeroInstance; position: THREE.Vector3 } | null = null
  private readonly pointer = new THREE.Vector2()
  private readonly raycaster = new THREE.Raycaster()
  private readonly loader = new GLTFLoader()
  private minionAnimations: THREE.AnimationClip[] = []
  private minionModelReady = false
  private minionModelSource: THREE.Object3D | null = null
  private minionSequence = 0
  private nextMinionWaveAt = Number.POSITIVE_INFINITY
  private readonly objectiveModelSources = new Map<string, THREE.Object3D>()
  private inputManager: InputManager | null = null
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private animationFrame = 0
  private loadedHeroes = 0
  private matchStartedAt = 0
  private readonly heroSlots: MatchHeroSlot[]
  private matchResult: MatchResult = 'playing'
  private readonly onStatusChange: (status: SceneStatus) => void
  private readonly playerHeroIndex = 0
  private readonly kills: Record<TeamSide, number> = {
    blue: 0,
    red: 0,
  }

  constructor(
    canvas: HTMLCanvasElement,
    onStatusChange: (status: SceneStatus) => void,
    playerHeroName = 'Alice',
  ) {
    this.onStatusChange = onStatusChange
    this.heroSlots = createMatchHeroSlots(playerHeroName)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas,
      powerPreference: 'high-performance',
    })
    this.renderer.setClearColor(SKY_COLOR)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true

    this.camera = new THREE.PerspectiveCamera(15, 1, 0.1, MAP_WORLD_SIZE * 4)
    this.camera.position.copy(this.cameraOffset)
    this.camera.lookAt(this.controlsTarget)

    this.setupScene()
  }

  start() {
    this.matchStartedAt = performance.now() / 1000
    this.inputManager = new InputManager(this.renderer.domElement)
    window.addEventListener('skill-command', this.handleSkillCommand)
    this.emitStatus('loading')
    this.loadBrawlMap()
    loadObjectiveModels(this.loader, this.objectiveModelSources, this.objectiveStructures)
    this.loadMinionModel()
    this.heroSlots.forEach((slot, index) => this.loadHeroModel(slot, index))
    this.animate()
  }

  dispose() {
    cancelAnimationFrame(this.animationFrame)
    this.inputManager?.dispose()
    window.removeEventListener('skill-command', this.handleSkillCommand)
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((material) => material.dispose())
      }
    })
    this.renderer.dispose()
  }

  resize(width: number, height: number) {
    const safeHeight = Math.max(height, 1)
    this.camera.aspect = width / safeHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, safeHeight, false)
    this.rendererWidth = width
    this.rendererHeight = safeHeight
  }

  private setupScene() {
    this.scene.fog = new THREE.Fog(SKY_COLOR, MAP_WORLD_SIZE * 0.85, MAP_WORLD_SIZE * 2.1)
    this.environmentGroup.name = 'environment'
    this.characterGroup.name = 'characters'
    this.scene.add(this.environmentGroup, this.characterGroup, this.combatEffects.group)

    const ambientLight = new THREE.AmbientLight(0xc7d2fe, 1.7)
    this.scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, 3)
    keyLight.position.set(4, 7, 5)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    this.scene.add(keyLight)

    const rimLight = new THREE.DirectionalLight(0x45d4ff, 1.2)
    rimLight.position.set(-4, 3, -2)
    this.scene.add(rimLight)

    this.environmentGroup.add(this.brawlMap, this.objectiveStructures)
  }

  private loadBrawlMap() {
    this.mapBounds = BRAWL_MAP_BOUNDS
    this.wallColliders.splice(
      0,
      this.wallColliders.length,
      ...createSimpleBrawlColliders(),
      ...this.objectiveColliders,
    )
  }

  private loadMinionModel() {
    this.loader.load(
      MINION_MODEL_URL,
      (gltf) => {
        this.minionModelSource = gltf.scene
        this.minionAnimations = gltf.animations
        this.minionModelReady = true
        this.nextMinionWaveAt = performance.now() / 1000
      },
      undefined,
      () => {
        this.minionModelReady = true
        this.nextMinionWaveAt = performance.now() / 1000
      },
    )
  }

  private loadHeroModel(slot: MatchHeroSlot, index: number) {
    const { asset } = slot

    this.loader.load(
      asset.url,
      (gltf) => {
        const heroInstance = createHeroFromModel(asset, gltf.scene, gltf.animations, (hero) => {
          this.playHeroState(hero, this.getMovementState(hero))
        })
        heroInstance.group.userData.participantId = slot.id
        heroInstance.group.userData.controller = slot.controller
        heroInstance.group.userData.team = slot.team
        this.characterGroup.add(heroInstance.group)
        this.heroes[index] = heroInstance
        this.heroCombat.set(heroInstance, createHeroCombatState(HERO_MAX_HP))
        this.placeHeroAtSpawn(heroInstance, index)
        this.playHeroState(heroInstance, 'idle', 0)
        this.loadedHeroes += 1
        this.emitStatus('model')
      },
      undefined,
      () => {
        const hero = createPlaceholderHero(asset)
        hero.group.userData.participantId = slot.id
        hero.group.userData.controller = slot.controller
        hero.group.userData.team = slot.team
        this.characterGroup.add(hero.group)
        this.heroes[index] = hero
        this.heroCombat.set(hero, createHeroCombatState(HERO_MAX_HP))
        this.placeHeroAtSpawn(hero, index)
        this.loadedHeroes += 1
        this.emitStatus('placeholder')
      },
    )
  }

  private playHeroState(hero: HeroInstance, state: HeroState, fadeDuration = 0.18) {
    if (playHeroAnimationState(hero, state, fadeDuration)) {
      this.emitStatus('model')
    }
  }

  private animate = () => {
    const delta = this.clock.getDelta()
    this.updateCombatTimers()
    this.updateMinionWaves()
    this.updateObjectiveAttacks()
    this.updateMinions(delta)
    this.updateAiHeroes(delta)
    this.updateControlledHero(delta)
    this.updateActiveSkills()
    this.heroes.forEach((hero) => {
      hero.mixer?.update(delta)
      this.pinHeroToAnchor(hero)
    })
    this.minions.forEach((minion) => {
      minion.mixer?.update(delta)
      this.pinMinionToAnchor(minion)
    })
    this.updateCamera(delta)
    this.emitStatus('model')

    this.renderer.render(this.scene, this.camera)
    this.animationFrame = requestAnimationFrame(this.animate)
  }

  private pinHeroToAnchor(hero: HeroInstance) {
    this.heroBounds.setFromObject(hero.group)
    hero.group.position.x = hero.anchor.x
    hero.group.position.y -= this.heroBounds.min.y
    hero.group.position.z = hero.anchor.z
  }

  private pinMinionToAnchor(minion: MinionInstance) {
    this.minionBounds.setFromObject(minion.group)
    minion.group.position.x = minion.anchor.x
    minion.group.position.y -= this.minionBounds.min.y
    minion.group.position.z = minion.anchor.z
  }

  private updateMinionWaves() {
    if (!this.minionModelReady || this.matchResult !== 'playing') {
      return
    }

    const now = performance.now() / 1000

    if (now < this.nextMinionWaveAt) {
      return
    }

    this.spawnMinionWave('blue')
    this.spawnMinionWave('red')
    this.nextMinionWaveAt = now + MINION_WAVE_INTERVAL
  }

  private spawnMinionWave(team: TeamSide) {
    const base = this.getTeamBase(team)
    const baseCombat = base ? this.objectiveCombat.get(base.id) : undefined

    if (!base || !baseCombat || baseCombat.hp <= 0) {
      return
    }

    const laneDirection = this.getLaneDirection(team)

    MINION_WAVE_X_OFFSETS.forEach((xOffset) => {
      const position = base.position.clone()
      position.x += xOffset
      position.z += laneDirection * 4.2
      position.y = 0

      const minion = this.createMinion(team, position)
      this.minions.push(minion)
      this.minionCombat.set(minion, {
        hp: MINION_MAX_HP,
        maxHp: MINION_MAX_HP,
      })
      this.characterGroup.add(minion.group)
    })
  }

  private createMinion(team: TeamSide, position: THREE.Vector3) {
    const id = `${team}-minion-${this.minionSequence += 1}`

    if (this.minionModelSource) {
      return createMinionFromModel(
        id,
        team,
        this.minionModelSource,
        this.minionAnimations,
        position,
      )
    }

    return createPlaceholderMinion(id, team, position)
  }

  private updateMinions(delta: number) {
    if (this.matchResult !== 'playing') {
      return
    }

    const now = performance.now() / 1000

    this.minions.forEach((minion) => {
      const combat = this.minionCombat.get(minion)

      if (!combat || combat.hp <= 0) {
        return
      }

      if (now < minion.actionLockedUntil) {
        return
      }

      const target = this.getMinionAiTarget(minion)

      if (!target) {
        this.moveMinion(minion, this.getLaneDirectionVector(minion.team), delta)
        return
      }

      const targetPosition = this.getCombatTargetPosition(target)
      const targetRadius = this.getCombatTargetRadius(target)
      const distance = minion.anchor.distanceTo(targetPosition)

      if (distance <= MINION_ATTACK_RANGE + targetRadius) {
        if (minion.nextAttackAt <= now) {
          this.castMinionAttack(minion, target, now)
        } else {
          this.faceMinionTarget(minion, targetPosition)
          playMinionState(minion, 'idle')
        }

        return
      }

      const direction = targetPosition.clone().sub(minion.anchor)
      direction.y = 0

      if (direction.lengthSq() === 0) {
        playMinionState(minion, 'idle')
        return
      }

      this.moveMinion(minion, direction.normalize(), delta)
    })
  }

  private updateAiHeroes(delta: number) {
    if (this.matchResult !== 'playing') {
      return
    }

    this.heroes.forEach((hero, index) => {
      const slot = this.heroSlots[index]

      if (!hero || slot?.controller !== 'ai') {
        return
      }

      this.updateAiHero(hero, index, delta)
    })
  }

  private updateAiHero(hero: HeroInstance, index: number, delta: number) {
    const combat = this.heroCombat.get(hero)

    if (!combat || combat.hp <= 0) {
      return
    }

    const now = performance.now() / 1000

    if (combat.stunnedUntil > now || combat.immobilizedUntil > now) {
      hero.moveTarget = null
      this.playHeroState(hero, 'idle')
      return
    }

    const team = this.getHeroTeam(index)
    const kit = HERO_KITS[hero.name]
    const target = this.getHeroAiTarget(hero, team)

    if (!target) {
      this.moveHero(
        hero,
        this.steerAroundObjectives(hero.anchor, this.getLaneDirectionVector(team), team),
        delta,
        combat.slowUntil > now ? 0.45 : 0.62,
      )
      return
    }

    const targetPosition = this.getCombatTargetPosition(target)
    const targetRadius = this.getCombatTargetRadius(target)
    const distance = hero.anchor.distanceTo(targetPosition)

    if (distance <= kit.attack.range + targetRadius) {
      hero.moveTarget = null

      if (this.castBasicAttack(hero)) {
        return
      }
    }

    const direction = targetPosition.clone().sub(hero.anchor)
    direction.y = 0

    if (direction.lengthSq() === 0) {
      this.playHeroState(hero, 'idle')
      return
    }

    hero.moveTarget = null
    this.moveHero(
      hero,
      this.steerAroundObjectives(hero.anchor, direction.normalize(), team),
      delta,
      combat.slowUntil > now ? 0.55 : 0.72,
    )
  }

  private updateCamera(delta: number) {
    const selectedHero = this.heroes[this.playerHeroIndex]

    if (selectedHero) {
      this.cameraDesiredTarget.copy(selectedHero.anchor)
    } else {
      this.cameraDesiredTarget.set(0, 0, 0)
    }

    this.cameraDesiredTarget.y = 0.75
    this.controlsTarget.lerp(this.cameraDesiredTarget, 1 - Math.exp(-6 * delta))
    this.camera.position.copy(this.controlsTarget).add(this.cameraOffset)
    this.camera.lookAt(this.controlsTarget)
  }

  private updateControlledHero(delta: number) {
    const hero = this.heroes[this.playerHeroIndex]
    const combat = hero ? this.heroCombat.get(hero) : null

    if (!hero || !combat || hero.currentState === 'death' || this.matchResult !== 'playing') {
      return
    }

    const now = performance.now() / 1000

    if (combat.stunnedUntil > now || combat.immobilizedUntil > now) {
      hero.moveTarget = null

      if (hero.currentState === 'run') {
        this.playHeroState(hero, 'idle')
      }

      return
    }

    const skillCommand = this.inputManager?.consumeSkillCommand()

    if (skillCommand && this.castSkill(hero, skillCommand)) {
      return
    }

    if (this.inputManager?.getAttackCommand()) {
      hero.moveTarget = null

      if (!ATTACK_RETURN_STATES.has(hero.currentState)) {
        return
      }

      if (this.castBasicAttack(hero)) {
        return
      }

      this.showBasicAttackRange(hero)
    }

    this.updatePointerTarget(hero)
    const inputVector = this.inputManager?.getMovementVector() ?? new THREE.Vector2()
    const keyboardDirection = new THREE.Vector3(inputVector.x, 0, -inputVector.y)

    if (keyboardDirection.lengthSq() > 0) {
      keyboardDirection.normalize()
      hero.moveTarget = null
      this.moveHero(hero, keyboardDirection, delta, combat.slowUntil > now ? 0.55 : 1)
      return
    }

    if (hero.moveTarget) {
      const targetDirection = hero.moveTarget.clone().sub(hero.anchor)
      targetDirection.y = 0

      if (targetDirection.length() <= TARGET_EPSILON) {
        hero.moveTarget = null
        this.playHeroState(hero, 'idle')
        return
      }

      targetDirection.normalize()
      this.moveHero(hero, targetDirection, delta, combat.slowUntil > now ? 0.55 : 1)
      return
    }

    if (hero.currentState === 'run') {
      this.playHeroState(hero, 'idle')
    }
  }

  private updatePointerTarget(hero: HeroInstance) {
    const pointerCommand = this.inputManager?.consumePointerCommand()

    if (!pointerCommand) {
      return
    }

    this.pointer.set(pointerCommand.x, pointerCommand.y)
    this.raycaster.setFromCamera(this.pointer, this.camera)

    const target = new THREE.Vector3()
    if (this.raycaster.ray.intersectPlane(this.groundPlane, target)) {
      this.clampToMapBounds(target)
      target.y = 0
      hero.moveTarget = target
    }
  }

  private moveHero(
    hero: HeroInstance,
    direction: THREE.Vector3,
    delta: number,
    speedMultiplier = 1,
  ) {
    if (!ATTACK_RETURN_STATES.has(hero.currentState)) {
      return
    }

    hero.anchor.addScaledVector(direction, HERO_SPEED * speedMultiplier * delta)
    const collision = resolveAabbCollisions(
      hero.anchor,
      HERO_COLLIDER_HALF_SIZE,
      this.wallColliders,
    )
    this.clampToMapBounds(hero.anchor)
    const targetAngle = Math.atan2(direction.x, direction.z)
    hero.facingAngle = dampAngle(
      hero.facingAngle,
      targetAngle,
      ROTATION_SMOOTHING,
      delta,
    )
    hero.group.rotation.y = hero.facingAngle
    this.playHeroState(hero, collision.collided && !hero.moveTarget ? 'idle' : 'run')
  }

  private moveMinion(
    minion: MinionInstance,
    direction: THREE.Vector3,
    delta: number,
  ) {
    if (minion.currentState === 'death') {
      return
    }

    const steeredDirection = this.steerAroundObjectives(minion.anchor, direction, minion.team)

    minion.anchor.addScaledVector(steeredDirection, MINION_SPEED * delta)
    resolveAabbCollisions(minion.anchor, MINION_COLLIDER_HALF_SIZE, this.wallColliders)
    this.clampToMapBounds(minion.anchor)
    minion.facingAngle = Math.atan2(steeredDirection.x, steeredDirection.z)
    minion.group.rotation.y = minion.facingAngle
    playMinionState(minion, 'run')
  }

  private castBasicAttack(hero: HeroInstance) {
    if (!ATTACK_RETURN_STATES.has(hero.currentState) || this.matchResult !== 'playing') {
      return false
    }

    const kit = HERO_KITS[hero.name]
    const heroTeam = this.getHeroTeamForHero(hero)
    const enemyHero = this.getEnemyHero(hero)
    const heroTarget =
      enemyHero && hero.anchor.distanceTo(enemyHero.anchor) <= kit.attack.range + this.getCombatTargetRadius({ kind: 'hero', hero: enemyHero })
        ? enemyHero
        : null
    const minionTarget = heroTarget
      ? null
      : this.getClosestEnemyMinion(hero.anchor, heroTeam, kit.attack.range + 0.2)
    const objectiveTarget = heroTarget || minionTarget
      ? null
      : this.getAttackableEnemyObjective(hero, kit.attack.range)
    const targetPosition = heroTarget?.anchor ?? minionTarget?.anchor ?? objectiveTarget?.position

    if (!targetPosition) {
      return false
    }

    this.faceTarget(hero, targetPosition)
    this.playHeroState(hero, 'attack')

    if (heroTarget) {
      this.createHeroBasicAttackEffect(hero, heroTarget.anchor)
      this.damageHeroFromHero(hero, heroTarget, kit.attack.damage)
      return true
    }

    if (minionTarget) {
      this.createHeroBasicAttackEffect(hero, minionTarget.anchor)
      this.damageMinionFromHero(hero, minionTarget, kit.attack.damage)
      return true
    }

    if (objectiveTarget) {
      const targetPoint = objectiveTarget.position.clone()
      targetPoint.y = 1.9
      this.createHeroBasicAttackEffect(hero, targetPoint)

      this.damageObjectiveFromHero(hero, objectiveTarget, kit.attack.damage)
      return true
    }

    return false
  }

  private castMinionAttack(minion: MinionInstance, target: CombatTarget, now: number) {
    if (minion.nextAttackAt > now || minion.currentState === 'death') {
      return
    }

    const targetPosition = this.getCombatTargetPosition(target)
    this.faceMinionTarget(minion, targetPosition)
    playMinionState(minion, 'attack')
    minion.actionLockedUntil = now + MINION_ATTACK_LOCK_SECONDS
    minion.nextAttackAt = now + MINION_ATTACK_SECONDS

    const impact = targetPosition.clone()
    impact.y = target.kind === 'objective' ? 1.35 : 0.85
    this.combatEffects.createProjectile(
      minion.anchor,
      impact,
      minion.team === 'blue' ? 0x5bdcff : 0xff5368,
      0.24,
      0.09,
    )

    if (target.kind === 'hero') {
      this.damageHero(target.hero, MINION_ATTACK_DAMAGE, minion.team)
    } else if (target.kind === 'minion') {
      this.damageMinion(target.minion, MINION_ATTACK_DAMAGE, minion.team)
    } else {
      this.damageObjective(target.objective, MINION_ATTACK_DAMAGE, minion.team)
    }
  }

  private createHeroBasicAttackEffect(hero: HeroInstance, target: THREE.Vector3) {
    if (hero.name === 'Ruby') {
      this.combatEffects.createForward(hero, 1.55, 1.05, 0xf5d168, 0.2)
      return
    }

    const color = hero.name === 'Layla' ? 0x7ae8ff : 0xb64cff
    const radius = hero.name === 'Layla' ? 0.13 : 0.14
    this.combatEffects.createProjectile(hero.anchor, target, color, 0.28, radius)
  }

  private showBasicAttackRange(hero: HeroInstance) {
    const kit = HERO_KITS[hero.name]
    const color = hero.name === 'Ruby'
      ? 0xf5d168
      : hero.name === 'Layla'
        ? 0x7ae8ff
        : 0xb64cff

    this.combatEffects.createStaticCircle(hero.anchor, kit.attack.range, color, 0.55)
  }

  private castSkill(hero: HeroInstance, slot: SkillSlot) {
    if (!ATTACK_RETURN_STATES.has(hero.currentState) || this.matchResult !== 'playing') {
      return false
    }

    if (hero.name === 'Alice' && slot === 'skill1' && this.tryAliceBloodOrbTeleport(hero)) {
      return true
    }

    const combat = this.heroCombat.get(hero)
    const kit = HERO_KITS[hero.name]
    const skill = kit.skills[slot]
    const now = performance.now() / 1000

    if (!combat || combat.cooldowns[slot] > now) {
      return false
    }

    hero.moveTarget = null
    combat.cooldowns[slot] = now + skill.cooldown
    this.playHeroState(hero, skill.animationState)

    if (hero.name === 'Ruby') {
      this.castRubySkill(hero, slot, now)
    } else if (hero.name === 'Layla') {
      this.castLaylaSkill(hero, slot, now)
    } else {
      this.castAliceSkill(hero, slot, now)
    }

    this.emitStatus('model')
    return true
  }

  private castRubySkill(hero: HeroInstance, slot: SkillSlot, now: number) {
    const target = this.getEnemyHero(hero)

    if (slot === 'skill1') {
      this.combatEffects.createForward(hero, 4.2, 1.45, 0xff4b65, 0.28)
      this.damageEnemyMinionsInForwardBox(hero, 4.2, 1.45, 150)

      if (target && isInForwardBox(hero, target, 4.2, 1.45)) {
        this.damageHeroFromHero(hero, target, 150)
        this.applySlow(target, now + 1)
      }

      return
    }

    if (slot === 'skill2') {
      this.combatEffects.createVortex(hero.anchor, 2.05, 0xff4b65, 0.44)
      this.damageEnemyMinionsInRadius(hero, 2.05, 130)

      if (target && isInRadius(hero, target, 2.05)) {
        this.damageHeroFromHero(hero, target, 130)
        this.applyStun(target, now + 0.5)
        this.pullTarget(target, hero.anchor, 0.65)
      }

      return
    }

    this.combatEffects.createForward(hero, 5.1, 2.35, 0xff203a, 0.42)
    this.combatEffects.createVortex(hero.anchor, 1.35, 0xff203a, 0.42)
    this.damageEnemyMinionsInForwardBox(hero, 5.1, 2.35, 260)

    if (target && isInForwardBox(hero, target, 5.1, 2.35)) {
      this.damageHeroFromHero(hero, target, 260)
      this.applyStun(target, now + 0.5)
      this.pullTarget(target, hero.anchor, 1.35)
    }
  }

  private castLaylaSkill(hero: HeroInstance, slot: SkillSlot, now: number) {
    const target = this.getEnemyHero(hero)
    const forward = getHeroForward(hero)

    if (slot === 'skill1') {
      const impact = hero.anchor.clone().addScaledVector(forward, 6.8)
      this.clampToMapBounds(impact)
      this.combatEffects.createProjectile(hero.anchor, impact, 0x5bdcff, 0.38, 0.16)
      this.combatEffects.createBurst(impact, 0.72, 0x5bdcff, 0.28)
      this.damageEnemyMinionsInForwardBox(hero, 6.8, 0.82, 180)

      if (target && isInForwardBox(hero, target, 6.8, 0.82)) {
        this.damageHeroFromHero(hero, target, 180)
      }

      return
    }

    if (slot === 'skill2') {
      const impact = target && isInRadius(hero, target, 6.2)
        ? target.anchor.clone()
        : hero.anchor.clone().addScaledVector(forward, 5.6)
      this.clampToMapBounds(impact)
      this.combatEffects.createProjectile(hero.anchor, impact, 0xf6d65f, 0.34, 0.18)
      this.combatEffects.createCircle(impact, 1.35, 0xf6d65f, 0.5)
      this.combatEffects.createBurst(impact, 1.08, 0xf6d65f, 0.3)
      this.damageEnemyMinionsNear(impact, hero, 1.35, 165)

      if (target && target.anchor.distanceTo(impact) <= 1.35) {
        this.damageHeroFromHero(hero, target, 165)
        this.applySlow(target, now + 1)
      }

      return
    }

    const range = 9.2
    const width = 1.55
    const beamEnd = hero.anchor.clone().addScaledVector(forward, range)
    this.clampToMapBounds(beamEnd)
    this.combatEffects.createForward(hero, range, width, 0x64f5ff, 0.52)
    this.combatEffects.createProjectile(hero.anchor, beamEnd, 0x64f5ff, 0.28, 0.22)
    this.combatEffects.createBurst(beamEnd, 1.25, 0x64f5ff, 0.36)
    this.damageEnemyMinionsInForwardBox(hero, range, width, 320)

    if (target && isInForwardBox(hero, target, range, width)) {
      this.damageHeroFromHero(hero, target, 320)
    }
  }

  private castAliceSkill(hero: HeroInstance, slot: SkillSlot, now: number) {
    const target = this.getEnemyHero(hero)

    if (slot === 'skill1') {
      const forward = getHeroForward(hero)
      const orbPosition = hero.anchor.clone().addScaledVector(forward, 4.8)

      this.clampToMapBounds(orbPosition)
      this.aliceBloodOrb = {
        createdAt: now,
        hero,
        position: orbPosition.clone(),
      }
      this.combatEffects.createProjectile(hero.anchor, orbPosition, 0x9b3dff, 0.42, 0.18)
      this.combatEffects.createCircle(orbPosition, 0.55, 0xb64cff, 2)
      this.damageEnemyMinionsInForwardBox(hero, 4.8, 0.9, 170)

      if (target && isInForwardBox(hero, target, 4.8, 0.9)) {
        this.damageHeroFromHero(hero, target, 170)
      }

      return
    }

    if (slot === 'skill2') {
      this.combatEffects.createVortex(hero.anchor, 2.15, 0x9b3dff, 0.42)
      this.damageEnemyMinionsInRadius(hero, 2.15, 210)

      if (target && isInRadius(hero, target, 2.15)) {
        this.damageHeroFromHero(hero, target, 210)
        this.applySlow(target, now + 1)
      }

      return
    }

    const combat = this.heroCombat.get(hero)
    this.combatEffects.createVortex(hero.anchor, 2.7, 0x8b1dff, 1.5)

    if (combat) {
      combat.skillWindow = {
        endsAt: now + 2,
        pulseEvery: 1.5,
        slot,
      }
      combat.lastPulseAt = now
    }
  }

  private tryAliceBloodOrbTeleport(hero: HeroInstance) {
    const orb = this.aliceBloodOrb
    const now = performance.now() / 1000

    if (!orb || orb.hero !== hero || now - orb.createdAt > 2) {
      return false
    }

    hero.anchor.copy(orb.position)
    resolveAabbCollisions(hero.anchor, HERO_COLLIDER_HALF_SIZE, this.wallColliders)
    this.clampToMapBounds(hero.anchor)
    this.aliceBloodOrb = null
    this.combatEffects.createBurst(hero.anchor, 1.25, 0xb64cff, 0.3)
    this.playHeroState(hero, 'skill1')

    return true
  }

  private updateActiveSkills() {
    if (this.matchResult !== 'playing') {
      return
    }

    const now = performance.now() / 1000

    this.heroes.forEach((hero) => {
      const combat = this.heroCombat.get(hero)

      if (!combat?.skillWindow || combat.hp <= 0) {
        return
      }

      if (now >= combat.skillWindow.endsAt) {
        combat.skillWindow = null
        return
      }

      if (now - combat.lastPulseAt < combat.skillWindow.pulseEvery) {
        return
      }

      combat.lastPulseAt = now

      if (hero.name === 'Alice' && combat.skillWindow.slot === 'skill3') {
        const target = this.getEnemyHero(hero)

        this.combatEffects.createBurst(hero.anchor, 2.7, 0x8b1dff, 0.42)
        this.damageEnemyMinionsInRadius(hero, 2.7, 330)

        if (target && isInRadius(hero, target, 2.7)) {
          this.damageHeroFromHero(hero, target, 330)
          this.applyImmobilize(target, now + 1)
        }

        combat.skillWindow = null
      }
    })
  }

  private updateCombatTimers() {
    const now = performance.now() / 1000

    this.combatEffects.update(now)

    this.heroes.forEach((hero, index) => {
      const combat = this.heroCombat.get(hero)

      if (!combat || combat.hp > 0 || !combat.respawnAt || now < combat.respawnAt) {
        return
      }

      this.respawnHero(hero, index)
    })

    for (let index = this.minions.length - 1; index >= 0; index -= 1) {
      const minion = this.minions[index]
      const combat = this.minionCombat.get(minion)

      if (!combat || combat.hp > 0 || !minion.deadAt || now - minion.deadAt < MINION_REMOVE_DELAY) {
        continue
      }

      minion.group.removeFromParent()
      this.minionCombat.delete(minion)
      this.minions.splice(index, 1)
    }

    if (this.aliceBloodOrb && now - this.aliceBloodOrb.createdAt > 2) {
      this.aliceBloodOrb = null
    }
  }

  private updateObjectiveAttacks() {
    if (this.matchResult !== 'playing') {
      return
    }

    const now = performance.now() / 1000

    OBJECTIVE_LAYOUT.forEach((objective) => {
      const objectiveCombat = this.objectiveCombat.get(objective.id)

      if (!objectiveCombat || objectiveCombat.hp <= 0 || objectiveCombat.nextFireAt > now) {
        return
      }

      const target = this.getObjectiveTarget(objective.team, objective.position, objective.attackRange)

      if (!target) {
        return
      }

      objectiveCombat.nextFireAt = now + objective.attackSeconds
      const origin = objective.position.clone()
      origin.y = objective.kind === 'base' ? 2.2 : 2.6
      const targetPoint = this.getCombatTargetPosition(target)
      targetPoint.y = 0.95

      this.combatEffects.createProjectile(
        origin,
        targetPoint,
        objective.team === 'blue' ? 0x5bdcff : 0xff5368,
        0.32,
        0.18,
      )
      if (target.kind === 'hero') {
        this.damageHero(target.hero, objective.attackDamage, objective.team)
      } else if (target.kind === 'minion') {
        this.damageMinion(target.minion, objective.attackDamage, objective.team)
      }
    })
  }

  private damageHero(target: HeroInstance, amount: number, sourceTeam?: TeamSide) {
    const combat = this.heroCombat.get(target)

    if (!combat || combat.hp <= 0) {
      return
    }

    if (applyDamage(combat, amount)) {
      this.killHero(target, sourceTeam)
    }

    this.combatEffects.createCircle(target.anchor, 0.72, 0xff2c4a, 0.18)
  }

  private damageHeroFromHero(source: HeroInstance, target: HeroInstance, baseAmount: number) {
    this.damageHero(
      target,
      this.getHeroScaledDamage(source, baseAmount),
      this.getHeroTeamForHero(source),
    )
  }

  private damageMinion(target: MinionInstance, amount: number, sourceTeam?: TeamSide) {
    const combat = this.minionCombat.get(target)

    if (
      !combat ||
      combat.hp <= 0 ||
      this.matchResult !== 'playing' ||
      sourceTeam === target.team
    ) {
      return
    }

    combat.hp = Math.max(0, combat.hp - amount)
    this.combatEffects.createCircle(target.anchor, 0.42, 0xff2c4a, 0.16)

    if (combat.hp <= 0) {
      this.killMinion(target, sourceTeam)
    }
  }

  private damageMinionFromHero(source: HeroInstance, target: MinionInstance, baseAmount: number) {
    this.damageMinion(
      target,
      this.getHeroScaledDamage(source, baseAmount),
      this.getHeroTeamForHero(source),
    )
  }

  private damageObjective(target: ObjectiveDefinition, amount: number, sourceTeam?: TeamSide) {
    const combat = this.objectiveCombat.get(target.id)

    if (
      !combat ||
      combat.hp <= 0 ||
      this.matchResult !== 'playing' ||
      sourceTeam === target.team
    ) {
      return
    }

    const wasDestroyed = combat.hp - amount <= 0
    combat.hp = Math.max(0, combat.hp - amount)
    this.combatEffects.createCircle(target.position, 0.95, 0xff2c4a, 0.18)

    if (wasDestroyed && target.kind === 'base') {
      this.finishMatch(target.team === this.getPlayerTeam() ? 'lose' : 'win')
    }
  }

  private damageObjectiveFromHero(source: HeroInstance, target: ObjectiveDefinition, baseAmount: number) {
    this.damageObjective(
      target,
      this.getHeroScaledDamage(source, baseAmount),
      this.getHeroTeamForHero(source),
    )
  }

  private killMinion(minion: MinionInstance, sourceTeam?: TeamSide) {
    const combat = this.minionCombat.get(minion)

    if (!combat || minion.currentState === 'death') {
      return
    }

    combat.hp = 0
    minion.deadAt = performance.now() / 1000
    minion.actionLockedUntil = 0
    playMinionState(minion, 'death')

    if (sourceTeam && sourceTeam !== minion.team) {
      this.grantTeamXp(sourceTeam, MINION_XP_REWARD)
    }
  }

  private killHero(hero: HeroInstance, sourceTeam?: TeamSide) {
    const combat = this.heroCombat.get(hero)

    if (!combat) {
      return
    }

    combat.hp = 0
    combat.respawnAt = performance.now() / 1000 + this.getCurrentRespawnDelay()
    combat.skillWindow = null
    hero.moveTarget = null
    this.playHeroState(hero, 'death')

    if (sourceTeam && sourceTeam !== this.getHeroTeamForHero(hero)) {
      this.kills[sourceTeam] += 1
      this.grantTeamXp(sourceTeam, HERO_KILL_XP_REWARD)
    }
  }

  private getHeroScaledDamage(hero: HeroInstance, baseAmount: number) {
    const combat = this.heroCombat.get(hero)
    return getHeroDamageForLevel(baseAmount, combat?.level ?? 1)
  }

  private grantTeamXp(team: TeamSide, amount: number) {
    this.heroes.forEach((hero, index) => {
      if (this.getHeroTeam(index) !== team) {
        return
      }

      const combat = this.heroCombat.get(hero)

      if (!combat || combat.hp <= 0) {
        return
      }

      const previousLevel = combat.level

      if (grantHeroXp(combat, amount) > 0 && combat.level > previousLevel) {
        this.combatEffects.createCircle(hero.anchor, 0.95, 0x70b7ff, 0.42)
      }
    })
  }

  private applySlow(hero: HeroInstance, until: number) {
    const combat = this.heroCombat.get(hero)

    if (combat) {
      combat.slowUntil = Math.max(combat.slowUntil, until)
    }
  }

  private applyImmobilize(hero: HeroInstance, until: number) {
    const combat = this.heroCombat.get(hero)

    if (combat) {
      combat.immobilizedUntil = Math.max(combat.immobilizedUntil, until)
    }
  }

  private applyStun(hero: HeroInstance, until: number) {
    const combat = this.heroCombat.get(hero)

    if (combat) {
      combat.stunnedUntil = Math.max(combat.stunnedUntil, until)
    }
  }

  private pullTarget(target: HeroInstance, toward: THREE.Vector3, distance: number) {
    const direction = toward.clone().sub(target.anchor)
    direction.y = 0

    if (direction.lengthSq() === 0) {
      return
    }

    direction.normalize()
    target.anchor.addScaledVector(direction, distance)
    resolveAabbCollisions(target.anchor, HERO_COLLIDER_HALF_SIZE, this.wallColliders)
    this.clampToMapBounds(target.anchor)
  }

  private getEnemyHero(hero: HeroInstance) {
    const heroTeam = this.getHeroTeamForHero(hero)

    return this.getClosestEnemyHero(hero.anchor, heroTeam, Number.POSITIVE_INFINITY)
  }

  private getClosestEnemyHero(
    position: THREE.Vector3,
    team: TeamSide,
    range: number,
  ): HeroInstance | null {
    let closestDistance = Number.POSITIVE_INFINITY
    let closestHero: HeroInstance | null = null

    this.heroes.forEach((hero, index) => {
      const combat = this.heroCombat.get(hero)

      if (!hero || !combat || combat.hp <= 0 || this.getHeroTeam(index) === team) {
        return
      }

      const distance = hero.anchor.distanceTo(position)

      if (distance <= range && distance < closestDistance) {
        closestDistance = distance
        closestHero = hero
      }
    })

    return closestHero
  }

  private getClosestEnemyMinion(
    position: THREE.Vector3,
    team: TeamSide,
    range: number,
  ): MinionInstance | null {
    let closestDistance = Number.POSITIVE_INFINITY
    let closestMinion: MinionInstance | null = null

    this.minions.forEach((minion) => {
      const combat = this.minionCombat.get(minion)

      if (!combat || combat.hp <= 0 || minion.team === team) {
        return
      }

      const distance = minion.anchor.distanceTo(position)

      if (distance <= range && distance < closestDistance) {
        closestDistance = distance
        closestMinion = minion
      }
    })

    return closestMinion
  }

  private getAttackableEnemyObjective(hero: HeroInstance, range: number): ObjectiveDefinition | null {
    const heroTeam = this.getHeroTeamForHero(hero)
    let closestDistance = Number.POSITIVE_INFINITY
    let closestObjective: ObjectiveDefinition | null = null

    for (const objective of OBJECTIVE_LAYOUT) {
      const combat = this.objectiveCombat.get(objective.id)

      if (
        objective.team === heroTeam ||
        !combat ||
        combat.hp <= 0
      ) {
        continue
      }

      const hitRadius = objective.colliderRadius ?? objective.colliderHalfSize
      const distance = hero.anchor.distanceTo(objective.position)

      if (distance > range + hitRadius || distance >= closestDistance) {
        continue
      }

      closestDistance = distance
      closestObjective = objective
    }

    return closestObjective
  }

  private getClosestEnemyObjective(
    position: THREE.Vector3,
    team: TeamSide,
    range = Number.POSITIVE_INFINITY,
  ): ObjectiveDefinition | null {
    let closestDistance = Number.POSITIVE_INFINITY
    let closestObjective: ObjectiveDefinition | null = null

    OBJECTIVE_LAYOUT.forEach((objective) => {
      const combat = this.objectiveCombat.get(objective.id)

      if (!combat || combat.hp <= 0 || objective.team === team) {
        return
      }

      const hitRadius = objective.colliderRadius ?? objective.colliderHalfSize
      const distance = Math.max(0, position.distanceTo(objective.position) - hitRadius)

      if (distance <= range && distance < closestDistance) {
        closestDistance = distance
        closestObjective = objective
      }
    })

    return closestObjective
  }

  private getMinionAiTarget(minion: MinionInstance): CombatTarget | null {
    const enemyMinion = this.getClosestEnemyMinion(minion.anchor, minion.team, MINION_AGGRO_RANGE)

    if (enemyMinion) {
      return { kind: 'minion', minion: enemyMinion }
    }

    const enemyHero = this.getClosestEnemyHero(minion.anchor, minion.team, MINION_AGGRO_RANGE)

    if (enemyHero) {
      return { kind: 'hero', hero: enemyHero }
    }

    const attackableObjective = this.getClosestEnemyObjective(
      minion.anchor,
      minion.team,
      MINION_AGGRO_RANGE,
    )

    if (attackableObjective) {
      return { kind: 'objective', objective: attackableObjective }
    }

    const laneObjective = this.getClosestEnemyObjective(minion.anchor, minion.team)
    return laneObjective ? { kind: 'objective', objective: laneObjective } : null
  }

  private getHeroAiTarget(hero: HeroInstance, team: TeamSide): CombatTarget | null {
    const enemyHero = this.getClosestEnemyHero(hero.anchor, team, HERO_AI_AGGRO_RANGE)

    if (enemyHero) {
      return { kind: 'hero', hero: enemyHero }
    }

    const enemyMinion = this.getClosestEnemyMinion(hero.anchor, team, HERO_AI_AGGRO_RANGE)

    if (enemyMinion) {
      return { kind: 'minion', minion: enemyMinion }
    }

    const objective = this.getClosestEnemyObjective(hero.anchor, team)
    return objective ? { kind: 'objective', objective } : null
  }

  private getObjectiveTarget(
    team: TeamSide,
    position: THREE.Vector3,
    range: number,
  ) {
    const minion = this.getClosestEnemyMinion(position, team, range)

    if (minion) {
      return { kind: 'minion', minion } satisfies CombatTarget
    }

    const hero = this.getClosestEnemyHero(position, team, range)

    return hero ? { kind: 'hero', hero } satisfies CombatTarget : null
  }

  private getHeroTeam(index: number): TeamSide {
    return this.heroSlots[index]?.team ?? 'red'
  }

  private getHeroTeamForHero(hero: HeroInstance): TeamSide {
    const index = this.heroes.indexOf(hero)
    return this.getHeroTeam(index)
  }

  private getPlayerTeam(): TeamSide {
    return this.getHeroTeam(this.playerHeroIndex)
  }

  private getTeamBase(team: TeamSide) {
    return OBJECTIVE_LAYOUT.find((objective) => (
      objective.kind === 'base' && objective.team === team
    ))
  }

  private getLaneDirection(team: TeamSide) {
    return team === 'blue' ? -1 : 1
  }

  private getLaneDirectionVector(team: TeamSide) {
    return new THREE.Vector3(0, 0, this.getLaneDirection(team))
  }

  private getCombatTargetPosition(target: CombatTarget) {
    if (target.kind === 'hero') {
      return target.hero.anchor.clone()
    }

    if (target.kind === 'minion') {
      return target.minion.anchor.clone()
    }

    return target.objective.position.clone()
  }

  private getCombatTargetRadius(target: CombatTarget) {
    if (target.kind === 'objective') {
      return target.objective.colliderRadius ?? target.objective.colliderHalfSize
    }

    return target.kind === 'minion' ? 0.2 : 0.6
  }

  private steerAroundObjectives(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    team: TeamSide,
  ) {
    const safeDirection = direction.clone()
    safeDirection.y = 0

    if (safeDirection.lengthSq() === 0) {
      return safeDirection
    }

    safeDirection.normalize()

    for (const objective of OBJECTIVE_LAYOUT) {
      const radius = (objective.colliderRadius ?? objective.colliderHalfSize) + OBJECTIVE_AVOIDANCE_PADDING
      const offset = objective.position.clone().sub(position)
      offset.y = 0
      const forwardDistance = offset.dot(safeDirection)

      if (
        forwardDistance <= 0 ||
        forwardDistance > OBJECTIVE_AVOIDANCE_LOOKAHEAD + radius
      ) {
        continue
      }

      const closestPoint = position.clone().addScaledVector(safeDirection, forwardDistance)
      const lateralDistance = closestPoint.distanceTo(objective.position)

      if (lateralDistance >= radius) {
        continue
      }

      let side = Math.sign(position.x - objective.position.x)

      if (side === 0) {
        side = team === 'blue' ? -1 : 1
      }

      const waypoint = new THREE.Vector3(
        objective.position.x + side * radius,
        0,
        position.z + this.getLaneDirection(team) * (OBJECTIVE_AVOIDANCE_LOOKAHEAD + 0.8),
      )
      const steeredDirection = waypoint.sub(position)
      steeredDirection.y = 0

      if (steeredDirection.lengthSq() > 0) {
        return steeredDirection.normalize()
      }
    }

    return safeDirection
  }

  private getHeroSpawnPosition(index: number) {
    const team = this.getHeroTeam(index)
    const base = this.getTeamBase(team)
    const slot = this.heroSlots[index]
    const spawn = (base?.position ?? slot?.asset.position ?? HERO_ASSETS[0].position).clone()
    const laneDirection = this.getLaneDirection(team)

    spawn.x += slot?.spawnOffset.x ?? 0
    spawn.z += laneDirection * (3.2 + (slot?.spawnOffset.y ?? 0))
    spawn.y = 0

    return spawn
  }

  private placeHeroAtSpawn(hero: HeroInstance, index: number) {
    hero.anchor.copy(this.getHeroSpawnPosition(index))
    hero.moveTarget = null
    hero.group.position.copy(hero.anchor)
  }

  private respawnHero(hero: HeroInstance, index: number) {
    const combat = this.heroCombat.get(hero)

    if (!combat) {
      return
    }

    combat.hp = combat.maxHp
    combat.respawnAt = 0
    combat.skillWindow = null
    combat.slowUntil = 0
    combat.stunnedUntil = 0
    combat.immobilizedUntil = 0
    this.placeHeroAtSpawn(hero, index)
    this.playHeroState(hero, 'idle')
  }

  private finishMatch(result: Exclude<MatchResult, 'playing'>) {
    if (this.matchResult !== 'playing') {
      return
    }

    this.matchResult = result
    this.heroes.forEach((hero) => {
      hero.moveTarget = null
      this.playHeroState(hero, this.heroCombat.get(hero)?.hp ? 'idle' : 'death')
    })
  }

  private faceTarget(hero: HeroInstance, target: THREE.Vector3) {
    const offset = target.clone().sub(hero.anchor)
    offset.y = 0

    if (offset.lengthSq() === 0) {
      return
    }

    hero.facingAngle = Math.atan2(offset.x, offset.z)
    hero.group.rotation.y = hero.facingAngle
  }

  private faceMinionTarget(minion: MinionInstance, target: THREE.Vector3) {
    const offset = target.clone().sub(minion.anchor)
    offset.y = 0

    if (offset.lengthSq() === 0) {
      return
    }

    minion.facingAngle = Math.atan2(offset.x, offset.z)
    minion.group.rotation.y = minion.facingAngle
  }

  private damageEnemyMinionsInRadius(hero: HeroInstance, radius: number, amount: number) {
    this.damageEnemyMinionsNear(hero.anchor, hero, radius, amount)
  }

  private damageEnemyMinionsNear(
    position: THREE.Vector3,
    sourceHero: HeroInstance,
    radius: number,
    amount: number,
  ) {
    const sourceTeam = this.getHeroTeamForHero(sourceHero)
    const scaledAmount = this.getHeroScaledDamage(sourceHero, amount)

    this.minions.forEach((minion) => {
      const combat = this.minionCombat.get(minion)

      if (!combat || combat.hp <= 0 || minion.team === sourceTeam) {
        return
      }

      if (position.distanceTo(minion.anchor) <= radius) {
        this.damageMinion(minion, scaledAmount, sourceTeam)
      }
    })
  }

  private damageEnemyMinionsInForwardBox(
    hero: HeroInstance,
    range: number,
    width: number,
    amount: number,
  ) {
    const heroTeam = this.getHeroTeamForHero(hero)
    const forward = getHeroForward(hero)
    const scaledAmount = this.getHeroScaledDamage(hero, amount)

    this.minions.forEach((minion) => {
      const combat = this.minionCombat.get(minion)

      if (!combat || combat.hp <= 0 || minion.team === heroTeam) {
        return
      }

      const offset = minion.anchor.clone().sub(hero.anchor)
      offset.y = 0
      const forwardDistance = offset.dot(forward)

      if (forwardDistance < 0 || forwardDistance > range) {
        return
      }

      const sideDistance = offset.sub(forward.clone().multiplyScalar(forwardDistance)).length()

      if (sideDistance <= width / 2) {
        this.damageMinion(minion, scaledAmount, heroTeam)
      }
    })
  }

  private clampToMapBounds(point: THREE.Vector3) {
    point.x = THREE.MathUtils.clamp(point.x, this.mapBounds.minX, this.mapBounds.maxX)
    point.z = THREE.MathUtils.clamp(point.z, this.mapBounds.minZ, this.mapBounds.maxZ)
  }

  private getMovementState(hero: HeroInstance): HeroState {
    const inputVector = this.inputManager?.getMovementVector() ?? new THREE.Vector2()
    return inputVector.lengthSq() > 0 || hero.moveTarget ? 'run' : 'idle'
  }

  private emitStatus(mode: SceneStatus['mode']) {
    const nowSeconds = performance.now() / 1000

    this.onStatusChange(createSceneStatus({
      camera: this.camera,
      heroCombat: this.heroCombat,
      heroes: this.heroes,
      heroSlots: this.heroSlots,
      kills: this.kills,
      loadedHeroes: this.loadedHeroes,
      mapBounds: this.mapBounds,
      matchResult: this.matchResult,
      matchSeconds: this.getMatchSeconds(nowSeconds),
      minionCombat: this.minionCombat,
      minions: this.minions,
      mode,
      nowSeconds,
      objectiveCombat: this.objectiveCombat,
      playerHeroIndex: this.playerHeroIndex,
      rendererHeight: this.rendererHeight,
      rendererWidth: this.rendererWidth,
    }))
  }

  private readonly handleSkillCommand = (event: Event) => {
    const slot = (event as CustomEvent<SkillSlot>).detail
    const selectedHero = this.heroes[this.playerHeroIndex]

    if (slot && selectedHero && this.matchResult === 'playing') {
      this.castSkill(selectedHero, slot)
    }
  }

  private getMatchSeconds(nowSeconds = performance.now() / 1000) {
    return Math.max(0, nowSeconds - this.matchStartedAt)
  }

  private getCurrentRespawnDelay() {
    const scaledDelay = RESPAWN_DELAY + Math.floor(this.getMatchSeconds() / 60) * RESPAWN_DELAY_PER_MINUTE
    return Math.min(RESPAWN_MAX_DELAY, scaledDelay)
  }
}

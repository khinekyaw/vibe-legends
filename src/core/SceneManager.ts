import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  createHeroFromModel,
  createPlaceholderHero,
  playHeroState as playHeroAnimationState,
  type HeroInstance,
} from '../entities/HeroModel'
import type { MapBounds } from '../map/MapModel'
import {
  createObjectiveModelInstance,
  createObjectiveColliders,
  createObjectiveStructures,
  getObjectiveModelUrl,
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
  ROTATION_SMOOTHING,
  SKY_COLOR,
  TARGET_EPSILON,
  type HeroAsset,
  type HeroState,
  type MatchResult,
  type SceneStatus,
} from './sceneConfig'
import {
  applyDamage,
  createHeroCombatState,
  getHeroForward,
  HERO_KITS,
  isInForwardBox,
  isInRadius,
  type HeroCombatState,
  type SkillSlot,
} from '../systems/CombatSystem'
import { CombatEffects } from '../systems/CombatEffects'
import {
  projectObjectiveHealthBars,
  projectWorldHealthBars,
  type ObjectiveCombatState,
} from '../ui/WorldHealthBars'

type TeamSide = 'blue' | 'red'

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
  private readonly objectiveModelSources = new Map<string, THREE.Object3D>()
  private inputManager: InputManager | null = null
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private animationFrame = 0
  private loadedHeroes = 0
  private matchResult: MatchResult = 'playing'
  private readonly onStatusChange: (status: SceneStatus) => void
  private readonly playerHeroIndex = 0
  private readonly kills: Record<TeamSide, number> = {
    blue: 0,
    red: 0,
  }

  constructor(canvas: HTMLCanvasElement, onStatusChange: (status: SceneStatus) => void) {
    this.onStatusChange = onStatusChange
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
    this.inputManager = new InputManager(this.renderer.domElement)
    window.addEventListener('skill-command', this.handleSkillCommand)
    this.emitStatus('loading')
    this.loadBrawlMap()
    this.loadObjectiveModels()
    HERO_ASSETS.forEach((asset, index) => this.loadHeroModel(asset, index))
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

  private loadObjectiveModels() {
    const urls = [...new Set(OBJECTIVE_LAYOUT.map(getObjectiveModelUrl))]

    Promise.all(
      urls.map(
        (url) =>
          new Promise<void>((resolve) => {
            this.loader.load(
              url,
              (gltf) => {
                this.objectiveModelSources.set(url, gltf.scene)
                resolve()
              },
              undefined,
              () => resolve(),
            )
          }),
      ),
    ).then(() => {
      OBJECTIVE_LAYOUT.forEach((objective) => {
        const source = this.objectiveModelSources.get(getObjectiveModelUrl(objective))
        const container = this.objectiveStructures.getObjectByName(objective.id)

        if (!source || !container) {
          return
        }

        this.disposeObjectivePlaceholder(container)
        container.clear()
        container.add(createObjectiveModelInstance(objective, source))
      })
    })
  }

  private disposeObjectivePlaceholder(object: THREE.Object3D) {
    object.children.forEach((child) => {
      child.traverse((descendant) => {
        if (descendant instanceof THREE.Mesh) {
          descendant.geometry.dispose()
          const materials = Array.isArray(descendant.material)
            ? descendant.material
            : [descendant.material]
          materials.forEach((material) => material.dispose())
        }
      })
    })
  }

  private loadHeroModel(asset: HeroAsset, index: number) {
    this.loader.load(
      asset.url,
      (gltf) => {
        const heroInstance = createHeroFromModel(asset, gltf.scene, gltf.animations, (hero) => {
          this.playHeroState(hero, this.getMovementState(hero))
        })
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
    this.updateObjectiveAttacks()
    this.updateControlledHero(delta)
    this.updateActiveSkills()
    this.heroes.forEach((hero) => {
      hero.mixer?.update(delta)
      this.pinHeroToAnchor(hero)
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
      this.castBasicAttack(hero)
      return
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
    hero.facingAngle = THREE.MathUtils.damp(
      hero.facingAngle,
      targetAngle,
      ROTATION_SMOOTHING,
      delta,
    )
    hero.group.rotation.y = hero.facingAngle
    this.playHeroState(hero, collision.collided && !hero.moveTarget ? 'idle' : 'run')
  }

  private castBasicAttack(hero: HeroInstance) {
    if (!ATTACK_RETURN_STATES.has(hero.currentState) || this.matchResult !== 'playing') {
      return
    }

    const kit = HERO_KITS[hero.name]
    const heroTeam = this.getHeroTeamForHero(hero)
    const enemyHero = this.getEnemyHero(hero)
    const heroTarget =
      enemyHero && isInRadius(hero, enemyHero, kit.attack.range) ? enemyHero : null
    const objectiveTarget = heroTarget
      ? null
      : this.getAttackableEnemyObjective(hero, kit.attack.range)
    const targetPosition = heroTarget?.anchor ?? objectiveTarget?.position

    if (targetPosition) {
      this.faceTarget(hero, targetPosition)
    }

    this.playHeroState(hero, 'attack')

    if (heroTarget) {
      if (hero.name === 'Alice') {
        this.combatEffects.createLine(hero.anchor, heroTarget.anchor, 0xb64cff, 0.22)
      } else {
        this.combatEffects.createCircle(heroTarget.anchor, 0.72, 0xf5d168, 0.18)
      }

      this.damageHero(heroTarget, kit.attack.damage, heroTeam)
      return
    }

    if (objectiveTarget) {
      if (hero.name === 'Alice') {
        const targetPoint = objectiveTarget.position.clone()
        targetPoint.y = 1.9
        this.combatEffects.createLine(hero.anchor, targetPoint, 0xb64cff, 0.22)
      } else {
        this.combatEffects.createCircle(objectiveTarget.position, 0.9, 0xf5d168, 0.18)
      }

      this.damageObjective(objectiveTarget, kit.attack.damage, heroTeam)
    }
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
    } else {
      this.castAliceSkill(hero, slot, now)
    }

    this.emitStatus('model')
    return true
  }

  private castRubySkill(hero: HeroInstance, slot: SkillSlot, now: number) {
    const target = this.getEnemyHero(hero)
    const heroTeam = this.getHeroTeamForHero(hero)

    if (slot === 'skill1') {
      this.combatEffects.createForward(hero, 4.2, 1.45, 0xff4b65, 0.28)

      if (target && isInForwardBox(hero, target, 4.2, 1.45)) {
        this.damageHero(target, 150, heroTeam)
        this.applySlow(target, now + 1)
      }

      return
    }

    if (slot === 'skill2') {
      this.combatEffects.createCircle(hero.anchor, 2.05, 0xff4b65, 0.35)

      if (target && isInRadius(hero, target, 2.05)) {
        this.damageHero(target, 130, heroTeam)
        this.applyStun(target, now + 0.5)
        this.pullTarget(target, hero.anchor, 0.65)
      }

      return
    }

    this.combatEffects.createForward(hero, 5.1, 2.35, 0xff203a, 0.42)

    if (target && isInForwardBox(hero, target, 5.1, 2.35)) {
      this.damageHero(target, 260, heroTeam)
      this.applyStun(target, now + 0.5)
      this.pullTarget(target, hero.anchor, 1.35)
    }
  }

  private castAliceSkill(hero: HeroInstance, slot: SkillSlot, now: number) {
    const target = this.getEnemyHero(hero)
    const heroTeam = this.getHeroTeamForHero(hero)

    if (slot === 'skill1') {
      const forward = getHeroForward(hero)
      const orbPosition = hero.anchor.clone().addScaledVector(forward, 4.8)

      this.clampToMapBounds(orbPosition)
      this.aliceBloodOrb = {
        createdAt: now,
        hero,
        position: orbPosition.clone(),
      }
      this.combatEffects.createForward(hero, 4.8, 0.9, 0x9b3dff, 0.45)
      this.combatEffects.createCircle(orbPosition, 0.55, 0xb64cff, 2)

      if (target && isInForwardBox(hero, target, 4.8, 0.9)) {
        this.damageHero(target, 170, heroTeam)
      }

      return
    }

    if (slot === 'skill2') {
      this.combatEffects.createCircle(hero.anchor, 2.15, 0x9b3dff, 0.36)

      if (target && isInRadius(hero, target, 2.15)) {
        this.damageHero(target, 210, heroTeam)
        this.applySlow(target, now + 1)
      }

      return
    }

    const combat = this.heroCombat.get(hero)
    this.combatEffects.createCircle(hero.anchor, 2.7, 0x8b1dff, 1.5)

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
    this.combatEffects.createCircle(hero.anchor, 1.25, 0xb64cff, 0.25)
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

        this.combatEffects.createCircle(hero.anchor, 2.7, 0x8b1dff, 0.35)

        if (target && isInRadius(hero, target, 2.7)) {
          this.damageHero(target, 330, this.getHeroTeamForHero(hero))
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
      const targetPoint = target.anchor.clone()
      targetPoint.y = 1.15

      this.combatEffects.createLine(
        origin,
        targetPoint,
        objective.team === 'blue' ? 0x5bdcff : 0xff5368,
        0.22,
      )
      this.damageHero(target, objective.attackDamage, objective.team)
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

  private killHero(hero: HeroInstance, sourceTeam?: TeamSide) {
    const combat = this.heroCombat.get(hero)

    if (!combat) {
      return
    }

    combat.hp = 0
    combat.respawnAt = performance.now() / 1000 + RESPAWN_DELAY
    combat.skillWindow = null
    hero.moveTarget = null
    this.playHeroState(hero, 'death')

    if (sourceTeam && sourceTeam !== this.getHeroTeamForHero(hero)) {
      this.kills[sourceTeam] += 1
    }
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
    return this.heroes.find((candidate) => {
      const combat = this.heroCombat.get(candidate)
      return candidate !== hero && combat && combat.hp > 0
    })
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

  private getObjectiveTarget(
    team: TeamSide,
    position: THREE.Vector3,
    range: number,
  ) {
    return this.heroes.find((candidate, index) => {
      const combat = this.heroCombat.get(candidate)

      if (!candidate || !combat || combat.hp <= 0 || this.getHeroTeam(index) === team) {
        return false
      }

      return candidate.anchor.distanceTo(position) <= range
    })
  }

  private getHeroTeam(index: number): TeamSide {
    return index === 0 ? 'blue' : 'red'
  }

  private getHeroTeamForHero(hero: HeroInstance): TeamSide {
    const index = this.heroes.indexOf(hero)
    return this.getHeroTeam(index)
  }

  private getPlayerTeam(): TeamSide {
    return this.getHeroTeam(this.playerHeroIndex)
  }

  private getHeroSpawnPosition(index: number) {
    const team = this.getHeroTeam(index)
    const base = OBJECTIVE_LAYOUT.find((objective) => (
      objective.kind === 'base' && objective.team === team
    ))
    const spawn = (base?.position ?? HERO_ASSETS[index].position).clone()
    const laneDirection = team === 'blue' ? 1 : -1

    spawn.x += team === this.getPlayerTeam() ? -1.35 : 1.35
    spawn.z += laneDirection * 3.2
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

  private clampToMapBounds(point: THREE.Vector3) {
    point.x = THREE.MathUtils.clamp(point.x, this.mapBounds.minX, this.mapBounds.maxX)
    point.z = THREE.MathUtils.clamp(point.z, this.mapBounds.minZ, this.mapBounds.maxZ)
  }

  private getMovementState(hero: HeroInstance): HeroState {
    const inputVector = this.inputManager?.getMovementVector() ?? new THREE.Vector2()
    return inputVector.lengthSq() > 0 || hero.moveTarget ? 'run' : 'idle'
  }

  private emitStatus(mode: SceneStatus['mode']) {
    const now = performance.now()
    const selectedHero = this.heroes[this.playerHeroIndex]
    const enemyHero = selectedHero
      ? this.heroes.find((candidate) => candidate && candidate !== selectedHero)
      : undefined
    const selectedCombat = selectedHero ? this.heroCombat.get(selectedHero) : undefined
    const enemyCombat = enemyHero ? this.heroCombat.get(enemyHero) : undefined
    const nowSeconds = now / 1000
    const respawnSeconds = Math.max(0, (selectedCombat?.respawnAt ?? 0) - nowSeconds)

    this.onStatusChange({
      enemyHp: Math.round(enemyCombat?.hp ?? HERO_MAX_HP),
      enemyKills: this.kills.red,
      enemyMaxHp: enemyCombat?.maxHp ?? HERO_MAX_HP,
      healthBars: projectWorldHealthBars(
        this.heroes,
        this.heroCombat,
        this.playerHeroIndex,
        this.camera,
        this.rendererWidth,
        this.rendererHeight,
      ).concat(
        projectObjectiveHealthBars(
          OBJECTIVE_LAYOUT,
          this.objectiveCombat,
          this.camera,
          this.rendererWidth,
          this.rendererHeight,
        ),
      ),
      loaded: this.loadedHeroes,
      matchResult: this.matchResult,
      mode,
      playerKills: this.kills.blue,
      respawnSeconds,
      selectedHp: Math.round(selectedCombat?.hp ?? HERO_MAX_HP),
      selectedHero: selectedHero?.name ?? HERO_ASSETS[this.playerHeroIndex]?.name ?? 'Alice',
      selectedMaxHp: selectedCombat?.maxHp ?? HERO_MAX_HP,
      selectedState: selectedHero?.currentState ?? 'idle',
      skillCooldowns: {
        skill1: Math.max(0, (selectedCombat?.cooldowns.skill1 ?? 0) - nowSeconds),
        skill2: Math.max(0, (selectedCombat?.cooldowns.skill2 ?? 0) - nowSeconds),
        skill3: Math.max(0, (selectedCombat?.cooldowns.skill3 ?? 0) - nowSeconds),
      },
      total: HERO_ASSETS.length,
    })
  }

  private readonly handleSkillCommand = (event: Event) => {
    const slot = (event as CustomEvent<SkillSlot>).detail
    const selectedHero = this.heroes[this.playerHeroIndex]

    if (slot && selectedHero && this.matchResult === 'playing') {
      this.castSkill(selectedHero, slot)
    }
  }
}

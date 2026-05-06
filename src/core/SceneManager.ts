import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  createHeroFromModel,
  createPlaceholderHero,
  playHeroState as playHeroAnimationState,
  type HeroInstance,
} from '../entities/HeroModel'
import {
  createMapWallColliders,
  createDefaultMapBounds,
  createFallbackGround,
  createWallColliderDebugGroup,
  prepareMapModel,
  type MapBounds,
} from '../map/MapModel'
import {
  resolveAabbCollisions,
  type AabbCollider,
} from '../systems/CollisionSystem'
import { InputManager } from './InputManager'
import {
  ATTACK_RETURN_STATES,
  HERO_ASSETS,
  HERO_COLLIDER_HALF_SIZE,
  HERO_SPEED,
  MAP_MODEL_URL,
  MAP_WORLD_SIZE,
  ROTATION_SMOOTHING,
  SKY_COLOR,
  TARGET_EPSILON,
  type HeroAsset,
  type HeroState,
  type SceneStatus,
} from './sceneConfig'

export class SceneManager {
  private readonly camera: THREE.PerspectiveCamera
  private readonly cameraDesiredPosition = new THREE.Vector3()
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
  private readonly fallbackGround = createFallbackGround()
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private readonly heroBounds = new THREE.Box3()
  private readonly heroes: HeroInstance[] = []
  private mapBounds: MapBounds = createDefaultMapBounds()
  private readonly wallColliders: AabbCollider[] = []
  private wallColliderDebugGroup: THREE.Group | null = null
  private wallColliderDebugVisible = true
  private readonly pointer = new THREE.Vector2()
  private readonly raycaster = new THREE.Raycaster()
  private readonly loader = new GLTFLoader()
  private inputManager: InputManager | null = null
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private animationFrame = 0
  private loadedHeroes = 0
  private readonly onStatusChange: (status: SceneStatus) => void
  private selectedHeroIndex = 0

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

    this.camera = new THREE.PerspectiveCamera(16, 1, 0.1, MAP_WORLD_SIZE * 4)
    this.camera.position.copy(this.cameraOffset)
    this.camera.lookAt(this.controlsTarget)

    this.setupScene()
  }

  start() {
    this.inputManager = new InputManager(this.renderer.domElement)
    window.addEventListener('keydown', this.handleKeyDown)
    this.emitStatus('loading')
    this.loadMapModel()
    HERO_ASSETS.forEach((asset, index) => this.loadHeroModel(asset, index))
    this.animate()
  }

  dispose() {
    cancelAnimationFrame(this.animationFrame)
    this.inputManager?.dispose()
    window.removeEventListener('keydown', this.handleKeyDown)
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
  }

  private setupScene() {
    this.scene.fog = new THREE.Fog(SKY_COLOR, MAP_WORLD_SIZE * 0.85, MAP_WORLD_SIZE * 2.1)
    this.environmentGroup.name = 'environment'
    this.characterGroup.name = 'characters'
    this.scene.add(this.environmentGroup, this.characterGroup)

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

    this.environmentGroup.add(this.fallbackGround)
  }

  private loadMapModel() {
    this.loader.load(
      MAP_MODEL_URL,
      (gltf) => {
        const map = gltf.scene
        this.mapBounds = prepareMapModel(map)
        this.wallColliders.splice(0, this.wallColliders.length, ...createMapWallColliders(map))
        this.environmentGroup.add(map)
        this.wallColliderDebugGroup?.removeFromParent()
        this.wallColliderDebugGroup = createWallColliderDebugGroup(this.wallColliders)
        this.wallColliderDebugGroup.visible = this.wallColliderDebugVisible
        this.environmentGroup.add(this.wallColliderDebugGroup)
        this.fallbackGround.visible = false
      },
      undefined,
      () => {
        this.fallbackGround.visible = true
      },
    )
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
        this.playHeroState(heroInstance, 'idle', 0)
        this.loadedHeroes += 1
        this.emitStatus('model')
      },
      undefined,
      () => {
        const hero = createPlaceholderHero(asset)
        this.characterGroup.add(hero.group)
        this.heroes[index] = hero
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
    this.updateControlledHero(delta)
    this.heroes.forEach((hero) => {
      hero.mixer?.update(delta)
      this.pinHeroToAnchor(hero)
    })
    this.updateCamera(delta)

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
    const selectedHero = this.heroes[this.selectedHeroIndex]

    if (selectedHero) {
      this.cameraDesiredTarget.copy(selectedHero.anchor)
    } else {
      this.cameraDesiredTarget.set(0, 0, 0)
    }

    this.cameraDesiredTarget.y = 0.75
    this.controlsTarget.lerp(this.cameraDesiredTarget, 1 - Math.exp(-6 * delta))
    this.cameraDesiredPosition.copy(this.controlsTarget).add(this.cameraOffset)
    this.camera.position.lerp(this.cameraDesiredPosition, 1 - Math.exp(-5 * delta))
    this.camera.lookAt(this.controlsTarget)
  }

  private updateControlledHero(delta: number) {
    const hero = this.heroes[this.selectedHeroIndex]

    if (!hero || hero.currentState === 'death') {
      return
    }

    if (this.inputManager?.getAttackCommand()) {
      hero.moveTarget = null
      this.playHeroState(hero, 'attack')
      return
    }

    this.updatePointerTarget(hero)
    const inputVector = this.inputManager?.getMovementVector() ?? new THREE.Vector2()
    const keyboardDirection = new THREE.Vector3(inputVector.x, 0, -inputVector.y)

    if (keyboardDirection.lengthSq() > 0) {
      keyboardDirection.normalize()
      hero.moveTarget = null
      this.moveHero(hero, keyboardDirection, delta)
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
      this.moveHero(hero, targetDirection, delta)
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

  private moveHero(hero: HeroInstance, direction: THREE.Vector3, delta: number) {
    if (!ATTACK_RETURN_STATES.has(hero.currentState)) {
      return
    }

    hero.anchor.addScaledVector(direction, HERO_SPEED * delta)
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

  private clampToMapBounds(point: THREE.Vector3) {
    point.x = THREE.MathUtils.clamp(point.x, this.mapBounds.minX, this.mapBounds.maxX)
    point.z = THREE.MathUtils.clamp(point.z, this.mapBounds.minZ, this.mapBounds.maxZ)
  }

  private getMovementState(hero: HeroInstance): HeroState {
    const inputVector = this.inputManager?.getMovementVector() ?? new THREE.Vector2()
    return inputVector.lengthSq() > 0 || hero.moveTarget ? 'run' : 'idle'
  }

  private emitStatus(mode: SceneStatus['mode']) {
    const selectedHero = this.heroes[this.selectedHeroIndex]
    this.onStatusChange({
      loaded: this.loadedHeroes,
      mode,
      selectedHero: selectedHero?.name ?? HERO_ASSETS[this.selectedHeroIndex]?.name ?? 'Alice',
      selectedState: selectedHero?.currentState ?? 'idle',
      total: HERO_ASSETS.length,
    })
  }

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) {
      return
    }

    if (event.code === 'Digit1' || event.code === 'Digit2') {
      this.selectedHeroIndex = event.code === 'Digit1' ? 0 : 1
      this.emitStatus('model')
      return
    }

    if (event.code === 'F1') {
      event.preventDefault()
      this.wallColliderDebugVisible = !this.wallColliderDebugVisible

      if (this.wallColliderDebugGroup) {
        this.wallColliderDebugGroup.visible = this.wallColliderDebugVisible
      }

      return
    }

    const selectedHero = this.heroes[this.selectedHeroIndex]

    if (!selectedHero) {
      return
    }

    const stateByKey: Partial<Record<string, HeroState>> = {
      KeyX: 'death',
      KeyI: 'idle',
    }
    const nextState = stateByKey[event.code]

    if (nextState) {
      this.playHeroState(selectedHero, nextState)
    }
  }
}

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { InputManager } from './InputManager'

const HERO_ASSETS = [
  {
    clips: {
      attack: 'attack1',
      death: 'dead',
      idle: 'fight_idle',
      run: 'run',
    },
    name: 'Alice',
    position: new THREE.Vector3(-0.75, 0, 0),
    url: '/assets/models/alice/model.glb',
  },
  {
    clips: {
      attack: 'attack1',
      death: 'dead',
      idle: 'fight_idle',
      run: 'run',
    },
    name: 'Ruby',
    position: new THREE.Vector3(0.75, 0, 0),
    url: '/assets/models/ruby/model.glb',
  },
] as const

type HeroState = 'idle' | 'run' | 'attack' | 'death'

type SceneStatus = {
  loaded: number
  mode: 'loading' | 'model' | 'placeholder'
  selectedHero: string
  selectedState: HeroState
  total: number
}

type HeroInstance = {
  actions: Partial<Record<HeroState, THREE.AnimationAction>>
  anchor: THREE.Vector3
  currentAction: THREE.AnimationAction | null
  currentState: HeroState
  group: THREE.Group
  facingAngle: number
  mixer: THREE.AnimationMixer | null
  moveTarget: THREE.Vector3 | null
  name: string
}

const ATTACK_RETURN_STATES = new Set<HeroState>(['idle', 'run'])
const HERO_SPEED = 1.7
const MAP_LIMIT = 2.15
const ROTATION_SMOOTHING = 16
const TARGET_EPSILON = 0.06

export class SceneManager {
  private readonly camera: THREE.PerspectiveCamera
  private readonly clock = new THREE.Clock()
  private readonly controlsTarget = new THREE.Vector3(0, 0.8, 0)
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private readonly heroBounds = new THREE.Box3()
  private readonly heroes: HeroInstance[] = []
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
    this.renderer.setClearColor(0x11151c)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    this.camera.position.set(3.6, 2.4, 4.4)
    this.camera.lookAt(this.controlsTarget)

    this.setupScene()
  }

  start() {
    this.inputManager = new InputManager(this.renderer.domElement)
    window.addEventListener('keydown', this.handleKeyDown)
    this.emitStatus('loading')
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
    this.scene.fog = new THREE.Fog(0x11151c, 8, 18)

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

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.7, 64),
      new THREE.MeshStandardMaterial({
        color: 0x263242,
        metalness: 0,
        roughness: 0.82,
      }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    const grid = new THREE.GridHelper(6, 12, 0x516070, 0x2c3644)
    grid.position.y = 0.01
    this.scene.add(grid)
  }

  private loadHeroModel(asset: (typeof HERO_ASSETS)[number], index: number) {
    this.loader.load(
      asset.url,
      (gltf) => {
        const model = gltf.scene
        model.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.frustumCulled = false
            object.castShadow = true
            object.receiveShadow = true
          }
        })

        const hero = new THREE.Group()
        const visual = new THREE.Group()
        hero.name = `${asset.name.toLowerCase()}-model`
        visual.name = `${asset.name.toLowerCase()}-visual`
        visual.add(model)
        hero.add(visual)
        this.normalizeHero(hero)
        hero.position.copy(asset.position)
        this.scene.add(hero)

        const heroInstance = this.createHeroInstance(asset, hero, model, gltf.animations)
        this.heroes[index] = heroInstance
        this.playHeroState(heroInstance, 'idle', 0)
        this.loadedHeroes += 1
        this.emitStatus('model')
      },
      undefined,
      () => {
        const hero = this.createPlaceholderHero(asset.name)
        hero.position.copy(asset.position)
        this.scene.add(hero)
        this.heroes[index] = {
          actions: {},
          anchor: asset.position.clone(),
          currentAction: null,
          currentState: 'idle',
          facingAngle: Math.PI,
          group: hero,
          mixer: null,
          moveTarget: null,
          name: asset.name,
        }
        this.loadedHeroes += 1
        this.emitStatus('placeholder')
      },
    )
  }

  private normalizeHero(hero: THREE.Group) {
    const box = new THREE.Box3().setFromObject(hero)
    const size = box.getSize(new THREE.Vector3())
    const visual = hero.children[0]
    const model = visual.children[0] ?? visual
    const pivot = this.getHeroPivot(hero) ?? box.getCenter(new THREE.Vector3())
    const maxDimension = Math.max(size.x, size.y, size.z, 0.001)

    model.position.x -= pivot.x
    model.position.y -= box.min.y
    model.position.z -= pivot.z
    hero.scale.setScalar(1.45 / maxDimension)
    hero.rotation.y = Math.PI
  }

  private getHeroPivot(hero: THREE.Group) {
    hero.updateMatrixWorld(true)
    const pivot = new THREE.Vector3()
    const pivotObject =
      hero.getObjectByName('Bip001_00') ??
      hero.getObjectByName('Bip001_01') ??
      hero.getObjectByName('Bip001 Pelvis_02')

    if (!pivotObject) {
      return null
    }

    pivotObject.getWorldPosition(pivot)
    return pivot
  }

  private createHeroInstance(
    asset: (typeof HERO_ASSETS)[number],
    group: THREE.Group,
    model: THREE.Group,
    animations: THREE.AnimationClip[],
  ): HeroInstance {
    const mixer = new THREE.AnimationMixer(model)
    const actions = {
      attack: this.createAction(mixer, animations, asset.clips.attack),
      death: this.createAction(mixer, animations, asset.clips.death),
      idle: this.createAction(mixer, animations, asset.clips.idle),
      run: this.createAction(mixer, animations, asset.clips.run),
    }
    const hero: HeroInstance = {
      actions,
      anchor: asset.position.clone(),
      currentAction: null,
      currentState: 'idle',
      facingAngle: Math.PI,
      group,
      mixer,
      moveTarget: null,
      name: asset.name,
    }

    mixer.addEventListener('finished', (event) => {
      if (hero.currentState === 'attack' && event.action === hero.actions.attack) {
        this.playHeroState(hero, this.getMovementState(hero))
      }
    })

    return hero
  }

  private createAction(
    mixer: THREE.AnimationMixer,
    animations: THREE.AnimationClip[],
    clipName: string,
  ) {
    const clip = animations.find((animation) => animation.name === clipName)
    return clip ? mixer.clipAction(clip) : undefined
  }

  private playHeroState(hero: HeroInstance, state: HeroState, fadeDuration = 0.18) {
    const nextAction = hero.actions[state]

    if (!nextAction || (hero.currentState === state && hero.currentAction)) {
      return
    }

    nextAction.reset()
    nextAction.enabled = true
    nextAction.clampWhenFinished = state === 'death'

    if (state === 'attack' || state === 'death') {
      nextAction.setLoop(THREE.LoopOnce, 1)
    } else {
      nextAction.setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY)
    }

    if (hero.currentAction && fadeDuration > 0) {
      hero.currentAction.crossFadeTo(nextAction, fadeDuration, false)
    }

    nextAction.play()
    hero.currentAction = nextAction
    hero.currentState = state
    this.emitStatus('model')
  }

  private createPlaceholderHero(name: string) {
    const hero = new THREE.Group()
    hero.name = `${name.toLowerCase()}-placeholder`

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.7, 8, 18),
      new THREE.MeshStandardMaterial({ color: 0x3dd6a5, roughness: 0.45 }),
    )
    body.position.y = 0.7
    body.castShadow = true
    hero.add(body)

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 24, 16),
      new THREE.MeshStandardMaterial({ color: 0xf4c95d, roughness: 0.36 }),
    )
    head.position.y = 1.35
    head.castShadow = true
    hero.add(head)

    return hero
  }

  private animate = () => {
    const delta = this.clock.getDelta()
    this.updateControlledHero(delta)
    this.heroes.forEach((hero) => {
      hero.mixer?.update(delta)
      this.pinHeroToAnchor(hero)
    })

    this.renderer.render(this.scene, this.camera)
    this.animationFrame = requestAnimationFrame(this.animate)
  }

  private pinHeroToAnchor(hero: HeroInstance) {
    this.heroBounds.setFromObject(hero.group)
    hero.group.position.x = hero.anchor.x
    hero.group.position.y -= this.heroBounds.min.y
    hero.group.position.z = hero.anchor.z
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
      target.x = THREE.MathUtils.clamp(target.x, -MAP_LIMIT, MAP_LIMIT)
      target.z = THREE.MathUtils.clamp(target.z, -MAP_LIMIT, MAP_LIMIT)
      target.y = 0
      hero.moveTarget = target
    }
  }

  private moveHero(hero: HeroInstance, direction: THREE.Vector3, delta: number) {
    if (!ATTACK_RETURN_STATES.has(hero.currentState)) {
      return
    }

    hero.anchor.addScaledVector(direction, HERO_SPEED * delta)
    hero.anchor.x = THREE.MathUtils.clamp(hero.anchor.x, -MAP_LIMIT, MAP_LIMIT)
    hero.anchor.z = THREE.MathUtils.clamp(hero.anchor.z, -MAP_LIMIT, MAP_LIMIT)
    const targetAngle = Math.atan2(direction.x, direction.z)
    hero.facingAngle = THREE.MathUtils.damp(
      hero.facingAngle,
      targetAngle,
      ROTATION_SMOOTHING,
      delta,
    )
    hero.group.rotation.y = hero.facingAngle
    this.playHeroState(hero, 'run')
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

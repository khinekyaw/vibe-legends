import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

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
  mixer: THREE.AnimationMixer | null
  name: string
}

export class SceneManager {
  private readonly camera: THREE.PerspectiveCamera
  private readonly clock = new THREE.Clock()
  private readonly controlsTarget = new THREE.Vector3(0, 0.8, 0)
  private readonly heroBounds = new THREE.Box3()
  private readonly heroCenter = new THREE.Vector3()
  private readonly heroes: HeroInstance[] = []
  private readonly loader = new GLTFLoader()
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
    window.addEventListener('keydown', this.handleKeyDown)
    this.emitStatus('loading')
    HERO_ASSETS.forEach((asset) => this.loadHeroModel(asset))
    this.animate()
  }

  dispose() {
    cancelAnimationFrame(this.animationFrame)
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

  private loadHeroModel(asset: (typeof HERO_ASSETS)[number]) {
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
        this.heroes.push(heroInstance)
        this.playHeroState(heroInstance, 'idle', 0)
        this.loadedHeroes += 1
        this.emitStatus('model')
      },
      undefined,
      () => {
        const hero = this.createPlaceholderHero(asset.name)
        hero.position.copy(asset.position)
        this.scene.add(hero)
        this.heroes.push({
          actions: {},
          anchor: asset.position.clone(),
          currentAction: null,
          currentState: 'idle',
          group: hero,
          mixer: null,
          name: asset.name,
        })
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
    const center = box.getCenter(new THREE.Vector3())
    const maxDimension = Math.max(size.x, size.y, size.z, 0.001)

    model.position.x -= center.x
    model.position.y -= box.min.y
    model.position.z -= center.z
    hero.scale.setScalar(1.45 / maxDimension)
    hero.rotation.y = Math.PI
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
      group,
      mixer,
      name: asset.name,
    }

    mixer.addEventListener('finished', (event) => {
      if (hero.currentState === 'attack' && event.action === hero.actions.attack) {
        this.playHeroState(hero, 'idle')
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
    this.heroes.forEach((hero) => {
      hero.mixer?.update(delta)
      this.pinHeroToAnchor(hero)
    })

    this.renderer.render(this.scene, this.camera)
    this.animationFrame = requestAnimationFrame(this.animate)
  }

  private pinHeroToAnchor(hero: HeroInstance) {
    this.heroBounds.setFromObject(hero.group)
    this.heroBounds.getCenter(this.heroCenter)
    hero.group.position.x += hero.anchor.x - this.heroCenter.x
    hero.group.position.y -= this.heroBounds.min.y
    hero.group.position.z += hero.anchor.z - this.heroCenter.z
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
      KeyA: 'attack',
      KeyD: 'death',
      KeyI: 'idle',
      KeyR: 'run',
    }
    const nextState = stateByKey[event.code]

    if (nextState) {
      this.playHeroState(selectedHero, nextState)
    }
  }
}

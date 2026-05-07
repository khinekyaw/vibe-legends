import * as THREE from 'three'
import type { HeroAsset, HeroState } from '../core/sceneConfig'

export type HeroInstance = {
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

export function createHeroFromModel(
  asset: HeroAsset,
  model: THREE.Group,
  animations: THREE.AnimationClip[],
  onAttackFinished: (hero: HeroInstance) => void,
) {
  prepareHeroModel(model)

  const heroGroup = new THREE.Group()
  const visual = new THREE.Group()
  heroGroup.name = `${asset.name.toLowerCase()}-model`
  visual.name = `${asset.name.toLowerCase()}-visual`
  visual.add(model)
  heroGroup.add(visual)
  normalizeHero(heroGroup)
  heroGroup.scale.multiplyScalar(getHeroScaleMultiplier(asset.name))
  heroGroup.position.copy(asset.position)

  return createHeroInstance(asset, heroGroup, model, animations, onAttackFinished)
}

function getHeroScaleMultiplier(heroName: string) {
  return heroName === 'Layla' ? 0.8 : 1
}

export function createPlaceholderHero(asset: HeroAsset): HeroInstance {
  const hero = new THREE.Group()
  hero.name = `${asset.name.toLowerCase()}-placeholder`

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

  hero.position.copy(asset.position)

  return {
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
}

export function playHeroState(hero: HeroInstance, state: HeroState, fadeDuration = 0.18) {
  const nextAction = hero.actions[state]

  if (!nextAction || (hero.currentState === state && hero.currentAction)) {
    return false
  }

  nextAction.reset()
  nextAction.enabled = true
  nextAction.clampWhenFinished = state === 'death'

  if (state === 'attack' || state === 'skill1' || state === 'skill2' || state === 'skill3' || state === 'death') {
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

  return true
}

function prepareHeroModel(model: THREE.Group) {
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.frustumCulled = false
      object.castShadow = true
      object.receiveShadow = true
    }
  })
}

function normalizeHero(hero: THREE.Group) {
  const box = new THREE.Box3().setFromObject(hero)
  const size = box.getSize(new THREE.Vector3())
  const visual = hero.children[0]
  const model = visual.children[0] ?? visual
  const pivot = getHeroPivot(hero) ?? box.getCenter(new THREE.Vector3())
  const maxDimension = Math.max(size.x, size.y, size.z, 0.001)

  model.position.x -= pivot.x
  model.position.y -= box.min.y
  model.position.z -= pivot.z
  hero.scale.setScalar(1.45 / maxDimension)
  hero.rotation.y = Math.PI
}

function getHeroPivot(hero: THREE.Group) {
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

function createHeroInstance(
  asset: HeroAsset,
  group: THREE.Group,
  model: THREE.Group,
  animations: THREE.AnimationClip[],
  onAttackFinished: (hero: HeroInstance) => void,
): HeroInstance {
  const mixer = new THREE.AnimationMixer(model)
  const actions = {
    attack: createAction(mixer, animations, asset.clips.attack),
    death: createAction(mixer, animations, asset.clips.death),
    idle: createAction(mixer, animations, asset.clips.idle),
    run: createAction(mixer, animations, asset.clips.run),
    skill1: createAction(mixer, animations, asset.clips.skill1),
    skill2: createAction(mixer, animations, asset.clips.skill2),
    skill3: createAction(mixer, animations, asset.clips.skill3),
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
    if (
      (hero.currentState === 'attack' && event.action === hero.actions.attack) ||
      (hero.currentState === 'skill1' && event.action === hero.actions.skill1) ||
      (hero.currentState === 'skill2' && event.action === hero.actions.skill2) ||
      (hero.currentState === 'skill3' && event.action === hero.actions.skill3)
    ) {
      onAttackFinished(hero)
    }
  })

  return hero
}

function createAction(
  mixer: THREE.AnimationMixer,
  animations: THREE.AnimationClip[],
  clipName: string,
) {
  const clip = animations.find((animation) => animation.name === clipName)
  return clip ? mixer.clipAction(clip) : undefined
}

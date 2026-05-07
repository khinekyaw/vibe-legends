import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

export type MinionState = 'idle' | 'run' | 'attack' | 'death'
export type MinionTeam = 'blue' | 'red'

export type MinionInstance = {
  actions: Partial<Record<MinionState, THREE.AnimationAction>>
  actionLockedUntil: number
  anchor: THREE.Vector3
  currentAction: THREE.AnimationAction | null
  currentState: MinionState
  deadAt: number
  facingAngle: number
  group: THREE.Group
  id: string
  mixer: THREE.AnimationMixer | null
  nextAttackAt: number
  team: MinionTeam
}

const MINION_HEIGHT = 0.675
const clipNames: Record<MinionState, string[]> = {
  attack: ['Attack', 'attack'],
  death: ['Dead', 'Death', 'dead', 'death'],
  idle: ['Walking', 'Idle', 'idle'],
  run: ['Running', 'Walking', 'Run', 'run'],
}

export function createMinionFromModel(
  id: string,
  team: MinionTeam,
  source: THREE.Object3D,
  animations: THREE.AnimationClip[],
  position: THREE.Vector3,
) {
  const model = cloneSkeleton(source) as THREE.Group
  prepareMinionModel(model)

  const group = new THREE.Group()
  const visual = new THREE.Group()
  group.name = id
  visual.name = `${id}-visual`
  visual.add(model)
  group.add(visual)
  normalizeMinion(group)
  group.position.copy(position)

  const mixer = new THREE.AnimationMixer(model)
  const minion = createMinionInstance(id, team, group, mixer, animations, position)
  playMinionState(minion, 'idle', 0)

  return minion
}

export function createPlaceholderMinion(
  id: string,
  team: MinionTeam,
  position: THREE.Vector3,
) {
  const group = new THREE.Group()
  group.name = id

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.09, 0.24, 6, 14),
    new THREE.MeshStandardMaterial({
      color: team === 'blue' ? 0x58d8ff : 0xff6476,
      roughness: 0.5,
    }),
  )
  body.position.y = 0.26
  body.castShadow = true
  group.add(body)
  group.position.copy(position)

  return createMinionInstance(id, team, group, null, [], position)
}

export function playMinionState(minion: MinionInstance, state: MinionState, fadeDuration = 0.14) {
  const nextAction = minion.actions[state]

  if (!nextAction || (minion.currentState === state && minion.currentAction)) {
    minion.currentState = state
    return false
  }

  nextAction.reset()
  nextAction.enabled = true
  nextAction.clampWhenFinished = state === 'death'

  if (state === 'attack' || state === 'death') {
    nextAction.setLoop(THREE.LoopOnce, 1)
  } else {
    nextAction.setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY)
  }

  if (minion.currentAction && fadeDuration > 0) {
    minion.currentAction.crossFadeTo(nextAction, fadeDuration, false)
  }

  nextAction.play()
  minion.currentAction = nextAction
  minion.currentState = state

  return true
}

function createMinionInstance(
  id: string,
  team: MinionTeam,
  group: THREE.Group,
  mixer: THREE.AnimationMixer | null,
  animations: THREE.AnimationClip[],
  position: THREE.Vector3,
): MinionInstance {
  return {
    actions: mixer ? {
      attack: createAction(mixer, animations, clipNames.attack),
      death: createAction(mixer, animations, clipNames.death),
      idle: createAction(mixer, animations, clipNames.idle),
      run: createAction(mixer, animations, clipNames.run),
    } : {},
    actionLockedUntil: 0,
    anchor: position.clone(),
    currentAction: null,
    currentState: 'idle',
    deadAt: 0,
    facingAngle: team === 'blue' ? Math.PI : 0,
    group,
    id,
    mixer,
    nextAttackAt: 0,
    team,
  }
}

function prepareMinionModel(model: THREE.Object3D) {
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.frustumCulled = false
      object.castShadow = true
      object.receiveShadow = true
    }
  })
}

function normalizeMinion(group: THREE.Group) {
  group.updateMatrixWorld(true)

  const box = new THREE.Box3().setFromObject(group)
  const size = box.getSize(new THREE.Vector3())
  const visual = group.children[0]
  const model = visual.children[0] ?? visual
  const center = box.getCenter(new THREE.Vector3())
  const scale = size.y > 0 ? MINION_HEIGHT / size.y : 1

  model.position.x -= center.x
  model.position.y -= box.min.y
  model.position.z -= center.z
  group.scale.setScalar(scale)
  group.rotation.y = Math.PI
}

function createAction(
  mixer: THREE.AnimationMixer,
  animations: THREE.AnimationClip[],
  names: string[],
) {
  const clip = animations.find((animation) => names.includes(animation.name))
  return clip ? mixer.clipAction(clip) : undefined
}

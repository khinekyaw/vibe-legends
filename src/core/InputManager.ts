import * as THREE from 'three'

type PointerCommand = {
  x: number
  y: number
}

export type SkillCommand = 'skill1' | 'skill2' | 'skill3'

const MOVEMENT_KEYS = {
  ArrowDown: new THREE.Vector2(0, -1),
  ArrowLeft: new THREE.Vector2(-1, 0),
  ArrowRight: new THREE.Vector2(1, 0),
  ArrowUp: new THREE.Vector2(0, 1),
  KeyA: new THREE.Vector2(-1, 0),
  KeyD: new THREE.Vector2(1, 0),
  KeyS: new THREE.Vector2(0, -1),
  KeyW: new THREE.Vector2(0, 1),
} as const

export class InputManager {
  private readonly canvas: HTMLCanvasElement
  private readonly movementVector = new THREE.Vector2()
  private readonly virtualMovement = new THREE.Vector2()
  private readonly pressedKeys = new Set<string>()
  private attackQueued = false
  private pointerCommand: PointerCommand | null = null
  private skillCommand: SkillCommand | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('blur', this.handleBlur)
    window.addEventListener('virtual-movement', this.handleVirtualMovement as EventListener)
    window.addEventListener('virtual-attack', this.handleVirtualAttack)
    canvas.addEventListener('pointerdown', this.handlePointerDown)
  }

  dispose() {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('blur', this.handleBlur)
    window.removeEventListener('virtual-movement', this.handleVirtualMovement as EventListener)
    window.removeEventListener('virtual-attack', this.handleVirtualAttack)
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
  }

  getMovementVector() {
    this.movementVector.set(0, 0)

    Object.entries(MOVEMENT_KEYS).forEach(([code, direction]) => {
      if (this.pressedKeys.has(code)) {
        this.movementVector.add(direction)
      }
    })

    if (this.movementVector.lengthSq() === 0 && this.virtualMovement.lengthSq() > 0) {
      this.movementVector.copy(this.virtualMovement)
    }

    if (this.movementVector.lengthSq() > 1) {
      this.movementVector.normalize()
    }

    return this.movementVector
  }

  getAttackCommand() {
    const shouldAttack = this.attackQueued || this.pressedKeys.has('Space')
    this.attackQueued = false
    return shouldAttack
  }

  consumePointerCommand() {
    const command = this.pointerCommand
    this.pointerCommand = null
    return command
  }

  consumeSkillCommand() {
    const command = this.skillCommand
    this.skillCommand = null
    return command
  }

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'Space' && !event.repeat) {
      event.preventDefault()
      this.attackQueued = true
    }

    if (!event.repeat) {
      const skillByKey: Partial<Record<string, SkillCommand>> = {
        KeyE: 'skill2',
        KeyQ: 'skill1',
        KeyR: 'skill3',
      }

      const skillCommand = skillByKey[event.code]

      if (skillCommand) {
        event.preventDefault()
        this.skillCommand = skillCommand
      }
    }

    this.pressedKeys.add(event.code)
  }

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code)
  }

  private readonly handleBlur = () => {
    this.pressedKeys.clear()
    this.pointerCommand = null
    this.virtualMovement.set(0, 0)
  }

  private readonly handleVirtualMovement = (event: CustomEvent<{ x: number; y: number }>) => {
    this.virtualMovement.set(event.detail.x, event.detail.y)
  }

  private readonly handleVirtualAttack = () => {
    this.attackQueued = true
  }

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return
    }

    const bounds = this.canvas.getBoundingClientRect()
    this.pointerCommand = {
      x: ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      y: -(((event.clientY - bounds.top) / bounds.height) * 2 - 1),
    }
  }
}

import * as THREE from 'three'
import type { HeroInstance } from '../entities/HeroModel'
import { getHeroForward } from './CombatSystem'

type AnimatedEffect = THREE.Object3D & {
  userData: {
    baseOpacity?: number
    baseScale?: THREE.Vector3
    createdAt: number
    duration: number
    end?: THREE.Vector3
    kind: 'beam' | 'burst' | 'projectile' | 'pulse' | 'slash' | 'vortex'
    start?: THREE.Vector3
  }
}

const up = new THREE.Vector3(0, 1, 0)

export class CombatEffects {
  readonly group = new THREE.Group()

  constructor() {
    this.group.name = 'combat-effects'
  }

  update(now: number) {
    ;[...this.group.children].forEach((object) => {
      const effect = object as AnimatedEffect
      const { createdAt, duration, kind } = effect.userData

      if (!createdAt || !duration) {
        return
      }

      const progress = THREE.MathUtils.clamp((now - createdAt) / duration, 0, 1)

      if (kind === 'projectile') {
        this.updateProjectile(effect, progress)
      } else if (kind === 'pulse') {
        this.updatePulse(effect, progress)
      } else if (kind === 'slash') {
        this.updateSlash(effect, progress)
      } else if (kind === 'vortex') {
        this.updateVortex(effect, progress)
      } else if (kind === 'beam') {
        this.updateBeam(effect, progress)
      } else if (kind === 'burst') {
        this.updateBurst(effect, progress)
      }

      if (progress >= 1) {
        if (kind === 'projectile' && effect.userData.end) {
          this.createBurst(effect.userData.end, 0.82, this.getEffectColor(effect), 0.24)
        }

        object.removeFromParent()
        this.disposeObject(object)
      }
    })
  }

  createCircle(center: THREE.Vector3, radius: number, color: number, duration: number) {
    this.createGroundPulse(center, radius, color, duration)
  }

  createForward(
    hero: HeroInstance,
    range: number,
    width: number,
    color: number,
    duration: number,
  ) {
    this.createForwardSlash(hero, range, width, color, duration)
  }

  createLine(from: THREE.Vector3, to: THREE.Vector3, color: number, duration: number) {
    this.createBeam(from, to, color, duration)
  }

  createProjectile(
    from: THREE.Vector3,
    to: THREE.Vector3,
    color: number,
    duration = 0.34,
    radius = 0.16,
  ) {
    const start = from.clone()
    const end = to.clone()
    start.y = Math.max(start.y, 0.85)
    end.y = Math.max(end.y, 0.85)

    if (end.distanceTo(start) === 0) {
      this.createBurst(end, radius * 3.5, color, 0.22)
      return
    }

    const projectile = new THREE.Group() as unknown as AnimatedEffect
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 12),
      this.createMaterial(color, 0.95),
    )
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.9, 20, 12),
      this.createMaterial(color, 0.24),
    )
    projectile.add(halo, core)
    projectile.position.copy(start)
    projectile.userData = {
      createdAt: performance.now() / 1000,
      duration,
      end,
      kind: 'projectile',
      start,
    }

    this.group.add(projectile)
  }

  createGroundPulse(center: THREE.Vector3, radius: number, color: number, duration: number) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.04, 10, 72),
      this.createMaterial(color, 0.68),
    ) as unknown as AnimatedEffect

    ring.position.set(center.x, 0.11, center.z)
    ring.rotation.x = Math.PI / 2
    ring.userData = {
      baseScale: ring.scale.clone(),
      createdAt: performance.now() / 1000,
      duration,
      kind: 'pulse',
    }
    this.group.add(ring)
  }

  createForwardSlash(
    hero: HeroInstance,
    range: number,
    width: number,
    color: number,
    duration: number,
  ) {
    const forward = getHeroForward(hero)
    const center = hero.anchor.clone().addScaledVector(forward, range / 2)
    const slash = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.18, range),
      this.createMaterial(color, 0.46),
    ) as unknown as AnimatedEffect

    slash.position.set(center.x, 0.24, center.z)
    slash.rotation.y = hero.facingAngle
    slash.userData = {
      baseScale: slash.scale.clone(),
      createdAt: performance.now() / 1000,
      duration,
      kind: 'slash',
    }
    this.group.add(slash)
  }

  createVortex(center: THREE.Vector3, radius: number, color: number, duration: number) {
    const vortex = new THREE.Group() as unknown as AnimatedEffect

    for (let index = 0; index < 3; index += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius * (0.54 + index * 0.22), 0.035, 8, 64),
        this.createMaterial(color, 0.42 - index * 0.08),
      )
      ring.rotation.x = Math.PI / 2
      ring.position.y = 0.1 + index * 0.2
      ring.userData.spin = index % 2 === 0 ? 1 : -1
      vortex.add(ring)
    }

    vortex.position.set(center.x, 0.08, center.z)
    vortex.userData = {
      baseScale: vortex.scale.clone(),
      createdAt: performance.now() / 1000,
      duration,
      kind: 'vortex',
    }
    this.group.add(vortex)
  }

  createBurst(center: THREE.Vector3, radius: number, color: number, duration: number) {
    const burst = new THREE.Group() as unknown as AnimatedEffect
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.05, 10, 72),
      this.createMaterial(color, 0.72),
    )
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.48, 20, 12),
      this.createMaterial(color, 0.24),
    )

    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.12
    flash.position.y = 0.24
    burst.position.set(center.x, 0.06, center.z)
    burst.add(ring, flash)
    burst.userData = {
      baseScale: burst.scale.clone(),
      createdAt: performance.now() / 1000,
      duration,
      kind: 'burst',
    }
    this.group.add(burst)
  }

  createBeam(from: THREE.Vector3, to: THREE.Vector3, color: number, duration: number) {
    const start = from.clone()
    const end = to.clone()
    start.y = Math.max(start.y, 0.7)
    end.y = Math.max(end.y, 0.7)
    const direction = end.clone().sub(start)
    const length = direction.length()

    if (length === 0) {
      return
    }

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, length, 16),
      this.createMaterial(color, 0.68),
    ) as unknown as AnimatedEffect

    beam.position.copy(start.clone().add(end).multiplyScalar(0.5))
    beam.quaternion.setFromUnitVectors(up, direction.normalize())
    beam.userData = {
      baseScale: beam.scale.clone(),
      createdAt: performance.now() / 1000,
      duration,
      kind: 'beam',
    }
    this.group.add(beam)
  }

  private updateProjectile(effect: AnimatedEffect, progress: number) {
    if (!effect.userData.start || !effect.userData.end) {
      return
    }

    effect.position.lerpVectors(effect.userData.start, effect.userData.end, progress)
    effect.position.y += Math.sin(progress * Math.PI) * 0.55
    effect.rotation.y += 0.26
    effect.rotation.z += 0.16
    this.setOpacity(effect, 1 - progress * 0.18)
  }

  private updatePulse(effect: AnimatedEffect, progress: number) {
    const scale = 0.72 + progress * 0.55
    effect.scale.set(scale, scale, scale)
    effect.rotation.z += 0.04
    this.setOpacity(effect, 1 - progress)
  }

  private updateSlash(effect: AnimatedEffect, progress: number) {
    effect.scale.x = 0.65 + progress * 0.7
    effect.scale.z = 0.22 + progress * 0.95
    this.setOpacity(effect, 1 - progress)
  }

  private updateVortex(effect: AnimatedEffect, progress: number) {
    effect.scale.setScalar(0.74 + progress * 0.42)
    effect.children.forEach((child) => {
      child.rotation.z += 0.075 * (child.userData.spin ?? 1)
    })
    this.setOpacity(effect, 1 - progress * 0.72)
  }

  private updateBeam(effect: AnimatedEffect, progress: number) {
    const pulse = 1 + Math.sin(progress * Math.PI * 5) * 0.22
    effect.scale.x = pulse
    effect.scale.z = pulse
    this.setOpacity(effect, 1 - progress)
  }

  private updateBurst(effect: AnimatedEffect, progress: number) {
    effect.scale.setScalar(0.66 + progress * 0.72)
    this.setOpacity(effect, 1 - progress)
  }

  private createMaterial(color: number, opacity: number) {
    const material = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity,
      transparent: true,
    })
    material.userData.baseOpacity = opacity
    return material
  }

  private setOpacity(object: THREE.Object3D, opacityMultiplier: number) {
    object.traverse((descendant) => {
      if (!(descendant instanceof THREE.Mesh)) {
        return
      }

      const materials = Array.isArray(descendant.material)
        ? descendant.material
        : [descendant.material]

      materials.forEach((material) => {
        if ('opacity' in material) {
          material.opacity = (material.userData.baseOpacity ?? 1) * opacityMultiplier
        }
      })
    })
  }

  private getEffectColor(object: THREE.Object3D) {
    let color = 0xffffff

    object.traverse((descendant) => {
      if (!(descendant instanceof THREE.Mesh)) {
        return
      }

      const material = Array.isArray(descendant.material)
        ? descendant.material[0]
        : descendant.material

      if (material && 'color' in material && material.color instanceof THREE.Color) {
        color = material.color.getHex()
      }
    })

    return color
  }

  private disposeObject(object: THREE.Object3D) {
    object.traverse((descendant) => {
      if (!(descendant instanceof THREE.Mesh)) {
        return
      }

      descendant.geometry.dispose()
      const materials = Array.isArray(descendant.material)
        ? descendant.material
        : [descendant.material]
      materials.forEach((material) => material.dispose())
    })
  }
}

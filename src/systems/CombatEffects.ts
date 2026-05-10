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
    followHero?: HeroInstance
    kind: 'beam' | 'burst' | 'projectile' | 'pulse' | 'range-circle' | 'slash' | 'vortex'
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
      } else if (kind === 'range-circle') {
        this.updateRangeCircle(effect)
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

  createHeroRangeCircle(hero: HeroInstance, radius: number, color: number, duration: number) {
    this.removeHeroRangeCircle(hero)

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.035, 10, 96),
      this.createMaterial(color, 0.72),
    ) as unknown as AnimatedEffect

    ring.position.set(hero.anchor.x, 0.11, hero.anchor.z)
    ring.rotation.x = Math.PI / 2
    ring.userData = {
      createdAt: performance.now() / 1000,
      duration,
      followHero: hero,
      kind: 'range-circle',
    }
    this.group.add(ring)
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

    const direction = end.clone().sub(start).normalize()
    const projectile = new THREE.Group() as unknown as AnimatedEffect
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 1),
      this.createMaterial(color, 1),
    )
    core.userData.isCore = true
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.9, 20, 12),
      this.createMaterial(color, 0.28),
    )
    const outerHalo = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 3.2, 16, 10),
      this.createMaterial(color, 0.1),
    )
    const trail = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.15, radius * 1.4, radius * 8, 12, 1, true),
      this.createMaterial(color, 0.42),
    )
    trail.quaternion.setFromUnitVectors(up, direction.clone().negate())
    trail.position.copy(direction.clone().multiplyScalar(-radius * 4))
    const flareA = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 6, radius * 0.18, radius * 0.18),
      this.createMaterial(color, 0.55),
    )
    flareA.userData.isCore = true
    const flareB = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.18, radius * 0.18, radius * 6),
      this.createMaterial(color, 0.55),
    )
    flareB.userData.isCore = true
    projectile.add(outerHalo, halo, trail, core, flareA, flareB)
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
    const pulse = new THREE.Group() as unknown as AnimatedEffect
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.05, 12, 80),
      this.createMaterial(color, 0.78),
    )
    ring.rotation.x = Math.PI / 2
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.78, 0.025, 10, 72),
      this.createMaterial(color, 0.44),
    )
    innerRing.rotation.x = Math.PI / 2
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 64),
      this.createMaterial(color, 0.16),
    )
    disk.rotation.x = -Math.PI / 2
    disk.position.y = 0.005
    pulse.add(disk, innerRing, ring)
    pulse.position.set(center.x, 0.11, center.z)
    pulse.userData = {
      baseScale: pulse.scale.clone(),
      createdAt: performance.now() / 1000,
      duration,
      kind: 'pulse',
    }
    this.group.add(pulse)
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
    const slash = new THREE.Group() as unknown as AnimatedEffect

    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.16, range),
      this.createMaterial(color, 0.5),
    )
    const innerCore = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.55, 0.18, range * 0.96),
      this.createMaterial(color, 0.78),
    )
    const tipFlare = new THREE.Mesh(
      new THREE.SphereGeometry(width * 0.55, 18, 10),
      this.createMaterial(color, 0.4),
    )
    tipFlare.scale.set(1.4, 0.2, 0.6)
    tipFlare.position.z = range / 2
    const trailingFlare = new THREE.Mesh(
      new THREE.SphereGeometry(width * 0.4, 16, 8),
      this.createMaterial(color, 0.32),
    )
    trailingFlare.scale.set(1.1, 0.18, 0.5)
    trailingFlare.position.z = -range / 2 + width * 0.2

    slash.add(blade, innerCore, tipFlare, trailingFlare)
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

    for (let index = 0; index < 5; index += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius * (0.5 + index * 0.16), 0.04, 8, 72),
        this.createMaterial(color, 0.5 - index * 0.07),
      )
      ring.rotation.x = Math.PI / 2
      ring.rotation.z = (index / 5) * Math.PI * 0.4
      ring.position.y = 0.08 + index * 0.18
      ring.userData.spin = index % 2 === 0 ? 1 : -1
      vortex.add(ring)
    }

    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.18, radius * 0.42, radius * 1.6, 16, 1, true),
      this.createMaterial(color, 0.3),
    )
    column.position.y = radius * 0.8
    column.userData.isColumn = true
    vortex.add(column)

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.22, 16, 12),
      this.createMaterial(color, 0.55),
    )
    core.position.y = radius * 0.4
    vortex.add(core)

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
      new THREE.TorusGeometry(radius, 0.06, 12, 80),
      this.createMaterial(color, 0.85),
    )
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.62, 0.03, 8, 64),
      this.createMaterial(color, 0.5),
    )
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.55, 22, 14),
      this.createMaterial(color, 0.32),
    )
    const flashCore = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.28, 16, 10),
      this.createMaterial(color, 0.7),
    )
    const beamUp = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.1, radius * 0.25, radius * 1.6, 12, 1, true),
      this.createMaterial(color, 0.32),
    )

    ring.rotation.x = Math.PI / 2
    innerRing.rotation.x = Math.PI / 2
    ring.position.y = 0.12
    innerRing.position.y = 0.16
    flash.position.y = 0.24
    flashCore.position.y = 0.24
    beamUp.position.y = radius * 0.8

    burst.position.set(center.x, 0.06, center.z)
    burst.add(ring, innerRing, flash, flashCore, beamUp)
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

    const beam = new THREE.Group() as unknown as AnimatedEffect
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, length, 12),
      this.createMaterial(color, 0.95),
    )
    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, length, 16),
      this.createMaterial(color, 0.55),
    )
    const halo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, length, 18),
      this.createMaterial(color, 0.22),
    )
    beam.add(halo, inner, core)

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
    effect.children.forEach((child) => {
      if (child.userData.isCore) {
        child.rotation.y += 0.34
        child.rotation.z += 0.22
      }
    })
    this.setOpacity(effect, 1 - progress * 0.2)
  }

  private updatePulse(effect: AnimatedEffect, progress: number) {
    const scale = 0.6 + progress * 0.85
    effect.scale.set(scale, scale, scale)
    effect.rotation.y += 0.02
    this.setOpacity(effect, Math.pow(1 - progress, 1.4))
  }

  private updateSlash(effect: AnimatedEffect, progress: number) {
    effect.scale.x = 0.55 + progress * 0.85
    effect.scale.z = 0.2 + progress * 1.05
    effect.scale.y = 1 + Math.sin(progress * Math.PI) * 0.4
    this.setOpacity(effect, Math.pow(1 - progress, 1.4))
  }

  private updateVortex(effect: AnimatedEffect, progress: number) {
    effect.scale.setScalar(0.7 + progress * 0.5)
    effect.children.forEach((child) => {
      if (child.userData.isColumn) {
        child.rotation.y += 0.08
        return
      }
      child.rotation.z += 0.09 * (child.userData.spin ?? 1)
    })
    this.setOpacity(effect, 1 - progress * 0.78)
  }

  private updateBeam(effect: AnimatedEffect, progress: number) {
    const pulse = 1 + Math.sin(progress * Math.PI * 6) * 0.28
    effect.scale.x = pulse
    effect.scale.z = pulse
    effect.children.forEach((child, index) => {
      child.rotation.y += 0.06 * (index + 1)
    })
    this.setOpacity(effect, Math.pow(1 - progress, 1.5))
  }

  private updateBurst(effect: AnimatedEffect, progress: number) {
    effect.scale.setScalar(0.5 + progress * 1.05)
    effect.rotation.y += 0.05
    this.setOpacity(effect, Math.pow(1 - progress, 1.6))
  }

  private updateRangeCircle(effect: AnimatedEffect) {
    const hero = effect.userData.followHero

    if (!hero) {
      return
    }

    effect.position.set(hero.anchor.x, 0.11, hero.anchor.z)
  }

  private removeHeroRangeCircle(hero: HeroInstance) {
    ;[...this.group.children].forEach((object) => {
      const effect = object as AnimatedEffect

      if (effect.userData.kind !== 'range-circle' || effect.userData.followHero !== hero) {
        return
      }

      object.removeFromParent()
      this.disposeObject(object)
    })
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

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createHeroFromModel, playHeroState } from '../entities/HeroModel'
import { HERO_ASSETS } from '../core/sceneConfig'

type HeroPreviewProps = {
  heroName: string
}

export function HeroPreview({ heroName }: HeroPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const frame = frameRef.current
    const asset = HERO_ASSETS.find((heroAsset) => heroAsset.name === heroName) ?? HERO_ASSETS[0]

    if (!canvas || !frame) {
      return
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111923)

    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 30)
    camera.position.set(0, 1.45, 5.2)
    camera.lookAt(0, 0.82, 0)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      canvas,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const previewRoot = new THREE.Group()
    scene.add(previewRoot)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x314050, 2.4))

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.7)
    keyLight.position.set(2.5, 4, 3.5)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 1.2)
    fillLight.position.set(-3, 2, -2)
    scene.add(fillLight)

    let disposed = false
    let animationFrame = 0
    let mixer: THREE.AnimationMixer | null = null

    const resize = () => {
      const width = Math.max(frame.clientWidth, 1)
      const height = Math.max(frame.clientHeight, 1)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(frame)
    resize()

    const loader = new GLTFLoader()
    loader.load(
      asset.url,
      (gltf) => {
        if (disposed) {
          return
        }

        const hero = createHeroFromModel(asset, gltf.scene, gltf.animations, () => undefined)
        hero.anchor.set(0, 0, 0)
        hero.group.position.set(0, 0, 0)
        hero.group.rotation.y = 0
        hero.group.scale.multiplyScalar(1.65)
        previewRoot.add(hero.group)
        mixer = hero.mixer
        playHeroState(hero, 'idle', 0)
      },
      undefined,
      () => undefined,
    )

    const clock = new THREE.Clock()
    const animate = () => {
      const delta = clock.getDelta()
      mixer?.update(delta)
      previewRoot.rotation.y += delta * 0.45
      renderer.render(scene, camera)
      animationFrame = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      disposed = true
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      renderer.dispose()
    }
  }, [heroName])

  return (
    <div className="hero-preview-frame" ref={frameRef}>
      <canvas ref={canvasRef} />
    </div>
  )
}

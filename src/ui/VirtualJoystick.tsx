import { useEffect, useRef, useState } from 'react'

const DEAD_ZONE = 0.18

function dispatchMovement(x: number, y: number) {
  window.dispatchEvent(new CustomEvent('virtual-movement', { detail: { x, y } }))
}

export function VirtualJoystick() {
  const baseRef = useRef<HTMLDivElement | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const baseRectRef = useRef<DOMRect | null>(null)
  const [active, setActive] = useState(false)
  const [stick, setStick] = useState({ x: 0, y: 0 })

  useEffect(() => {
    return () => dispatchMovement(0, 0)
  }, [])

  const updateFromPointer = (clientX: number, clientY: number) => {
    const rect = baseRectRef.current
    if (!rect) return
    const radius = rect.width / 2
    const cx = rect.left + radius
    const cy = rect.top + radius
    let dx = clientX - cx
    let dy = clientY - cy
    const distance = Math.hypot(dx, dy)
    if (distance > radius) {
      dx = (dx / distance) * radius
      dy = (dy / distance) * radius
    }
    setStick({ x: dx, y: dy })
    const nx = dx / radius
    const ny = -dy / radius
    const magnitude = Math.hypot(nx, ny)
    if (magnitude < DEAD_ZONE) {
      dispatchMovement(0, 0)
    } else {
      const scale = (magnitude - DEAD_ZONE) / (1 - DEAD_ZONE)
      const factor = scale / magnitude
      dispatchMovement(nx * factor, ny * factor)
    }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null) return
    pointerIdRef.current = event.pointerId
    baseRectRef.current = baseRef.current?.getBoundingClientRect() ?? null
    event.currentTarget.setPointerCapture(event.pointerId)
    setActive(true)
    updateFromPointer(event.clientX, event.clientY)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerIdRef.current) return
    updateFromPointer(event.clientX, event.clientY)
  }

  const reset = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerIdRef.current) return
    pointerIdRef.current = null
    baseRectRef.current = null
    setActive(false)
    setStick({ x: 0, y: 0 })
    dispatchMovement(0, 0)
  }

  return (
    <div
      aria-label="Movement joystick"
      className={`virtual-joystick${active ? ' active' : ''}`}
      onPointerCancel={reset}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={reset}
      ref={baseRef}
      role="application"
    >
      <div className="virtual-joystick-base" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="virtual-joystick-stick"
        style={{ transform: `translate(calc(-50% + ${stick.x}px), calc(-50% + ${stick.y}px))` }}
      />
    </div>
  )
}

# Mobile Legend Clone — Build Plan

> A phased roadmap from zero to a playable MOBA prototype on the web.
> We start simple (rendering two characters) and layer complexity milestone by milestone.

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Renderer | Three.js | Three.js for 3D |
| Physics | Rapier.js (WASM) | Fast broad + narrow phase; or hand-roll AABB for early phases |
| Networking | Socket.io + Node.js | Authoritative server at ~20Hz tick rate |
| Build tool | Vite | Fast HMR, easy GLTF/asset pipeline |
| Language | TypeScript | Strongly typed game state = fewer runtime bugs |

---

## Characters

For now, the game ships with **2 heroes** only. Each hero has:
- A GLTF/GLB model with skeleton
- Animation clips: `idle`, `run`, `attack`, `death`
- 2 unique skills with cooldowns
- A circle collider radius

---

## Phase 1 — Rendering & Animation

> Goal: Get both characters visible on screen and animating correctly.

### M1 — Static character render
- Set up a Three.js canvas
- Load one `.glb` model using `GLTFLoader`
- Add a `PerspectiveCamera` and basic `DirectionalLight` + `AmbientLight`
- Confirm the model is visible with correct scale and orientation

### M2 — Skeleton animations
- Attach an `AnimationMixer` to the loaded model
- Load and play `idle`, `run`, `attack`, `death` clips
- Implement crossfade blending between clips (`crossFadeTo`)
- Test each clip in isolation via keyboard shortcuts

### M3 — Two characters, independent state
- Instantiate both heroes in the same scene
- Each hero owns its own `AnimationMixer` and animation state machine
- State machine handles: `IDLE → RUN → ATTACK → DEATH`
- Confirm neither hero's state bleeds into the other

---

## Phase 2 — Input & Movement

> Goal: Make one hero fully controllable on a flat plane.

### M4 — Keyboard / virtual joystick input
- Build an `InputManager` singleton
- Support WASD keys for directional movement
- Support left-click / tap for click-to-move (raycast to ground plane)
- Abstract into `getMovementVector(): Vector2` and `getAttackCommand(): boolean`

### M5 — Movement on plane + facing direction
- Each frame, apply `velocity = movementVector * speed * delta`
- Translate hero position on the XZ plane (3D) or XY plane (2D)
- Rotate the mesh to face the velocity direction (use `lookAt` or `Math.atan2`)
- Clamp movement within map bounds

### M6 — Animation driven by movement state
- If `velocity.length() > threshold` → crossfade to `run` clip
- If stationary → crossfade back to `idle` clip
- Trigger `attack` clip on attack command, then return to `idle`/`run`

---

## Phase 3 — Map Rendering

> Goal: Build the arena the characters inhabit.

Implementation note: Phase 3 originally used `public/assets/models/map/model.glb`, but Phase 7 replaces it with a modular single-lane Brawl-style bridge map made from primitive geometry.

### M7 — Flat tilemap arena
- Create a ground plane mesh or render a grid of tiles
- Switch camera to top-down isometric rig (45° pitch, fixed zoom)
- Add a skybox or solid background color

### M8 — Character walks on map, camera follows
- Project character position to map surface (Y = 0 in 3D)
- Lerp camera target to hero position each frame
- Add map boundary walls (invisible collision blockers)

### M9 — Static props (trees, walls, towers)
- Place static GLTF meshes: trees, wall segments, base towers
- No collision yet — purely visual
- Organise scene into logical groups: `environment`, `characters`, `ui`

---

## Phase 4 — Collision & Physics

> Goal: Make the world solid. No more walking through walls.

### M10 — Wall collision (AABB)
- Define axis-aligned bounding boxes for each wall tile/prop
- Each frame, check hero AABB against all wall AABBs
- Resolve overlap by pushing hero out on the shallowest axis
- Visualise colliders in a debug mode (toggle with `F1`)

### M11 — Character vs character collision
- Give each hero a **circle collider** with a defined radius
- On overlap between two heroes, compute push vector and separate them
- Ensure collision response is frame-rate independent

### M12 — Spatial grid (broad-phase optimisation)
- Divide the map into a grid of cells (e.g. 64×64 px cells)
- Each frame, insert colliders into their cell(s)
- Only check collisions between objects in the same or adjacent cells
- Benchmark: should handle 50+ objects at 60fps before optimising further

---

## Phase 5 — Combat System

> Goal: Skills, damage, health, and death. It becomes a game here.

### M13 — Basic attack + hitbox
- On the `attack` animation's keyframe event, spawn a **hitbox** (AABB or circle)
- Hitbox lives for N milliseconds, then is destroyed
- Check hitbox overlap against enemy collider
- On hit: apply damage, play hit particle effect, flash enemy red

### M14 — Health bar UI + death state
- Render a world-space health bar above each hero's head (CSS overlay projected from 3D)
- HP bar updates smoothly on damage (lerped bar width)
- At 0 HP: play `death` animation, remove collider, start respawn timer (e.g. 5s)
- After respawn: reset HP, re-enable collider, teleport to base

### M15 — Hero skills + cooldowns
- Each hero has one basic attack and 3 active skills mapped to their available GLB clips
- `Skill` interface: `{ name, cooldown, range, damage, effect, activate() }`
- Skills bound to `Q`, `E`, and `R` keys (or HUD buttons on mobile)
- Cooldown shown as an overlay on bottom-right skill image buttons

**Alice prototype kit:**
- Basic attack: target-locked ranged magic hit
- Skill 1 (Q): Crimson Gleam / Flowing Blood-style blood projectile; recast blinks Alice to the orb
- Skill 2 (E): Doom Waltz AoE damage with slow
- Skill 3 (R): Throne of Ruin delayed AoE impact with immobilize

**Ruby prototype kit:**
- Basic attack: target-locked short-range scythe hit
- Skill 1 (Q): Be Good! forward slash and shockwave with slow
- Skill 2 (E): Don't Run, Wolf King! AoE stun and pull
- Skill 3 (R): I'm Offended! forward sweep that pulls and stuns

Implementation note: current Phase 5 combat uses temporary colored geometry for hitboxes/VFX. Replace with supplied skill icons, particles, SFX, and MLBB-like visual assets when available.

---

## Phase 6 — Multiplayer (Real-time)

> Goal: Two players in the same match over the network.

### M16 — WebSocket server + authoritative state
- Set up a Node.js server with Socket.io
- Server runs a game loop at **~20Hz** (50ms tick)
- Server holds the authoritative `GameState`: positions, HP, skills, events
- Clients send **input commands** (not positions) to the server
- Server broadcasts state snapshots to all clients
- Clients **interpolate** between received snapshots (render at `now - 100ms`)
- Implement basic **lag compensation** for hit detection

**Key concepts to implement:**
- Client-side prediction (apply input immediately, reconcile on server ack)
- Entity interpolation (smooth movement between server ticks)
- Room system: 2 players per room, simple matchmaking queue

---

## Phase 7 — Polish & HUD

> Goal: A complete, playable match loop with visual feedback.

### M17 — Modular objective structures
- Skip Phase 6 multiplayer for now and add local objective layout first
- Replace the complex GLB arena with a simpler Mobile Legends Brawl-style single-lane bridge map
- Keep floor tiles, side walls, bridge edges, void backdrop, towers, and bases as separate named modules so textures/materials can be swapped later
- Add 2 lane-aligned towers and 1 base for each side
- Keep structures modular and data-driven so positions, teams, and visuals can be changed when the map changes
- Use `tower1.glb`, `tower2.glb`, and `nexus.glb` from `public/assets/models/map` for objective visuals, with cylinder fallbacks if an asset fails to load
- Rotate objective models by team side so tower fronts face into the lane instead of reusing one baked orientation
- Add simple wall/objective colliders so heroes cannot walk through bridge sides, towers, or bases; towers use smaller circular colliders for smoother movement around them

### M18 — Minimap, kill feed, skill HUD
- **Minimap**: Canvas 2D overlay in corner, dots for each hero, map outline
- **Fog of war**: Mask minimap outside your hero's vision radius
- **Kill feed**: Sliding notification panel (e.g. "Hero A killed Hero B")
- **Skill HUD**: Bottom-centre bar with portrait, HP bar, skill icons + cooldowns
- **Respawn timer**: Countdown shown over dead hero's portrait
- **Match end screen**: First to N kills wins — show result overlay

---

## File Structure (suggested)

```
/src
  /core
    GameLoop.ts          # requestAnimationFrame loop, delta time
    InputManager.ts      # keyboard + mouse/touch abstraction
    SceneManager.ts      # Three.js scene, camera, renderer setup
  /entities
    Hero.ts              # base class: model, collider, HP, state machine
    Hero1.ts             # hero 1 — skills, stats
    Hero2.ts             # hero 2 — skills, stats
    Projectile.ts        # skill projectiles
    Hitbox.ts            # temporary damage zones
  /systems
    CollisionSystem.ts   # spatial grid + AABB/circle resolution
    CombatSystem.ts      # damage, death, respawn
    AnimationSystem.ts   # drives AnimationMixer per entity
    NetworkSystem.ts     # socket.io client, snapshot buffer, interpolation
  /map
    MapLoader.ts         # loads tilemap + static props
    Camera.ts            # top-down rig, lerp follow
  /ui
    HUD.ts               # Canvas 2D overlay: HP bars, skills, minimap
    KillFeed.ts
  /server
    index.ts             # Node.js + Socket.io server
    GameRoom.ts          # authoritative game state per room
    GameLoop.ts          # server-side 20Hz tick
  /assets
    /models              # .glb files for heroes + props
    /textures
    /audio
```

---

## Milestone Summary

| # | Milestone | Phase | Complexity |
|---|---|---|---|
| M1 | Static character render | Rendering | ⬜ Low |
| M2 | Skeleton animations | Rendering | ⬜ Low |
| M3 | Two characters, independent state | Rendering | ⬜ Low |
| M4 | Keyboard / virtual joystick input | Input | 🟨 Medium |
| M5 | Movement on plane + facing direction | Input | 🟨 Medium |
| M6 | Animation driven by movement state | Input | ⬜ Low |
| M7 | Flat tilemap arena | Map | 🟨 Medium |
| M8 | Character walks on map, camera follows | Map | 🟨 Medium |
| M9 | Static props | Map | ⬜ Low |
| M10 | Wall collision (AABB) | Collision | 🟨 Medium |
| M11 | Character vs character collision | Collision | 🟨 Medium |
| M12 | Spatial grid broad-phase | Collision | 🟧 High |
| M13 | Basic attack + hitbox | Combat | 🟨 Medium |
| M14 | Health bar UI + death state | Combat | 🟨 Medium |
| M15 | 2 unique skills per hero | Combat | 🟧 High |
| M16 | WebSocket server + multiplayer | Network | 🟥 Very High |
| M17 | Minimap, kill feed, skill HUD | Polish | 🟧 High |

---

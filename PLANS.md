# Mobile Legend Clone — Build Plan

> A phased roadmap from zero to a playable MOBA prototype on the web.
> We start simple (rendering two characters) and layer complexity milestone by milestone.

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Renderer | Three.js | Three.js for 3D |
| Physics | Rapier.js (WASM) | Fast broad + narrow phase; or hand-roll AABB for early phases |
| Build tool | Vite | Fast HMR, easy GLTF/asset pipeline |
| Language | TypeScript | Strongly typed game state = fewer runtime bugs |

---

## Current Progress

The active prototype is now a **local single-player MOBA lane**. Multiplayer is removed from the active roadmap for now.

Implemented:
- Three.js scene, camera follow, GLB hero loading, animation state playback, and placeholder fallbacks.
- Keyboard movement, click-to-move, basic attacks, skills, cooldowns, damage, death, and respawn.
- Modular Brawl-style single-lane map with floor/wall textures, objective colliders, towers, and nexuses.
- Player side is blue/bottom-left by default. The player chooses Alice, Ruby, or Layla at match start.
- Enemy side is red/top-right. The unselected hero spawns at the enemy base and stays idle until simple AI is added.
- Player and enemy spawn at their own base on game start and after death.
- Tower and nexus health bars render in world space without objective name labels.
- Towers and nexuses auto-fire at enemy heroes in range.
- Player basic attacks can damage enemy towers and the enemy nexus.
- Minion waves spawn 3 smaller minions per team, use `public/assets/models/minion/model.glb`, show health bars, move down lane, and basic attack enemy minions, heroes, and objectives.
- The red-side enemy hero has simple local AI: move down lane, steer around objective colliders, acquire enemies/objectives, and basic attack when in range.
- HUD includes player HP, enemy HP, skill buttons, respawn countdown, kill count, minimap, and win/lose overlay.
- Temporary 3D combat VFX cover tower shots, Alice projectiles, Ruby slashes, Layla energy shots, AoE pulses, and impact bursts.
- Destroying the enemy nexus shows Victory. Destroying the player nexus shows Defeat.

Next:
- Tune minion/hero AI priorities, wave timing, attack timing, and combat balance after playtesting.
- Add kill feed and HUD polish.

Deferred:
- Multiplayer, matchmaking, authoritative server state, network interpolation, and lag compensation.

## Characters

For now, the game ships with **3 heroes**. Each hero has:
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

**Layla prototype kit:**
- Basic attack: target-locked ranged energy shot
- Skill 1 (Q): Malefic Bomb long projectile shot
- Skill 2 (E): Void Projectile ranged AoE impact with slow
- Skill 3 (R): Destruction Rush long forward blast

Implementation note: current Phase 5 combat uses temporary colored geometry for hitboxes/VFX. Replace with supplied skill icons, particles, SFX, and MLBB-like visual assets when available.

---

## Phase 6 — Local Match Loop, Polish & HUD

> Goal: A complete, playable match loop with visual feedback.

### M16 — Modular objective structures
- Replace the complex GLB arena with a simpler Mobile Legends Brawl-style single-lane bridge map
- Keep floor tiles, side walls, bridge edges, void backdrop, towers, and bases as separate named modules so textures/materials can be swapped later
- Apply repeating floor and wall textures from `public/assets/images/map`, with one continuous floor mesh and visible side/end wall enclosure matching the collision blockers
- Add 2 lane-aligned towers and 1 base for each side
- Keep structures modular and data-driven so positions, teams, and visuals can be changed when the map changes
- Use `tower1.glb`, `tower2.glb`, and `nexus.glb` from `public/assets/models/map` for objective visuals; keep objective containers empty until models load
- Rotate objective models by team side so tower fronts face into the lane instead of reusing one baked orientation
- Add simple wall/objective colliders so heroes cannot walk through bridge sides, towers, or bases; towers and nexus use smaller circular colliders for smoother movement around them
- Add world-space objective health bars and local auto-fire behavior when enemy heroes enter tower or nexus range

### M17 — Local match rules and HUD
- Lock the local player to the blue/bottom-left side and spawn them at the blue base
- Let the player choose Alice, Ruby, or Layla before the local match starts
- Spawn the enemy at the red base; keep the enemy idle until simple AI is added
- Respawn both heroes at their own base after death
- Let heroes damage enemy towers and nexuses
- End the match when a nexus is destroyed
- Show Victory or Defeat based on which nexus fell
- Track player and enemy kill counts
- **Skill HUD**: Bottom-right skill buttons with icons and cooldown overlays
- **Player HUD**: Player HP, enemy HP, respawn countdown, and kill count
- **Match end screen**: Centered win/lose result overlay

### M18 — Simple enemy AI
- Spawn 3 minions per team per wave and move them down the lane
- Minions basic attack enemy minions, heroes, towers, and nexus
- Minions and enemy hero steer around tower/base colliders while moving down lane
- Show world-space minion health bars and minimap dots
- Move the red-side hero from red base down the lane
- Prefer attacking the player when in range
- Attack enemy minions, towers, and nexus when no hero target is available
- Stop acting while dead and resume from red base after respawn
- Keep behavior deterministic and local-only

### M19 — Minimap and kill feed polish
- **Minimap**: Canvas 2D overlay in corner, dots for each hero, map outline
- **Fog of war**: Mask minimap outside your hero's vision radius
- **Kill feed**: Sliding notification panel (e.g. "Hero A killed Hero B")
- **HUD polish**: Tighten mobile layout, portrait treatment, and objective status

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
  /map
    MapLoader.ts         # loads tilemap + static props
    Camera.ts            # top-down rig, lerp follow
  /ui
    HUD.ts               # Canvas 2D overlay: HP bars, skills, minimap
    KillFeed.ts
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
| M16 | Modular objective structures | Local Match | 🟧 High |
| M17 | Local match rules and HUD | Local Match | 🟨 Medium |
| M18 | Simple enemy AI | Local Match | 🟧 High |
| M19 | Minimap and kill feed polish | Polish | 🟧 High |

---

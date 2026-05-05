# MLBB Web Prototype

Web-based Mobile Legends-style MOBA prototype built with Vite, React, TypeScript, and Three.js.

Read `AGENTS.md` and `PLANS.md` before starting feature work.

## Current State

- Phase 1 complete: Three.js scene, GLB character loading, skeleton animation playback, animation crossfades.
- Phase 2 complete: keyboard movement, click/tap move, facing direction, movement-driven animation state, attack trigger.
- Phase 3 in progress: map GLB is loaded as the arena, both characters render on the map, selected hero camera follow is active.

## Run

```bash
npm install
npm run dev
npm run build
```

Local app: `http://127.0.0.1:5173/`

## Important Files

- `src/core/SceneManager.ts`: Three.js scene, hero loading, animation state, map loading, camera follow.
- `src/core/InputManager.ts`: WASD/arrows, Space attack, click/tap move pointer commands.
- `src/App.tsx`: React shell and compact HUD.
- `src/App.css`: fullscreen canvas and HUD styling.
- `PLANS.md`: milestone roadmap.
- `AGENTS.md`: coding-agent rules and asset-request policy.

## Asset Paths

```text
public/assets/models/alice/model.glb
public/assets/models/ruby/model.glb
public/assets/models/map/model.glb
```

Do not invent final production assets silently. If a milestone needs a new model, animation file, sound, texture, UI art, VFX sprite, or branded reference asset, ask the user first.

## Character Notes

Both hero GLBs contain their own animations. Use the model clips directly; do not add procedural character animation unless the user asks.

Current clip mappings:

- Alice: `fight_idle`, `run`, `attack1`, `dead`
- Ruby: `fight_idle`, `run`, `attack1`, `dead`

Controls:

- `1` selects Alice
- `2` selects Ruby
- WASD/arrows move selected hero
- Click/tap moves selected hero toward the clicked map point
- Space triggers attack
- `X` triggers death debug state
- `I` triggers idle debug state

Ruby had an off-center rotation issue because her weapon affects the bounding box. The fix uses skeleton/body pivot names in `getHeroPivot()` instead of centering only by full mesh bounds.

## Map Notes

`public/assets/models/map/model.glb` contains two visible layers:

- Real playable arena: upper layer around original GLB `y ~= 305`
- Small duplicate/preview layer: lower layer around original GLB `y = 0`

Do not anchor the map to the GLB's lowest Y value. `SceneManager.normalizeMap()` detects the upper main layer and uses the playable surface as world `Y = 0`.

Manual map offset is here:

```ts
map.position.set(-center.x * scale, -surfaceY * scale, -center.z * scale)
```

Current map constants live near the top of `SceneManager.ts`:

- `MAP_MODEL_URL`
- `MAP_WORLD_SIZE`
- `MAP_SURFACE_NAME_HINTS`
- `MAP_LIMIT`

## UI Direction

Keep in-app UI compact and game-like. Do not add paragraphs explaining controls, implementation details, milestone notes, or asset status inside the app UI. Put that information in docs or assistant replies.

## Next Likely Work

Phase 3 cleanup:

- Tune map scale/camera framing if needed.
- Decide whether to hide/remove the lower duplicate layer completely.
- Add any visual-only static prop handling only if separate assets are supplied or clearly present in the map GLB.

Phase 4:

- Add collision boundaries.
- Either ask the user for collider/blocker data or create simple invisible bounds from the current map.
- Add debug collider visualization.

# AGENTS.md

## Project Context

This repo is building a web-based Mobile Legends-style MOBA prototype. The current roadmap lives in `PLANS.md` and is organized around phased milestones: Three.js rendering, GLB character animation, input, map rendering, collision, combat, multiplayer, and HUD polish.

Use `PLANS.md` as the source of truth for milestone order and expected features.

## Agent Workflow

1. Read `PLANS.md` before starting feature work.
2. Work milestone by milestone unless the user explicitly asks for a different order.
3. Keep changes scoped to the current milestone or user request.
4. Prefer the planned stack and structure:
   - Three.js for rendering
   - TypeScript
   - Vite
   - Rapier.js or simple collision primitives for physics
   - Socket.io + Node.js for multiplayer
5. Reuse existing project patterns once code exists.

## Asset Requests Are Required

Agents must ask the user whenever a task needs project assets that are not already present in the repo.

This includes, but is not limited to:

- 3D hero models (`.glb`, `.gltf`, `.fbx`)
- Skeleton animation clips such as `idle`, `run`, `attack`, and `death`
- Map props such as trees, walls, towers, bases, terrain pieces, and decorations
- Textures, materials, skyboxes, icons, portraits, and UI art
- Sound effects, music, voice lines, and other audio files
- Particle textures, VFX sprites, and hit effects
- Any branded or reference assets the user expects the game to resemble

Ask at every step where an asset choice matters. Do not silently invent final production assets when user-provided assets are needed.

Acceptable fallback behavior:

- Use simple primitives, placeholder colors, generated geometry, or clearly labeled temporary assets only after telling the user what is missing.
- Keep placeholders easy to replace.
- Document expected file paths and naming conventions when asking for assets.

Example:

> I need the hero GLB model and its `idle`, `run`, `attack`, and `death` animation clips for this step. Please add them under `src/assets/models/hero1/`, or tell me to continue with placeholders.

## Implementation Notes

- Keep 3D model loading isolated so assets can be swapped without rewriting gameplay code.
- Treat animation clip names as configurable; do not hard-code names unless the milestone specifically requires it.
- Add debug helpers for scale, orientation, colliders, and animation state when useful.
- For missing art or audio, prefer placeholder systems over blocking unrelated logic.
- Avoid committing large binary assets unless the user explicitly supplies or approves them.

## Verification

Before calling a milestone done:

- Run the relevant build, lint, or test command if available.
- For rendering or UI work, verify the scene visually when practical.
- Confirm required assets are present, or clearly state which placeholders are still being used.
- Update any asset path assumptions in code or docs.

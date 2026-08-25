# 🛸 Galactic Recruit Pinball

> Modern 3D Space Invaders-themed browser pinball game with faithful *3D Pinball: Space Cadet* mechanics, rank progression, and mission systems. Playable as a single HTML bundle with zero installation.

---

## 📋 Project Board & Operational Tracking

> [!IMPORTANT]
> **ALL work on this project is strictly tracked and managed on the GitHub Project Board.**
> 
> 👉 **[DaedalusApps Project #4 — Galactic Recruit Pinball](https://github.com/orgs/DaedalusApps/projects/4)**

### 🛡️ Core Working Process Rules

1. **Board-First Execution**:
   - **No work is done without being tied to an issue on the project board.** Every commit and PR must reference its corresponding task issue (`P<phase>.<seq>`).
2. **Discovery-First Rule**:
   - Any emergent requirement, bug, edge-case, or technical debt discovered mid-development **MUST start by creating an issue on the project board *first*** before any code or documentation is modified.
3. **One Issue = One Branch = One PR**:
   - No direct pushes to `main`. Every unit of work gets its own branch (`feat/<slug>`, `fix/<slug>`) and a PR linking its issue via `Closes #N`.
4. **Red-First (Strict TDD)**:
   - Every task begins with a visible, failing artifact (test, assertion, or automated scenario) executed and verified *before* writing the implementation.
5. **Three Gates Before Merge**:
   - Every PR diff must pass:
     1. **Declutter & Simplify**: Dead code elimination and complexity reduction.
     2. **Security Audit (`sec-audit`)**: Secret scanning, vulnerability check, input safety.
     3. **Deep Review (`deep-review`)**: Architectural correctness and edge-case validation.
6. **No Secrets / Local Decision Logging**:
   - Sensitive credentials, API keys, tokens, and local decision logs (`prd/`) are strictly kept local and never pushed to the remote repository.

---

## 🎮 Game Design & Architecture Summary

- **Engine & Rendering**: Modern 3D via [Three.js](https://threejs.org/) (PBR materials, bloom post-processing, dynamic lighting).
- **Physics Engine**: Full 3D collision dynamics via [Cannon-es](https://pmndrs.github.io/cannon-es/).
- **Audio Engine**: 100% procedural Web Audio API synthesis (zero external audio files).
- **Table Topology**: Exact physical layout of *3D Pinball: Space Cadet* re-skinned with classic *Space Invaders* alien bumpers, UFO beams, mothership gravity well, and laser habitrails.
- **Progression**: 9 military defender ranks (Rookie Defender to Galactic Admiral) and 17 table missions across 5 tiers.
- **Controls**:
  - **Desktop**: `Z` / `M` (Flippers), `Space` (Plunger / Railgun), `X` / `.` / `Up` (Nudge / Tilt), `C` (Toggle Fixed/Follow Camera).
  - **Mobile**: Touch tap zones for flippers, swipe/hold for plunger, and DeviceMotion accelerometer tilt-to-nudge.
- **Distribution**: Single standalone `index.html` file via Vite and `vite-plugin-singlefile`.

---

## 📁 Key Documentation

- 📖 **[Full Game Design Plan](file:///C:/Users/franc/Projects/GalacticRecruitPinball/GALACTIC_RECRUIT_PINBALL_PLAN.md)** — Complete 16-section design specification including all 17 missions, scoring rules, math formulas, and physics parameters.
- 📋 **[Local Operational Workplan](file:///C:/Users/franc/Projects/GalacticRecruitPinball/WORKPLAN.md)** — Master phase roadmap (P0 through P7).
- 📜 **[Architecture & Decision Log](file:///C:/Users/franc/Projects/GalacticRecruitPinball/prd/DECISIONS.md)** — Local architectural decision records (D001–D009).

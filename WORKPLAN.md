# Galactic Recruit Pinball — Operational Board

> Tracks all work items. Each task has a unique ID (`P<phase>.<seq>`), scope, red-first artifact, done-when criteria, and DoD checklist.

## Status Key

- 🔴 Not Started
- 🟡 In Progress
- 🟢 Done
- ⏸️ Blocked

---

## P0: Foundation (Week 1–2)

| ID | Task | Red-first Artifact | Done When | Status |
| :--- | :--- | :--- | :--- | :---: |
| P0.1 | Project scaffolding (Vite + TS + Three.js) | `npm run dev` fails → passes, shows blank page | Vite dev server boots, TS compiles, Three.js imported | 🟢 |
| P0.2 | Basic Three.js scene (camera, lights, table surface) | Empty black canvas → visible lit table plane | Black glossy table renders with correct perspective camera | 🟢 |
| P0.3 | Ball rendering (chrome sphere) | No ball visible → chrome ball on table | Ball renders with environment reflections | 🟢 |
| P0.4 | 2D physics engine (gravity, walls, bounce) | Ball static → ball falls under gravity, bounces off walls | Ball rolls down incline, bounces off all 4 walls | 🟢 |
| P0.5 | Flipper rendering + arc rotation | Flippers static → rotate on keypress | Z/M keys rotate left/right flippers through arc, return spring | 🟢 |
| P0.6 | Flipper-ball interaction | Ball passes through flipper → ball deflects | Ball is hit by flipper with correct velocity transfer | 🟢 |
| P0.7 | Plunger (railgun) + spring launch | Ball sits in lane → plunger launches ball | Space key charges + releases, ball velocity proportional to hold time | 🟢 |
| P0.8 | Keyboard input system | No input handling → all keys mapped | Z, M, Space, X, ., Up all functional | 🟢 |

**Milestone**: Ball launches, bounces off walls, interacts with flippers ✅

---

## P1: Table Geometry (Week 3–4)

| ID | Task | Red-first Artifact | Done When | Status |
| :--- | :--- | :--- | :--- | :---: |
| P1.1 | Full table walls + lanes as collision geometry | Ball escapes bounds → contained in full layout | Ball stays on table through all paths | 🔴 |
| P1.2 | Slingshots with impulse | Ball passes through → kicked upfield | Triangular kickers deflect ball with 500pt score | 🔴 |
| P1.3 | 3 Attack Bumpers (hit + impulse) | Ball passes through → bounced with points | 3 circular bumpers apply impulse, score 500/1500/4000 | 🔴 |
| P1.4 | Re-entry Lanes (3 top rollovers) | No detection → rollover triggers register | Flipper buttons rotate lit lanes, all 3 completable | 🔴 |
| P1.5 | Cannon Launch Tube (ramp) | Ball can't reach ramp → ball rides up, follows rail | Ramp capture → habitrail → exit works | 🔴 |
| P1.6 | Drop target banks | No drops → targets drop on hit, reset on clear | Booster targets (3 drops), clear awards bonus | 🔴 |
| P1.7 | Spot target banks | No spots → targets register hits | Mission, Medal, Hazard targets all register | 🔴 |
| P1.8 | 3 UFO Beams (wormholes) | Ball passes over → captured + ejected | Ball captured, teleported, ejected from another hole | 🔴 |
| P1.9 | Alien Disc spinners | No spinners → spin on ball contact | Spinner rotates, increments counter, awards pts | 🔴 |
| P1.10 | Space Warp rollover | No detection → registers hit | Rollover triggers and scores | 🔴 |
| P1.11 | Outlanes + drain + kickback | Ball drains silently → drain detected, kickback fires | Left outlane kickback works when armed | 🔴 |
| P1.12 | Center post (barrier drone) | No post → post pops up, blocks drain | Post deploys, absorbs one center drain, lowers | 🔴 |
| P1.13 | Skill Shot lane | No detection → rollover lights register | 6 skill shot positions score correctly | 🔴 |

**Milestone**: Complete playable table with all physical interactions ✅/❌

---

## P2: Game Logic & Scoring (Week 5–6)

| ID | Task | Red-first Artifact | Done When | Status |
| :--- | :--- | :--- | :--- | :---: |
| P2.1 | Score tracking + display | Score stays 0 → increments on hits | All elements award correct points | 🔴 |
| P2.2 | Bumper upgrade system | Bumpers stay blue → upgrade on lane cycles | Blue→Green→Red via Re-entry lane completion | 🔴 |
| P2.3 | Spinner boost system | Spinners stay 100pt → boost to 1000pt | Booster target clear upgrades spinners | 🔴 |
| P2.4 | Skill Shot scoring | No skill award → correct pts on launch | 15K/30K/75K/30K/15K/5K by position | 🔴 |
| P2.5 | UFO Beam progressive rewards | No progression → 5-stage unlock | 10K → lights → post → extra ball → tractor beam | 🔴 |
| P2.6 | Mothership Tractor Beam | No gravity → magnetic capture + eject | Ball attracted, captured, ejected randomly | 🔴 |
| P2.7 | Field multiplier (1×→10×) | Multiplier stuck at 1× → progresses | 1×→2×→3×→5×→10× via Medal/Re-entry/UFO | 🔴 |
| P2.8 | End-of-ball bonus | No bonus → calculated + displayed | Formula correct, forfeited on tilt | 🔴 |
| P2.9 | Ball count + extra ball | Infinite play → 3 balls, extras work | Game ends after 3 balls, extras add 1 | 🔴 |
| P2.10 | Tilt system | No tilt → 3-strike system | Warn 1 → Warn 2 → TILT (flippers die) | 🔴 |
| P2.11 | Ball saver | Instant drain counts → 5-10s grace | Early drain returns ball to plunger | 🔴 |

**Milestone**: Full scoring game with all table element rewards ✅/❌

---

## P3: Mission System (Week 7–8)

| ID | Task | Red-first Artifact | Done When | Status |
| :--- | :--- | :--- | :--- | :---: |
| P3.1 | Rank system (9 ranks) | No ranks → Rookie Defender displayed | All 9 ranks with icons defined | 🔴 |
| P3.2 | 18 Progress Lights ring | No lights → ring visible + tracks | Lights increment on mission complete, reset on promote | 🔴 |
| P3.3 | Mission lifecycle (request→accept→execute) | No missions → full lifecycle | Request via targets, accept via ramp, fuel timer runs | 🔴 |
| P3.4 | All 17 missions | 0 missions → 17 with correct objectives | Each mission's objective + reward matches spec | 🔴 |
| P3.5 | Fuel timer (Energy Core) | No timer → countdown active | Fuel ticks down, refuelable, failure on empty | 🔴 |
| P3.6 | Promotion logic | No promotion → rank advances | 18 lights → fanfare → next rank → lights reset | 🔴 |
| P3.7 | LCD ticker messages | No messages → all states shown | Request, accept, objective, complete, fail, promote msgs | 🔴 |

**Milestone**: Full Space Cadet–equivalent progression system ✅/❌

---

## P4: Visuals & Polish (Week 9–10)

| ID | Task | Red-first Artifact | Done When | Status |
| :--- | :--- | :--- | :--- | :---: |
| P4.1 | PBR materials (table, flippers, bumpers) | Flat shading → glossy PBR | Realistic lighting, reflections, metallic surfaces | 🔴 |
| P4.2 | Space Invader alien models (bumpers) | Placeholder spheres → 3D pixel aliens | Squid, crab, octopus aliens on bumpers | 🔴 |
| P4.3 | UFO models over wormholes | No models → spinning UFOs | 3 UFO models hover above beam entry points | 🔴 |
| P4.4 | Mothership model | No model → large UFO at gravity well | Animated mothership with tractor beam visuals | 🔴 |
| P4.5 | Neon light system with bloom | No glow → all table lights bloom | Progress ring, bumper lamps, lane lights all glow | 🔴 |
| P4.6 | Particle effects | No particles → VFX on events | Bumper hits, drain, promotion particles | 🔴 |
| P4.7 | Screen shake | No feedback → shake on events | Big hits and promotions trigger screen shake | 🔴 |
| P4.8 | Attract mode | Game starts immediately → title + demo | Attract screen with title, demo ball, press start | 🔴 |

**Milestone**: Visually polished and themed ✅/❌

---

## P5: Audio & UI (Week 11–12)

| ID | Task | Red-first Artifact | Done When | Status |
| :--- | :--- | :--- | :--- | :---: |
| P5.1 | Procedural SFX (all events) | Silent → sounds on every interaction | All 18+ sound events play correctly | 🔴 |
| P5.2 | Background chiptune music | Silent → 8-bit loop plays | Space Invaders–style music loops seamlessly | 🔴 |
| P5.3 | HUD overlay | No HUD → score, ball, rank, LCD visible | All HUD elements render and update | 🔴 |
| P5.4 | High score system | No persistence → localStorage top 5 | Scores persist across sessions | 🔴 |
| P5.5 | Game Over + high score entry | Game just stops → proper end screen | Name entry, hall of fame display | 🔴 |
| P5.6 | Easter eggs / cheats | No cheats → all codes functional | `invasion`, `maxwaves`, `tractor`, `promote` + debug keys | 🔴 |
| P5.7 | Camera toggle | Fixed only → toggleable fixed/follow | `C` key or icon switches modes, both work correctly | 🔴 |

**Milestone**: Complete game with audio + UI on desktop ✅/❌

---

## P6: Mobile Mode (Week 13–14)

| ID | Task | Red-first Artifact | Done When | Status |
| :--- | :--- | :--- | :--- | :---: |
| P6.1 | Touch input: flipper tap zones | No touch → tapping sides triggers flippers | Left/right tap zones work, 3rd flipper upper-left zone | 🔴 |
| P6.2 | Touch input: plunger swipe/hold | No plunger on mobile → swipe/hold launches ball | Swipe distance or hold duration controls power | 🔴 |
| P6.3 | DeviceMotion nudge (tilt-to-nudge) | No tilt input → shaking phone nudges table | iOS permission prompt, Android auto, fallback buttons | 🔴 |
| P6.4 | Responsive portrait layout | Desktop-only layout → portrait-first responsive | Table fills width in portrait, HUD collapses to compact bar | 🔴 |
| P6.5 | Compact mobile HUD | HUD overlaps/unreadable → scaled and compact | Fonts scale, touch targets ≥44px, ticker single-line | 🔴 |
| P6.6 | Performance tier auto-detection | Same effects everywhere → adaptive quality | Full/reduced/basic tiers based on frame timing | 🔴 |
| P6.7 | Canvas DPI scaling | Blurry on Retina → crisp rendering | `devicePixelRatio` applied, sharp on HiDPI | 🔴 |
| P6.8 | Fallback nudge buttons | No nudge if DeviceMotion denied → on-screen buttons | L/R/Up nudge buttons appear when tilt unavailable | 🔴 |
| P6.9 | Mobile browser testing | Untested → 2 mobile browsers pass | Chrome Android + Safari iOS playable | 🔴 |

**Milestone**: Fully playable on mobile with touch controls ✅/❌

---

## P7: Release Build (Week 15)

| ID | Task | Red-first Artifact | Done When | Status |
| :--- | :--- | :--- | :--- | :---: |
| P7.1 | Vite single-file build | Multi-file → single index.html | `vite-plugin-singlefile` produces one file with all assets inlined | 🔴 |
| P7.2 | Performance optimization | <60 FPS → stable FPS | 60 FPS desktop, 30+ FPS mobile on mid-range | 🔴 |
| P7.3 | Cross-browser testing (desktop + mobile) | Untested → 6 browser configs pass | Chrome, Firefox, Safari, Edge + Chrome Android + Safari iOS | 🔴 |
| P7.4 | Final playtesting + tuning | Untuned → balanced and fun | All 17 missions completable, physics feel good | 🔴 |

**Milestone**: Single `index.html` file, fully playable on desktop and mobile ✅/❌

# COT-21 v0.17 Chart Polish

## Goal
Bring the route chart up to the same pixel-art quality level as the polished S→A gameplay slice.

## What changed
- Replaced the SVG node/line map with a Canvas-rendered pixel chart.
- Islands now use the shared pixel asset API.
- Route segments show main-hazard icons, sailing time chips, and compact risk pips.
- Current / visited / goal nodes have different pixel framing.
- Live chart draws the player's ship on the current route in real time.
- Live chart still does not pause the game, enemies, timer, or tilt input.
- Pre-sail chart still includes the full route table and legend.
- Title screen now exposes the core loop with TILT / ROUTE / TIME chips.

## Preserved rules
- Route graph and all timings unchanged.
- C→F→I time trap unchanged.
- Difficulty curve unchanged from v0.13.2.
- Sensor physics unchanged.
- Failure palette and result copy unchanged.

## Acceptance checks
- On mobile, chart remains readable without horizontal scroll.
- Hazard type is understandable at a glance from icon + route table.
- Player position on the live chart is immediately visible.
- The chart feels like part of the same pixel game rather than a debug diagram.
# COT-21 v0.15 Production Sprite Pass

## Purpose
Move the representative S→A vertical slice from programmatic placeholder drawing to real pixel sprite assets without touching gameplay rules.

## Pipeline
1. `pixel-assets-v014.js` = guaranteed code-drawn fallback.
2. `pixel-sprites-v015.js` = embedded PNG sprite sheet data + frame metadata.
3. `pixel-assets-v015.js` = enhancement layer that uses PNG frames when ready.
4. `game-v015.js` = gameplay; asks the asset API to draw, never depends on PNG readiness.

## Current sprite sheet
256×256 transparent PNG embedded as a data URI.
Contains:
- player pirate ship
- pirate pursuer
- Marine ship
- Sea King
- rock variants
- island
- buoy
- foam/waves
- cannon target
- cannonball
- current arrow
- hazard icons
- impact burst
- cloud

## Runtime resilience
If the PNG cannot load, all core visuals fall back to the v0.14 code renderer and gameplay still starts.

## v0.15 visual additions
- S→A Marine route uses actual Marine ship sprites as ambient threat/source.
- player / pirate / Sea King / rocks / island / buoy / foam switch to PNG sprites.
- cannon target and cannonball switch to PNG sprites.
- current arrows can switch to PNG sprites.
- collision gets a short pixel impact burst.
- route identity chip displays the current main hazard and ★ risk.

## Locked rules
No change to v0.13.2 gameplay balance, route graph, timer penalties, sensor physics, CFI trap, live-map behavior, or failure palette.
# COT-21 v0.14 Vertical Slice

## Goal
Build one representative section that demonstrates the intended final production quality before expanding the rest of the game.

## Representative route
S → A (★4 / 海軍)
Reason: this route can showcase cannon fire, secondary hazards, dense navigation, map planning, the player ship, and the high-risk visual language in a single slice.

## Locked gameplay rules
- Portrait top-down 2D forced vertical scroll.
- Tilt movement in four directions.
- Horizontal movement = main steering.
- Vertical movement = auxiliary steering at ~75% response.
- Collision does not use HP. It deducts remaining time.
- Pre-sail chart pauses time.
- Live chart does not pause game, enemies, timer, or tilt input.
- C→F→I remains an intentionally safe-looking but time-impossible first-run trap.
- v0.13.2 difficulty curve remains the current baseline.

## Art direction
Normal state: loud Buggy-style pop pixel palette.
- Red #E43D45
- Blue #2786C1
- Deep blue #165477
- Cyan #55B8D0
- Cream #FFF1D6
- Pink #F19AAF
- Yellow #F4C84B
- Purple #7359A6
- Orange #E98438
- Sand #D7B576
- Ink #172B3C
- White #F5F4ED

Failure state: Cross Guild horror palette.
- Obsidian #101217
- Wine #4B1017
- Blood red #8C2028
- Antique gold #C39A43
- Tarnished gold #79612F
- Bone #E3DAC4
- Dead gray #55545A

## Asset architecture
`pixel-assets-v014.js` owns reusable visual assets.
Gameplay logic should call the asset API instead of drawing finished sprites directly.

Current API:
- drawPlayerShip
- drawPirateShip
- drawMarineShip
- drawSeaKing
- drawRock
- drawFoam
- drawBuoy
- drawSmallIsland

This is intentional: future production-quality art can replace individual asset functions without touching game rules, physics, collision, route logic, or sensor input.

## v0.14 success criteria
- S→A visually reads as a real pixel game rather than a physics/debug prototype.
- Player/enemy/hazard silhouettes are immediately distinguishable.
- Route identity is visible in the environment.
- No reduction in collision readability.
- Existing gameplay and sensor controls remain unchanged.
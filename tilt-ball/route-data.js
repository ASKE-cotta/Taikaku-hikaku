window.ROUTE_DATA = {
  version: "0.9",
  start: "S",
  goal: "K",
  initialMinutes: 240,
  minutesPerSecond: 1.0,
  scrollSpeed: 180,
  hazardMeta: {
    "岩礁": { short:"岩礁水道", cue:"岩壁に囲まれた蛇行水路を抜ける" },
    "海流": { short:"強海流", cue:"流される方向と逆へ舵を当て続ける" },
    "海軍": { short:"予告砲撃", cue:"照準を見て砲撃地点から逃げる" },
    "海賊": { short:"追尾船", cue:"寄ってくる船を振り切る" },
    "海王類": { short:"横断突進", cue:"側面警告を見て上下へ逃げる" },
    "混在": { short:"混成海域", cue:"複数の回避パターンが混ざる" }
  },
  nodes: {
    S: { name: "やらかし地点", log: 0, x: 300, y: 535 },
    A: { name: "A島", log: 12, x: 105, y: 420 },
    B: { name: "B島", log: 28, x: 300, y: 420 },
    C: { name: "C島", log: 42, x: 495, y: 420 },
    D: { name: "D島", log: 10, x: 55, y: 295 },
    E: { name: "E島", log: 24, x: 215, y: 295 },
    F: { name: "F島", log: 32, x: 385, y: 295 },
    G: { name: "G島", log: 15, x: 545, y: 295 },
    H: { name: "H島", log: 16, x: 210, y: 165 },
    I: { name: "I島", log: 24, x: 410, y: 165 },
    K: { name: "カライ・バリ島", log: 0, x: 300, y: 45 }
  },
  edges: [
    { from:"S", to:"A", sail:28, risk:4, hazard:"海軍" },
    { from:"S", to:"B", sail:36, risk:2, hazard:"海賊" },
    { from:"S", to:"C", sail:42, risk:1, hazard:"岩礁" },
    { from:"A", to:"D", sail:30, risk:4, hazard:"海軍" },
    { from:"A", to:"E", sail:40, risk:2, hazard:"岩礁" },
    { from:"B", to:"E", sail:30, risk:2, hazard:"海賊" },
    { from:"B", to:"F", sail:27, risk:3, hazard:"海王類" },
    { from:"C", to:"F", sail:22, risk:1, hazard:"岩礁" },
    { from:"C", to:"G", sail:20, risk:4, hazard:"海王類" },
    { from:"D", to:"H", sail:34, risk:4, hazard:"海軍" },
    { from:"E", to:"H", sail:28, risk:2, hazard:"海流" },
    { from:"E", to:"I", sail:23, risk:3, hazard:"海賊" },
    { from:"F", to:"H", sail:35, risk:1, hazard:"海流" },
    { from:"F", to:"I", sail:26, risk:2, hazard:"海王類" },
    { from:"G", to:"I", sail:22, risk:4, hazard:"海軍" },
    { from:"H", to:"K", sail:26, risk:2, hazard:"混在" },
    { from:"I", to:"K", sail:30, risk:3, hazard:"混在" }
  ]
};
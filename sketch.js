const ASPECT_PRESETS = {
  "16:9": { width: 1440, height: 810 },
  "1:1": { width: 1000, height: 1000 },
  "4:5": { width: 960, height: 1200 },
  "960:1536": {
    width: 960,
    height: 1536,
    outputPixels: true
  },
  "1440:768": {
    width: 1440,
    height: 768,
    outputPixels: true
  },
  "2496:768": {
    width: 2496,
    height: 768,
    outputPixels: true
  },
  "2496:786": {
    width: 2496,
    height: 786,
    outputPixels: true
  },
  "1824:2304": {
    width: 1824,
    height: 2304,
    outputPixels: true
  },
  /* Lobby left as two separate 720×768 screens. */
  "1440:768-split": {
    width: 1440,
    height: 768,
    outputPixels: true,
    split: true
  },
  /* One half of the split lobby; used for per-side renders. */
  "720:768": {
    width: 720,
    height: 768,
    outputPixels: true
  }
};

const RETIRED_ASPECT_RATIOS = {
  "3936:768": "2496:768",
  "3936:768-tilted": "2496:768"
};

function migrateAspectKey(key) {
  return RETIRED_ASPECT_RATIOS[key] || key;
}

/*
 * Run with ?renderWorker: a hidden second copy of the
 * sketch that renders the other side of the split
 * lobby. It never reads or writes saved state.
 */
const RENDER_WORKER = new URLSearchParams(
  window.location.search
).has("renderWorker");

/*
 * Reel clips keep the aspect they were authored at;
 * at another canvas size the cube size scales with
 * the canvas instead of staying a fixed pixel size,
 * so layouts see the same frame scaled, not cropped.
 */
let contentReferenceAspect = null;
let contentScaleMode = "area";

/* How the split lobby draws a single clip: two crops. */
let splitViewMode = "crop";
const SPLIT_CROP_SHIFT = 0.25;

function getContentScale() {
  if (!contentReferenceAspect || contentScaleMode === "pixels") {
    return 1;
  }

  const reference =
    ASPECT_PRESETS[migrateAspectKey(contentReferenceAspect)];

  if (!reference || !(width > 0) || !(height > 0)) {
    return 1;
  }

  const ref = resolveAspectCanvasSize(reference);

  if (contentScaleMode === "fit") {
    return min(width / ref.width, height / ref.height);
  }

  return sqrt((width * height) / (ref.width * ref.height));
}

const CANVAS_WIDTH = ASPECT_PRESETS["16:9"].width;
const CANVAS_HEIGHT = ASPECT_PRESETS["16:9"].height;
const CANVAS_PIXEL_DENSITY = 2;

/*
 * Max per-net fold delay (0–1 timeline units) before
 * the fold-stagger slider scales it down.
 */
const FOLD_STAGGER_MAX = 0.72;

const controls = {};

const PALETTE = [
  "#032932",
  "#0A4552",
  "#DAFF47",
  "#5D005D",
  "#16C518",
  "#235C58",
  "#9EE6FF",
  "#0DB6FF",
  "#AF830F",
  "#F9A3FB",
  "#FF520D",
  "#FFB616"
];

const RETIRED_PALETTE_COLOR = "#32eeff";
const RETIRED_PALETTE_REPLACEMENT = "#0DB6FF";

function migrateRetiredPaletteColor(hex) {
  if (
    typeof hex === "string" &&
    hex.toLowerCase() === RETIRED_PALETTE_COLOR
  ) {
    return RETIRED_PALETTE_REPLACEMENT;
  }

  return hex;
}

function migratePresetSnapshot(preset) {
  if (!preset || typeof preset !== "object") {
    return preset;
  }

  let changed = false;
  const next = { ...preset };

  for (const key of [
    "monoColor",
    "outerColor",
    "innerColor"
  ]) {
    if (typeof next[key] !== "string") {
      continue;
    }

    const migrated = migrateRetiredPaletteColor(
      next[key]
    );

    if (migrated !== next[key]) {
      next[key] = migrated;
      changed = true;
    }
  }

  if (
    next.fields &&
    RETIRED_ASPECT_RATIOS[next.fields.aspectRatio]
  ) {
    next.fields = {
      ...next.fields,
      aspectRatio: migrateAspectKey(next.fields.aspectRatio)
    };
    changed = true;
  }

  return changed ? next : preset;
}

const BACKGROUNDS = {
  light: "#FEF9F3",
  dark: "#032932"
};

/*
 * Page chrome uses the opposite of the canvas theme
 * so the frame reads clearly against the artwork.
 */
const PAGE_CHROME = {
  light: {
    bg: "#032932",
    fg: "#f4f1ea",
    border: "rgba(244, 241, 234, 0.18)",
    borderStrong: "rgba(244, 241, 234, 0.55)",
    inputBg: "rgba(254, 249, 243, 0.08)",
    swatchBorder: "rgba(255, 255, 255, 0.28)"
  },
  dark: {
    bg: "#ecece8",
    fg: "#111111",
    border: "rgba(0, 0, 0, 0.12)",
    borderStrong: "rgba(17, 17, 17, 0.85)",
    inputBg: "#ffffff",
    swatchBorder: "rgba(0, 0, 0, 0.18)"
  }
};

/*
 * Display labels for the 11 hexomino unfoldings
 * (1-based for the UI).
 */
const CUBE_NET_LABELS = [
  "Type 1 — zigzag",
  "Type 2 — branched",
  "Type 3 — cross",
  "Type 4 — T",
  "Type 5 — branched Z",
  "Type 6 — skew Z",
  "Type 7 — zigzag bar",
  "Type 8 — P",
  "Type 9 — F",
  "Type 10 — L",
  "Type 11 — N"
];

const CUBE_NETS = [
  [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 2],
    [2, 1],
    [3, 1]
  ],

  [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [2, 2],
    [3, 1]
  ],

  [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, 2],
    [1, 3],
    [2, 1]
  ],

  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
    [2, 1],
    [3, 1]
  ],

  [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, 2],
    [1, 3],
    [2, 2]
  ],

  [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 2],
    [2, 2],
    [2, 3]
  ],

  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
    [1, 3],
    [1, 4]
  ],

  [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 2],
    [1, 3],
    [2, 1]
  ],

  [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 2],
    [1, 3],
    [2, 2]
  ],

  [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [3, 2]
  ],

  [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 2],
    [1, 3],
    [2, 3]
  ]
];

let processedNets = [];
let netVariants = [];

let packedPlacements = {
  placements: [],
  totalCells: 0
};
let packCacheKey = "";

/*
 * Salts packing / traveler placement hashes only.
 * Controls stay put when this is re-rolled.
 */
let placementSeed = 0;

const PRESET_STORAGE_KEY =
  "devagm-11-cube-unfold-presets";

const SESSION_SETTINGS_KEY =
  "devagm-11-cube-unfold-session";

let sessionSaveTimer = null;
let sessionRestoring = false;

/*
 * Reel renderer (reel.js) drives frames manually with
 * redraw(). While it runs, stray loop frames are
 * skipped, time advances by a fixed step, and the
 * session / page chrome stay on the user's settings.
 */
let reelRendering = false;
let reelFrameStep = false;
let reelSimulateOnly = false;
let fixedFrameDeltaMs = null;

function frameDeltaMs() {
  if (fixedFrameDeltaMs !== null) {
    return fixedFrameDeltaMs;
  }

  return typeof deltaTime === "number" && deltaTime > 0
    ? deltaTime
    : 1000 / 60;
}

const PRESET_FIELD_IDS = [
  "sketchMode",
  "netTypeMode",
  "netTypeCount",
  "netTypeSlot0",
  "netTypeSlot1",
  "netTypeSlot2",
  "aspectRatio",
  "cascadeDirection",
  "cascadeCount",
  "cascadePause",
  "cascadeMotionCurve",
  "cascadePhaseOffset",
  "rollGridMotion",
  "rollGridDirection",
  "rollGridDestOffset",
  "rollGridRadialBias",
  "rollGridUniform",
  "rollGridPause",
  "insideOutGridFullness",
  "insideOutFlatStop",
  "insideOutPause",
  "wanderGridFullness",
  "wanderFrequency",
  "wanderSpeed",
  "imageScaleBias",
  "imageColorMode",
  "gridPlacement",
  "placementSkew",
  "foldStagger",
  "foldStaggerCarryOver",
  "foldProgress",
  "foldMode",
  "drapeAmount",
  "cubeCoverage",
  "cubeCount",
  "animationSpeed",
  "oneAtATimeHold",
  "oneAtATimeGap",
  "compositionPlacement",
  "presentationPlacement",
  "presentationPaletteBrightness",
  "presentationDivisionWeight",
  "gridSize",
  "cubeScale1",
  "cubeScale2",
  "cubeScale3",
  "layoutSpacing",
  "cameraZoom",
  "backgroundTheme",
  "colorMode",
  "animateFolding",
  "quickToggle",
  "showDivisions",
  "divisionMatchBackground",
  "divisionAngleFilter",
  "showGrid",
  "showCubeGrid",
  "allowBoxExtents",
  "showFaceShading",
  "lightAngle"
];

const REMOVED_SKETCH_MODES = new Set([
  "dense-cubes",
  "tidal",
  "scatter",
  "gallery",
  "transition",
  "transition-letters",
  "stacked-layers",
  "text",
  "text-image"
]);

let animatedProgress = 0;
let animationDirection = 1;
let animationPauseTimer = 0;
let monoColor = RETIRED_PALETTE_REPLACEMENT;
let outerColor = PALETTE[1];
let innerColor = PALETTE[2];

/*
 * Two-tone shuffle: per-cube inside color, keyed by the
 * cube's own placement / agent object (seeds repeat in
 * some modes). `closed` tracks whether the cube was at
 * its swap moment last time it drew, so a new color is
 * picked once per cycle. Modes listed here swap when
 * the net lies fully flat; the rest swap when sealed.
 */
const SHUFFLE_SWAP_WHEN_FLAT = new Set([
  "gridded",
  "gradient",
  "cascade",
  "one-at-a-time"
]);

function createShuffleChannel() {
  return {
    byObject: new WeakMap(),
    bySeed: new Map(),
    round: 0,
    color: null
  };
}

/*
 * Inside-out cubes evert, so the outer shell is the
 * sealed side while inverted; it shuffles on its own
 * channel at that moment.
 */
let innerShuffle = createShuffleChannel();
let outerShuffle = createShuffleChannel();
let shuffleInnerVersion = 0;
let shuffleInnerFrozen = false;

let cascadeTravelers = [];
let cascadeCacheKey = "";
let cascadeTime = 0;

/*
 * Roll-grid mode: padded lattice of solid cubes that
 * tip one cell at a time through the four directions.
 */
let rollGridCubes = [];
let rollGridCacheKey = "";
let rollGridTime = 0;
let rollGridBoard = null;

/*
 * Wander mode: folded cubes placed on a random subset
 * of the visible grid roll or unfold on their own,
 * never claiming cells another cube already uses.
 */
let wanderAgents = [];
let wanderCacheKey = "";
let wanderTime = 0;

/*
 * Inside-out mode: padded lattice of folded cubes that
 * evert through a random side wall and land inverted
 * one grid row below, then keep descending.
 */
let insideOutCubes = [];
let insideOutCacheKey = "";
let insideOutTime = 0;

/*
 * One-at-a-time mode: the packed layout stays unfolded
 * while a single net folds, holds, and unfolds.
 */
let oneAtATimeState = {
  placementsKey: "",
  activeIndex: 0,
  progress: 0,
  phase: "folding",
  phaseTimer: 0
};
let insideOutBoard = null;

const ROLL_GRID_DIRS = [
  { di: 1, dj: 0 },
  { di: 0, dj: 1 },
  { di: -1, dj: 0 },
  { di: 0, dj: -1 }
];

/*
 * Uploaded source for image mode. Pixels are stored
 * in a plain ImageData buffer for fast sampling.
 */
let sourceImageData = null;
let sourceImageKey = "";
let sourceImageName = "";

let syncingQuickToggle = false;

const FPS_HISTORY_LENGTH = 90;
let fpsHistory = [];
let fpsDisplay = 60;
let fpsMeterElements = null;

function setup() {
  const canvas = createCanvas(
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    WEBGL
  );

  canvas.parent("canvas-stage");

  smooth();

  getControls();
  connectControls();

  processedNets = CUBE_NETS.map((cells) => {
    return prepareNet(cells);
  });

  netVariants = buildAllNetVariants();

  buildPaletteSwatches();
  buildNetTypeSlotOptions();
  refreshPresetSelect();

  /*
   * Restore the last session when present. Otherwise
   * start flat with the HTML defaults.
   */
  if (RENDER_WORKER || !restoreSessionSettings()) {
    controls.foldProgress.value = 0;
    controls.drapeAmount.value = 1;
    controls.cubeCoverage.value = 100;

    animatedProgress = 0;
    animationDirection = 1;

    syncColorModeUI();
    syncSketchModeUI();
    syncNetTypeUI();
    syncCoverageControlsUI();
    applyBackgroundTheme();
    applyAspectRatio();
    updateAllValueLabels();
  }

  window.addEventListener(
    "beforeunload",
    saveSessionSettings
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") {
        saveSessionSettings();
      }
    }
  );

  if (typeof initReel === "function") {
    initReel();
  }

  if (RENDER_WORKER) {
    noLoop();
    window.reelWorkerReady = true;
  }
}

function draw() {
  if (reelRendering && !reelFrameStep) {
    return;
  }

  const settings = getSettings();

  /*
   * Shuffle modes pick colors with random() while
   * drawing, so skipping the draw would change every
   * later random pick — those always render.
   */
  if (
    reelSimulateOnly &&
    !isShuffleColorMode(settings.colorMode)
  ) {
    advanceSimulation(settings);
    return;
  }

  background(getBackgroundColor(settings));
  applyBackgroundTheme(settings);

  if (settings.sketchMode === "gridded" || settings.sketchMode === "image") {
    updateAnimation();
  } else if (settings.sketchMode === "cascade") {
    updateCascade(settings);
  } else if (settings.sketchMode === "roll-grid") {
    updateRollGrid(settings);
  } else if (settings.sketchMode === "inside-out") {
    updateInsideOut(settings);
  } else if (settings.sketchMode === "one-at-a-time") {
    updateOneAtATime(settings);
  }

  drawScene(settings);
  drawTiltedPanel(settings);
  drawSplitCropPanel(settings);

  if (isWanderMode(settings.sketchMode)) {
    updateWander(settings);
  }

  updateFpsMeter(settings);
}

/*
 * Rendering only — simulation updates stay in draw()
 * so a second pass (tilted lobby panel) is side-effect
 * free.
 */
function drawScene(settings) {
  if (settings.sketchMode === "one-at-a-time") {
    drawOneAtATimeFrame(settings);
    return;
  }

  if (settings.showCubeGrid) {
    drawIsometricCubeGrid(settings);
  }

  if (settings.showGrid) {
    drawScreenIsometricGrid(settings);
  }

  setIsometricCamera(settings);

  if (settings.sketchMode === "image") {
    /*
     * Soft lighting: keeps sampled colors close to the
     * photo while still reading folds when animating.
     */
    ambientLight(220);

    directionalLight(
      70,
      70,
      70,
      -0.55,
      -1,
      -0.35
    );
  } else if (
    settings.sketchMode === "roll-grid" ||
    settings.sketchMode === "inside-out"
  ) {
    /*
     * No lights → p5's flat color shader. fill()
     * colors match the palette with no angle tint.
     */
    noLights();
  } else {
    applyDefaultSceneLights(settings);
  }

  if (settings.sketchMode === "cascade") {
    drawCascadeNets(settings);
  } else if (settings.sketchMode === "gradient") {
    drawGradientNets(settings);
  } else if (settings.sketchMode === "image") {
    drawImageNets(settings);
  } else if (settings.sketchMode === "roll-grid") {
    drawRollGrid(settings);
  } else if (settings.sketchMode === "inside-out") {
    drawInsideOut(settings);
  } else if (isWanderMode(settings.sketchMode)) {
    drawWanderAgents(settings);
  } else {
    drawAllNets(settings);
  }
}

/* Set while drawing the tilted lobby panel. */
let screenTilt = null;

function getActiveAspectPreset() {
  const key =
    controls.aspectRatio
      ? controls.aspectRatio.value
      : "16:9";

  return ASPECT_PRESETS[key] || ASPECT_PRESETS["16:9"];
}

/*
 * Split lobby, one clip: the right screen redraws the
 * scene shifted so it shows a different crop rather
 * than continuing the left screen's picture.
 */
function drawSplitCropPanel(settings) {
  const preset = getActiveAspectPreset();

  if (!preset.split || splitViewMode !== "crop") {
    return;
  }

  const gl = drawingContext;
  const bufferWidth = gl.drawingBufferWidth;
  const bufferHeight = gl.drawingBufferHeight;
  const scissorX = round(bufferWidth * 0.5);

  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(scissorX, 0, bufferWidth - scissorX, bufferHeight);

  background(getBackgroundColor(settings));
  gl.clear(gl.DEPTH_BUFFER_BIT);

  screenTilt = {
    radians: 0,
    centerX: 0,
    offsetX: width * SPLIT_CROP_SHIFT
  };

  push();
  noLights();
  drawScene(settings);
  pop();

  screenTilt = null;
  gl.disable(gl.SCISSOR_TEST);
}

/*
 * Redraws the scene into the right-hand screen only,
 * turned clockwise about that screen's center.
 */
function drawTiltedPanel(settings) {
  const preset = getActiveAspectPreset();

  if (!preset.tilt) {
    return;
  }

  const gl = drawingContext;
  const split = preset.tilt.splitPixels / preset.width;
  const bufferWidth = gl.drawingBufferWidth;
  const bufferHeight = gl.drawingBufferHeight;
  const scissorX = round(bufferWidth * split);

  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(scissorX, 0, bufferWidth - scissorX, bufferHeight);

  background(getBackgroundColor(settings));
  gl.clear(gl.DEPTH_BUFFER_BIT);

  const panelCenterX =
    width * split + (width * (1 - split)) * 0.5 - width * 0.5;

  screenTilt = {
    radians: radians(preset.tilt.degrees),
    centerX: panelCenterX
  };

  push();
  /* lights accumulate per frame; don't double them */
  noLights();
  drawScene(settings);
  pop();

  screenTilt = null;
  gl.disable(gl.SCISSOR_TEST);
}

/*
 * Left-multiplies the projection by a screen-space
 * clockwise rotation about the tilted panel center.
 * Done in pixel space so the canvas aspect doesn't
 * shear the rotation.
 */
function applyScreenTilt() {
  if (!screenTilt) {
    return;
  }

  const renderer = p5.instance && p5.instance._renderer;

  if (!renderer || !renderer.uPMatrix) {
    return;
  }

  const a = width * 0.5;
  const b = height * 0.5;
  const c = cos(screenTilt.radians);
  const s = sin(screenTilt.radians);
  const px = screenTilt.centerX;
  const shiftX = (screenTilt.offsetX || 0) / a;

  const m = [
    [c, (s * b) / a, 0, (px / a) * (1 - c) + shiftX],
    [(-s * a) / b, c, 0, (s * px) / b],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];

  const p = renderer.uPMatrix.mat4;
  const out = new Array(16);

  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;

      for (let k = 0; k < 4; k++) {
        sum += m[row][k] * p[col * 4 + k];
      }

      out[col * 4 + row] = sum;
    }
  }

  for (let i = 0; i < 16; i++) {
    p[i] = out[i];
  }
}

function advanceSimulation(settings) {
  if (settings.sketchMode === "gridded" || settings.sketchMode === "image") {
    updateAnimation();
  } else if (settings.sketchMode === "cascade") {
    updateCascade(settings);
  } else if (settings.sketchMode === "roll-grid") {
    updateRollGrid(settings);
  } else if (settings.sketchMode === "inside-out") {
    updateInsideOut(settings);
  } else if (settings.sketchMode === "one-at-a-time") {
    updateOneAtATime(settings);
  } else if (isWanderMode(settings.sketchMode)) {
    updateWander(settings);
  }
}

function applyDefaultSceneLights(settings) {
  ambientLight(
    settings.backgroundTheme === "dark" ? 160 : 205
  );

  directionalLight(
    255,
    255,
    255,
    -0.55,
    -1,
    -0.35
  );

  directionalLight(
    115,
    115,
    115,
    0.7,
    0.35,
    0.55
  );
}


function getBackgroundColor(settings) {
  return (
    BACKGROUNDS[settings.backgroundTheme] ||
    BACKGROUNDS.light
  );
}

function applyBackgroundTheme(settings) {
  if (reelRendering) {
    return;
  }

  const theme =
    settings
      ? settings.backgroundTheme
      : controls.backgroundTheme.value;

  const chrome =
    PAGE_CHROME[theme] ||
    PAGE_CHROME.light;

  const root = document.documentElement;

  root.style.setProperty("--page-bg", chrome.bg);
  root.style.setProperty("--page-fg", chrome.fg);
  root.style.setProperty("--page-border", chrome.border);
  root.style.setProperty(
    "--page-border-strong",
    chrome.borderStrong
  );
  root.style.setProperty(
    "--page-input-bg",
    chrome.inputBg
  );
  root.style.setProperty(
    "--page-swatch-border",
    chrome.swatchBorder
  );

  /*
   * Keep the area around the canvas on the contrasting
   * page color — the canvas paints its own fill.
   */
  const wrap =
    document.getElementById(
      "canvas-container"
    );

  if (wrap) {
    wrap.style.background = chrome.bg;
  }
}

function isMulticolorColorMode(mode) {
  return (
    mode === "multicolored" ||
    mode === "two-tone-multi"
  );
}

/*
 * In multicolor modes on the dark canvas, keep the
 * background swatch off cube faces so they stay visible.
 */
function getFacePalette(settings) {
  if (
    settings.backgroundTheme !== "dark" ||
    !isMulticolorColorMode(settings.colorMode)
  ) {
    return PALETTE;
  }

  const background = BACKGROUNDS.dark.toLowerCase();
  const palette = PALETTE.filter(
    (hex) => hex.toLowerCase() !== background
  );

  return palette.length ? palette : PALETTE;
}

function paletteColorForFace(index, settings) {
  const palette = getFacePalette(settings);
  const slot =
    ((index % palette.length) + palette.length) %
    palette.length;

  return palette[slot];
}

function adjustHexBrightness(hex, percent) {
  const factor = (Number(percent) || 100) / 100;

  if (factor === 1) {
    return hex;
  }

  const { r, g, b } = hexToRgb(hex);

  return rgbToHex(r * factor, g * factor, b * factor);
}

function presentationFaceColor(hex, settings) {
  if (!settings.presentationPlacement) {
    return hex;
  }

  const pct = Number(settings.presentationPaletteBrightness);

  if (!Number.isFinite(pct) || pct === 100) {
    return hex;
  }

  return adjustHexBrightness(hex, pct);
}

function getDivisionStrokeWeight(settings) {
  if (!settings.presentationPlacement) {
    return 1;
  }

  const weight = Number(settings.presentationDivisionWeight);

  return Number.isFinite(weight) && weight > 0
    ? weight
    : 1;
}

function getNetColor(index, settings) {
  let color;

  if (settings.colorMode === "monochromatic") {
    color = monoColor;
  } else if (
    settings.colorMode === "two-tone" ||
    isShuffleColorMode(settings.colorMode)
  ) {
    color = outerColor;
  } else {
    color = paletteColorForFace(index, settings);
  }

  return presentationFaceColor(color, settings);
}

function isShuffleColorMode(mode) {
  return (
    mode === "two-tone-shuffle" ||
    mode === "two-tone-shuffle-sync"
  );
}

function isTwoToneColorMode(mode) {
  return (
    mode === "two-tone" ||
    mode === "two-tone-multi" ||
    isShuffleColorMode(mode)
  );
}

/*
 * Shared shuffle: one color per round. The first cube
 * to swap again after a round began starts the next
 * round; every other cube adopts the latest round color
 * at its own swap moment.
 */
function resetShuffleInnerColors() {
  innerShuffle = createShuffleChannel();
  outerShuffle = createShuffleChannel();
  shuffleInnerVersion++;
}

function pickShuffleColor(current, otherSide, settings) {
  const avoid = new Set([
    String(current).toLowerCase(),
    String(otherSide).toLowerCase(),
    String(getBackgroundColor(settings)).toLowerCase()
  ]);

  const options = PALETTE.filter(
    (hex) => !avoid.has(hex.toLowerCase())
  );

  return options.length
    ? options[floor(random(options.length))]
    : current;
}

function shuffleChannelEntry(channel, key) {
  const store =
    key !== null && typeof key === "object"
      ? channel.byObject
      : channel.bySeed;

  return {
    entry: store.get(key),
    store
  };
}

function getShuffledColorFor(
  channel,
  key,
  closed,
  settings,
  initialHex,
  otherSideHex
) {
  const { entry: found, store } =
    shuffleChannelEntry(channel, key);
  let entry = found;

  if (!entry) {
    entry = { hex: initialHex, closed, round: 0 };
    store.set(key, entry);
    return entry.hex;
  }

  if (shuffleInnerFrozen) {
    return entry.hex;
  }

  if (closed && !entry.closed) {
    if (settings.colorMode === "two-tone-shuffle-sync") {
      if (entry.round === channel.round) {
        channel.color = pickShuffleColor(
          channel.color || initialHex,
          otherSideHex,
          settings
        );
        channel.round++;
      }

      entry.round = channel.round;
      entry.hex = channel.color || initialHex;
    } else {
      entry.hex = pickShuffleColor(
        entry.hex,
        otherSideHex,
        settings
      );
    }

    shuffleInnerVersion++;
  }

  entry.closed = closed;

  return entry.hex;
}

function peekShuffledColor(channel, key, fallbackHex) {
  const { entry } = shuffleChannelEntry(channel, key);
  return entry ? entry.hex : fallbackHex;
}

function getInnerColorFor(
  key,
  closed,
  settings,
  outerHex = outerColor
) {
  if (!isShuffleColorMode(settings.colorMode)) {
    return settings.innerColor;
  }

  return getShuffledColorFor(
    innerShuffle,
    key,
    closed,
    settings,
    settings.innerColor,
    outerHex
  );
}

function getOuterShuffleColorFor(
  key,
  closed,
  settings,
  fallbackHex
) {
  if (!isShuffleColorMode(settings.colorMode)) {
    return fallbackHex;
  }

  return getShuffledColorFor(
    outerShuffle,
    key,
    closed,
    settings,
    fallbackHex,
    peekShuffledColor(
      innerShuffle,
      key,
      settings.innerColor
    )
  );
}

function getFaceOuterColor(
  faceIndex,
  netColor,
  settings,
  creaseSeed = 0
) {
  if (settings.colorMode !== "two-tone-multi") {
    return netColor;
  }

  const face =
    typeof faceIndex === "number"
      ? faceIndex
      : 0;

  const salt =
    floor(abs(creaseSeed) * 97) + face * 3;

  return paletteColorForFace(salt, settings);
}

function getAllowedTypeIndexes(settings) {
  if (settings.netTypeMode !== "select") {
    return Array.from(
      { length: CUBE_NETS.length },
      (_, i) => i
    );
  }

  const count = constrain(
    settings.netTypeCount,
    1,
    3
  );

  const picked = [];

  for (let i = 0; i < count; i++) {
    const typeIndex = settings.netTypeSlots[i];

    if (
      typeIndex >= 0 &&
      typeIndex < CUBE_NETS.length &&
      !picked.includes(typeIndex)
    ) {
      picked.push(typeIndex);
    }
  }

  return picked.length > 0 ? picked : [0];
}

function pickAllowedTypeIndex(seed, settings) {
  const allowed = getAllowedTypeIndexes(settings);

  return allowed[
    floor(unitHash(seed) * allowed.length)
  ];
}

function allowedTypesCacheKey(settings) {
  return getAllowedTypeIndexes(settings).join(",");
}

/*
 * Relative 1× / 2× / 3× mix. Sliders are weights;
 * all-zero falls back to pure 1× so layouts stay valid.
 */
function getNormalizedScaleWeights(settings) {
  const w1 = max(0, Number(settings.cubeScale1) || 0);
  const w2 = max(0, Number(settings.cubeScale2) || 0);
  const w3 = max(0, Number(settings.cubeScale3) || 0);
  const sum = w1 + w2 + w3;

  if (sum <= 0) {
    return { 1: 1, 2: 0, 3: 0 };
  }

  return {
    1: w1 / sum,
    2: w2 / sum,
    3: w3 / sum
  };
}

function scaleWeightsCacheKey(settings) {
  const weights = getNormalizedScaleWeights(settings);

  return [
    weights[1].toFixed(4),
    weights[2].toFixed(4),
    weights[3].toFixed(4)
  ].join(",");
}

function getMaxActiveScale(settings) {
  const weights = getNormalizedScaleWeights(settings);

  if (weights[3] > 0) {
    return 3;
  }

  if (weights[2] > 0) {
    return 2;
  }

  return 1;
}

function onlyUnitScaleActive(settings) {
  const weights = getNormalizedScaleWeights(settings);

  return weights[2] <= 0 && weights[3] <= 0;
}

function pickCubeScale(seed, settings) {
  const weights = getNormalizedScaleWeights(settings);
  const roll = unitHash(seed);

  if (roll < weights[1]) {
    return 1;
  }

  if (roll < weights[1] + weights[2]) {
    return 2;
  }

  return 3;
}

/*
 * Each logical face of a scale-s cube occupies an
 * s×s block on the base face lattice.
 */
function expandCellsToFootprint(cells, scale) {
  const edge = max(1, round(scale) || 1);
  const footprint = [];

  for (const cell of cells) {
    const ox = cell[0] * edge;
    const oy = cell[1] * edge;

    for (let dy = 0; dy < edge; dy++) {
      for (let dx = 0; dx < edge; dx++) {
        footprint.push([ox + dx, oy + dy]);
      }
    }
  }

  return footprint;
}

function footprintKeys(cells, scale) {
  return expandCellsToFootprint(cells, scale).map(
    (cell) => coordinateKey(cell[0], cell[1])
  );
}

function worldOriginForFace(gridX, gridY, scale, faceSize) {
  const edge = max(1, scale || 1);

  return {
    x: (gridX * edge + edge * 0.5) * faceSize,
    z: (gridY * edge + edge * 0.5) * faceSize
  };
}

function buildNetTypeSlotOptions() {
  for (let slot = 0; slot < 3; slot++) {
    const select =
      controls[`netTypeSlot${slot}`];

    select.innerHTML = "";

    for (
      let typeIndex = 0;
      typeIndex < CUBE_NET_LABELS.length;
      typeIndex++
    ) {
      const option =
        document.createElement("option");

      option.value = String(typeIndex);
      option.textContent =
        CUBE_NET_LABELS[typeIndex];

      select.appendChild(option);
    }

    select.value = String(
      min(slot, CUBE_NETS.length - 1)
    );
  }
}

function syncNetTypeUI() {
  const isSelect =
    controls.netTypeMode.value === "select";

  controls.netTypeSelectControls.classList.toggle(
    "hidden",
    !isSelect
  );

  if (!isSelect) {
    return;
  }

  const count = constrain(
    Number(controls.netTypeCount.value) || 1,
    1,
    3
  );

  controls.netTypeCount.value = String(count);
  controls.netTypeCountValue.textContent =
    String(count);

  for (let slot = 0; slot < 3; slot++) {
    controls[`netTypeSlotGroup${slot}`]
      .classList.toggle(
        "hidden",
        slot >= count
      );
  }
}

function invalidateNetTypeCaches() {
  packCacheKey = "";
  cascadeCacheKey = "";
  rollGridCacheKey = "";
  wanderCacheKey = "";
  insideOutCacheKey = "";
}

function randomizePlacements() {
  placementSeed =
    floor(Math.random() * 1000000000);

  invalidateNetTypeCaches();
  scheduleSessionSave();
}

const RANDOMIZE_EXCLUDED_FIELDS = new Set([
  "aspectRatio",
  "animateFolding",
  "quickToggle",
  "foldProgress",
  "drapeAmount",
  "presentationPlacement",
  "cascadeMotionCurve"
]);

const RANDOMIZE_EXCLUDED_MODES = new Set([
  "image",
  "gradient"
]);

/*
 * Narrower ranges keep "randomize everything" from
 * landing on settings that stall the frame rate.
 */
const RANDOMIZE_RANGE_LIMITS = {
  cameraZoom: [0.7, 2.5],
  cascadeCount: [4, 80],
  animationSpeed: [0.004, 0.03],
  wanderSpeed: [0.004, 0.03],
  oneAtATimeHold: [0.2, 2],
  oneAtATimeGap: [0, 3]
};

function pickRandomFrom(list) {
  return list[floor(Math.random() * list.length)];
}

function randomRangeValue(el, id) {
  const step = Number(el.step) || 1;
  let lo = Number(el.min);
  let hi = Number(el.max);

  if (RANDOMIZE_RANGE_LIMITS[id]) {
    lo = max(lo, RANDOMIZE_RANGE_LIMITS[id][0]);
    hi = min(hi, RANDOMIZE_RANGE_LIMITS[id][1]);
  }

  const steps = floor((hi - lo) / step + 1e-9);
  const value =
    lo + floor(Math.random() * (steps + 1)) * step;
  const decimals =
    (String(el.step).split(".")[1] || "").length;

  return value.toFixed(decimals);
}

function randomizeEverything() {
  applyPresetSnapshot(buildRandomizedSnapshot());
  resetShuffleInnerColors();
}

/*
 * `modeWeights` maps sketch modes to relative odds
 * (default 1) when picking the mode.
 */
function buildRandomizedSnapshot(modeWeights = null) {
  const snapshot = JSON.parse(
    JSON.stringify(collectPresetSnapshot())
  );
  const fields = snapshot.fields;

  for (const id of PRESET_FIELD_IDS) {
    const el = controls[id];

    if (!el || RANDOMIZE_EXCLUDED_FIELDS.has(id)) {
      continue;
    }

    if (el.type === "checkbox") {
      fields[id] = Math.random() < 0.5;
    } else if (el.type === "range") {
      fields[id] = randomRangeValue(el, id);
    } else if (el.tagName === "SELECT") {
      const options = [...el.options]
        .filter((option) => !option.disabled)
        .map((option) => option.value)
        .filter((value) =>
          id !== "sketchMode" ||
          (!RANDOMIZE_EXCLUDED_MODES.has(value) &&
            !REMOVED_SKETCH_MODES.has(value))
        );

      if (options.length) {
        fields[id] =
          id === "sketchMode" && modeWeights
            ? pickWeightedFrom(options, modeWeights)
            : pickRandomFrom(options);
      }
    }
  }

  const scaleIds = ["cubeScale1", "cubeScale2", "cubeScale3"];

  if (scaleIds.every((id) => Number(fields[id]) <= 0)) {
    fields[pickRandomFrom(scaleIds)] =
      controls.cubeScale1.max;
  }

  const background = (
    BACKGROUNDS[fields.backgroundTheme] || ""
  ).toLowerCase();
  const colors = PALETTE.filter(
    (hex) => hex.toLowerCase() !== background
  );

  snapshot.monoColor = pickRandomFrom(colors);
  snapshot.outerColor = pickRandomFrom(colors);
  snapshot.innerColor = pickRandomFrom(
    colors.filter((hex) => hex !== snapshot.outerColor)
  );
  snapshot.placementSeed =
    floor(Math.random() * 1000000000);

  fields.drapeAmount = Math.random() < 0.5 ? "0" : "1";
  fields.presentationPlacement = false;
  fields.showFaceShading = false;
  fields.cascadeMotionCurve = "ease";

  if (fields.showDivisions) {
    fields.divisionMatchBackground = true;
  }

  return snapshot;
}

function pickWeightedFrom(list, weights) {
  const weightOf = (value) =>
    weights[value] === undefined ? 1 : weights[value];
  const total = list.reduce(
    (sum, value) => sum + weightOf(value),
    0
  );
  let roll = Math.random() * total;

  for (const value of list) {
    roll -= weightOf(value);

    if (roll < 0) {
      return value;
    }
  }

  return list[list.length - 1];
}

function readPresetStore() {
  try {
    const raw =
      localStorage.getItem(PRESET_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    let migrated = false;

    for (const name of Object.keys(parsed)) {
      const updated = migratePresetSnapshot(
        parsed[name]
      );

      if (updated !== parsed[name]) {
        parsed[name] = updated;
        migrated = true;
      }
    }

    if (migrated) {
      writePresetStore(parsed);
    }

    return parsed;
  } catch (error) {
    return {};
  }
}

function writePresetStore(store) {
  if (RENDER_WORKER) {
    return;
  }

  localStorage.setItem(
    PRESET_STORAGE_KEY,
    JSON.stringify(store)
  );
}

function scheduleSessionSave() {
  if (sessionRestoring || reelRendering || RENDER_WORKER) {
    return;
  }

  if (sessionSaveTimer !== null) {
    clearTimeout(sessionSaveTimer);
  }

  sessionSaveTimer = setTimeout(() => {
    sessionSaveTimer = null;
    saveSessionSettings();
  }, 200);
}

function saveSessionSettings() {
  if (
    RENDER_WORKER ||
    sessionRestoring ||
    reelRendering ||
    !controls.foldProgress
  ) {
    return;
  }

  try {
    localStorage.setItem(
      SESSION_SETTINGS_KEY,
      JSON.stringify(collectPresetSnapshot())
    );
  } catch (error) {
    /*
     * Quota / private-mode failures shouldn't break
     * the sketch.
     */
  }
}

function restoreSessionSettings() {
  let preset = null;

  try {
    const raw =
      localStorage.getItem(SESSION_SETTINGS_KEY);

    if (!raw) {
      return false;
    }

    preset = JSON.parse(raw);
  } catch (error) {
    return false;
  }

  if (!preset || typeof preset !== "object") {
    return false;
  }

  const migrated = migratePresetSnapshot(preset);

  if (migrated !== preset) {
    preset = migrated;

    try {
      localStorage.setItem(
        SESSION_SETTINGS_KEY,
        JSON.stringify(preset)
      );
    } catch (error) {
      /*
       * Quota / private-mode failures shouldn't block
       * restoring the session.
       */
    }
  }

  sessionRestoring = true;
  applyPresetSnapshot(preset);
  sessionRestoring = false;
  return true;
}

function refreshPresetSelect(selectedName = "") {
  const store = readPresetStore();
  const names = Object.keys(store).sort((a, b) => {
    return a.localeCompare(b);
  });

  const select = controls.presetSelect;
  const previous =
    selectedName || select.value;

  select.innerHTML = "";

  const placeholder =
    document.createElement("option");

  placeholder.value = "";
  placeholder.textContent = "Load a preset…";
  select.appendChild(placeholder);

  for (const name of names) {
    const option =
      document.createElement("option");

    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }

  const values = [...names];

  if (typeof readReelPresetStore === "function") {
    const sequences = readReelPresetStore();
    const sequenceNames = Object.keys(sequences).sort(
      (a, b) => a.localeCompare(b)
    );

    if (sequenceNames.length) {
      const group = document.createElement("optgroup");
      group.label = "Sequences";

      for (const name of sequenceNames) {
        const count = Array.isArray(sequences[name].clips)
          ? sequences[name].clips.length
          : 0;
        const option = document.createElement("option");

        option.value = SEQUENCE_PRESET_PREFIX + name;
        option.textContent =
          `${name} · ${count} clip${count === 1 ? "" : "s"}`;
        group.appendChild(option);
        values.push(option.value);
      }

      select.appendChild(group);
    }
  }

  if (
    previous &&
    values.includes(previous)
  ) {
    select.value = previous;
  }
}

const SEQUENCE_PRESET_PREFIX = "sequence:";

function getSelectedSequencePresetName() {
  const value = controls.presetSelect.value;

  return value.startsWith(SEQUENCE_PRESET_PREFIX)
    ? value.slice(SEQUENCE_PRESET_PREFIX.length)
    : null;
}

function collectPresetSnapshot() {
  const fields = {};

  for (const id of PRESET_FIELD_IDS) {
    const el = controls[id];

    if (!el) {
      continue;
    }

    if (el.type === "checkbox") {
      fields[id] = el.checked;
    } else {
      fields[id] = el.value;
    }
  }

  return {
    version: 1,
    savedAt: Date.now(),
    fields,
    monoColor,
    outerColor,
    innerColor,
    placementSeed,
    animatedProgress,
    animationDirection
  };
}

function saveCurrentPreset() {
  const name =
    controls.presetName.value.trim();

  if (!name) {
    controls.presetName.focus();
    return;
  }

  const store = readPresetStore();
  store[name] = collectPresetSnapshot();
  writePresetStore(store);

  refreshPresetSelect(name);
  controls.presetName.value = "";
}

function loadSelectedPreset() {
  const name = controls.presetSelect.value;

  if (!name) {
    return;
  }

  const sequenceName = getSelectedSequencePresetName();

  if (sequenceName !== null) {
    loadSequencePresetByName(sequenceName);
    return;
  }

  const store = readPresetStore();
  const preset = store[name];

  if (!preset || !preset.fields) {
    return;
  }

  applyPresetSnapshot(preset);
}

function deleteSelectedPreset() {
  const name = controls.presetSelect.value;

  if (!name) {
    return;
  }

  const sequenceName = getSelectedSequencePresetName();

  if (sequenceName !== null) {
    deleteSequencePresetByName(sequenceName);
    return;
  }

  const store = readPresetStore();

  if (!store[name]) {
    return;
  }

  delete store[name];
  writePresetStore(store);
  refreshPresetSelect("");
  controls.presetName.value = "";
}

function applyPresetSnapshot(preset) {
  const fields = preset.fields || {};

  contentReferenceAspect = null;
  splitViewMode = "crop";

  for (const id of PRESET_FIELD_IDS) {
    if (!(id in fields)) {
      continue;
    }

    const el = controls[id];

    if (!el) {
      continue;
    }

    if (el.type === "checkbox") {
      el.checked = Boolean(fields[id]);
    } else if (id === "aspectRatio") {
      el.value = migrateAspectKey(String(fields[id]));
    } else {
      el.value = String(fields[id]);
    }
  }

  controls.showGrid.checked = false;
  controls.showCubeGrid.checked = false;

  if (typeof preset.monoColor === "string") {
    monoColor = migrateRetiredPaletteColor(
      preset.monoColor
    );
  }

  if (typeof preset.outerColor === "string") {
    outerColor = migrateRetiredPaletteColor(
      preset.outerColor
    );
  }

  if (typeof preset.innerColor === "string") {
    innerColor = migrateRetiredPaletteColor(
      preset.innerColor
    );
  }

  if (typeof preset.placementSeed === "number") {
    placementSeed = preset.placementSeed;
  }

  if (REMOVED_SKETCH_MODES.has(controls.sketchMode.value)) {
    controls.sketchMode.value = "gridded";
  }

  if (typeof preset.animatedProgress === "number") {
    animatedProgress = preset.animatedProgress;
    controls.foldProgress.value =
      String(animatedProgress);
  }

  if (
    typeof preset.animationDirection === "number"
  ) {
    animationDirection = preset.animationDirection;
  }

  invalidateNetTypeCaches();
  syncSketchModeUI();
  syncNetTypeUI();
  syncColorModeUI();
  syncCoverageControlsUI();
  applyBackgroundTheme();
  applyAspectRatio();
  updateAllValueLabels();

  syncingQuickToggle = true;
  controls.quickToggle.checked =
    controls.showDivisions.checked &&
    controls.showFaceShading.checked;
  syncingQuickToggle = false;
  syncLightAngleUI();

  if (
    controls.presetSelect.value &&
    getSelectedSequencePresetName() === null
  ) {
    controls.presetName.value =
      controls.presetSelect.value;
  }

  scheduleSessionSave();
}

function syncLightAngleUI() {
  controls.lightAngleGroup.classList.toggle(
    "hidden",
    !controls.showFaceShading.checked
  );
}

function syncColorModeUI() {
  const isImage = controls.sketchMode.value === "image";
  const mode = controls.colorMode.value;
  const isMono = mode === "monochromatic";
  const isTwoTone = isTwoToneColorMode(mode);
  const isMultiOuter = mode === "two-tone-multi";
  const imageNeedsPalette =
    isImage &&
    controls.imageColorMode.value === "shades";

  if (controls.colorModeGroup) {
    controls.colorModeGroup.classList.toggle(
      "hidden",
      isImage
    );
  }

  controls.monoColorGroup.classList.toggle(
    "hidden",
    isImage ? !imageNeedsPalette : !isMono
  );

  controls.twoToneColorGroup.classList.toggle(
    "hidden",
    isImage || !isTwoTone
  );

  if (controls.outerColorRow) {
    controls.outerColorRow.classList.toggle(
      "hidden",
      isMultiOuter
    );
  }

  if (controls.outerPalette) {
    controls.outerPalette.classList.toggle(
      "hidden",
      isMultiOuter
    );
  }

  if (controls.twoToneNote) {
    controls.twoToneNote.textContent =
      isMultiOuter
        ? "Each plane uses a different outer palette color; the inside of every face shares the inner color."
        : mode === "two-tone-shuffle"
          ? "Cubes start with the inner color, then switch to a random palette color once per fold cycle — when flat in Gridded, Cascade and One at a time; while closed in Wander, Inside out and Roll grid."
          : mode === "two-tone-shuffle-sync"
            ? "Like shuffle inside, but every cube moves to the same new random color each round, switching at its own fold moment."
            : "Outside of each face uses the outer color; the inside uses the inner color.";
  }

  refreshPaletteSelection();
  syncImageAnimateButton();
}

function buildPaletteSwatches() {
  fillPalette(
    controls.monoPalette,
    () => monoColor,
    (hex) => {
      monoColor = hex;
      if (controls.sketchMode.value !== "image") {
        controls.colorMode.value =
          "monochromatic";
      }
      syncColorModeUI();
      scheduleSessionSave();
    }
  );

  fillPalette(
    controls.outerPalette,
    () => outerColor,
    (hex) => {
      outerColor = hex;
      if (!isTwoToneColorMode(controls.colorMode.value)) {
        controls.colorMode.value = "two-tone";
      }
      syncColorModeUI();
      scheduleSessionSave();
    }
  );

  fillPalette(
    controls.innerPalette,
    () => innerColor,
    (hex) => {
      innerColor = hex;
      resetShuffleInnerColors();
      if (!isTwoToneColorMode(controls.colorMode.value)) {
        controls.colorMode.value = "two-tone";
      }
      syncColorModeUI();
      scheduleSessionSave();
    }
  );

  refreshPaletteSelection();
}

function fillPalette(container, getSelected, onPick) {
  container.innerHTML = "";

  for (const hex of PALETTE) {
    const swatch =
      document.createElement("button");

    swatch.type = "button";
    swatch.className = "swatch";
    swatch.dataset.color = hex;
    swatch.style.background = hex;
    swatch.title = hex;

    swatch.addEventListener("click", () => {
      onPick(hex);
    });

    container.appendChild(swatch);
  }

  /*
   * Stash getter so refresh can update selection
   * without rebuilding the buttons.
   */
  container._getSelected = getSelected;
}

function refreshPaletteSelection() {
  for (const container of [
    controls.monoPalette,
    controls.outerPalette,
    controls.innerPalette
  ]) {
    const selected =
      container._getSelected
        ? container._getSelected()
        : "";

    container
      .querySelectorAll(".swatch")
      .forEach((el) => {
        el.classList.toggle(
          "selected",
          el.dataset.color === selected
        );
      });
  }
}

function getControls() {
  const ids = [
    "sketchMode",
    "netTypeFilterGroup",
    "netTypeMode",
    "netTypeSelectControls",
    "netTypeCount",
    "netTypeCountValue",
    "netTypeSlotGroup0",
    "netTypeSlotGroup1",
    "netTypeSlotGroup2",
    "netTypeSlot0",
    "netTypeSlot1",
    "netTypeSlot2",
    "aspectRatio",
    "cascadeDirection",
    "cascadeCount",
    "cascadePause",
    "cascadeMotionCurve",
    "cascadePhaseOffset",
    "cascadeDirectionGroup",
    "cascadeCountGroup",
    "cascadePauseGroup",
    "cascadeMotionCurveGroup",
    "cascadePhaseOffsetGroup",
    "rollGridControls",
    "rollGridMotion",
    "rollGridDirectionGroup",
    "rollGridDirection",
    "rollGridDestOffset",
    "rollGridRadialGroup",
    "rollGridRadialBias",
    "rollGridRadialBiasLabel",
    "rollGridUniform",
    "rollGridPause",
    "insideOutControls",
    "insideOutGridFullness",
    "insideOutFlatStop",
    "insideOutPause",
    "wanderControls",
    "wanderGridFullness",
    "wanderFrequency",
    "wanderSpeed",
    "imageModeControls",
    "imageUpload",
    "imageUploadNote",
    "imageScaleBias",
    "imageColorMode",
    "imageAnimateButton",
    "griddedPlacementControls",
    "sharedFoldControls",
    "griddedCoverageControls",
    "griddedActionControls",
    "griddedFoldButtons",
    "directionLabel",
    "presetName",
    "savePresetButton",
    "presetSelect",
    "loadPresetButton",
    "deletePresetButton",
    "gridPlacement",
    "gridPlacementNote",
    "placementSkew",
    "foldStagger",
    "foldStaggerCarryOver",
    "foldProgress",
    "foldMode",
    "drapeAmount",
    "cubeCoverage",
    "coveragePercentControls",
    "coverageCountControls",
    "cubeCount",
    "animationSpeed",
    "oneAtATimeControls",
    "oneAtATimeHold",
    "oneAtATimeGap",
    "compositionPlacement",
    "compositionPlacementNote",
    "presentationPlacement",
    "presentationPlacementControls",
    "presentationPaletteBrightness",
    "presentationDivisionWeight",
    "gridSize",
    "cubeScale1",
    "cubeScale2",
    "cubeScale3",
    "layoutSpacing",
    "cameraZoom",
    "backgroundTheme",
    "colorModeGroup",
    "colorMode",
    "monoColorGroup",
    "monoPalette",
    "twoToneColorGroup",
    "outerColorRow",
    "outerPalette",
    "innerPalette",
    "twoToneNote",
    "animateFolding",
    "quickToggle",
    "showDivisions",
    "divisionMatchBackground",
    "divisionAngleFilter",
    "showGrid",
    "showCubeGrid",
    "allowBoxExtents",
    "showFaceShading",
    "lightAngle",
    "lightAngleGroup",
    "unfoldButton",
    "foldButton",
    "randomizePlacementsButton",
    "exportButton",
    "randomizeEverythingButton"
  ];

  for (const id of ids) {
    const element =
      document.getElementById(id);

    if (!element) {
      throw new Error(
        `Missing interface element: ${id}`
      );
    }

    controls[id] = element;
  }
}

function connectControls() {
  const rangeIds = [
    "foldProgress",
    "drapeAmount",
    "cubeCoverage",
    "cubeCount",
    "placementSkew",
    "foldStagger",
    "cascadeCount",
    "cascadePause",
    "cascadePhaseOffset",
    "animationSpeed",
    "gridSize",
    "cubeScale1",
    "cubeScale2",
    "cubeScale3",
    "layoutSpacing",
    "cameraZoom",
    "rollGridRadialBias",
    "rollGridDestOffset",
    "rollGridPause",
    "insideOutGridFullness",
    "insideOutFlatStop",
    "insideOutPause",
    "wanderGridFullness",
    "wanderFrequency",
    "wanderSpeed",
    "oneAtATimeHold",
    "oneAtATimeGap"
  ];

  for (const id of rangeIds) {
    controls[id].addEventListener(
      "input",
      updateAllValueLabels
    );
  }

  controls.foldProgress.addEventListener(
    "input",
    () => {
      animatedProgress = Number(
        controls.foldProgress.value
      );
    }
  );

  controls.sketchMode.addEventListener(
    "change",
    () => {
      syncSketchModeUI();
      cascadeCacheKey = "";
      packCacheKey = "";
      rollGridCacheKey = "";
      insideOutCacheKey = "";
      wanderCacheKey = "";
      resetOneAtATimeState();
      resetShuffleInnerColors();

      if (controls.sketchMode.value === "one-at-a-time") {
        applyOneAtATimeDivisionDefaults();
      }
    }
  );

  controls.compositionPlacement.addEventListener(
    "change",
    () => {
      syncSketchModeUI();
      resetOneAtATimeState();
    }
  );

  controls.presentationPlacement.addEventListener(
    "change",
    () => {
      syncPresentationPlacementUI();
      resetOneAtATimeState();
    }
  );

  controls.presentationPaletteBrightness.addEventListener(
    "input",
    () => {
      setValueLabel(
        "presentationPaletteBrightness",
        `${controls.presentationPaletteBrightness.value}%`
      );
      resetOneAtATimeState();
    }
  );

  controls.presentationDivisionWeight.addEventListener(
    "input",
    () => {
      setValueLabel(
        "presentationDivisionWeight",
        Number(
          controls.presentationDivisionWeight.value
        ).toFixed(2)
      );
      resetOneAtATimeState();
    }
  );

  controls.wanderGridFullness.addEventListener(
    "change",
    () => {
      wanderCacheKey = "";
    }
  );

  controls.wanderFrequency.addEventListener(
    "input",
    () => {
      setValueLabel(
        "wanderFrequency",
        `${controls.wanderFrequency.value}%`
      );
    }
  );

  controls.wanderSpeed.addEventListener(
    "input",
    () => {
      setValueLabel(
        "wanderSpeed",
        Number(controls.wanderSpeed.value).toFixed(3)
      );
    }
  );

  controls.rollGridMotion.addEventListener(
    "change",
    () => {
      syncRollGridMotionUI();
      rollGridCacheKey = "";
    }
  );

  controls.rollGridDirection.addEventListener(
    "change",
    () => {
      rollGridCacheKey = "";
    }
  );

  controls.rollGridDestOffset.addEventListener(
    "input",
    () => {
      setValueLabel(
        "rollGridDestOffset",
        `${controls.rollGridDestOffset.value}%`
      );
      rollGridCacheKey = "";
    }
  );

  controls.rollGridUniform.addEventListener(
    "change",
    () => {
      rollGridCacheKey = "";
    }
  );

  controls.rollGridRadialBias.addEventListener(
    "input",
    () => {
      setValueLabel(
        "rollGridRadialBias",
        `${controls.rollGridRadialBias.value}%`
      );
    }
  );

  controls.insideOutGridFullness.addEventListener(
    "input",
    () => {
      setValueLabel(
        "insideOutGridFullness",
        `${controls.insideOutGridFullness.value}%`
      );
      insideOutCacheKey = "";
    }
  );

  controls.insideOutGridFullness.addEventListener(
    "change",
    () => {
      insideOutCacheKey = "";
    }
  );

  controls.insideOutPause.addEventListener(
    "input",
    () => {
      setValueLabel(
        "insideOutPause",
        `${Number(controls.insideOutPause.value).toFixed(2)}s`
      );
    }
  );

  controls.imageUpload.addEventListener(
    "change",
    handleImageUpload
  );

  controls.imageScaleBias.addEventListener(
    "change",
    () => {
      packCacheKey = "";
    }
  );

  controls.imageColorMode.addEventListener(
    "change",
    () => {
      syncColorModeUI();
    }
  );

  controls.imageAnimateButton.addEventListener(
    "click",
    toggleImageAnimate
  );

  controls.netTypeMode.addEventListener(
    "change",
    () => {
      syncNetTypeUI();
      invalidateNetTypeCaches();
      updateAllValueLabels();
    }
  );

  controls.netTypeCount.addEventListener(
    "input",
    () => {
      syncNetTypeUI();
      invalidateNetTypeCaches();
      updateAllValueLabels();
    }
  );

  for (let slot = 0; slot < 3; slot++) {
    controls[`netTypeSlot${slot}`].addEventListener(
      "change",
      () => {
        invalidateNetTypeCaches();
        updateAllValueLabels();
      }
    );
  }

  controls.aspectRatio.addEventListener(
    "change",
    applyAspectRatio
  );

  controls.cascadeDirection.addEventListener(
    "change",
    () => {
      cascadeCacheKey = "";
    }
  );

  controls.quickToggle.addEventListener(
    "change",
    () => {
      if (syncingQuickToggle) {
        return;
      }

      const on = controls.quickToggle.checked;

      syncingQuickToggle = true;
      controls.showDivisions.checked = on;
      controls.showFaceShading.checked = on;
      syncingQuickToggle = false;
      syncLightAngleUI();
    }
  );

  const syncQuickFromParts = () => {
    if (syncingQuickToggle) {
      return;
    }

    syncingQuickToggle = true;
    controls.quickToggle.checked =
      controls.showDivisions.checked &&
      controls.showFaceShading.checked;
    syncingQuickToggle = false;
  };

  controls.showDivisions.addEventListener(
    "change",
    syncQuickFromParts
  );

  controls.allowBoxExtents.addEventListener(
    "change",
    () => {
      rollGridCacheKey = "";
    }
  );

  controls.showFaceShading.addEventListener(
    "change",
    () => {
      syncQuickFromParts();
      syncLightAngleUI();
    }
  );

  controls.gridPlacement.addEventListener(
    "change",
    () => {
      packCacheKey = "";
      syncCoverageControlsUI();
      updateAllValueLabels();
    }
  );

  controls.placementSkew.addEventListener(
    "input",
    () => {
      packCacheKey = "";
      updateAllValueLabels();
    }
  );

  controls.foldStagger.addEventListener(
    "input",
    () => {
      syncFoldProgressRange();
      updateAllValueLabels();
    }
  );

  controls.foldStaggerCarryOver.addEventListener(
    "change",
    () => {
      syncFoldProgressRange();
      updateAllValueLabels();
    }
  );

  controls.cascadeCount.addEventListener(
    "input",
    () => {
      updateAllValueLabels();
    }
  );

  controls.cascadePhaseOffset.addEventListener(
    "input",
    () => {
      cascadeCacheKey = "";
      updateAllValueLabels();
    }
  );

  const invalidateScaleCaches = () => {
    packCacheKey = "";
    cascadeCacheKey = "";
    insideOutCacheKey = "";
    updateAllValueLabels();
  };

  controls.cubeScale1.addEventListener(
    "input",
    invalidateScaleCaches
  );

  controls.cubeScale2.addEventListener(
    "input",
    invalidateScaleCaches
  );

  controls.cubeScale3.addEventListener(
    "input",
    invalidateScaleCaches
  );

  controls.unfoldButton.addEventListener(
    "click",
    () => {
      animatedProgress = 0;
      animationDirection = 1;
      animationPauseTimer = 0;

      controls.foldProgress.value = 0;
      controls.animateFolding.checked = false;

      syncImageAnimateButton();
      updateAllValueLabels();
    }
  );

  controls.foldButton.addEventListener(
    "click",
    () => {
      const settings = getSettings();
      const foldEnd =
        1 + getMaxFoldStaggerDelay(settings);

      animatedProgress = foldEnd;
      animationDirection = -1;
      animationPauseTimer = 0;

      controls.foldProgress.value = foldEnd;
      controls.animateFolding.checked = false;

      syncImageAnimateButton();
      updateAllValueLabels();
    }
  );

  controls.randomizePlacementsButton.addEventListener(
    "click",
    randomizePlacements
  );

  controls.randomizeEverythingButton.addEventListener(
    "click",
    randomizeEverything
  );

  controls.savePresetButton.addEventListener(
    "click",
    saveCurrentPreset
  );

  controls.loadPresetButton.addEventListener(
    "click",
    () => {
      loadSelectedPreset();
    }
  );

  controls.presetSelect.addEventListener(
    "change",
    () => {
      /* Sequences replace the reel, so they wait for Load. */
      if (
        controls.presetSelect.value &&
        getSelectedSequencePresetName() === null
      ) {
        loadSelectedPreset();
      }
    }
  );

  controls.deletePresetButton.addEventListener(
    "click",
    deleteSelectedPreset
  );

  controls.exportButton.addEventListener(
    "click",
    () => {
      saveCanvas(
        "connected-isometric-cube-nets",
        "png"
      );
    }
  );

  controls.backgroundTheme.addEventListener(
    "change",
    () => {
      applyBackgroundTheme();
    }
  );

  controls.colorMode.addEventListener(
    "change",
    () => {
      resetShuffleInnerColors();
      syncColorModeUI();
    }
  );

  /*
   * Persist every control that belongs in a session
   * snapshot, including checkboxes / selects that
   * don't always refresh value labels.
   */
  for (const id of PRESET_FIELD_IDS) {
    const el = controls[id];

    if (!el) {
      continue;
    }

    el.addEventListener("input", scheduleSessionSave);
    el.addEventListener("change", scheduleSessionSave);
  }
}

function getSettings() {
  const gridSize =
    Number(controls.gridSize.value);

  const cameraZoom =
    Number(controls.cameraZoom.value);

  const verticalView =
    getVerticalView(cameraZoom);

  const pixelsPerWorldUnit =
    height / (verticalView * 2);

  const isometricAxisProjection =
    sqrt(2 / 3);

  /*
   * Face size is locked to gridSize at zoom = 1 so
   * camera zoom actually zooms the scene instead of
   * being cancelled by a compensating face scale.
   */
  const referencePixelsPerWorldUnit =
    height / (getVerticalView(1) * 2 * getContentScale());

  const faceSize =
    gridSize /
    (
      referencePixelsPerWorldUnit *
      isometricAxisProjection
    );

  /*
   * Screen-space edge length of one face at the
   * current zoom — grids must use this to stay
   * aligned with the 3D nets.
   */
  const screenGridSize =
    faceSize *
    pixelsPerWorldUnit *
    isometricAxisProjection;

  return {
    sketchMode:
      controls.sketchMode.value,

    netTypeMode:
      controls.netTypeMode.value,

    netTypeCount:
      Number(controls.netTypeCount.value) || 1,

    netTypeSlots: [
      Number(controls.netTypeSlot0.value) || 0,
      Number(controls.netTypeSlot1.value) || 1,
      Number(controls.netTypeSlot2.value) || 2
    ],

    cascadeDirection:
      controls.cascadeDirection.value,

    cascadeCount:
      Number(controls.cascadeCount.value),

    cascadePause:
      Number(controls.cascadePause.value) || 0,

    cascadeMotionCurve:
      controls.cascadeMotionCurve.value || "ease",

    cascadePhaseOffset:
      Number(controls.cascadePhaseOffset.value) / 100,

    imageScaleBias:
      controls.imageScaleBias.value || "dark-large",

    imageColorMode:
      controls.imageColorMode.value || "faces",

    rollGridMotion:
      controls.rollGridMotion.value || "uniform",

    rollGridDirection:
      controls.rollGridDirection.value || "x+",

    rollGridDestOffset:
      Number(controls.rollGridDestOffset.value) / 100,

    rollGridRadialBias:
      Number(controls.rollGridRadialBias.value) / 100,

    rollGridUniform:
      controls.rollGridUniform.checked,

    rollGridPause:
      Number(controls.rollGridPause.value) || 0,

    insideOutGridFullness:
      Number(controls.insideOutGridFullness.value) / 100,

    insideOutFlatStop:
      controls.insideOutFlatStop.value || "pause-flat",

    insideOutPause:
      Number(controls.insideOutPause.value) || 0,

    wanderGridFullness:
      Number(controls.wanderGridFullness.value) / 100,

    wanderFrequency:
      Number(controls.wanderFrequency.value) / 100,

    wanderSpeed:
      Number(controls.wanderSpeed.value) || 0.008,

    gridPlacement:
      controls.gridPlacement.value,

    placementSkew:
      Number(controls.placementSkew.value) / 100,

    foldStagger:
      Number(controls.foldStagger.value) / 100,

    foldStaggerCarryOver:
      controls.foldStaggerCarryOver.checked,

    foldProgress:
      animatedProgress,

    foldMode:
      controls.foldMode.value,

    drapeAmount:
      Number(
        controls.drapeAmount.value
      ),

    cubeCoverage:
      Number(
        controls.cubeCoverage.value
      ) / 100,

    cubeCount:
      Number(controls.cubeCount.value) || 1,

    backgroundTheme:
      controls.backgroundTheme.value,

    colorMode:
      controls.colorMode.value,

    outerColor,
    innerColor,

    animationSpeed:
      Number(
        controls.animationSpeed.value
      ),

    oneAtATimeHold:
      Number(
        controls.oneAtATimeHold.value
      ),

    oneAtATimeGap:
      Number(
        controls.oneAtATimeGap.value
      ),

    compositionPlacement:
      controls.compositionPlacement.value,

    presentationPlacement:
      controls.presentationPlacement.checked,

    presentationPaletteBrightness:
      Number(
        controls.presentationPaletteBrightness.value
      ) || 100,

    presentationDivisionWeight:
      Number(
        controls.presentationDivisionWeight.value
      ) || 1,

    /*
     * Authoring cell size in screen pixels at zoom 1.
     */
    gridSize,

    /*
     * Relative mix of 1× / 2× / 3× plain-faced cubes.
     * Normalized at use sites; all-zero falls back to 1×.
     */
    cubeScale1:
      Number(controls.cubeScale1.value) || 0,

    cubeScale2:
      Number(controls.cubeScale2.value) || 0,

    cubeScale3:
      Number(controls.cubeScale3.value) || 0,

    /*
     * Current on-screen edge length after zoom.
     */
    screenGridSize,

    /*
     * Calculated world-space cube edge length.
     */
    faceSize,

    layoutSpacing:
      Number(
        controls.layoutSpacing.value
      ),

    cameraZoom,

    verticalView,

    animateFolding:
      controls.animateFolding.checked,

    showDivisions:
      controls.showDivisions.checked,

    divisionMatchBackground:
      controls.divisionMatchBackground.checked,

    divisionAngleFilter:
      controls.divisionAngleFilter.value,

    showGrid:
      controls.showGrid.checked,

    showCubeGrid:
      controls.showCubeGrid.checked,

    allowBoxExtents:
      controls.allowBoxExtents.checked,

    showFaceShading:
      controls.showFaceShading.checked,

    lightAngle:
      controls.lightAngle.value
  };
}

function updateAllValueLabels() {
  setValueLabel(
    "foldProgress",
    Number(
      controls.foldProgress.value
    ).toFixed(2)
  );

  setValueLabel(
    "drapeAmount",
    Number(
      controls.drapeAmount.value
    ).toFixed(2)
  );

  setValueLabel(
    "cubeCoverage",
    `${controls.cubeCoverage.value}%`
  );

  setValueLabel(
    "cubeCount",
    `${controls.cubeCount.value}`
  );

  setValueLabel(
    "placementSkew",
    `${controls.placementSkew.value}%`
  );

  setValueLabel(
    "foldStagger",
    `${controls.foldStagger.value}%`
  );

  setValueLabel(
    "cascadeCount",
    `${controls.cascadeCount.value}`
  );

  setValueLabel(
    "cascadePause",
    `${Number(controls.cascadePause.value).toFixed(2)}s`
  );

  setValueLabel(
    "cascadePhaseOffset",
    `${controls.cascadePhaseOffset.value}%`
  );

  setValueLabel(
    "animationSpeed",
    Number(
      controls.animationSpeed.value
    ).toFixed(3)
  );

  setValueLabel(
    "gridSize",
    `${controls.gridSize.value}px`
  );

  setValueLabel(
    "cubeScale1",
    `${controls.cubeScale1.value}`
  );

  setValueLabel(
    "cubeScale2",
    `${controls.cubeScale2.value}`
  );

  setValueLabel(
    "cubeScale3",
    `${controls.cubeScale3.value}`
  );

  setValueLabel(
    "layoutSpacing",
    `${Number(
      controls.layoutSpacing.value
    ).toFixed(2)} cells`
  );

  setValueLabel(
    "cameraZoom",
    Number(
      controls.cameraZoom.value
    ).toFixed(2)
  );

  setValueLabel(
    "presentationPaletteBrightness",
    `${controls.presentationPaletteBrightness.value}%`
  );

  setValueLabel(
    "presentationDivisionWeight",
    Number(
      controls.presentationDivisionWeight.value
    ).toFixed(2)
  );

  setValueLabel(
    "rollGridRadialBias",
    `${controls.rollGridRadialBias.value}%`
  );

  setValueLabel(
    "rollGridDestOffset",
    `${controls.rollGridDestOffset.value}%`
  );

  setValueLabel(
    "rollGridPause",
    `${Number(controls.rollGridPause.value).toFixed(2)}s`
  );

  setValueLabel(
    "insideOutGridFullness",
    `${controls.insideOutGridFullness.value}%`
  );

  setValueLabel(
    "insideOutPause",
    `${Number(controls.insideOutPause.value).toFixed(2)}s`
  );

  setValueLabel(
    "wanderGridFullness",
    `${controls.wanderGridFullness.value}%`
  );

  setValueLabel(
    "wanderFrequency",
    `${controls.wanderFrequency.value}%`
  );

  setValueLabel(
    "wanderSpeed",
    Number(controls.wanderSpeed.value).toFixed(3)
  );

  setValueLabel(
    "oneAtATimeHold",
    `${Number(controls.oneAtATimeHold.value).toFixed(1)}s`
  );

  setValueLabel(
    "oneAtATimeGap",
    `${Number(controls.oneAtATimeGap.value).toFixed(1)}s`
  );

  syncFoldProgressRange();
}

function getEffectiveFoldDelay(foldDelay, settings) {
  const staggerMix = constrain(
    settings.foldStagger ?? 1,
    0,
    1
  );

  return foldDelay * staggerMix;
}

function getMaxFoldStaggerDelay(settings) {
  const staggerMix = constrain(
    settings.foldStagger ?? 1,
    0,
    1
  );

  if (
    !settings.foldStaggerCarryOver ||
    staggerMix <= 0 ||
    settings.sketchMode !== "gridded"
  ) {
    return 0;
  }

  ensurePackedLayout(settings);

  const placements = selectPlacementsForCoverage(
    packedPlacements.placements,
    settings
  );

  let maxDelay = 0;

  for (const placement of placements) {
    maxDelay = max(
      maxDelay,
      getEffectiveFoldDelay(
        placement.foldDelay,
        settings
      )
    );
  }

  return maxDelay;
}

/*
 * Seconds for one full fold cycle (fold + unfold, with
 * pauses) at 60 simulation steps per second, or null
 * when the mode has no repeating fold (static frame).
 * Roll grid counts one roll as a cycle.
 */
function getFoldCycleSeconds(settings, staggerDelay = 0) {
  const speed = Number(settings.animationSpeed) || 0;

  if (speed <= 0) {
    return null;
  }

  const perSec = speed * 60;
  const mode = settings.sketchMode;

  if (mode === "gridded" || mode === "image") {
    if (!settings.animateFolding) {
      return null;
    }

    return (
      (2 * (1 + staggerDelay)) / perSec +
      2 * max(0, Number(settings.cascadePause) || 0)
    );
  }

  if (mode === "cascade") {
    return (
      2 / (perSec * 1.65) +
      2 * max(0, Number(settings.cascadePause) || 0)
    );
  }

  if (mode === "one-at-a-time") {
    return (
      2 / perSec +
      max(0, Number(settings.oneAtATimeHold) || 0) +
      max(0, Number(settings.oneAtATimeGap) || 0)
    );
  }

  if (mode === "inside-out") {
    return (
      insideOutCycleLength(settings) /
      insideOutFlipRatePerSec(settings)
    );
  }

  if (mode === "roll-grid") {
    return (
      (1 + rollGridPauseUnits(settings)) /
      rollGridTipRatePerSec(settings)
    );
  }

  if (mode === "wander-roll") {
    return 1 / wanderRollRate(settings);
  }

  if (isWanderMode(mode)) {
    return 2 / wanderFoldRate(settings);
  }

  return null;
}

function staggeredNetFoldProgress(
  globalProgress,
  foldDelay,
  settings
) {
  const delay = constrain(
    getEffectiveFoldDelay(foldDelay, settings),
    0,
    FOLD_STAGGER_MAX
  );

  if (delay <= 0) {
    return constrain(globalProgress, 0, 1);
  }

  if (
    settings.foldStaggerCarryOver &&
    settings.sketchMode === "gridded"
  ) {
    return constrain(
      globalProgress - delay,
      0,
      1
    );
  }

  const span = max(0.001, 1 - delay);

  return constrain(
    (globalProgress - delay) / span,
    0,
    1
  );
}

function syncFoldProgressRange() {
  if (!controls.foldProgress) {
    return;
  }

  const settings = getSettings();
  const maxDelay =
    getMaxFoldStaggerDelay(settings);
  const max = 1 + maxDelay;

  controls.foldProgress.max = String(max);

  const current = Number(
    controls.foldProgress.value
  );

  if (current > max) {
    controls.foldProgress.value = max;
    animatedProgress = max;
  }
}

function syncSketchModeUI() {
  if (REMOVED_SKETCH_MODES.has(controls.sketchMode.value)) {
    controls.sketchMode.value = "gridded";
  }

  const mode = controls.sketchMode.value;
  const isCascade = mode === "cascade";
  const isGridded = mode === "gridded";
  const isGradient = mode === "gradient";
  const isImage = mode === "image";
  const isRollGrid = mode === "roll-grid";
  const isInsideOut = mode === "inside-out";
  const isWander = isWanderMode(mode);
  const isOneAtATime = mode === "one-at-a-time";

  document
    .getElementById("wanderNote")
    ?.classList.toggle("hidden", mode !== "wander");
  document
    .getElementById("wanderRollNote")
    ?.classList.toggle("hidden", mode !== "wander-roll");

  controls.oneAtATimeControls.classList.toggle(
    "hidden",
    !isOneAtATime
  );

  syncPresentationPlacementUI();

  const composition =
    controls.compositionPlacement.value;

  controls.compositionPlacementNote.textContent =
    composition === "edges"
      ? "Favor cubes that fold near the edges of the frame."
      : composition === "center-exclude"
        ? "Only fold cubes in the top or bottom third of the frame."
        : "Favor cubes that fold near the middle of the frame.";

  controls.imageModeControls.classList.toggle(
    "hidden",
    !isImage
  );

  controls.rollGridControls.classList.toggle(
    "hidden",
    !isRollGrid
  );

  controls.insideOutControls.classList.toggle(
    "hidden",
    !isInsideOut
  );

  controls.wanderControls.classList.toggle(
    "hidden",
    !isWander
  );

  controls.cascadeDirectionGroup.classList.toggle(
    "hidden",
    isGridded ||
      isImage ||
      isRollGrid ||
      isInsideOut ||
      isWander ||
      isOneAtATime
  );

  controls.cascadeCountGroup.classList.toggle(
    "hidden",
    !isCascade
  );

  controls.cascadePauseGroup.classList.toggle(
    "hidden",
    !isCascade && !isGridded && !isImage
  );

  controls.cascadePhaseOffsetGroup.classList.toggle(
    "hidden",
    !isCascade
  );

  controls.directionLabel.textContent =
    isGradient
      ? "Dense → empty"
      : "Cascade direction";

  controls.griddedPlacementControls.classList.toggle(
    "hidden",
    !isGridded && !isOneAtATime
  );

  controls.sharedFoldControls.classList.toggle(
    "hidden",
    !isGridded && !isImage && !isOneAtATime
  );

  controls.griddedCoverageControls.classList.toggle(
    "hidden",
    !isGridded && !isGradient && !isImage && !isOneAtATime
  );

  controls.griddedActionControls.classList.toggle(
    "hidden",
    !isGridded
  );

  controls.griddedFoldButtons.classList.toggle(
    "hidden",
    !isGridded && !isImage
  );

  syncRollGridMotionUI();
  syncColorModeUI();
  syncLightAngleUI();
  syncFoldProgressRange();
  updateImageUploadNote();
}

function syncRollGridMotionUI() {
  if (!controls.rollGridRadialGroup) {
    return;
  }

  const isRoll =
    controls.sketchMode.value === "roll-grid";
  const motion = controls.rollGridMotion.value;
  const showBias =
    isRoll &&
    (motion === "radial" || motion === "offset-center");

  controls.rollGridRadialGroup.classList.toggle(
    "hidden",
    !showBias
  );

  if (controls.rollGridRadialBiasLabel) {
    controls.rollGridRadialBiasLabel.textContent =
      motion === "offset-center"
        ? "Center phase lead"
        : "Center speed boost";
  }

  if (controls.rollGridDirectionGroup) {
    controls.rollGridDirectionGroup.classList.toggle(
      "hidden",
      !isRoll || motion !== "one-way"
    );
  }
}

function resolveAspectCanvasSize(preset) {
  const density = CANVAS_PIXEL_DENSITY;

  if (preset.outputPixels) {
    return {
      width: round(preset.width / density),
      height: round(preset.height / density),
      pixelDensity: density
    };
  }

  return {
    width: preset.width,
    height: preset.height,
    pixelDensity: density
  };
}

function applyAspectRatio() {
  const key =
    controls.aspectRatio
      ? controls.aspectRatio.value
      : "16:9";

  const preset =
    ASPECT_PRESETS[key] || ASPECT_PRESETS["16:9"];

  const size = resolveAspectCanvasSize(preset);

  if (pixelDensity() !== size.pixelDensity) {
    pixelDensity(size.pixelDensity);
  }

  if (
    width === size.width &&
    height === size.height
  ) {
    return;
  }

  resizeCanvas(size.width, size.height);

  /*
   * Layout depends on canvas bounds — rebuild packs
   * and cascade paths for the new frame.
   */
  packCacheKey = "";
  cascadeCacheKey = "";
  rollGridCacheKey = "";
  insideOutCacheKey = "";
}

function setValueLabel(controlId, text) {
  const label =
    document.getElementById(
      `${controlId}Value`
    );

  if (label) {
    label.textContent = text;
  }
}

function updateAnimation() {
  if (!controls.animateFolding.checked) {
    animatedProgress = Number(
      controls.foldProgress.value
    );
    animationPauseTimer = 0;

    return;
  }

  const settings = getSettings();
  const maxDelay =
    getMaxFoldStaggerDelay(settings);
  const foldEnd = 1 + maxDelay;

  const speed = Number(
    controls.animationSpeed.value
  );

  const pauseSec = max(
    0,
    Number(controls.cascadePause.value) || 0
  );

  const dt =
    frameDeltaMs() / 1000;

  if (animationPauseTimer > 0) {
    animationPauseTimer = max(
      0,
      animationPauseTimer - dt
    );

    controls.foldProgress.value =
      animatedProgress;

    setValueLabel(
      "foldProgress",
      animatedProgress.toFixed(2)
    );

    return;
  }

  animatedProgress +=
    speed * animationDirection;

  if (animatedProgress >= foldEnd) {
    animatedProgress = foldEnd;

    if (pauseSec > 0 && animationDirection > 0) {
      animationPauseTimer = pauseSec;
      animationDirection = -1;
    } else {
      animationDirection = -1;
    }
  } else if (animatedProgress <= 0) {
    animatedProgress = 0;

    if (pauseSec > 0 && animationDirection < 0) {
      animationPauseTimer = pauseSec;
      animationDirection = 1;
    } else {
      animationDirection = 1;
    }
  }

  controls.foldProgress.value =
    animatedProgress;

  setValueLabel(
    "foldProgress",
    animatedProgress.toFixed(2)
  );

  scheduleSessionSave();
}

function getVerticalView(zoom) {
  return 560 / zoom;
}

function setIsometricCamera(settings) {
  const verticalView =
    settings.verticalView;

  const horizontalView =
    verticalView *
    (width / height);

  ortho(
    -horizontalView,
    horizontalView,
    -verticalView,
    verticalView,
    -10000,
    10000
  );
  applyScreenTilt();

  /*
   * True isometric camera:
   *
   * Azimuth: 45°
   * Elevation: 35.264°
   *
   * World Y projects vertically, while world X and
   * Z project at matching ±30° screen angles.
   */
  const elevation =
    atan(1 / sqrt(2));

  const azimuth =
    QUARTER_PI;

  const distance = 2400;

  const horizontalDistance =
    distance * cos(elevation);

  const eyeX =
    horizontalDistance *
    cos(azimuth);

  const eyeY =
    -distance *
    sin(elevation);

  const eyeZ =
    horizontalDistance *
    sin(azimuth);

  camera(
    eyeX,
    eyeY,
    eyeZ,
    0,
    0,
    0,
    0,
    1,
    0
  );
}

function getIsometricEyePosition() {
  const elevation =
    atan(1 / sqrt(2));

  const azimuth =
    QUARTER_PI;

  const distance = 2400;

  const horizontalDistance =
    distance * cos(elevation);

  return [
    horizontalDistance * cos(azimuth),
    -distance * sin(elevation),
    horizontalDistance * sin(azimuth)
  ];
}

/*
 * The camera is orthographic, so facing and depth use
 * the fixed view direction — measuring toward the eye
 * point misjudges faces far from the canvas center.
 */
function getIsometricViewDirection() {
  return normalizeVector(getIsometricEyePosition());
}

function getFaceViewerDistance(center) {
  return (
    vectorLength(getIsometricEyePosition()) -
    dotVectors(center, getIsometricViewDirection())
  );
}

function beginCloserFaceDepthBias(units) {
  const gl = drawingContext;

  if (!gl || gl.POLYGON_OFFSET_FILL == null) {
    return;
  }

  /*
   * Positive units push a face back (inner shells) so
   * it never wins against an outer shell it touches.
   */
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(units > 0 ? 1 : -1, units);
}

function endCloserFaceDepthBias() {
  const gl = drawingContext;

  if (!gl || gl.POLYGON_OFFSET_FILL == null) {
    return;
  }

  gl.polygonOffset(0, 0);
  gl.disable(gl.POLYGON_OFFSET_FILL);
}

function beginScreenSpaceCamera() {
  ortho(
    -width * 0.5,
    width * 0.5,
    -height * 0.5,
    height * 0.5,
    -1000,
    1000
  );
  applyScreenTilt();

  camera(
    0,
    0,
    500,
    0,
    0,
    0,
    0,
    1,
    0
  );
}

function ensureFpsMeter() {
  if (fpsMeterElements) {
    return fpsMeterElements;
  }

  fpsMeterElements = {
    value: document.getElementById("fps-meter-value"),
    chart: document.getElementById("fps-meter-chart"),
    yAxis: document.getElementById("fps-meter-y-axis"),
    xAxis: document.getElementById("fps-meter-x-label")
  };

  return fpsMeterElements;
}

function formatFpsAxisSeconds(seconds) {
  const rounded = max(0, Number(seconds) || 0);

  if (rounded === 0) {
    return "0 s";
  }

  return `−${rounded.toFixed(1)} s`;
}

function getFpsChartScale() {
  let maxFps = 60;

  for (const sample of fpsHistory) {
    maxFps = max(maxFps, sample);
  }

  return max(30, ceil(maxFps / 15) * 15);
}

function updateFpsMeter(settings) {
  updateFpsSample();

  const meter = ensureFpsMeter();

  if (
    !meter.chart ||
    !meter.value ||
    fpsHistory.length < 2
  ) {
    return;
  }

  const maxFps = getFpsChartScale();
  const windowSec =
    fpsHistory.length / max(fpsDisplay, 1);

  meter.value.textContent = `${round(fpsDisplay)}`;

  if (meter.yAxis) {
    const yTicks = [
      maxFps,
      round(maxFps * (2 / 3)),
      round(maxFps * (1 / 3)),
      0
    ];

    meter.yAxis.innerHTML = yTicks
      .map((tick) => `<span>${tick}</span>`)
      .join("");
  }

  if (meter.xAxis) {
    const xTicks = [
      windowSec,
      windowSec * (2 / 3),
      windowSec * (1 / 3),
      0
    ];

    meter.xAxis.innerHTML = xTicks
      .map((tick) => `<span>${formatFpsAxisSeconds(tick)}</span>`)
      .join("");
  }

  const ctx = meter.chart.getContext("2d");
  const w = meter.chart.width;
  const h = meter.chart.height;
  const pad = { top: 4, right: 4, bottom: 4, left: 4 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const dark = settings.backgroundTheme === "dark";

  const gridColor = dark
    ? "rgba(254, 249, 243, 0.12)"
    : "rgba(3, 41, 50, 0.12)";

  const lineColor = dark
    ? "rgba(50, 238, 255, 0.9)"
    : "rgba(10, 69, 82, 0.85)";

  const fillColor = dark
    ? "rgba(50, 238, 255, 0.12)"
    : "rgba(10, 69, 82, 0.1)";

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;

  for (let i = 0; i <= 3; i++) {
    const gy = pad.top + (i / 3) * chartH;

    ctx.beginPath();
    ctx.moveTo(pad.left, gy);
    ctx.lineTo(pad.left + chartW, gy);
    ctx.stroke();
  }

  const points = fpsHistory.map((sample, index) => {
    const x =
      pad.left +
      (index / max(1, fpsHistory.length - 1)) * chartW;

    const y =
      pad.top +
      chartH -
      constrain(sample / maxFps, 0, 1) * chartH;

    return { x, y };
  });

  if (points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, pad.top + chartH);

    for (const point of points) {
      ctx.lineTo(point.x, point.y);
    }

    ctx.lineTo(
      points[points.length - 1].x,
      pad.top + chartH
    );
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function updateFpsSample() {
  const dt =
    typeof deltaTime === "number" && deltaTime > 0
      ? deltaTime
      : 1000 / 60;

  const fps = constrain(1000 / dt, 1, 999);

  fpsHistory.push(fps);

  if (fpsHistory.length > FPS_HISTORY_LENGTH) {
    fpsHistory.shift();
  }

  fpsDisplay = fpsDisplay * 0.9 + fps * 0.1;
}

/*
 * Screen-aligned isometric grid.
 *
 * Three line families:
 *
 * 1. Vertical
 * 2. Down-right at 30°
 * 3. Down-left at 30°
 *
 * The spacing formulas ensure all three families
 * intersect at the same isometric lattice nodes.
 */
function drawScreenIsometricGrid(settings) {
  push();
  beginScreenSpaceCamera();

  const edge =
    settings.screenGridSize;

  /*
   * Horizontal distance between neighboring
   * vertical lines in an equilateral lattice.
   */
  const columnSpacing =
    edge * sqrt(3) * 0.5;

  const overscan =
    max(width, height) * 1.5;

  if (settings.backgroundTheme === "dark") {
    stroke(254, 249, 243, 36);
  } else {
    stroke(3, 41, 50, 28);
  }

  strokeWeight(1);

  /*
   * Vertical family.
   */
  const verticalCount =
    ceil(
      width / columnSpacing
    ) + 8;

  for (
    let column = -verticalCount;
    column <= verticalCount;
    column++
  ) {
    const x =
      column * columnSpacing;

    line(
      x,
      -overscan,
      0,
      x,
      overscan,
      0
    );
  }

  /*
   * Both diagonal families have slopes ±1/sqrt(3).
   * Their vertical intercepts differ by one edge
   * length, which makes every crossing land on a
   * vertical grid line.
   */
  const rowCount =
    ceil(
      height / edge
    ) +
    ceil(
      width / edge
    ) +
    12;

  for (
    let row = -rowCount;
    row <= rowCount;
    row++
  ) {
    const intercept =
      row * edge;

    /*
     * Down-right family.
     */
    line(
      -overscan,
      intercept -
        overscan / sqrt(3),
      0,

      overscan,
      intercept +
        overscan / sqrt(3),
      0
    );

    /*
     * Down-left family.
     */
    line(
      -overscan,
      intercept +
        overscan / sqrt(3),
      0,

      overscan,
      intercept -
        overscan / sqrt(3),
      0
    );
  }

  pop();
}

/*
 * Underlying isometric cube field: each cell is one
 * hexagon made of the three visible cube faces
 * (top / left / right). Faces are non-overlapping
 * parallelograms of two triangles and share edges
 * with neighbors on the same lattice as the line grid.
 */
function drawIsometricCubeGrid(settings) {
  push();
  beginScreenSpaceCamera();

  const edge = settings.screenGridSize;
  const columnSpacing = edge * sqrt(3) * 0.5;

  const hexRangeI =
    ceil(width / (columnSpacing * 2)) + 3;

  const hexRangeJ =
    ceil(height / (edge * 1.5)) + 3;

  noStroke();

  for (
    let hexJ = -hexRangeJ;
    hexJ <= hexRangeJ;
    hexJ++
  ) {
    for (
      let hexI = -hexRangeI;
      hexI <= hexRangeI;
      hexI++
    ) {
      const center =
        getHexCenterScreen(
          hexI,
          hexJ,
          edge
        );

      drawIsometricCubeTile(
        center.x,
        center.y,
        edge,
        settings
      );
    }
  }

  pop();
}

function fract(value) {
  return value - floor(value);
}

function getHexVertices(cx, cy, edge) {
  /*
   * Pointy-top hexagon vertices, clockwise from top.
   */
  return [
    [cx, cy + edge],
    [
      cx + edge * sqrt(3) * 0.5,
      cy + edge * 0.5
    ],
    [
      cx + edge * sqrt(3) * 0.5,
      cy - edge * 0.5
    ],
    [cx, cy - edge],
    [
      cx - edge * sqrt(3) * 0.5,
      cy - edge * 0.5
    ],
    [
      cx - edge * sqrt(3) * 0.5,
      cy + edge * 0.5
    ]
  ];
}

function drawIsometricCubeTile(cx, cy, edge, settings) {
  const v = getHexVertices(cx, cy, edge);
  const c = [cx, cy];

  const top = [v[5], v[0], v[1], c];
  const right = [c, v[1], v[2], v[3]];
  const left = [c, v[3], v[4], v[5]];

  const isDark =
    settings.backgroundTheme === "dark";

  if (isDark) {
    fill(254, 249, 243, 22);
    drawScreenQuad(top);
    fill(254, 249, 243, 38);
    drawScreenQuad(left);
    fill(254, 249, 243, 14);
    drawScreenQuad(right);
  } else {
    fill(3, 41, 50, 16);
    drawScreenQuad(top);
    fill(3, 41, 50, 28);
    drawScreenQuad(left);
    fill(3, 41, 50, 10);
    drawScreenQuad(right);
  }
}

function drawScreenQuad(corners) {
  beginShape(QUADS);

  for (const corner of corners) {
    vertex(corner[0], corner[1], 0);
  }

  endShape(CLOSE);
}

function getPixelsPerWorldUnit(settings) {
  return height / (settings.verticalView * 2);
}

/*
 * Camera basis matching setIsometricCamera /
 * p5 lookAt (f = center−eye, s = f×up, u = s×f).
 */
function getIsometricScreenAxes() {
  const invSqrt2 = 1 / sqrt(2);
  const invSqrt6 = 1 / sqrt(6);
  const sqrtTwoThirds = sqrt(2 / 3);

  return {
    /*
     * s · (x,y,z) = (x - z) / √2
     */
    toScreenX(x, y, z) {
      return (x - z) * invSqrt2;
    },

    /*
     * u · (x,y,z) = x/√6 + y√(2/3) + z/√6
     */
    toScreenY(x, y, z) {
      return (
        x * invSqrt6 +
        y * sqrtTwoThirds +
        z * invSqrt6
      );
    }
  };
}

/*
 * Pointy-top hex centers on the screen triangle
 * lattice. One hex = one isometric cube cell.
 */
function getHexCenterScreen(hexI, hexJ, gridSize) {
  return {
    x:
      gridSize *
      sqrt(3) *
      (hexI + hexJ * 0.5),

    y:
      gridSize *
      1.5 *
      hexJ
  };
}

/*
 * Center of the top parallelogram inside a cube hex
 * (two triangles). Unfolded root faces snap here.
 */
function getTopFaceCenterScreen(
  hexI,
  hexJ,
  gridSize
) {
  const hex =
    getHexCenterScreen(
      hexI,
      hexJ,
      gridSize
    );

  return {
    x: hex.x,
    y: hex.y + gridSize * 0.5
  };
}

/*
 * Place the unfolded root face (y = 0) so its
 * projected center matches a cube-grid top face.
 */
function screenToUnfoldedRootOrigin(
  screenX,
  screenY,
  settings
) {
  const scale = getPixelsPerWorldUnit(settings);

  const szx = screenX / scale;
  const szy = screenY / scale;

  /*
   * On the ground plane y = 0:
   * sx = (cx - cz) / √2
   * sy = (cx + cz) / √6
   */
  const cxMinusCz = szx * sqrt(2);
  const cxPlusCz = szy * sqrt(6);

  return {
    x: (cxPlusCz + cxMinusCz) * 0.5,
    z: (cxPlusCz - cxMinusCz) * 0.5
  };
}


function drawAllNets(settings) {
  ensurePackedLayout(settings);

  const placements = selectPlacementsForCoverage(
    packedPlacements.placements,
    settings
  );

  for (const placement of placements) {
    drawNet(
      placement.net,
      placement.originX,
      placement.originZ,
      getNetColor(
        placement.colorIndex,
        settings
      ),
      settings,
      placement.creaseStyle,
      placement.seed,
      placement.foldDelay,
      {
        cubeScale: placement.scale || 1,
        colorKey: placement
      }
    );
  }
}


/* ---------------------------------------------------------
   ONE AT A TIME — single cube folds on a flat layout
--------------------------------------------------------- */

function resetOneAtATimeState() {
  oneAtATimeState.placementsKey = "";
  oneAtATimeState.activeIndex = 0;
  oneAtATimeState.progress = 0;
  oneAtATimeState.phase = "folding";
  oneAtATimeState.phaseTimer = 0;
}

function getPlacementFlatTransforms(
  placement,
  settings
) {
  return buildConnectedFaceTransforms(
    placement.net,
    placement.originX,
    placement.originZ,
    settings.faceSize * (placement.scale || 1),
    0
  );
}

function getPlacementFlatFaceCorners(
  transform,
  faceSize
) {
  const half = faceSize * 0.5;
  const u = scaleVector(transform.u, half);
  const v = scaleVector(transform.v, half);
  const center = transform.center;

  return [
    addVectors(
      addVectors(center, scaleVector(u, -1)),
      scaleVector(v, -1)
    ),
    addVectors(
      addVectors(center, u),
      scaleVector(v, -1)
    ),
    addVectors(
      addVectors(center, u),
      v
    ),
    addVectors(
      addVectors(center, scaleVector(u, -1)),
      v
    )
  ];
}

function projectWorldToScreen(
  wx,
  wy,
  wz,
  settings
) {
  const scale =
    getPixelsPerWorldUnit(settings);

  const axes =
    getIsometricScreenAxes();

  return {
    x: axes.toScreenX(wx, wy, wz) * scale,
    y: axes.toScreenY(wx, wy, wz) * scale
  };
}

function getPlacementScreenBounds(
  placement,
  settings
) {
  const transforms =
    getPlacementFlatTransforms(
      placement,
      settings
    );

  const faceSize =
    settings.faceSize * (placement.scale || 1);

  let minSX = Infinity;
  let maxSX = -Infinity;
  let minSY = Infinity;
  let maxSY = -Infinity;

  for (const transform of transforms) {
    const corners =
      getPlacementFlatFaceCorners(
        transform,
        faceSize
      );

    for (const corner of corners) {
      const screen =
        projectWorldToScreen(
          corner[0],
          corner[1],
          corner[2],
          settings
        );

      minSX = min(minSX, screen.x);
      maxSX = max(maxSX, screen.x);
      minSY = min(minSY, screen.y);
      maxSY = max(maxSY, screen.y);
    }
  }

  return {
    minSX,
    maxSX,
    minSY,
    maxSY
  };
}

function getPlacementScreenCenter(
  placement,
  settings
) {
  const transforms =
    getPlacementFlatTransforms(
      placement,
      settings
    );

  let sumX = 0;
  let sumY = 0;

  for (const transform of transforms) {
    const screen =
      projectWorldToScreen(
        transform.center[0],
        transform.center[1],
        transform.center[2],
        settings
      );

    sumX += screen.x;
    sumY += screen.y;
  }

  const count = max(1, transforms.length);
  const cx = sumX / count;
  const cy = sumY / count;

  return {
    cx,
    cy,
    normX: cx / max(1, width * 0.5),
    normY: cy / max(1, height * 0.5),
    distSq: cx * cx + cy * cy
  };
}

function getOneAtATimeCompositionWeight(
  center,
  settings
) {
  const mode =
    settings.compositionPlacement ||
    "centered";

  const normX = center.normX;
  const normY = center.normY;

  const radial = sqrt(
    normX * normX +
    normY * normY
  );

  const edgePull = max(
    abs(normX),
    abs(normY)
  );

  if (mode === "edges") {
    return (
      pow(constrain(edgePull, 0, 1.15), 2.2) +
      0.03
    );
  }

  if (mode === "center-exclude") {
    const absY = abs(normY);

    if (absY < 0.34) {
      return 0.01;
    }

    return pow(absY, 1.6) + 0.05;
  }

  return (
    pow(constrain(1 - radial, 0, 1), 2.4) +
    0.03
  );
}

function getTransformsScreenRect(
  transforms,
  faceSize,
  settings
) {
  const rect = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity
  };

  for (const transform of transforms) {
    for (const corner of getPlacementFlatFaceCorners(
      transform,
      faceSize
    )) {
      const screen = projectWorldToScreen(
        corner[0],
        corner[1],
        corner[2],
        settings
      );

      rect.minX = min(rect.minX, screen.x);
      rect.maxX = max(rect.maxX, screen.x);
      rect.minY = min(rect.minY, screen.y);
      rect.maxY = max(rect.maxY, screen.y);
    }
  }

  return rect;
}

/*
 * Mirrors drawNet's plant / reroot logic at full fold
 * so the rect matches where the finished cube lands.
 */
function getOneAtATimeFoldedCubeRect(
  placement,
  settings
) {
  const cubeScale = max(1, placement.scale || 1);
  const faceSize = settings.faceSize * cubeScale;

  let net = placement.net;
  let plantX = placement.originX;
  let plantZ = placement.originZ;

  if (settings.foldMode === "one-side") {
    const fromMaxX =
      unitHash(placement.seed * 0.91 + 2.3) < 0.5;

    const endIndex =
      getExtremeFaceIndex(net, fromMaxX);

    net = rerootNet(net, endIndex);

    const endFace = net.faces[endIndex];

    const plant = worldOriginForFace(
      endFace.gridX,
      endFace.gridY,
      cubeScale,
      settings.faceSize
    );

    plantX = plant.x;
    plantZ = plant.z;
  }

  const transforms = buildConnectedFaceTransforms(
    net,
    plantX,
    plantZ,
    faceSize,
    HALF_PI
  );

  return getTransformsScreenRect(
    transforms,
    faceSize,
    settings
  );
}

function isScreenRectInsideCanvas(rect) {
  return (
    rect.minX >= -width * 0.5 &&
    rect.maxX <= width * 0.5 &&
    rect.minY >= -height * 0.5 &&
    rect.maxY <= height * 0.5
  );
}

/*
 * Screen area to repaint while a cube folds: flat net
 * and finished cube, plus headroom for faces swinging
 * up through the fold.
 */
function getOneAtATimeRedrawRect(placement, settings) {
  const flat =
    getPlacementScreenBounds(placement, settings);

  const folded =
    getOneAtATimeFoldedCubeRect(placement, settings);

  const faceScreen =
    settings.faceSize *
    (placement.scale || 1) *
    getPixelsPerWorldUnit(settings);

  return {
    minX: min(flat.minSX, folded.minX) - faceScreen,
    maxX: max(flat.maxSX, folded.maxX) + faceScreen,
    minY:
      min(flat.minSY, folded.minY) - faceScreen * 3,
    maxY: max(flat.maxSY, folded.maxY) + faceScreen
  };
}

/*
 * Full-width 16:9 band centered in the frame —
 * 1824×1026 on the 1824×2304 canvas.
 */
const PRESENTATION_BAND_ASPECT = 1026 / 1824;

function getPresentationBand() {
  const halfHeight =
    width * PRESENTATION_BAND_ASPECT * 0.5;

  return {
    minX: -width * 0.5,
    maxX: width * 0.5,
    minY: -halfHeight,
    maxY: halfHeight
  };
}

function screenRectsOverlap(a, b) {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minY < b.maxY &&
    a.maxY > b.minY
  );
}

function buildOneAtATimeCandidates(
  placements,
  settings
) {
  const band = settings.presentationPlacement
    ? getPresentationBand()
    : null;

  const allowed = [];
  const candidates = [];

  for (
    let index = 0;
    index < placements.length;
    index++
  ) {
    const placement = placements[index];

    /* only the finished cube must stay clear */
    const cubeRect =
      getOneAtATimeFoldedCubeRect(placement, settings);

    if (!isScreenRectInsideCanvas(cubeRect)) {
      continue;
    }

    if (band && screenRectsOverlap(cubeRect, band)) {
      continue;
    }

    allowed.push(index);

    const center =
      getPlacementScreenCenter(
        placement,
        settings
      );

    const weight =
      getOneAtATimeCompositionWeight(
        center,
        settings
      );

    if (weight <= 0.001) {
      continue;
    }

    candidates.push({
      index,
      weight,
      center
    });
  }

  if (candidates.length > 0) {
    return candidates;
  }

  return allowed.map((index) => {
    return {
      index,
      weight: 1,
      center:
        getPlacementScreenCenter(
          placements[index],
          settings
        )
    };
  });
}

function pickOneAtATimeCube(
  placements,
  settings,
  avoidIndex = -1
) {
  let candidates =
    buildOneAtATimeCandidates(
      placements,
      settings
    );

  if (avoidIndex >= 0 && candidates.length > 1) {
    candidates = candidates.filter(
      (entry) => entry.index !== avoidIndex
    );
  }

  /* −1: nothing may fold (e.g. all inside the band) */
  if (!candidates.length) {
    oneAtATimeState.activeIndex = -1;
    return;
  }

  if (candidates.length === 1) {
    oneAtATimeState.activeIndex =
      candidates[0].index;
    return;
  }

  const total = candidates.reduce(
    (sum, entry) => sum + entry.weight,
    0
  );

  let roll = random(total);

  for (const entry of candidates) {
    roll -= entry.weight;

    if (roll <= 0) {
      oneAtATimeState.activeIndex = entry.index;
      return;
    }
  }

  oneAtATimeState.activeIndex =
    candidates[candidates.length - 1].index;
}

function pickNextOneAtATimeCube(
  placements,
  settings
) {
  pickOneAtATimeCube(
    placements,
    settings,
    oneAtATimeState.activeIndex
  );
}

function ensureOneAtATimeState(
  placements,
  settings
) {
  const key = [
    packCacheKey,
    placements.length,
    settings.cameraZoom.toFixed(3),
    settings.compositionPlacement,
    settings.presentationPlacement,
    width,
    height
  ].join("|");

  if (oneAtATimeState.placementsKey === key) {
    return;
  }

  oneAtATimeState.placementsKey = key;
  oneAtATimeState.progress = 0;
  oneAtATimeState.phase = "folding";
  oneAtATimeState.phaseTimer = 0;

  if (placements.length > 0) {
    pickOneAtATimeCube(placements, settings);
  } else {
    oneAtATimeState.activeIndex = 0;
  }
}

function getOneAtATimePlacements(settings) {
  ensurePackedLayout(settings);

  const placements = selectPlacementsForCoverage(
    packedPlacements.placements,
    settings
  );

  ensureOneAtATimeState(placements, settings);

  return placements;
}

function updateOneAtATime(settings) {
  const placements =
    getOneAtATimePlacements(settings);

  if (
    !placements.length ||
    oneAtATimeState.activeIndex < 0
  ) {
    return;
  }

  const foldSpeed = settings.animationSpeed;
  const holdSeconds = settings.oneAtATimeHold;
  const gapSeconds = settings.oneAtATimeGap;
  const elapsed = frameDeltaMs() / 1000;

  switch (oneAtATimeState.phase) {
    case "folding":
      oneAtATimeState.progress += foldSpeed;

      if (oneAtATimeState.progress >= 1) {
        oneAtATimeState.progress = 1;

        if (holdSeconds <= 0) {
          oneAtATimeState.phase = "unfolding";
        } else {
          oneAtATimeState.phase = "holding";
          oneAtATimeState.phaseTimer = 0;
        }
      }

      break;

    case "holding":
      oneAtATimeState.phaseTimer += elapsed;

      if (oneAtATimeState.phaseTimer >= holdSeconds) {
        oneAtATimeState.phase = "unfolding";
      }

      break;

    case "unfolding":
      oneAtATimeState.progress -= foldSpeed;

      if (oneAtATimeState.progress <= 0) {
        oneAtATimeState.progress = 0;
        getInnerColorFor(
          placements[oneAtATimeState.activeIndex],
          true,
          settings
        );

        if (gapSeconds <= 0) {
          pickNextOneAtATimeCube(placements, settings);
          oneAtATimeState.phase = "folding";
        } else {
          oneAtATimeState.phase = "gap";
          oneAtATimeState.phaseTimer = 0;
        }
      }

      break;

    case "gap":
      oneAtATimeState.phaseTimer += elapsed;

      if (oneAtATimeState.phaseTimer >= gapSeconds) {
        pickNextOneAtATimeCube(placements, settings);
        oneAtATimeState.phase = "folding";
        oneAtATimeState.phaseTimer = 0;
      }

      break;

    default:
      oneAtATimeState.phase = "folding";
      break;
  }
}

function syncPresentationPlacementUI() {
  const show =
    controls.sketchMode.value === "one-at-a-time" &&
    controls.presentationPlacement.checked;

  controls.presentationPlacementControls.classList.toggle(
    "hidden",
    !show
  );
}

function applyOneAtATimeDivisionDefaults() {
  controls.showDivisions.checked = true;
  controls.divisionMatchBackground.checked = true;
  controls.divisionAngleFilter.value =
    "diagonal-up-vertical";

  controls.showDivisions.dispatchEvent(
    new Event("change")
  );
  controls.divisionMatchBackground.dispatchEvent(
    new Event("change")
  );
  controls.divisionAngleFilter.dispatchEvent(
    new Event("change")
  );
}

/*
 * Only one cube moves at a time, so the static scene is
 * rendered once into framebuffers. "base" holds the
 * background + grids, "full" adds every flat net. Each
 * frame blits "full", then repaints just the scissored
 * region around the folding cube.
 */
let oneAtATimeLayers = {
  key: "",
  base: null,
  full: null,
  regions: []
};

function getOneAtATimeLayerKey(settings, placements) {
  const { foldProgress, ...stable } = settings;

  return JSON.stringify([
    stable,
    monoColor,
    outerColor,
    innerColor,
    shuffleInnerVersion,
    packCacheKey,
    placements.length,
    width,
    height,
    pixelDensity()
  ]);
}

function renderOneAtATimeLayer(
  layer,
  settings,
  placements
) {
  layer.begin();
  clear();
  background(getBackgroundColor(settings));

  if (settings.showCubeGrid) {
    drawIsometricCubeGrid(settings);
  }

  if (settings.showGrid) {
    drawScreenIsometricGrid(settings);
  }

  if (placements) {
    setIsometricCamera(settings);
    applyDefaultSceneLights(settings);

    /* cache draws at rest must not reset shuffle state */
    shuffleInnerFrozen = true;

    for (const placement of placements) {
      drawOneAtATimePlacement(placement, settings, 0);
    }

    shuffleInnerFrozen = false;
    noLights();
  }

  layer.end();
}

function ensureOneAtATimeLayers(settings, placements) {
  const key =
    getOneAtATimeLayerKey(settings, placements);

  if (
    oneAtATimeLayers.full &&
    oneAtATimeLayers.key === key
  ) {
    return oneAtATimeLayers;
  }

  if (!oneAtATimeLayers.full) {
    oneAtATimeLayers.base =
      createFramebuffer({ antialias: true });
    oneAtATimeLayers.full =
      createFramebuffer({ antialias: true });
  }

  oneAtATimeLayers.key = key;

  renderOneAtATimeLayer(
    oneAtATimeLayers.base,
    settings,
    null
  );
  renderOneAtATimeLayer(
    oneAtATimeLayers.full,
    settings,
    placements
  );

  oneAtATimeLayers.regions = placements.map(
    (placement) =>
      getOneAtATimeRedrawRect(placement, settings)
  );

  return oneAtATimeLayers;
}

function blitOneAtATimeLayer(layer) {
  push();
  noLights();
  noStroke();
  beginScreenSpaceCamera();
  imageMode(CORNER);
  image(layer, -width * 0.5, -height * 0.5, width, height);
  pop();
}

function drawOneAtATimeFrame(settings) {
  const placements =
    getOneAtATimePlacements(settings);

  const layers =
    ensureOneAtATimeLayers(settings, placements);

  blitOneAtATimeLayer(layers.full);

  const activeIndex = oneAtATimeState.activeIndex;
  const active = placements[activeIndex];

  if (!active || oneAtATimeState.progress <= 0) {
    return;
  }

  const region = layers.regions[activeIndex];

  const neighbours = [];

  for (
    let index = 0;
    index < placements.length;
    index++
  ) {
    if (
      index === activeIndex ||
      screenRectsOverlap(layers.regions[index], region)
    ) {
      neighbours.push(index);
    }
  }

  const density = pixelDensity();

  const left = floor(
    (constrain(region.minX, -width / 2, width / 2) +
      width / 2) *
      density
  );
  const right = ceil(
    (constrain(region.maxX, -width / 2, width / 2) +
      width / 2) *
      density
  );
  const top = floor(
    (constrain(region.minY, -height / 2, height / 2) +
      height / 2) *
      density
  );
  const bottom = ceil(
    (constrain(region.maxY, -height / 2, height / 2) +
      height / 2) *
      density
  );

  if (right <= left || bottom <= top) {
    return;
  }

  const gl = drawingContext;

  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(
    left,
    height * density - bottom,
    right - left,
    bottom - top
  );

  blitOneAtATimeLayer(layers.base);
  gl.clear(gl.DEPTH_BUFFER_BIT);

  setIsometricCamera(settings);
  applyDefaultSceneLights(settings);

  for (const index of neighbours) {
    drawOneAtATimePlacement(
      placements[index],
      settings,
      index === activeIndex
        ? oneAtATimeState.progress
        : 0
    );
  }

  noLights();
  gl.disable(gl.SCISSOR_TEST);
}

function drawOneAtATimePlacement(
  placement,
  settings,
  foldProgress
) {
  drawNet(
    placement.net,
    placement.originX,
    placement.originZ,
    getNetColor(
      placement.colorIndex,
      settings
    ),
    settings,
    placement.creaseStyle,
    placement.seed,
    placement.foldDelay,
    {
      cubeScale: placement.scale || 1,
      drapeAmount: settings.drapeAmount,
      foldProgress,
      colorKey: placement
    }
  );
}


function getTidalScore(placement, direction) {
  const prefer = getCascadeCellPrefer(direction);

  return (
    placement.originX * prefer.di +
    placement.originZ * prefer.dj
  );
}



/* ---------------------------------------------------------
   GRADIENT — density falloff of unfolded nets
--------------------------------------------------------- */

function drawGradientNets(settings) {
  const packSettings = {
    ...settings,
    cubeCoverage: 1,
    gridPlacement: "random"
  };

  ensurePackedLayout(packSettings);

  const placements =
    packedPlacements.placements;

  if (!placements.length) {
    return;
  }

  let minScore = Infinity;
  let maxScore = -Infinity;

  const scored = placements.map((placement) => {
    const score = getTidalScore(
      placement,
      settings.cascadeDirection
    );

    minScore = min(minScore, score);
    maxScore = max(maxScore, score);

    return { placement, score };
  });

  const range = max(0.0001, maxScore - minScore);
  const coverage = constrain(
    settings.cubeCoverage,
    0,
    1
  );

  for (const { placement, score } of scored) {
    /*
     * t = 0 on the dense edge (wave start),
     * t = 1 on the empty edge.
     */
    const t = (score - minScore) / range;
    const falloff = pow(1 - t, 2.15);
    const density =
      falloff * (0.22 + 0.78 * coverage);

    const keepChance = unitHash(
      placement.seed * 0.61 +
      placement.originX * 0.07 +
      placement.originZ * 0.11 +
      3.17
    );

    if (keepChance > density) {
      continue;
    }

    drawNet(
      placement.net,
      placement.originX,
      placement.originZ,
      getNetColor(
        placement.colorIndex,
        settings
      ),
      settings,
      placement.creaseStyle,
      placement.seed,
      0,
      {
        drapeAmount: settings.drapeAmount,
        foldProgress: 0,
        foldMode: "both",
        cubeScale: placement.scale || 1
      }
    );
  }
}


/* ---------------------------------------------------------
   ROLL GRID — padded cubes tipping through 4 directions
--------------------------------------------------------- */

function ensureRollGrid(settings) {
  const key = [
    "roll-grid",
    settings.faceSize.toFixed(5),
    settings.cameraZoom.toFixed(3),
    settings.gridSize,
    settings.rollGridMotion,
    settings.rollGridDirection,
    settings.rollGridUniform ? 1 : 0,
    settings.allowBoxExtents ? 1 : 0,
    Number(settings.rollGridDestOffset || 0).toFixed(2),
    placementSeed,
    width,
    height
  ].join("|");

  if (key === rollGridCacheKey && rollGridCubes.length) {
    return;
  }

  rollGridCacheKey = key;
  rollGridCubes = buildRollGridCubes(settings);
  rollGridTime = 0;
}

function pickRollGridExtents(seed, allowBoxes) {
  if (!allowBoxes) {
    return { ex: 1, ey: 1, ez: 1 };
  }

  /*
   * Integer edge lengths 1–3. Bias slightly away from
   * pure cubes so the toggle reads clearly when on.
   */
  const axis = (salt) =>
    1 + Math.floor(unitHash(seed * 0.17 + salt) * 3);

  let ex = axis(1.1);
  let ey = axis(2.3);
  let ez = axis(3.7);

  if (ex === ey && ey === ez) {
    const stretch = 1 + Math.floor(unitHash(seed * 0.41 + 8.2) * 3);
    const which = Math.floor(unitHash(seed * 0.59 + 4.4) * 3);

    if (which === 0) {
      ex = stretch;
    } else if (which === 1) {
      ey = stretch;
    } else {
      ez = stretch;
    }
  }

  return { ex, ey, ez };
}

function getRollGridTravelDir(settings) {
  const key = settings.rollGridDirection || "x+";

  if (key === "x-") {
    return { di: -1, dj: 0 };
  }

  if (key === "z+") {
    return { di: 0, dj: 1 };
  }

  if (key === "z-") {
    return { di: 0, dj: -1 };
  }

  return { di: 1, dj: 0 };
}

function getRollGridDirForStep(stepIndex, settings) {
  if (settings.rollGridMotion === "one-way") {
    return getRollGridTravelDir(settings);
  }

  return ROLL_GRID_DIRS[((stepIndex % 4) + 4) % 4];
}

function withEvenRollGridSpan(board, extra = {}) {
  let minI = board.minI;
  let maxI = board.maxI;
  let minJ = board.minJ;
  let maxJ = board.maxJ;

  /*
   * Odd spans flip i/j parity on wrap, so the row
   * re-entering from off-canvas sits on the neighboring
   * isometric diagonal and reads too close.
   */
  if (((maxI - minI + 1) & 1) !== 0) {
    maxI += 1;
  }

  if (((maxJ - minJ + 1) & 1) !== 0) {
    maxJ += 1;
  }

  const cells = [];

  for (let j = minJ; j <= maxJ; j++) {
    for (let i = minI; i <= maxI; i++) {
      cells.push(coordinateKey(i, j));
    }
  }

  return {
    ...board,
    ...extra,
    minI,
    maxI,
    minJ,
    maxJ,
    cells
  };
}

function getRollGridBoard(settings) {
  const visible = getVisibleFaceBoard(settings);

  /*
   * One-direction wraps re-enter from the far edge.
   * Push that edge past the canvas so new cubes aren't
   * seen popping in at the frame.
   */
  if (settings.rollGridMotion !== "one-way") {
    return withEvenRollGridSpan(visible);
  }

  const margin = 8;
  const dir = getRollGridTravelDir(settings);

  let minI = visible.minI - margin;
  let maxI = visible.maxI + margin;
  let minJ = visible.minJ - margin;
  let maxJ = visible.maxJ + margin;

  /*
   * Extra runway on the entry side (opposite travel).
   */
  if (dir.di > 0) {
    minI -= margin;
  } else if (dir.di < 0) {
    maxI += margin;
  } else if (dir.dj > 0) {
    minJ -= margin;
  } else if (dir.dj < 0) {
    maxJ += margin;
  }

  return withEvenRollGridSpan(
    { minI, maxI, minJ, maxJ },
    { visible }
  );
}

function wrapRollGridPose(i, j, ex, ez, board) {
  if (!board) {
    return { i, j };
  }

  const spanI = board.maxI - board.minI + 1;
  const spanJ = board.maxJ - board.minJ + 1;

  if (spanI <= 0 || spanJ <= 0) {
    return { i, j };
  }

  let ni = i;
  let nj = j;

  while (ni > board.maxI) {
    ni -= spanI;
  }

  while (ni + ex - 1 < board.minI) {
    ni += spanI;
  }

  while (nj > board.maxJ) {
    nj -= spanJ;
  }

  while (nj + ez - 1 < board.minJ) {
    nj += spanJ;
  }

  return { i: ni, j: nj };
}

function rollGridSlotSize(ex, ey, ez) {
  return Math.max(1, ex || 1, ey || 1, ez || 1);
}

/*
 * Ground footprints permute on tip (height can become
 * width). Space the lattice for the largest edge so
 * neighbors never collide after a roll. Desynced
 * phases need a wider moat so a tip can't land on a
 * neighbor still at rest.
 */
function rollGridWrapCoord(value, min, span) {
  if (span <= 0) {
    return value;
  }

  let v = value;

  while (v > min + span - 0.0001) {
    v -= span;
  }

  while (v < min - 0.0001) {
    v += span;
  }

  return v;
}

/*
 * Phase along the stream, entry → exit, with no wrap.
 * Wrapping through the visible board jumped off-canvas
 * entry cubes to t≈1, so they started one tip ahead of
 * the first on-canvas row and sat a cell too close.
 *
 * t stays in [0, 1) so a 100% destination lead never
 * floors the last row onto an extra completed tip.
 */
function rollGridLinearTravelT(i, j, ex, ez, board, dir) {
  if (dir.di !== 0) {
    const span = board.maxI - board.minI + 1;
    const pos = i + ex * 0.5 - board.minI;
    let t = pos / max(1, span);

    if (dir.di < 0) {
      t = 1 - t;
    }

    return constrain(t, 0, 0.999999);
  }

  const span = board.maxJ - board.minJ + 1;
  const pos = j + ez * 0.5 - board.minJ;
  let t = pos / max(1, span);

  if (dir.dj < 0) {
    t = 1 - t;
  }

  return constrain(t, 0, 0.999999);
}

function rollGridUsesPerCubeTime(settings) {
  const motion = settings.rollGridMotion;

  return (
    motion === "radial" ||
    (
      motion === "one-way" &&
      (settings.rollGridDestOffset || 0) > 0.001
    )
  );
}

/*
 * Drop odd completed tips so a destination lead can't
 * shift a cube onto the neighboring isometric diagonal.
 * Fractional progress still carries the wave.
 */
function rollGridEvenLatticeLead(lead) {
  const steps = Math.floor(max(0, lead));
  const frac = lead - steps;
  const evenSteps = steps - (steps & 1);

  return evenSteps + frac;
}

function initRollGridOneWayPhases(settings, cubes) {
  const bias = max(0, settings.rollGridDestOffset || 0);

  if (
    bias <= 0.001 ||
    settings.rollGridMotion !== "one-way" ||
    !rollGridBoard
  ) {
    return;
  }

  const board = rollGridBoard;
  const dir = getRollGridTravelDir(settings);

  for (const cube of cubes) {
    const t = rollGridLinearTravelT(
      cube.homeI,
      cube.homeJ,
      cube.homeEx,
      cube.homeEz,
      board,
      dir
    );

    cube.localTime = rollGridEvenLatticeLead(bias * t);
  }
}

function rollGridStepForExtents(ex, ey, ez, settings) {
  const slot = rollGridSlotSize(ex, ey, ez);
  const motion = settings.rollGridMotion;
  const desynced =
    motion === "radial" ||
    motion === "offset-center";

  if (desynced) {
    return slot * 2 + 1;
  }

  return slot + 1;
}

function rollGridFootprintKeys(i, j, ex, ez, pad = 0) {
  const keys = [];

  for (let jj = j - pad; jj < j + ez + pad; jj++) {
    for (let ii = i - pad; ii < i + ex + pad; ii++) {
      keys.push(coordinateKey(ii, jj));
    }
  }

  return keys;
}

function rollGridOnLattice(i, j, originI, originJ) {
  return (
    ((i - originI) & 1) === 0 &&
    ((j - originJ) & 1) === 0
  );
}

/*
 * One empty isometric diagonal between cube diagonals
 * means a single 2×2 lattice: (2,0) / (0,2), never
 * (2,1) or (3,1) phase slips that hug the next row.
 */
function rollGridFootprintFits(
  board,
  occupied,
  i,
  j,
  ex,
  ez,
  lattice = true
) {
  for (let jj = j; jj < j + ez; jj++) {
    for (let ii = i; ii < i + ex; ii++) {
      if (
        ii < board.minI ||
        ii > board.maxI ||
        jj < board.minJ ||
        jj > board.maxJ ||
        occupied.has(coordinateKey(ii, jj))
      ) {
        return false;
      }

      for (const key of occupied) {
        const cell = parseCoordinateKey(key);
        const di = ii - cell[0];
        const dj = jj - cell[1];

        if (di === 0 && dj === 0) {
          return false;
        }

        if (lattice) {
          if ((di & 1) !== 0 || (dj & 1) !== 0) {
            return false;
          }
        } else if (
          Math.max(Math.abs(di), Math.abs(dj)) < 2
        ) {
          return false;
        }
      }
    }
  }

  return true;
}

function pushRollGridCube(
  cubes,
  i,
  j,
  extents,
  colorIndex
) {
  const midI = i + extents.ex * 0.5;
  const midJ = j + extents.ez * 0.5;

  cubes.push({
    homeI: i,
    homeJ: j,
    homeEx: extents.ex,
    homeEy: extents.ey,
    homeEz: extents.ez,
    localTime: 0,
    simStep: 0,
    i,
    j,
    ex: extents.ex,
    ey: extents.ey,
    ez: extents.ez,
    /*
     * Which baked face paint sits on each world
     * slot (bottom, top, +X, -X, +Z, -Z). Tips
     * permute this so colors ride with the box.
     */
    facePaint: [0, 1, 2, 3, 4, 5],
    colorIndex,
    distNorm: 0,
    midI,
    midJ
  });

  return { midI, midJ };
}

function finishRollGridDistances(cubes) {
  if (cubes.length === 0) {
    return cubes;
  }

  let centerI = 0;
  let centerJ = 0;

  for (const cube of cubes) {
    centerI += cube.midI;
    centerJ += cube.midJ;
  }

  centerI /= cubes.length;
  centerJ /= cubes.length;

  let maxDist = 0.0001;

  for (const cube of cubes) {
    const dist = Math.hypot(
      cube.midI - centerI,
      cube.midJ - centerJ
    );

    cube.distFromCenter = dist;
    maxDist = Math.max(maxDist, dist);
  }

  for (const cube of cubes) {
    cube.distNorm = cube.distFromCenter / maxDist;
  }

  return cubes;
}

function buildRollGridCubes(settings) {
  const board = getRollGridBoard(settings);
  rollGridBoard = board;

  const allowBoxes = Boolean(settings.allowBoxExtents);
  const uniform = Boolean(settings.rollGridUniform);
  const cubes = [];

  if (uniform) {
    const extents = pickRollGridExtents(
      placementSeed + 19,
      allowBoxes
    );
    const step = allowBoxes
      ? rollGridStepForExtents(
          extents.ex,
          extents.ey,
          extents.ez,
          settings
        )
      : 2;

    for (
      let j = board.minJ;
      j + extents.ez - 1 <= board.maxJ;
      j += step
    ) {
      for (
        let i = board.minI;
        i + extents.ex - 1 <= board.maxI;
        i += step
      ) {
        pushRollGridCube(
          cubes,
          i,
          j,
          extents,
          cubes.length
        );
      }
    }

    initRollGridOneWayPhases(settings, cubes);

    return finishRollGridDistances(cubes);
  }

  const occupied = new Set();
  const candidates = [];
  const originI = board.minI;
  const originJ = board.minJ;

  for (let j = board.minJ; j <= board.maxJ; j++) {
    for (let i = board.minI; i <= board.maxI; i++) {
      if (
        !allowBoxes &&
        !rollGridOnLattice(i, j, originI, originJ)
      ) {
        continue;
      }

      candidates.push({
        i,
        j,
        order: cellHash(
          coordinateKey(i, j),
          placementSeed + 71
        )
      });
    }
  }

  candidates.sort((a, b) => a.order - b.order);

  for (const slot of candidates) {
    const extents = pickRollGridExtents(
      slot.order * 1000 + placementSeed,
      allowBoxes
    );

    if (
      !rollGridFootprintFits(
        board,
        occupied,
        slot.i,
        slot.j,
        extents.ex,
        extents.ez,
        !allowBoxes
      )
    ) {
      continue;
    }

    if (
      slot.i + extents.ex - 1 > board.maxI ||
      slot.j + extents.ez - 1 > board.maxJ
    ) {
      continue;
    }

    for (const key of rollGridFootprintKeys(
      slot.i,
      slot.j,
      extents.ex,
      extents.ez,
      0
    )) {
      occupied.add(key);
    }

    pushRollGridCube(
      cubes,
      slot.i,
      slot.j,
      extents,
      cubes.length
    );
  }

  initRollGridOneWayPhases(settings, cubes);

  return finishRollGridDistances(cubes);
}

function tipRollGridBox(i, j, ex, ey, ez, dir) {
  if (dir.di === 1) {
    return {
      i: i + ex,
      j,
      ex: ey,
      ey: ex,
      ez
    };
  }

  if (dir.di === -1) {
    return {
      i: i - ey,
      j,
      ex: ey,
      ey: ex,
      ez
    };
  }

  if (dir.dj === 1) {
    return {
      i,
      j: j + ez,
      ex,
      ey: ez,
      ez: ey
    };
  }

  return {
    i,
    j: j - ey,
    ex,
    ey: ez,
    ez: ey
  };
}

/*
 * Face slots: 0 bottom, 1 top, 2 +X, 3 -X, 4 +Z, 5 -Z.
 * After a tip, paints move with the physical faces.
 */
function tipRollGridFacePaint(facePaint, dir) {
  const p = facePaint;

  if (dir.di === 1) {
    return [p[2], p[3], p[1], p[0], p[4], p[5]];
  }

  if (dir.di === -1) {
    return [p[3], p[2], p[0], p[1], p[4], p[5]];
  }

  if (dir.dj === 1) {
    return [p[4], p[5], p[2], p[3], p[1], p[0]];
  }

  return [p[5], p[4], p[2], p[3], p[0], p[1]];
}

function syncRollGridCubeToStep(cube, stepIndex, settings) {
  let target = Math.max(0, stepIndex | 0);
  const oneWay = settings.rollGridMotion === "one-way";

  if (cube.simStep === target) {
    return;
  }

  if (target < cube.simStep) {
    if (target !== 0) {
      return;
    }

    cube.i = cube.homeI;
    cube.j = cube.homeJ;
    cube.ex = cube.homeEx;
    cube.ey = cube.homeEy;
    cube.ez = cube.homeEz;
    cube.facePaint = [0, 1, 2, 3, 4, 5];
    cube.simStep = 0;
  }

  while (cube.simStep < target) {
    const dir = getRollGridDirForStep(
      cube.simStep,
      settings
    );
    const next = tipRollGridBox(
      cube.i,
      cube.j,
      cube.ex,
      cube.ey,
      cube.ez,
      dir
    );

    cube.i = next.i;
    cube.j = next.j;
    cube.ex = next.ex;
    cube.ey = next.ey;
    cube.ez = next.ez;
    cube.facePaint = tipRollGridFacePaint(
      cube.facePaint,
      dir
    );

    if (oneWay) {
      const wrapped = wrapRollGridPose(
        cube.i,
        cube.j,
        cube.ex,
        cube.ez,
        rollGridBoard
      );

      cube.i = wrapped.i;
      cube.j = wrapped.j;
    }

    cube.simStep += 1;
  }
}

function rollGridSpeedMul(cube, settings) {
  if (settings.rollGridMotion !== "radial") {
    return 1;
  }

  const bias = max(0, settings.rollGridRadialBias || 0);

  /*
   * bias 1.0 → center tips at 2× edge rate;
   * bias 4.0 → center at 5× edge rate.
   */
  return 1 + bias * (1 - cube.distNorm);
}

/*
 * Same tip rate everywhere; center sits further along
 * the shared period. bias 1 → up to one tip ahead.
 */
function rollGridPhaseOffset(cube, settings) {
  if (settings.rollGridMotion === "offset-center") {
    const bias = max(0, settings.rollGridRadialBias || 0);

    return bias * (1 - cube.distNorm);
  }

  return 0;
}

function rollGridTipRatePerSec(settings) {
  /*
   * One timeline unit = one roll. Previously added
   * animationSpeed * 1.35 per frame (~60 fps).
   */
  return settings.animationSpeed * 1.35 * 60;
}

function rollGridPauseUnits(settings) {
  const pauseSec =
    max(0, Number(settings.rollGridPause) || 0);

  if (pauseSec <= 0) {
    return 0;
  }

  return pauseSec * rollGridTipRatePerSec(settings);
}

function rollGridStepState(timeline, settings) {
  const pause = rollGridPauseUnits(settings);
  const stepSize = 1 + pause;
  const stepIndex = floor(max(0, timeline) / stepSize);
  const local = timeline - stepIndex * stepSize;
  const tipProgress =
    local < pause
      ? 0
      : constrain((local - pause) / 1, 0, 0.999999);

  return { stepIndex, tipProgress };
}

function updateRollGrid(settings) {
  ensureRollGrid(settings);

  const dt =
    frameDeltaMs() / 1000;

  const tipRate = rollGridTipRatePerSec(settings);

  if (rollGridUsesPerCubeTime(settings)) {
    for (const cube of rollGridCubes) {
      cube.localTime +=
        dt *
        tipRate *
        rollGridSpeedMul(cube, settings);
    }

    return;
  }

  rollGridTime += dt * tipRate;
}

function drawRollGrid(settings) {
  ensureRollGrid(settings);

  const sharedTime = !rollGridUsesPerCubeTime(settings);

  for (const cube of rollGridCubes) {
    const timeline = sharedTime
      ? rollGridTime + rollGridPhaseOffset(cube, settings)
      : cube.localTime;

    const { stepIndex, tipProgress } =
      rollGridStepState(timeline, settings);

    syncRollGridCubeToStep(cube, stepIndex, settings);

    const dir = getRollGridDirForStep(
      stepIndex,
      settings
    );

    drawRollingCube(
      cube.i,
      cube.j,
      cube.ex,
      cube.ey,
      cube.ez,
      dir,
      tipProgress,
      getNetColor(cube.colorIndex, settings),
      settings,
      cube.colorIndex,
      cube.facePaint,
      cube
    );
  }
}

function rollGridBottomCenter(i, j, ex, ez, faceSize) {
  return {
    x: (i + ex * 0.5) * faceSize,
    z: (j + ez * 0.5) * faceSize
  };
}

function drawRollingCube(
  plantI,
  plantJ,
  ex,
  ey,
  ez,
  dir,
  tipProgress,
  netColor,
  settings,
  seed = 0,
  facePaint = null,
  colorKey = seed
) {
  const faceSize = settings.faceSize;
  const wx = ex * faceSize;
  const hy = ey * faceSize;
  const wz = ez * faceSize;
  const origin = rollGridBottomCenter(
    plantI,
    plantJ,
    ex,
    ez,
    faceSize
  );

  const angled =
    applyMotionCurve(
      constrain(tipProgress, 0, 1),
      settings.cascadeMotionCurve || "ease"
    ) * HALF_PI;

  const pivotX =
    origin.x + dir.di * (wx * 0.5);
  const pivotZ =
    origin.z + dir.dj * (wz * 0.5);

  push();
  translate(pivotX, 0, pivotZ);

  if (dir.di !== 0) {
    rotateZ(-dir.di * angled);
  } else {
    rotateX(dir.dj * angled);
  }

  translate(-pivotX, 0, -pivotZ);
  drawSolidBox(
    origin.x,
    origin.z,
    wx,
    hy,
    wz,
    netColor,
    settings,
    seed,
    facePaint,
    colorKey
  );
  pop();
}

function drawSolidBox(
  ox,
  oz,
  wx,
  hy,
  wz,
  netColor,
  settings,
  seed = 0,
  facePaint = null,
  colorKey = seed
) {
  const hx = wx * 0.5;
  const hz = wz * 0.5;
  const hy2 = hy * 0.5;
  /*
   * A solid box is always sealed, so only its outside
   * is drawn. Facing tests run in the unrotated pose
   * and would flash the inner color mid-tip.
   */
  const innerBaseColor = null;

  const paint =
    facePaint || [0, 1, 2, 3, 4, 5];

  const flatSettings = {
    ...settings,
    showFaceShading: false
  };

  /*
   * drawConnectedFace scales unit u/v by faceSize/2.
   * For rectangles, pre-bake half-extents into u/v and
   * pass faceSize = 2 so that scale factor is 1.
   */
  const faces = [
    {
      center: [ox, 0, oz],
      u: [hx, 0, 0],
      v: [0, 0, hz],
      normal: [0, -1, 0],
      faceSize: 2
    },
    {
      center: [ox, hy, oz],
      u: [hx, 0, 0],
      v: [0, 0, -hz],
      normal: [0, 1, 0],
      faceSize: 2
    },
    {
      center: [ox + hx, hy2, oz],
      u: [0, 0, hz],
      v: [0, hy2, 0],
      normal: [1, 0, 0],
      faceSize: 2
    },
    {
      center: [ox - hx, hy2, oz],
      u: [0, 0, -hz],
      v: [0, hy2, 0],
      normal: [-1, 0, 0],
      faceSize: 2
    },
    {
      center: [ox, hy2, oz + hz],
      u: [-hx, 0, 0],
      v: [0, hy2, 0],
      normal: [0, 0, 1],
      faceSize: 2
    },
    {
      center: [ox, hy2, oz - hz],
      u: [hx, 0, 0],
      v: [0, hy2, 0],
      normal: [0, 0, -1],
      faceSize: 2
    }
  ];

  const drawOrder = faces
    .map((face, faceIndex) => ({
      face,
      faceIndex,
      dist: getFaceViewerDistance(face.center)
    }))
    .sort((a, b) => b.dist - a.dist);

  for (let order = 0; order < drawOrder.length; order++) {
    const { face, faceIndex } = drawOrder[order];
    const paintIndex = paint[faceIndex];
    const faceColor = color(
      getFaceOuterColor(
        paintIndex,
        netColor,
        settings,
        seed
      )
    );

    drawConnectedFace(
      {
        center: face.center,
        u: face.u,
        v: face.v,
        normal: face.normal
      },
      faceColor,
      1,
      flatSettings,
      innerBaseColor,
      face.faceSize,
      true,
      order,
      null,
      getSolidBoxEdgeMask(faceIndex, face, paint, settings)
    );
  }
}

const SOLID_BOX_SLOT_AXIS = [1, 1, 0, 0, 2, 2];

function solidBoxSlotForDirection(dir) {
  const ax = abs(dir[0]);
  const ay = abs(dir[1]);
  const az = abs(dir[2]);

  if (ay >= ax && ay >= az) {
    return dir[1] < 0 ? 0 : 1;
  }

  if (ax >= az) {
    return dir[0] > 0 ? 2 : 3;
  }

  return dir[2] > 0 ? 4 : 5;
}

/*
 * Division edges are chosen once, in the cube's spawn
 * orientation, and keyed by the pair of physical faces
 * that share them so the lines roll with the cube.
 * Edge k of a face runs corner k → k+1, bordering the
 * −v, +u, +v, −u neighbor in turn.
 */
/*
 * Rolling boxes are drawn inside a rotated model
 * matrix, so facing must use the world-space normal.
 */
function modelToWorldDirection(dir) {
  const renderer = p5.instance && p5.instance._renderer;
  const model = renderer && renderer.uModelMatrix;

  if (!model) {
    return dir;
  }

  const m = model.mat4;

  return [
    m[0] * dir[0] + m[4] * dir[1] + m[8] * dir[2],
    m[1] * dir[0] + m[5] * dir[1] + m[9] * dir[2],
    m[2] * dir[0] + m[6] * dir[1] + m[10] * dir[2]
  ];
}

function getSolidBoxEdgeMask(slot, face, paint, settings) {
  const filter = settings.divisionAngleFilter || "all";

  if (!settings.showDivisions || filter === "all") {
    return null;
  }

  if (filter === "outline") {
    const facing = isFacingCamera(
      modelToWorldDirection(face.normal)
    );

    return [
      scaleVector(face.v, -1),
      face.u,
      face.v,
      scaleVector(face.u, -1)
    ].map((dir) =>
      isFacingCamera(modelToWorldDirection(dir)) !== facing
    );
  }

  const neighborDirs = [
    scaleVector(face.v, -1),
    face.u,
    face.v,
    scaleVector(face.u, -1)
  ];
  const physical = paint[slot];

  return neighborDirs.map((dir) => {
    const neighbor =
      paint[solidBoxSlotForDirection(dir)];
    const axis = 3 -
      SOLID_BOX_SLOT_AXIS[physical] -
      SOLID_BOX_SLOT_AXIS[neighbor];
    const end = [0, 0, 0];

    end[axis] = 1;

    return edgeMatchesDivisionFilter(
      edgeScreenFamily([0, 0, 0], end),
      filter
    );
  });
}

function drawSolidCube(
  ox,
  oz,
  size,
  netColor,
  settings,
  seed = 0
) {
  drawSolidBox(
    ox,
    oz,
    size,
    size,
    size,
    netColor,
    settings,
    seed
  );
}


/* ---------------------------------------------------------
   INSIDE OUT — evert through a random side wall downward
--------------------------------------------------------- */

const INSIDE_OUT_DEST_DIR = { di: 0, dj: 1 };

function ensureInsideOut(settings) {
  const key = [
    "inside-out",
    settings.faceSize.toFixed(5),
    settings.cameraZoom.toFixed(3),
    settings.gridSize,
    allowedTypesCacheKey(settings),
    scaleWeightsCacheKey(settings),
    Number(settings.insideOutGridFullness || 0).toFixed(3),
    placementSeed,
    width,
    height
  ].join("|");

  if (key === insideOutCacheKey && insideOutCubes.length) {
    return;
  }

  insideOutCacheKey = key;
  insideOutCubes = buildInsideOutCubes(settings);
  insideOutTime = 0;
}

function pickInsideOutHingeDir(seed) {
  const index =
    floor(unitHash(seed * 0.73 + 4.1) * 4) % 4;

  return ROLL_GRID_DIRS[index];
}

function findInsideOutNet(
  startI,
  startJ,
  hingeDir,
  settings
) {
  const destI = startI + INSIDE_OUT_DEST_DIR.di;
  const destJ = startJ + INSIDE_OUT_DEST_DIR.dj;
  const hingeI = startI + hingeDir.di;
  const hingeJ = startJ + hingeDir.dj;
  const allowed = getAllowedTypeIndexes(settings);

  for (const typeIndex of allowed) {
    const base = CUBE_NETS[typeIndex];

    for (let flip = 0; flip < 2; flip++) {
      for (let rot = 0; rot < 4; rot++) {
        const local = normalizeCells(
          transformCells(base, rot, flip === 1)
        );

        for (const anchor of local) {
          const ox = startI - anchor[0];
          const oy = startJ - anchor[1];
          const cells = local.map((cell) => [
            cell[0] + ox,
            cell[1] + oy
          ]);
          const net = prepareNet(cells);
          const startIndex = getNetFaceIndexAt(
            net,
            startI,
            startJ
          );
          const hingeIndex = getNetFaceIndexAt(
            net,
            hingeI,
            hingeJ
          );
          const destIndex = getNetFaceIndexAt(
            net,
            destI,
            destJ
          );

          if (
            startIndex === hingeIndex ||
            startIndex === destIndex ||
            hingeIndex === destIndex
          ) {
            continue;
          }

          if (
            net.faces[startIndex] &&
            net.faces[hingeIndex] &&
            net.faces[destIndex]
          ) {
            return {
              typeIndex,
              cells,
              net,
              startIndex,
              hingeIndex,
              destIndex
            };
          }
        }
      }
    }
  }

  return null;
}

function insideOutPlacementKeys(cells, scale) {
  return footprintKeys(cells, max(1, scale || 1));
}

function insideOutReserveKeys(cells, scale) {
  const edge = max(1, scale || 1);
  const keys = [];
  let minI = Infinity;
  let maxI = -Infinity;
  let minJ = Infinity;
  let maxJ = -Infinity;

  for (const cell of expandCellsToFootprint(cells, edge)) {
    minI = min(minI, cell[0]);
    maxI = max(maxI, cell[0]);
    minJ = min(minJ, cell[1]);
    maxJ = max(maxJ, cell[1]);
  }

  for (let j = minJ - 1; j <= maxJ + 1; j++) {
    for (let i = minI - 1; i <= maxI + 1; i++) {
      keys.push(coordinateKey(i, j));
    }
  }

  return keys;
}

function insideOutRestKeys(cube) {
  const scale = max(1, cube.scale || 1);

  return footprintKeys(
    [[cube.i, cube.j]],
    scale
  );
}

function insideOutAnimating(cube) {
  return (
    cube.phase === "unravel" ||
    cube.phase === "refold" ||
    cube.phase === "flip"
  ) && cube.phaseProgress > 0.001;
}

function getInsideOutClaimKeys(cube) {
  const scale = max(1, cube.scale || 1);

  if (
    insideOutAnimating(cube) &&
    cube.cells
  ) {
    return insideOutReserveKeys(cube.cells, scale);
  }

  return insideOutRestKeys(cube);
}

function buildInsideOutOccupancy(exceptCube = null) {
  const occupied = new Set();

  for (const cube of insideOutCubes) {
    if (cube === exceptCube) {
      continue;
    }

    for (const key of getInsideOutClaimKeys(cube)) {
      occupied.add(key);
    }
  }

  return occupied;
}

function insideOutPlanFits(
  plan,
  board,
  occupied,
  scale
) {
  const edge = max(1, scale || 1);
  const footprint =
    expandCellsToFootprint(plan.cells, edge);

  for (const cell of footprint) {
    if (
      cell[0] < board.minI ||
      cell[0] > board.maxI ||
      cell[1] < board.minJ ||
      cell[1] > board.maxJ
    ) {
      return false;
    }
  }

  for (const key of insideOutPlacementKeys(
    plan.cells,
    edge
  )) {
    if (occupied.has(key)) {
      return false;
    }
  }

  return true;
}

function getInsideOutRestDrawState(cube, settings) {
  if (insideOutUsesFlatPause(settings)) {
    if (cube.inverted) {
      return {
        foldProgress: 1,
        plantIndex: cube.destIndex,
        invertFold: true,
        insideOutFlow: false
      };
    }

    return {
      foldProgress: 1,
      plantIndex: cube.startIndex,
      invertFold: false,
      insideOutFlow: false
    };
  }

  /*
   * Continuous flow stays planted on the hinge so the
   * pose at progress 0/1 matches the rest cube. Planting
   * on start vs hinge while folded looks like a jump.
   */
  return {
    foldProgress: cube.inverted ? 1 : 0,
    plantIndex: cube.hingeIndex,
    invertFold: false,
    insideOutFlow: true
  };
}

function commitInsideOutCycle(cube, settings) {
  cube.inverted = !cube.inverted;

  const rest =
    getInsideOutRestDrawState(cube, settings);
  const face =
    cube.net &&
    cube.net.faces[rest.plantIndex];

  if (face) {
    cube.i = face.gridX;
    cube.j = face.gridY;
  }
}

function syncInsideOutCubeToCycle(
  cube,
  cycleIndex,
  settings
) {
  while (cube.simCycle < cycleIndex) {
    commitInsideOutCycle(cube, settings);
    cube.simCycle += 1;
  }
}

function insideOutCycleLength(settings) {
  const pause = insideOutPauseUnits(settings);
  return (1 + pause) * 2;
}

function insideOutCycleStart(phase, progress) {
  return (
    (phase === "unravel" ||
      phase === "flip") &&
    progress <= 0
  );
}

function drawInsideOutNet(
  cube,
  drawState,
  netColor,
  settings,
  size
) {
  const scale = max(1, cube.scale || 1);
  const plantFace =
    cube.net.faces[drawState.plantIndex] ||
    cube.net.faces[0];
  const origin = worldOriginForFace(
    plantFace.gridX,
    plantFace.gridY,
    scale,
    size
  );

  drawNet(
    cube.net,
    origin.x,
    origin.z,
    netColor,
    settings,
    cube.creaseStyle,
    cube.seed,
    0,
    {
      foldMode: "one-side",
      foldProgress: drawState.foldProgress,
      plantFaceIndex: drawState.plantIndex,
      useOriginAsPlant: true,
      drapeAmount: 0,
      cubeScale: scale,
      invertFold: drawState.invertFold,
      insideOutFlow: drawState.insideOutFlow,
      colorKey: cube,
      motionCurve:
        settings.cascadeMotionCurve || "ease"
    }
  );
}

function buildInsideOutCubes(settings) {
  const board = getVisibleFaceBoard(settings);
  insideOutBoard = board;
  const fullness = constrain(
    settings.insideOutGridFullness || 0,
    0,
    1
  );
  const candidates = [];

  for (let j = board.minJ; j <= board.maxJ; j++) {
    for (let i = board.minI; i <= board.maxI; i++) {
      candidates.push({
        i,
        j,
        order: cellHash(
          coordinateKey(i, j),
          placementSeed + 131
        )
      });
    }
  }

  candidates.sort((a, b) => a.order - b.order);

  const occupied = new Set();
  const packed = [];

  for (const slot of candidates) {
    const restKey =
      coordinateKey(slot.i, slot.j);

    if (occupied.has(restKey)) {
      continue;
    }

    const seed =
      packed.length * 97.3 +
      placementSeed * 0.013 +
      slot.order * 13.1;
    const scale =
      pickCubeScale(seed * 1.31, settings);
    let plan = null;
    let hingeDir = null;

    for (let attempt = 0; attempt < 4; attempt++) {
      const dir = pickInsideOutHingeDir(
        seed + attempt * 17.9
      );
      const candidate = findInsideOutNet(
        slot.i,
        slot.j,
        dir,
        settings
      );

      if (
        candidate &&
        insideOutPlanFits(
          candidate,
          board,
          occupied,
          scale
        )
      ) {
        plan = candidate;
        hingeDir = dir;
        break;
      }
    }

    if (!plan) {
      continue;
    }

    for (const key of insideOutPlacementKeys(
      plan.cells,
      scale
    )) {
      occupied.add(key);
    }

    packed.push({
      i: slot.i,
      j: slot.j,
      seed,
      scale,
      hingeDir,
      typeIndex: plan.typeIndex,
      creaseStyle:
        floor(unitHash(seed * 1.7) * 5),
      colorIndex:
        pickAllowedTypeIndex(
          seed,
          settings
        ),
      inverted: false,
      simCycle: 0,
      net: plan.net,
      cells: plan.cells,
      startIndex: plan.startIndex,
      hingeIndex: plan.hingeIndex,
      destIndex: plan.destIndex,
      phase: "rest",
      phaseProgress: 0
    });
  }

  const targetCount = max(
    0,
    floor(packed.length * fullness)
  );

  return packed.slice(0, targetCount);
}

function insideOutFlipRatePerSec(settings) {
  return settings.animationSpeed * 1.1 * 60;
}

function insideOutPauseUnits(settings) {
  const pauseSec =
    max(0, Number(settings.insideOutPause) || 0);

  if (pauseSec <= 0) {
    return 0;
  }

  return pauseSec * insideOutFlipRatePerSec(settings);
}

function getInsideOutDrawState(
  cube,
  phase,
  progress,
  settings
) {
  if (phase === "unravel") {
    if (cube.inverted) {
      return {
        foldProgress: 1 - progress,
        plantIndex: cube.destIndex,
        invertFold: true,
        insideOutFlow: false
      };
    }

    return {
      foldProgress: 1 - progress,
      plantIndex: cube.startIndex,
      invertFold: false,
      insideOutFlow: false
    };
  }

  if (phase === "refold") {
    const open = progress <= 0.0001;

    if (cube.inverted) {
      return {
        foldProgress: progress,
        plantIndex: open
          ? cube.destIndex
          : cube.startIndex,
        invertFold: false,
        insideOutFlow: false
      };
    }

    return {
      foldProgress: progress,
      plantIndex: open
        ? cube.startIndex
        : cube.destIndex,
      invertFold: !open,
      insideOutFlow: false
    };
  }

  if (phase === "flip") {
    if (cube.inverted) {
      return {
        foldProgress: 1 - progress,
        plantIndex: cube.hingeIndex,
        invertFold: false,
        insideOutFlow: true
      };
    }

    return {
      foldProgress: progress,
      plantIndex: cube.hingeIndex,
      invertFold: false,
      insideOutFlow: true
    };
  }

  return getInsideOutRestDrawState(cube, settings);
}

function insideOutUsesFlatPause(settings) {
  return (
    settings.insideOutFlatStop ||
    "pause-flat"
  ) !== "continuous";
}

function insideOutCycleState(timeline, settings) {
  const pause = insideOutPauseUnits(settings);
  const phaseSize = 1 + pause;

  if (insideOutUsesFlatPause(settings)) {
    const cycleLength = phaseSize * 2;
    const cycleIndex =
      floor(max(0, timeline) / cycleLength);
    const local =
      timeline - cycleIndex * cycleLength;

    if (local < phaseSize) {
      const active = local < pause
        ? 0
        : constrain(
            (local - pause) / 1,
            0,
            0.999999
          );

      return {
        cycleIndex,
        phase: "unravel",
        progress: active
      };
    }

    const refoldLocal = local - phaseSize;
    const active = refoldLocal < pause
      ? 0
      : constrain(
          (refoldLocal - pause) / 1,
          0,
          0.999999
        );

    return {
      cycleIndex,
      phase: "refold",
      progress: active
    };
  }

  /*
   * Flow through: same total cycle length as pause-flat
   * but one continuous motion that never fully opens.
   */
  const cycleLength = phaseSize * 2;
  const cycleIndex =
    floor(max(0, timeline) / cycleLength);
  const local = timeline - cycleIndex * cycleLength;
  const activeSpan = max(0.0001, cycleLength - pause);
  const active = local < pause
    ? 0
    : constrain(
        (local - pause) / activeSpan,
        0,
        0.999999
      );

  return {
    cycleIndex,
    phase: "flip",
    progress: active
  };
}

function updateInsideOut(settings) {
  ensureInsideOut(settings);

  const dt =
    frameDeltaMs() / 1000;

  insideOutTime += dt * insideOutFlipRatePerSec(settings);
}

function drawInsideOut(settings) {
  ensureInsideOut(settings);

  const size = settings.faceSize;

  for (const cube of insideOutCubes) {
    const netColor = getNetColor(
      cube.colorIndex,
      settings
    );

    if (!cube.net) {
      continue;
    }

    const phaseOffset =
      unitHash(cube.seed * 0.31 + 2.7) * 3.5;
    const timeline =
      insideOutTime + phaseOffset;

    let { cycleIndex, phase, progress } =
      insideOutCycleState(
        timeline,
        settings
      );

    syncInsideOutCubeToCycle(
      cube,
      cycleIndex,
      settings
    );

    cube.phase = phase;
    cube.phaseProgress = progress;

    if (insideOutCycleStart(phase, progress)) {
      drawInsideOutNet(
        cube,
        getInsideOutRestDrawState(
          cube,
          settings
        ),
        netColor,
        settings,
        size
      );
      continue;
    }

    drawInsideOutNet(
      cube,
      getInsideOutDrawState(
        cube,
        phase,
        progress,
        settings
      ),
      netColor,
      settings,
      size
    );
  }
}


/* ---------------------------------------------------------
   WANDER — random roll / unfold on a partial grid
--------------------------------------------------------- */

function getWanderBaseCacheKey(settings) {
  return [
    "wander",
    settings.gridSize,
    settings.cameraZoom.toFixed(3),
    allowedTypesCacheKey(settings),
    Number(settings.wanderGridFullness || 0).toFixed(3),
    placementSeed,
    width,
    height
  ].join("|");
}

function getNetFaceIndexAt(net, gridX, gridY) {
  if (!net || !net.faces) {
    return 0;
  }

  for (const face of net.faces) {
    if (
      face.gridX === gridX &&
      face.gridY === gridY
    ) {
      return face.index;
    }
  }

  return 0;
}

function ensureWanderAgents(settings) {
  const key = getWanderBaseCacheKey(settings);

  if (key === wanderCacheKey && wanderAgents.length) {
    return;
  }

  wanderCacheKey = key;
  wanderAgents = buildWanderAgents(settings);
}

function isWanderMode(mode) {
  return mode === "wander" || mode === "wander-roll";
}

function wanderFrequencyValue(settings) {
  return constrain(
    Number(settings.wanderFrequency) || 0,
    0,
    1
  );
}

function scheduleWanderWait(agent, settings) {
  const freq = wanderFrequencyValue(settings);

  if (freq >= 0.999) {
    agent.waitDelay = 0;
    agent.waitTimer = 0;
    return;
  }

  const maxInterval = (1 - freq) * 6;

  agent.waitDelay =
    unitHash(
      agent.seed * 0.41 +
      wanderTime * 0.17 +
      agent.i * 0.13 +
      agent.j * 0.07
    ) * maxInterval;

  agent.waitTimer = 0;
}

function buildWanderAgents(settings) {
  const board = getVisibleFaceBoard(settings);
  const fullness = constrain(
    settings.wanderGridFullness || 0,
    0,
    1
  );
  const candidates = [];

  for (let j = board.minJ; j <= board.maxJ; j++) {
    for (let i = board.minI; i <= board.maxI; i++) {
      candidates.push({
        i,
        j,
        order: cellHash(
          coordinateKey(i, j),
          placementSeed + 89
        )
      });
    }
  }

  candidates.sort((a, b) => a.order - b.order);

  const targetCount = max(
    0,
    floor(candidates.length * fullness)
  );
  const occupied = new Set();
  const agents = [];

  for (const slot of candidates) {
    if (agents.length >= targetCount) {
      break;
    }

    const key = coordinateKey(slot.i, slot.j);

    if (occupied.has(key)) {
      continue;
    }

    occupied.add(key);

    const seed =
      agents.length * 97.3 +
      placementSeed * 0.013 +
      slot.order * 13.1;
    const typeIndex =
      pickAllowedTypeIndex(seed, settings);

    const agent = {
      id: agents.length,
      seed,
      colorIndex: typeIndex,
      typeIndex,
      creaseStyle: floor(unitHash(seed * 1.7) * 5),
      i: slot.i,
      j: slot.j,
      ex: 1,
      ey: 1,
      ez: 1,
      facePaint: [0, 1, 2, 3, 4, 5],
      phase: "folded",
      animProgress: 0,
      waitTimer: 0,
      waitDelay: 0,
      rollDir: null,
      net: null,
      cells: null,
      travelUnfold: false,
      trailingIndex: 0,
      leadingIndex: 0,
      plantFaceIndex: 0
    };

    scheduleWanderWait(agent, settings);
    agent.waitTimer =
      unitHash(seed * 0.23) * agent.waitDelay;
    agents.push(agent);
  }

  return agents;
}

function wanderAgentIsFolded(agent) {
  return (
    agent.phase === "folded" ||
    agent.phase === "rolling"
  );
}

function getWanderClaimKeys(agent) {
  if (agent.phase === "rolling" && agent.rollDir) {
    const ex = agent.ex || 1;
    const ey = agent.ey || 1;
    const ez = agent.ez || 1;
    const next = tipRollGridBox(
      agent.i,
      agent.j,
      ex,
      ey,
      ez,
      agent.rollDir
    );

    return [
      coordinateKey(agent.i, agent.j),
      coordinateKey(next.i, next.j)
    ];
  }

  if (
    wanderAgentIsFolded(agent) ||
    !agent.cells
  ) {
    const keys = [];
    const ex = max(1, agent.ex || 1);
    const ez = max(1, agent.ez || 1);

    for (let jj = agent.j; jj < agent.j + ez; jj++) {
      for (let ii = agent.i; ii < agent.i + ex; ii++) {
        keys.push(coordinateKey(ii, jj));
      }
    }

    return keys;
  }

  return footprintKeys(agent.cells, 1);
}

function buildWanderOccupancy(exceptAgent = null) {
  const occupied = new Set();

  for (const agent of wanderAgents) {
    if (agent === exceptAgent) {
      continue;
    }

    for (const key of getWanderClaimKeys(agent)) {
      occupied.add(key);
    }
  }

  return occupied;
}

function wanderCellsFitBoard(cells, board) {
  for (const cell of cells) {
    if (
      cell[0] < board.minI ||
      cell[0] > board.maxI ||
      cell[1] < board.minJ ||
      cell[1] > board.maxJ
    ) {
      return false;
    }
  }

  return true;
}

function wanderRollFits(
  i,
  j,
  ex,
  ey,
  ez,
  dir,
  board,
  occupied,
  ownKey
) {
  const next = tipRollGridBox(
    i,
    j,
    ex,
    ey,
    ez,
    dir
  );

  const key = coordinateKey(next.i, next.j);

  if (
    next.i < board.minI ||
    next.i > board.maxI ||
    next.j < board.minJ ||
    next.j > board.maxJ
  ) {
    return false;
  }

  if (key !== ownKey && occupied.has(key)) {
    return false;
  }

  return true;
}

function collectWanderRollActions(agent, settings) {
  const board = getVisibleFaceBoard(settings);
  const occupied = buildWanderOccupancy(agent);
  const ownKey = coordinateKey(agent.i, agent.j);
  const ex = agent.ex || 1;
  const ey = agent.ey || 1;
  const ez = agent.ez || 1;
  const actions = [];

  for (const dir of ROLL_GRID_DIRS) {
    if (
      wanderRollFits(
        agent.i,
        agent.j,
        ex,
        ey,
        ez,
        dir,
        board,
        occupied,
        ownKey
      )
    ) {
      actions.push({ type: "roll", dir });
    }
  }

  return actions;
}

function collectWanderInPlaceUnfoldActions(
  agent,
  settings,
  seen
) {
  const plant = [agent.i, agent.j];
  const board = getVisibleFaceBoard(settings);
  const occupied = buildWanderOccupancy(agent);
  const ownKeys = new Set([
    coordinateKey(plant[0], plant[1])
  ]);
  const allowed = getAllowedTypeIndexes(settings);
  const actions = [];

  for (const typeIndex of allowed) {
    const base = CUBE_NETS[typeIndex];

    for (let flip = 0; flip < 2; flip++) {
      for (let rot = 0; rot < 4; rot++) {
        const local = normalizeCells(
          transformCells(base, rot, flip === 1)
        );

        for (const anchor of local) {
          const ox = plant[0] - anchor[0];
          const oy = plant[1] - anchor[1];
          const cells = local.map((cell) => [
            cell[0] + ox,
            cell[1] + oy
          ]);
          const signature = cells
            .map((cell) => coordinateKey(cell[0], cell[1]))
            .join("|");

          if (seen.has(signature)) {
            continue;
          }

          if (!wanderCellsFitBoard(cells, board)) {
            continue;
          }

          const keys = footprintKeys(cells, 1);

          if (
            !claimKeysAreFree(keys, occupied, ownKeys)
          ) {
            continue;
          }

          seen.add(signature);

          actions.push({
            type: "unfold",
            plan: {
              travel: false,
              typeIndex,
              cells
            }
          });
        }
      }
    }
  }

  return actions;
}

function collectWanderTravelUnfoldActions(
  agent,
  settings,
  seen
) {
  const plant = [agent.i, agent.j];
  const board = getVisibleFaceBoard(settings);
  const occupied = buildWanderOccupancy(agent);
  const ownKeys = new Set([
    coordinateKey(plant[0], plant[1])
  ]);
  const allowed = getAllowedTypeIndexes(settings);
  const actions = [];

  for (const prefer of ROLL_GRID_DIRS) {
    for (const typeIndex of allowed) {
      const base = CUBE_NETS[typeIndex];

      for (let flip = 0; flip < 2; flip++) {
        for (let rot = 0; rot < 4; rot++) {
          const local = normalizeCells(
            transformCells(base, rot, flip === 1)
          );

          const trailing = getLocalExtreme(
            local,
            prefer,
            false
          );
          const leading = getLocalExtreme(
            local,
            prefer,
            true
          );

          const span =
            preferScore(leading[0], leading[1], prefer) -
            preferScore(trailing[0], trailing[1], prefer);

          if (span <= 0) {
            continue;
          }

          const ox = plant[0] - trailing[0];
          const oy = plant[1] - trailing[1];
          const cells = local.map((cell) => [
            cell[0] + ox,
            cell[1] + oy
          ]);
          const leadingCell = [
            leading[0] + ox,
            leading[1] + oy
          ];

          if (
            leadingCell[0] === plant[0] &&
            leadingCell[1] === plant[1]
          ) {
            continue;
          }

          const signature = cells
            .map((cell) => coordinateKey(cell[0], cell[1]))
            .join("|");

          if (seen.has(signature)) {
            continue;
          }

          if (!wanderCellsFitBoard(cells, board)) {
            continue;
          }

          const keys = footprintKeys(cells, 1);

          if (
            !claimKeysAreFree(keys, occupied, ownKeys)
          ) {
            continue;
          }

          seen.add(signature);

          actions.push({
            type: "unfold",
            plan: {
              travel: true,
              typeIndex,
              cells,
              trailingCell: plant.slice(),
              leadingCell
            }
          });
        }
      }
    }
  }

  return actions;
}

function collectWanderUnfoldActions(agent, settings) {
  const seen = new Set();

  return collectWanderInPlaceUnfoldActions(
    agent,
    settings,
    seen
  ).concat(
    collectWanderTravelUnfoldActions(
      agent,
      settings,
      seen
    )
  );
}

function collectWanderActions(agent, settings) {
  const rolls = collectWanderRollActions(
    agent,
    settings
  );
  const unfolds = collectWanderUnfoldActions(
    agent,
    settings
  );
  const actions = rolls.concat(unfolds);

  if (actions.length <= 1) {
    return actions;
  }

  const offset = floor(
    unitHash(
      agent.seed * 0.53 +
      wanderTime * 0.09 +
      agent.i * 0.17
    ) * actions.length
  );

  return actions
    .slice(offset)
    .concat(actions.slice(0, offset));
}

function tryBeginWanderAction(agent, settings) {
  const rolls = collectWanderRollActions(
    agent,
    settings
  );
  const unfolds =
    settings.sketchMode === "wander-roll"
      ? []
      : collectWanderUnfoldActions(agent, settings);
  const freq = wanderFrequencyValue(settings);
  const rollChance = unitHash(
    agent.seed * 0.67 +
    wanderTime * 0.11 +
    agent.waitTimer * 3.1
  );

  let pick = null;

  if (settings.sketchMode === "wander-roll") {
    if (!rolls.length) {
      return false;
    }

    agent.rollDir =
      rolls[floor(rollChance * rolls.length)].dir;
    agent.phase = "rolling";
    agent.animProgress = 0;
    return true;
  }

  /*
   * At most one roll between folding sequences:
   * frequency is the chance a cube rolls once before
   * it unfolds again.
   */
  const wantsRoll =
    !agent.rolledSinceFold && rollChance < freq;

  if (rolls.length && wantsRoll) {
    pick = rolls[
      floor(rollChance * rolls.length)
    ];
  } else if (unfolds.length) {
    pick = unfolds[
      floor(
        unitHash(
          agent.seed * 0.71 + wanderTime * 0.19
        ) * unfolds.length
      )
    ];
  } else if (rolls.length && !agent.rolledSinceFold) {
    pick = rolls[0];
  }

  if (!pick) {
    return false;
  }

  if (pick.type === "roll") {
    agent.rollDir = pick.dir;
    agent.phase = "rolling";
    agent.animProgress = 0;
    return true;
  }

  agent.typeIndex = pick.plan.typeIndex;
  agent.cells = pick.plan.cells;
  agent.net = prepareNet(pick.plan.cells);
  agent.travelUnfold = Boolean(pick.plan.travel);
  agent.trailingIndex = getNetFaceIndexAt(
    agent.net,
    agent.i,
    agent.j
  );
  agent.plantFaceIndex = agent.trailingIndex;

  if (agent.travelUnfold) {
    agent.leadingIndex = getNetFaceIndexAt(
      agent.net,
      pick.plan.leadingCell[0],
      pick.plan.leadingCell[1]
    );
  } else {
    agent.leadingIndex = agent.trailingIndex;
  }

  agent.rolledSinceFold = false;
  agent.phase = "unravel";
  agent.animProgress = 0;
  return true;
}

function finishWanderRoll(agent) {
  const next = tipRollGridBox(
    agent.i,
    agent.j,
    agent.ex || 1,
    agent.ey || 1,
    agent.ez || 1,
    agent.rollDir
  );

  agent.i = next.i;
  agent.j = next.j;
  agent.ex = next.ex;
  agent.ey = next.ey;
  agent.ez = next.ez;
  agent.facePaint = tipRollGridFacePaint(
    agent.facePaint || [0, 1, 2, 3, 4, 5],
    agent.rollDir
  );
  agent.rollDir = null;
  agent.rolledSinceFold = true;
}

function finishWanderRefold(agent) {
  agent.plantFaceIndex = getWanderPlantFaceIndex(agent);
  agent.travelUnfold = false;
  agent.trailingIndex = agent.plantFaceIndex || 0;
  agent.leadingIndex = agent.plantFaceIndex || 0;
}

function getWanderPlantFaceIndex(agent) {
  if (!agent.net || !agent.net.faces) {
    return agent.plantFaceIndex || 0;
  }

  for (const face of agent.net.faces) {
    if (
      face.gridX === agent.i &&
      face.gridY === agent.j
    ) {
      return face.index;
    }
  }

  return agent.plantFaceIndex || 0;
}

function wanderFoldRate(settings) {
  return settings.animationSpeed * 1.65 * 60;
}

function wanderRollRate(settings) {
  const speed =
    Number(settings.wanderSpeed) ||
    settings.animationSpeed;

  return speed * 1.65 * 60;
}

function updateWander(settings) {
  ensureWanderAgents(settings);

  const dt =
    frameDeltaMs() / 1000;
  const foldSpeed = wanderFoldRate(settings) * dt;
  const rollSpeed = wanderRollRate(settings) * dt;

  wanderTime += dt;

  for (const agent of wanderAgents) {
    if (agent.phase === "folded") {
      agent.waitTimer += dt;

      if (agent.waitTimer >= agent.waitDelay) {
        agent.waitTimer = 0;

        if (!tryBeginWanderAction(agent, settings)) {
          scheduleWanderWait(agent, settings);
        }
      }

      continue;
    }

    agent.animProgress +=
      agent.phase === "rolling"
        ? rollSpeed
        : foldSpeed;

    if (agent.animProgress < 1) {
      continue;
    }

    agent.animProgress = 0;

    if (agent.phase === "rolling") {
      finishWanderRoll(agent);
      agent.phase = "folded";
      scheduleWanderWait(agent, settings);
      continue;
    }

    if (agent.phase === "unravel") {
      agent.phase = "refold";

      if (agent.travelUnfold && agent.net) {
        const leading =
          agent.net.faces[agent.leadingIndex];

        if (leading) {
          remapWanderFacePaint(
            agent,
            agent.trailingIndex,
            agent.leadingIndex
          );
          agent.i = leading.gridX;
          agent.j = leading.gridY;
          agent.plantFaceIndex = agent.leadingIndex;
        }
      }

      continue;
    }

    if (agent.phase === "refold") {
      finishWanderRefold(agent);
      agent.phase = "folded";
      scheduleWanderWait(agent, settings);
    }
  }
}

function getWanderDrawPlantIndex(agent, unraveling) {
  if (!agent.travelUnfold || unraveling) {
    return agent.trailingIndex;
  }

  return agent.leadingIndex;
}

/*
 * Wander cube face slots (matching tipRollGridFacePaint):
 * 0 ground, 1 top, 2 +X, 3 −X, 4 +Z, 5 −Z.
 * Folded cubes sit on the camera side (−Y) of the grid.
 */
function wanderSlotForOutward(outward) {
  const ax = abs(outward[0]);
  const ay = abs(outward[1]);
  const az = abs(outward[2]);

  if (ay >= ax && ay >= az) {
    return outward[1] > 0 ? 0 : 1;
  }

  if (ax >= az) {
    return outward[0] > 0 ? 2 : 3;
  }

  return outward[2] > 0 ? 4 : 5;
}

/*
 * Which cube slot each net face lands on once the net
 * is folded around `plantIndex`. Net normals point into
 * the folded cube.
 */
function getWanderNetSlots(agent, plantIndex) {
  const cache = agent.netSlotCache;

  if (
    cache &&
    cache.net === agent.net &&
    cache.plantIndex === plantIndex
  ) {
    return cache.slots;
  }

  const rooted = rerootNet(agent.net, plantIndex);
  const transforms = buildConnectedFaceTransforms(
    rooted,
    0,
    0,
    1,
    HALF_PI
  );
  const slots = transforms.map((transform) =>
    wanderSlotForOutward(
      scaleVector(transform.normal, -1)
    )
  );

  agent.netSlotCache = {
    net: agent.net,
    plantIndex,
    slots
  };

  return slots;
}

/*
 * Keep every face's paint when a travel unfold swaps
 * its plant from the trailing to the leading face.
 */
function remapWanderFacePaint(agent, fromPlant, toPlant) {
  const from = getWanderNetSlots(agent, fromPlant);
  const to = getWanderNetSlots(agent, toPlant);
  const paint = agent.facePaint || [0, 1, 2, 3, 4, 5];
  const next = paint.slice();

  for (let face = 0; face < from.length; face++) {
    next[to[face]] = paint[from[face]];
  }

  agent.facePaint = next;
}

/*
 * One side rule for nets and solid cubes: the cube's
 * outside shows the outer color, its inside the inner
 * color (two-tone only). `inward` points into the cube.
 */
function getWanderFaceColor(
  inward,
  center,
  outerColor,
  settings,
  innerHex = settings.innerColor
) {
  const insideVisible =
    dotVectors(inward, getIsometricViewDirection()) > 0;

  if (
    insideVisible &&
    isTwoToneColorMode(settings.colorMode)
  ) {
    return innerHex;
  }

  return outerColor;
}

function drawWanderCube(
  agent,
  dir,
  tipProgress,
  netColor,
  settings
) {
  const faceSize = settings.faceSize;
  const ex = agent.ex || 1;
  const ey = agent.ey || 1;
  const ez = agent.ez || 1;
  const hx = ex * faceSize * 0.5;
  const hz = ez * faceSize * 0.5;
  const hy = ey * faceSize;
  const h2 = hy * 0.5;
  const origin = rollGridBottomCenter(
    agent.i,
    agent.j,
    ex,
    ez,
    faceSize
  );
  const paint =
    agent.facePaint || [0, 1, 2, 3, 4, 5];
  const innerHex =
    getInnerColorFor(agent, true, settings);

  const local = [
    { c: [0, 0, 0], u: [hx, 0, 0], v: [0, 0, hz], n: [0, 1, 0] },
    { c: [0, -hy, 0], u: [hx, 0, 0], v: [0, 0, -hz], n: [0, -1, 0] },
    { c: [hx, -h2, 0], u: [0, 0, hz], v: [0, h2, 0], n: [1, 0, 0] },
    { c: [-hx, -h2, 0], u: [0, 0, -hz], v: [0, h2, 0], n: [-1, 0, 0] },
    { c: [0, -h2, hz], u: [-hx, 0, 0], v: [0, h2, 0], n: [0, 0, 1] },
    { c: [0, -h2, -hz], u: [hx, 0, 0], v: [0, h2, 0], n: [0, 0, -1] }
  ];

  const angle =
    dir && tipProgress > 0
      ? applyMotionCurve(
          constrain(tipProgress, 0, 1),
          settings.cascadeMotionCurve || "ease"
        ) * HALF_PI
      : 0;
  const pivot = dir
    ? [dir.di * hx, 0, dir.dj * hz]
    : [0, 0, 0];
  const axis =
    dir && dir.di !== 0 ? [0, 0, 1] : [1, 0, 0];
  const theta = !dir
    ? 0
    : dir.di !== 0
      ? dir.di * angle
      : -dir.dj * angle;
  const spin = (vector) =>
    theta === 0
      ? vector
      : rotateVectorAroundAxis(vector, axis, theta);

  const faces = local.map((face, slot) => {
    const rel = spin(subtractVectors(face.c, pivot));
    const outward = spin(face.n);
    const center = [
      origin.x + pivot[0] + rel[0],
      pivot[1] + rel[1],
      origin.z + pivot[2] + rel[2]
    ];
    const inward = scaleVector(outward, -1);

    return {
      transform: {
        center,
        u: spin(face.u),
        v: spin(face.v),
        normal: inward
      },
      color: getWanderFaceColor(
        inward,
        center,
        getFaceOuterColor(
          paint[slot],
          netColor,
          settings,
          agent.seed
        ),
        settings,
        innerHex
      ),
      dist: getFaceViewerDistance(center)
    };
  });

  faces.sort((a, b) => b.dist - a.dist);

  for (let order = 0; order < faces.length; order++) {
    drawConnectedFace(
      faces[order].transform,
      color(faces[order].color),
      1,
      settings,
      null,
      2,
      false,
      order
    );
  }
}

function drawWanderAgents(settings) {
  ensureWanderAgents(settings);

  const size = settings.faceSize;

  for (const agent of wanderAgents) {
    const netColor = getNetColor(
      agent.colorIndex !== undefined
        ? agent.colorIndex
        : agent.typeIndex,
      settings
    );

    if (agent.phase === "rolling") {
      const tipProgress = constrain(
        agent.animProgress,
        0,
        1
      );

      drawWanderCube(
        agent,
        agent.rollDir,
        tipProgress,
        netColor,
        settings
      );
      continue;
    }

    if (
      agent.phase === "unravel" ||
      agent.phase === "refold"
    ) {
      const animT = constrain(
        agent.animProgress,
        0,
        1
      );
      const unraveling =
        agent.phase === "unravel";
      const foldProgress = unraveling
        ? 1 - animT
        : animT;
      const plantIndex =
        getWanderDrawPlantIndex(
          agent,
          unraveling
        );
      const origin = worldOriginForFace(
        agent.i,
        agent.j,
        1,
        size
      );
      const motionCurve =
        settings.cascadeMotionCurve || "ease";
      const slots = getWanderNetSlots(
        agent,
        plantIndex
      );
      const paint =
        agent.facePaint || [0, 1, 2, 3, 4, 5];
      const innerHex = getInnerColorFor(
        agent,
        foldProgress >= 0.999,
        settings
      );

      drawNet(
        agent.net,
        origin.x,
        origin.z,
        netColor,
        settings,
        agent.creaseStyle,
        agent.seed,
        0,
        {
          foldMode: "one-side",
          foldProgress,
          plantFaceIndex: plantIndex,
          useOriginAsPlant: true,
          drapeAmount: 0,
          cubeScale: 1,
          colorKey: agent,
          motionCurve,
          singleSided: true,
          faceColorFor: (faceIndex, transform) =>
            getWanderFaceColor(
              transform.normal,
              transform.center,
              getFaceOuterColor(
                paint[slots[faceIndex]],
                netColor,
                settings,
                agent.seed
              ),
              settings,
              innerHex
            )
        }
      );
      continue;
    }

    drawWanderCube(
      agent,
      null,
      0,
      netColor,
      settings
    );
  }
}


/* ---------------------------------------------------------
   IMAGE — unfolded nets remapping a source photo
--------------------------------------------------------- */

function updateImageUploadNote() {
  if (!controls.imageUploadNote) {
    return;
  }

  if (!sourceImageData) {
    controls.imageUploadNote.textContent =
      "Upload an image to tile the canvas with " +
      "unfolded nets. Mapped like object-fit: fill. " +
      "Color comes from the image; size and unfold " +
      "type are derived from local brightness / hue.";
    return;
  }

  controls.imageUploadNote.textContent =
    `Loaded ${sourceImageName || "image"} ` +
    `(${sourceImageData.width}×${sourceImageData.height}). ` +
    "Use Play open / close to fold; Image color picks " +
    "how samples map onto faces.";
}

function handleImageUpload(event) {
  const file =
    event.target.files &&
    event.target.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    const img = new Image();

    img.onload = () => {
      ingestSourceImage(img, file.name || "image");
    };

    img.onerror = () => {
      sourceImageData = null;
      sourceImageKey = "";
      sourceImageName = "";
      packCacheKey = "";
      updateImageUploadNote();
    };

    img.src = reader.result;
  };

  reader.readAsDataURL(file);
}

function ingestSourceImage(img, name) {
  /*
   * Downsample large uploads so per-face sampling
   * stays cheap while still covering the canvas.
   */
  const maxDim = 640;
  const scale = Math.min(
    1,
    maxDim / Math.max(img.width, img.height)
  );

  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true
  });

  ctx.drawImage(img, 0, 0, w, h);

  sourceImageData = ctx.getImageData(0, 0, w, h);
  sourceImageKey = `${name}|${w}x${h}|${img.width}x${img.height}`;
  sourceImageName = name;
  packCacheKey = "";
  updateImageUploadNote();
}

function worldToCanvasScreen(x, y, z, settings) {
  const axes = getIsometricScreenAxes();
  const scale = getPixelsPerWorldUnit(settings);

  return {
    x: axes.toScreenX(x, y, z) * scale,
    y: axes.toScreenY(x, y, z) * scale
  };
}

/*
 * object-fit: fill — stretch source to the full
 * canvas. Match WEBGL Y-up screen space directly to
 * ImageData rows (top of canvas → top of image).
 */
function sampleSourceImageAtCanvas(sx, sy) {
  if (!sourceImageData) {
    return null;
  }

  const u = constrain(
    (sx + width * 0.5) / width,
    0,
    0.999999
  );

  const v = constrain(
    (sy + height * 0.5) / height,
    0,
    0.999999
  );

  const px = Math.min(
    sourceImageData.width - 1,
    Math.floor(u * sourceImageData.width)
  );

  const py = Math.min(
    sourceImageData.height - 1,
    Math.floor(v * sourceImageData.height)
  );

  const i = (py * sourceImageData.width + px) * 4;
  const d = sourceImageData.data;
  const r = d[i];
  const g = d[i + 1];
  const b = d[i + 2];

  return {
    r,
    g,
    b,
    hex: rgbToHex(r, g, b),
    luminance: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
    hue: rgbToHue(r, g, b)
  };
}

function sampleImageAtLattice(i, j, scale, settings) {
  const origin = worldOriginForFace(
    i,
    j,
    scale,
    settings.faceSize
  );

  const screen = worldToCanvasScreen(
    origin.x,
    0,
    origin.z,
    settings
  );

  return sampleSourceImageAtCanvas(screen.x, screen.y);
}

function rgbToHex(r, g, b) {
  const to = (n) => {
    const h = constrain(round(n), 0, 255)
      .toString(16)
      .padStart(2, "0");

    return h;
  };

  return `#${to(r)}${to(g)}${to(b)}`;
}

function hexToRgb(hex) {
  const raw = String(hex || "").replace("#", "");

  if (raw.length !== 6) {
    return { r: 128, g: 128, b: 128 };
  }

  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16)
  };
}

function rgbToHue(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const maxC = Math.max(rn, gn, bn);
  const minC = Math.min(rn, gn, bn);
  const delta = maxC - minC;

  if (delta < 1e-6) {
    return 0;
  }

  let hue;

  if (maxC === rn) {
    hue = ((gn - bn) / delta) % 6;
  } else if (maxC === gn) {
    hue = (bn - rn) / delta + 2;
  } else {
    hue = (rn - gn) / delta + 4;
  }

  hue *= 60;

  if (hue < 0) {
    hue += 360;
  }

  return hue;
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const maxC = Math.max(rn, gn, bn);
  const minC = Math.min(rn, gn, bn);
  const lightness = (maxC + minC) * 0.5;
  const delta = maxC - minC;

  if (delta < 1e-6) {
    return { h: 0, s: 0, l: lightness };
  }

  const saturation =
    lightness > 0.5
      ? delta / (2 - maxC - minC)
      : delta / (maxC + minC);

  return {
    h: rgbToHue(r, g, b),
    s: saturation,
    l: lightness
  };
}

function hslToRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const sat = constrain(s, 0, 1);
  const light = constrain(l, 0, 1);

  if (sat < 1e-6) {
    const v = round(light * 255);

    return { r: v, g: v, b: v };
  }

  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c * 0.5;

  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (hue < 60) {
    rp = c;
    gp = x;
  } else if (hue < 120) {
    rp = x;
    gp = c;
  } else if (hue < 180) {
    gp = c;
    bp = x;
  } else if (hue < 240) {
    gp = x;
    bp = c;
  } else if (hue < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }

  return {
    r: round((rp + m) * 255),
    g: round((gp + m) * 255),
    b: round((bp + m) * 255)
  };
}

function nearestPaletteHex(r, g, b) {
  let best = PALETTE[0];
  let bestDist = Infinity;

  for (const hex of PALETTE) {
    const c = hexToRgb(hex);
    const dist =
      (c.r - r) * (c.r - r) +
      (c.g - g) * (c.g - g) +
      (c.b - b) * (c.b - b);

    if (dist < bestDist) {
      bestDist = dist;
      best = hex;
    }
  }

  return best;
}

function shadeOfPaletteColor(baseHex, luminance) {
  const base = hexToRgb(baseHex);
  const hsl = rgbToHsl(base.r, base.g, base.b);
  const lit = constrain(0.1 + luminance * 0.8, 0.08, 0.92);
  const rgb = hslToRgb(hsl.h, Math.max(hsl.s, 0.35), lit);

  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function averageImageSample(placement, scale, settings) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;

  for (const face of placement.net.faces) {
    const sample = sampleImageAtLattice(
      face.gridX,
      face.gridY,
      scale,
      settings
    );

    if (!sample) {
      continue;
    }

    r += sample.r;
    g += sample.g;
    b += sample.b;
    n += 1;
  }

  if (n === 0) {
    return null;
  }

  r = round(r / n);
  g = round(g / n);
  b = round(b / n);

  return {
    r,
    g,
    b,
    hex: rgbToHex(r, g, b),
    luminance: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
    hue: rgbToHue(r, g, b)
  };
}

function resolveImageColor(sample, settings) {
  if (!sample) {
    return "#888888";
  }

  const mode = settings.imageColorMode || "faces";

  if (mode === "palette") {
    return nearestPaletteHex(sample.r, sample.g, sample.b);
  }

  if (mode === "shades") {
    return shadeOfPaletteColor(
      monoColor || PALETTE[0],
      sample.luminance
    );
  }

  return sample.hex;
}

function syncImageAnimateButton() {
  if (!controls.imageAnimateButton) {
    return;
  }

  const playing = controls.animateFolding.checked;

  controls.imageAnimateButton.textContent = playing
    ? "Pause open / close"
    : "Play open / close";
}

function toggleImageAnimate() {
  const playing = !controls.animateFolding.checked;

  controls.animateFolding.checked = playing;

  if (playing) {
    animationPauseTimer = 0;

    const foldEnd =
      1 +
      getMaxFoldStaggerDelay(getSettings());

    animationDirection =
      animatedProgress >= foldEnd - 0.001
        ? -1
        : 1;

    if (Number(controls.drapeAmount.value) < 0.05) {
      controls.drapeAmount.value = 1;
      setValueLabel("drapeAmount", "1.00");
    }
  }

  syncImageAnimateButton();
  scheduleSessionSave();
}

function scaleFromImageLuminance(luminance, bias) {
  if (bias === "unit") {
    return 1;
  }

  const t =
    bias === "bright-large"
      ? luminance
      : 1 - luminance;

  if (t > 0.62) {
    return 3;
  }

  if (t > 0.32) {
    return 2;
  }

  return 1;
}

function typeIndexFromImageHue(hue, allowedTypes) {
  const pool =
    allowedTypes && allowedTypes.length > 0
      ? allowedTypes
      : CUBE_NETS.map((_, index) => index);

  const idx = Math.floor((hue / 360) * pool.length) % pool.length;

  return pool[idx];
}

function drawImageNets(settings) {
  if (!sourceImageData) {
    return;
  }

  ensureImageLayout(settings);

  const placements = selectPlacementsForCoverage(
    packedPlacements.placements,
    {
      ...settings,
      gridPlacement: "random"
    }
  );

  const colorMode = settings.imageColorMode || "faces";
  const perCube = colorMode === "cube";

  const drawSettings = {
    ...settings,
    colorMode: "mono"
  };

  for (const placement of placements) {
    const scale = placement.scale || 1;

    const cubeSample = perCube
      ? averageImageSample(placement, scale, settings)
      : null;

    const cubeColor = perCube
      ? resolveImageColor(cubeSample, settings)
      : null;

    drawNet(
      placement.net,
      placement.originX,
      placement.originZ,
      cubeColor || "#888888",
      drawSettings,
      placement.creaseStyle,
      placement.seed,
      placement.foldDelay,
      {
        drapeAmount: settings.drapeAmount,
        foldMode: settings.foldMode || "both",
        cubeScale: scale,
        faceColorFor(faceIndex) {
          if (perCube) {
            return cubeColor || "#888888";
          }

          const face =
            placement.net.faces[faceIndex];

          const sample = sampleImageAtLattice(
            face.gridX,
            face.gridY,
            scale,
            settings
          );

          return resolveImageColor(sample, settings);
        }
      }
    );
  }
}

function ensureImageLayout(settings) {
  const key = [
    "image",
    sourceImageKey,
    settings.imageScaleBias,
    settings.faceSize.toFixed(5),
    settings.cameraZoom.toFixed(3),
    settings.gridSize,
    allowedTypesCacheKey(settings),
    placementSeed,
    width,
    height
  ].join("|");

  if (key === packCacheKey && packedPlacements.placements) {
    return;
  }

  packCacheKey = key;
  packedPlacements = buildImagePacking(settings);
}

function buildImagePacking(settings) {
  const board = getVisibleFaceBoard(settings);
  const totalCells = board.cells.length;
  const occupied = new Set();
  const raw = [];
  const allowedTypes = getAllowedTypeIndexes(settings);
  const bias = settings.imageScaleBias || "dark-large";
  const placement = "random";
  const skew = 0;

  const cells = board.cells
    .slice()
    .sort((a, b) => {
      return (
        cellHash(a, placementSeed + 19) -
        cellHash(b, placementSeed + 23)
      );
    });

  for (const key of cells) {
    if (occupied.has(key)) {
      continue;
    }

    const [i, j] = parseCoordinateKey(key);
    const sample = sampleImageAtLattice(i, j, 1, settings);

    if (!sample) {
      continue;
    }

    const preferredScale =
      scaleFromImageLuminance(sample.luminance, bias);

    const preferredType =
      typeIndexFromImageHue(sample.hue, allowedTypes);

    const scaleOrder =
      preferredScale === 1
        ? [1]
        : preferredScale === 2
          ? [2, 1, 3]
          : [3, 2, 1];

    for (const scale of scaleOrder) {
      const mi = Math.floor(i / scale);
      const mj = Math.floor(j / scale);
      const salt =
        i * 17 +
        j * 41 +
        scale * 13 +
        preferredType * 7 +
        placementSeed;

      /*
       * Prefer the hue-matched net, then one
       * fallback of any allowed type.
       */
      let candidate = tryPlaceScaledNetAt(
        mi,
        mj,
        scale,
        occupied,
        board,
        [preferredType],
        placement,
        skew,
        salt
      );

      if (!candidate) {
        candidate = tryPlaceScaledNetAt(
          mi,
          mj,
          scale,
          occupied,
          board,
          allowedTypes,
          placement,
          skew,
          salt + 101
        );
      }

      if (!candidate) {
        continue;
      }

      for (const footprint of candidate.footprintKeys) {
        occupied.add(footprint);
      }

      raw.push(candidate.entry);
      break;
    }
  }

  return finalizePackedPlacements(
    raw,
    settings,
    totalCells
  );
}

/*
 * Random placement: scatter by hash.
 * Patterned placements: coverage reduces how many
 * parallel paths/bands stay visible (e.g. 10 vertical
 * lines → 2), spaced evenly across the field.
 */
function selectPlacementsForCoverage(placements, settings) {
  if (settings.gridPlacement === "centered") {
    return selectCenteredCluster(
      placements,
      settings.cubeCount,
      settings
    );
  }

  const coverage = settings.cubeCoverage;
  const family = placementFamily(settings.gridPlacement);

  if (coverage <= 0) {
    return [];
  }

  if (coverage >= 0.999) {
    return placements;
  }

  if (family === "random") {
    const count = ceil(placements.length * coverage);
    const ranked = [...placements].sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }

      return a.seed - b.seed;
    });

    return ranked.slice(0, count);
  }

  return selectPatternedBandCoverage(
    placements,
    settings.gridPlacement,
    coverage
  );
}

/*
 * Keep the N nets closest to the visible board
 * center so the unfolded field reads as a cluster.
 */
function selectCenteredCluster(
  placements,
  count,
  settings
) {
  if (!placements.length || count <= 0) {
    return [];
  }

  if (count >= placements.length) {
    return placements;
  }

  const board = getVisibleFaceBoard(settings);
  const size = settings.faceSize;
  const centerX =
    ((board.minI + board.maxI) * 0.5 + 0.5) * size;
  const centerZ =
    ((board.minJ + board.maxJ) * 0.5 + 0.5) * size;

  const ranked = placements.map((placement) => {
    const scale = max(1, placement.scale || 1);
    let sumX = 0;
    let sumZ = 0;

    for (const face of placement.net.faces) {
      const origin = worldOriginForFace(
        face.gridX,
        face.gridY,
        scale,
        size
      );

      sumX += origin.x;
      sumZ += origin.z;
    }

    const n = placement.net.faces.length;
    const dx = sumX / n - centerX;
    const dz = sumZ / n - centerZ;

    return {
      placement,
      distSq: dx * dx + dz * dz
    };
  });

  ranked.sort((a, b) => {
    if (a.distSq !== b.distSq) {
      return a.distSq - b.distSq;
    }

    return a.placement.seed - b.placement.seed;
  });

  return ranked
    .slice(0, count)
    .map((entry) => entry.placement);
}

function syncCoverageControlsUI() {
  const isCentered =
    controls.gridPlacement.value === "centered";

  controls.coveragePercentControls.classList.toggle(
    "hidden",
    isCentered
  );

  controls.coverageCountControls.classList.toggle(
    "hidden",
    !isCentered
  );

  if (controls.gridPlacementNote) {
    controls.gridPlacementNote.textContent =
      isCentered
        ? "Centered: nets cluster around the middle of the frame. Use Unfolded squares for an exact count."
        : "Patterned placements; spaced doubles the gap between rows / bands.";
  }

  syncCenteredCountSliderMax();
}

function syncCenteredCountSliderMax() {
  if (controls.gridPlacement.value !== "centered") {
    return;
  }

  const settings = getSettings();
  ensurePackedLayout(settings);

  const maxCount = max(
    1,
    packedPlacements.placements.length
  );

  controls.cubeCount.max = String(maxCount);
  controls.cubeCount.min = "1";

  let value = Number(controls.cubeCount.value) || 1;
  value = constrain(value, 1, maxCount);
  controls.cubeCount.value = String(value);

  setValueLabel("cubeCount", `${value}`);
}

function selectPatternedBandCoverage(
  placements,
  gridPlacement,
  coverage
) {
  const byBand = new Map();

  for (const placement of placements) {
    const key =
      placementBandKey(placement, gridPlacement);

    if (!byBand.has(key)) {
      byBand.set(key, []);
    }

    byBand.get(key).push(placement);
  }

  const bands = [...byBand.keys()].sort((a, b) => a - b);

  if (bands.length === 0) {
    return [];
  }

  const keepCount = max(
    1,
    round(bands.length * coverage)
  );

  const keptBands = pickEvenlySpacedBands(
    bands,
    min(keepCount, bands.length)
  );

  const kept = new Set(keptBands);
  const selected = [];

  for (const band of bands) {
    if (!kept.has(band)) {
      continue;
    }

    for (const placement of byBand.get(band)) {
      selected.push(placement);
    }
  }

  return selected;
}

function pickEvenlySpacedBands(bands, keepCount) {
  if (keepCount >= bands.length) {
    return bands;
  }

  if (keepCount <= 1) {
    return [
      bands[floor((bands.length - 1) * 0.5)]
    ];
  }

  const picked = [];
  const used = new Set();

  for (let i = 0; i < keepCount; i++) {
    const t = i / (keepCount - 1);
    let index = round(t * (bands.length - 1));

    /*
     * Nudge away from collisions so we still reach
     * the requested path count when possible.
     */
    let guard = 0;

    while (used.has(index) && guard < bands.length) {
      index = (index + 1) % bands.length;
      guard += 1;
    }

    used.add(index);
    picked.push(bands[index]);
  }

  return picked.sort((a, b) => a - b);
}

function placementBandKey(placement, gridPlacement) {
  const faces = placement.net.faces;
  const scale = max(1, placement.scale || 1);
  let sumX = 0;
  let sumY = 0;

  for (const face of faces) {
    sumX += face.gridX * scale + (scale - 1) * 0.5;
    sumY += face.gridY * scale + (scale - 1) * 0.5;
  }

  const x = sumX / faces.length;
  const y = sumY / faces.length;
  const family = placementFamily(gridPlacement);

  if (family === "vertical") {
    return floor(x);
  }

  if (family === "horizontal") {
    return floor(y);
  }

  if (family === "diagonal") {
    return floor(x + y);
  }

  return 0;
}

function placementFamily(placement) {
  if (placement === "centered") {
    return "random";
  }

  if (
    placement === "vertical" ||
    placement === "vertical-spaced"
  ) {
    return "vertical";
  }

  if (
    placement === "horizontal" ||
    placement === "horizontal-spaced"
  ) {
    return "horizontal";
  }

  if (
    placement === "diagonal" ||
    placement === "diagonal-spaced"
  ) {
    return "diagonal";
  }

  return "random";
}

function placementIsSpaced(placement) {
  return (
    placement === "vertical-spaced" ||
    placement === "horizontal-spaced" ||
    placement === "diagonal-spaced"
  );
}

/*
 * Cascade mode: cubes inch across the lattice using
 * only one-side unfold / refold. Each cube claims only
 * the lattice it currently needs — plant footprint
 * while folded, full net while open — and may switch
 * unfold patterns to fit free space.
 */
function updateCascade(settings) {
  ensureCascadeTravelers(settings);

  const speed =
    settings.animationSpeed * 1.65;

  const pauseSec = max(0, settings.cascadePause || 0);
  const dt =
    frameDeltaMs() / 1000;

  cascadeTime += speed;

  for (const traveler of cascadeTravelers) {
    if (
      traveler.phase === "folded" ||
      traveler.phase === "waiting"
    ) {
      traveler.waitTimer =
        (traveler.waitTimer || 0) + dt;

      if (
        traveler.waitTimer >=
        (traveler.waitDelay || 0)
      ) {
        const started =
          tryBeginCascadeUnfold(traveler, settings);

        /*
         * If a cube sits idle too long, reseat it on
         * the source lip so the stream doesn't thin
         * after the first pass leaves the frame.
         */
        if (
          !started &&
          traveler.waitTimer >= 0.85 &&
          !cascadeTravelerVisible(
            traveler,
            settings
          )
        ) {
          resetCascadeTravelerToStart(
            traveler,
            settings
          );
          tryBeginCascadeUnfold(
            traveler,
            settings
          );
        }
      }

      continue;
    }

    if (
      traveler.phase === "pause-open" ||
      traveler.phase === "pause-closed"
    ) {
      traveler.pauseTimer =
        (traveler.pauseTimer || 0) + dt;

      if (
        pauseSec <= 0 ||
        traveler.pauseTimer >= pauseSec
      ) {
        traveler.pauseTimer = 0;
        traveler.animProgress = 0;

        if (traveler.phase === "pause-open") {
          traveler.phase = "refold";
        } else {
          traveler.phase = "folded";
          traveler.waitTimer = 0;
          traveler.waitDelay = 0;
          tryBeginCascadeUnfold(traveler, settings);
        }
      }

      continue;
    }

    traveler.animProgress += speed;

    while (traveler.animProgress >= 1) {
      traveler.animProgress -= 1;

      if (traveler.phase === "unravel") {
        /* frames can skip exact flat, so mark it here */
        getInnerColorFor(traveler, true, settings);

        if (pauseSec > 0) {
          traveler.phase = "pause-open";
          traveler.pauseTimer = 0;
          traveler.animProgress = 0;
          break;
        }

        traveler.phase = "refold";
      } else if (traveler.phase === "refold") {
        finishCascadeRefold(traveler, settings);

        if (pauseSec > 0) {
          traveler.phase = "pause-closed";
          traveler.pauseTimer = 0;
          traveler.animProgress = 0;
          break;
        }

        traveler.phase = "folded";
        traveler.waitTimer = 0;
        traveler.waitDelay = 0;

        if (!tryBeginCascadeUnfold(traveler, settings)) {
          traveler.phase = "waiting";
        }

        break;
      } else {
        break;
      }
    }
  }
}

function cascadeTravelerIsFolded(traveler) {
  return (
    traveler.phase === "folded" ||
    traveler.phase === "waiting" ||
    traveler.phase === "pause-closed"
  );
}

function getCascadePlantCell(traveler) {
  if (
    typeof traveler.plantX === "number" &&
    typeof traveler.plantY === "number"
  ) {
    return [traveler.plantX, traveler.plantY];
  }

  const plantIndex =
    traveler.phase === "refold" ||
    traveler.phase === "pause-closed"
      ? traveler.leadingIndex
      : traveler.trailingIndex;

  const face =
    traveler.net &&
    traveler.net.faces[plantIndex];

  if (face) {
    return [face.gridX, face.gridY];
  }

  if (traveler.cells && traveler.cells[0]) {
    return traveler.cells[0].slice();
  }

  return [0, 0];
}

function getTravelerClaimKeys(traveler) {
  const scale = max(1, traveler.scale || 1);

  if (cascadeTravelerIsFolded(traveler)) {
    return footprintKeys(
      [getCascadePlantCell(traveler)],
      scale
    );
  }

  return footprintKeys(traveler.cells, scale);
}

function buildCascadeOccupancy(exceptTraveler = null) {
  const occupied = new Set();

  for (const traveler of cascadeTravelers) {
    if (traveler === exceptTraveler) {
      continue;
    }

    for (const key of getTravelerClaimKeys(traveler)) {
      occupied.add(key);
    }
  }

  return occupied;
}

function claimKeysAreFree(keys, occupied, ownKeys) {
  for (const key of keys) {
    if (ownKeys.has(key)) {
      continue;
    }

    if (occupied.has(key)) {
      return false;
    }
  }

  return true;
}

/*
 * Search allowed nets / orientations for an unfold
 * anchored on this cube's plant that fits free space
 * and advances along travel.
 */
function findCascadeUnfoldPlan(traveler, settings) {
  const scale = max(1, traveler.scale || 1);
  const plant = getCascadePlantCell(traveler);
  const prefer = traveler.prefer;
  const board = getVisibleFaceBoard(settings);
  const occupied = buildCascadeOccupancy(traveler);
  const ownKeys = new Set(
    footprintKeys([plant], scale)
  );
  const plantOffBoard =
    !cascadePlantOnBoard(plant, board, scale);

  const allowed = getAllowedTypeIndexes(settings);
  let best = null;
  let bestScore = -Infinity;

  for (const typeIndex of allowed) {
    const base = CUBE_NETS[typeIndex];

    for (let flip = 0; flip < 2; flip++) {
      for (let rot = 0; rot < 4; rot++) {
        const local =
          normalizeCells(
            transformCells(base, rot, flip === 1)
          );

        const trailing =
          getLocalExtreme(local, prefer, false);

        const leading =
          getLocalExtreme(local, prefer, true);

        const span =
          (leading[0] - trailing[0]) * prefer.di +
          (leading[1] - trailing[1]) * prefer.dj;

        if (span <= 0) {
          continue;
        }

        const ox = plant[0] - trailing[0];
        const oy = plant[1] - trailing[1];

        const cells = local.map((cell) => [
          cell[0] + ox,
          cell[1] + oy
        ]);

        const keys = footprintKeys(cells, scale);

        if (!claimKeysAreFree(keys, occupied, ownKeys)) {
          continue;
        }

        const leadingPlant = [
          leading[0] + ox,
          leading[1] + oy
        ];

        const entersView =
          cascadePlantOnBoard(
            leadingPlant,
            board,
            scale
          );

        const plantScore =
          preferScore(
            plant[0],
            plant[1],
            prefer
          );

        const leadingScore =
          preferScore(
            leadingPlant[0],
            leadingPlant[1],
            prefer
          );

        if (leadingScore <= plantScore) {
          continue;
        }

        const score =
          span * 10 -
          abs(span - 3) * 1.5 +
          (entersView ? 18 : 0) +
          (plantOffBoard && entersView ? 16 : 0) +
          unitHash(
            traveler.seed * 0.31 +
            typeIndex * 17.9 +
            rot * 3.7 +
            flip * 11.3 +
            cascadeTime * 0.01
          ) * 2.5;

        if (score > bestScore) {
          bestScore = score;
          best = { typeIndex, cells, span };
        }
      }
    }
  }

  return best;
}

function tryBeginCascadeUnfold(traveler, settings) {
  const plan = findCascadeUnfoldPlan(traveler, settings);

  if (!plan) {
    traveler.phase = "waiting";
    return false;
  }

  traveler.typeIndex = plan.typeIndex;
  traveler.cells = plan.cells;
  traveler.net = prepareNet(plan.cells);

  /*
   * Keep colorIndex stable across pattern changes so
   * multicolor cubes don't recolor every cycle.
   */
  if (traveler.colorIndex === undefined) {
    traveler.colorIndex = plan.typeIndex;
  }

  const extremes =
    getCascadeTravelExtremes(
      traveler.net,
      traveler.prefer
    );

  traveler.trailingIndex = extremes.trailingIndex;
  traveler.leadingIndex = extremes.leadingIndex;

  const plant = getCascadePlantCell(traveler);
  traveler.plantX = plant[0];
  traveler.plantY = plant[1];

  traveler.phase = "unravel";
  traveler.animProgress = 0;
  traveler.waitTimer = 0;
  traveler.nudgeX = 0;
  traveler.nudgeZ = 0;

  return true;
}

function finishCascadeRefold(traveler, settings) {
  const leading =
    traveler.net.faces[traveler.leadingIndex];

  traveler.plantX = leading.gridX;
  traveler.plantY = leading.gridY;

  /*
   * Keep the current net so the folded cube still
   * has geometry to draw; occupancy shrinks to plant.
   */
  traveler.trailingIndex = traveler.leadingIndex;

  if (cascadeTravelerOffBoard(traveler, settings)) {
    resetCascadeTravelerToStart(traveler, settings);
  }
}

function getCascadeBaseCacheKey(settings) {
  return [
    settings.cascadeDirection,
    settings.cascadePhaseOffset.toFixed(3),
    settings.faceSize.toFixed(5),
    settings.cameraZoom.toFixed(3),
    settings.gridSize,
    allowedTypesCacheKey(settings),
    scaleWeightsCacheKey(settings),
    placementSeed,
    width,
    height
  ].join("|");
}

function buildCascadeOccupiedSet() {
  const occupied = new Set();

  for (const traveler of cascadeTravelers) {
    for (const key of getTravelerClaimKeys(traveler)) {
      occupied.add(key);
    }
  }

  return occupied;
}

function createCascadeTravelersUpTo(
  settings,
  prefer,
  board,
  layout,
  targetCount,
  startIndex,
  occupied
) {
  let created = startIndex;
  let attempt = 0;
  const maxAttempts = max(
    (targetCount - startIndex) * 12,
    64
  );

  while (created < targetCount && attempt < maxAttempts) {
    const seed =
      created * 97.3 +
      attempt * 13.1 +
      prefer.di * 11 +
      prefer.dj * 19 +
      placementSeed * 0.013;

    const traveler = createFoldedCascadeTraveler(
      created,
      targetCount,
      prefer,
      board,
      settings,
      layout,
      seed,
      occupied
    );

    attempt += 1;

    if (!traveler) {
      continue;
    }

    for (const key of getTravelerClaimKeys(traveler)) {
      occupied.add(key);
    }

    cascadeTravelers.push(traveler);
    created += 1;
  }
}

function ensureCascadeTravelers(settings) {
  const baseKey = getCascadeBaseCacheKey(settings);
  const targetCount = max(1, settings.cascadeCount);

  if (baseKey !== cascadeCacheKey) {
    cascadeCacheKey = baseKey;
    cascadeTravelers = [];

    const prefer =
      getCascadeCellPrefer(settings.cascadeDirection);

    const board = getVisibleFaceBoard(settings);
    const maxScale = getMaxActiveScale(settings);
    const layout =
      getCascadeStreamLayout(
        board,
        prefer,
        targetCount,
        maxScale
      );

    createCascadeTravelersUpTo(
      settings,
      prefer,
      board,
      layout,
      targetCount,
      0,
      new Set()
    );

    return;
  }

  if (cascadeTravelers.length === targetCount) {
    return;
  }

  if (cascadeTravelers.length > targetCount) {
    cascadeTravelers.length = targetCount;
    return;
  }

  const prefer =
    getCascadeCellPrefer(settings.cascadeDirection);

  const board = getVisibleFaceBoard(settings);
  const maxScale = getMaxActiveScale(settings);
  const layout =
    getCascadeStreamLayout(
      board,
      prefer,
      targetCount,
      maxScale
    );

  createCascadeTravelersUpTo(
    settings,
    prefer,
    board,
    layout,
    targetCount,
    cascadeTravelers.length,
    buildCascadeOccupiedSet()
  );
}

/*
 * Preferred step in face-lattice (i, j). Further
 * along travel = higher i*di + j*dj.
 */
function getCascadeCellPrefer(direction) {
  if (direction === "top-bottom") {
    return { di: -1, dj: -1 };
  }

  if (direction === "bottom-top") {
    return { di: 1, dj: 1 };
  }

  if (direction === "left-right") {
    return { di: 1, dj: -1 };
  }

  return { di: -1, dj: 1 };
}

/*
 * Pack travelers into perpendicular lanes × depth
 * along travel. Spacing compresses with count so the
 * stream can fill denser than one cube per several
 * cells.
 */
function getCascadeStreamLayout(
  board,
  prefer,
  count,
  scaleFactor = 1
) {
  const travelI = prefer.di;
  const travelJ = prefer.dj;
  const perpI = -prefer.dj;
  const perpJ = prefer.di;
  const factor = max(1, scaleFactor);
  const total = max(1, count);

  const corners = getBoardTravelCorners(board);

  let travelMin = Infinity;
  let travelMax = -Infinity;
  let perpMin = Infinity;
  let perpMax = -Infinity;

  for (const corner of corners) {
    const travel =
      corner[0] * travelI + corner[1] * travelJ;

    const perp =
      corner[0] * perpI + corner[1] * perpJ;

    travelMin = min(travelMin, travel);
    travelMax = max(travelMax, travel);
    perpMin = min(perpMin, perp);
    perpMax = max(perpMax, perp);
  }

  const travelLength =
    max(1, travelMax - travelMin);

  const perpExtent =
    max(1, perpMax - perpMin);

  const aspect =
    travelLength / max(0.001, perpExtent);

  let lanes = max(
    1,
    round(sqrt(total / max(0.35, aspect)))
  );

  lanes = constrain(lanes, 1, total);
  let depth = max(1, ceil(total / lanes));

  const laneSpacing =
    lanes <= 1
      ? 0
      : perpExtent / (lanes - 1);

  const stepSpacing =
    depth <= 1
      ? max(1, travelLength * 0.35)
      : travelLength / max(1, depth - 1);

  return {
    lanes,
    depth,
    laneSpacing,
    stepSpacing,
    travelLength,
    perpExtent,
    travelMin,
    travelMax,
    perpMin,
    perpMax,
    perpI,
    perpJ,
    scaleFactor: factor
  };
}

function createFoldedCascadeTraveler(
  index,
  count,
  prefer,
  board,
  settings,
  layout,
  seed,
  occupied
) {
  const scale = pickCubeScale(seed * 1.31, settings);
  const typeIndex =
    pickAllowedTypeIndex(seed, settings);

  const laneIndex = index % max(1, layout.lanes);
  const depthIndex = floor(index / max(1, layout.lanes));

  const plant = findFreeCascadePlant(
    board,
    prefer,
    scale,
    occupied,
    seed,
    index,
    layout,
    laneIndex,
    depthIndex,
    "initial"
  );

  if (!plant) {
    return null;
  }

  const placement =
    buildCascadeNetAtPlant(
      typeIndex,
      prefer,
      plant,
      scale,
      seed
    );

  if (!placement) {
    return null;
  }

  const net = prepareNet(placement.cells);
  const extremes =
    getCascadeTravelExtremes(net, prefer);

  const phaseAmount = constrain(
    Number(settings.cascadePhaseOffset) || 0,
    0,
    1
  );

  const waitDelay =
    cascadePhaseRoll(seed, index) * phaseAmount * 1.8;

  return {
    typeIndex,
    colorIndex: typeIndex,
    scale,
    seed,
    laneIndex: index % max(1, layout.lanes),
    depthIndex: floor(index / max(1, layout.lanes)),
    laneCount: layout.lanes,
    streamLayout: layout,
    creaseStyle: floor(unitHash(seed * 1.7) * 5),
    prefer,
    cells: placement.cells,
    net,
    trailingIndex: extremes.trailingIndex,
    leadingIndex: extremes.leadingIndex,
    plantX: plant[0],
    plantY: plant[1],
    nudgeX: 0,
    nudgeZ: 0,
    phase: "folded",
    animProgress: 0,
    pauseTimer: 0,
    waitTimer: 0,
    waitDelay
  };
}

function cascadeSourceMargin(scale = 1) {
  return max(2, max(1, round(scale) || 1) + 1);
}

function cascadeTravelerVisible(traveler, settings) {
  if (
    traveler.phase === "unravel" ||
    traveler.phase === "refold" ||
    traveler.phase === "pause-open" ||
    traveler.phase === "pause-closed"
  ) {
    return true;
  }

  const board = getVisibleFaceBoard(settings);
  const scale = max(1, traveler.scale || 1);

  return cascadePlantOnBoard(
    getCascadePlantCell(traveler),
    board,
    scale
  );
}

function cascadePlantOnBoard(plant, board, scale) {
  const footprint = expandCellsToFootprint([plant], scale);

  for (const cell of footprint) {
    if (
      cell[0] >= board.minI &&
      cell[0] <= board.maxI &&
      cell[1] >= board.minJ &&
      cell[1] <= board.maxJ
    ) {
      return true;
    }
  }

  return false;
}

/*
 * True when every base cell of the plant footprint sits
 * strictly outside the visible board on the source axes.
 */
function getBoardTravelRange(board, prefer) {
  const corners = getBoardTravelCorners(board);

  const perpI = -prefer.dj;
  const perpJ = prefer.di;
  let travelMin = Infinity;
  let travelMax = -Infinity;
  let perpMin = Infinity;
  let perpMax = -Infinity;

  for (const corner of corners) {
    const travel =
      preferScore(
        corner[0],
        corner[1],
        prefer
      );

    const perp =
      corner[0] * perpI +
      corner[1] * perpJ;

    travelMin = min(travelMin, travel);
    travelMax = max(travelMax, travel);
    perpMin = min(perpMin, perp);
    perpMax = max(perpMax, perp);
  }

  return {
    travelMin,
    travelMax,
    perpMin,
    perpMax,
    perpI,
    perpJ
  };
}

function latticeFromTravelPerp(travel, perp, prefer) {
  const di = prefer.di;
  const dj = prefer.dj;

  return [
    round((di * travel - dj * perp) * 0.5),
    round((dj * travel + di * perp) * 0.5)
  ];
}

/*
 * True when the plant sits on the incoming side of
 * travel — behind the visible board, not past it.
 */
function cascadePlantOffSourceBoard(
  plant,
  board,
  prefer,
  scale
) {
  const edge = max(1, scale);
  const range = getBoardTravelRange(board, prefer);
  const plantScore =
    preferScore(
      plant[0] * edge,
      plant[1] * edge,
      prefer
    );

  return plantScore < range.travelMin;
}

function findFreeCascadePlant(
  board,
  prefer,
  scale,
  occupied,
  seed,
  index,
  layout = null,
  laneIndex = 0,
  depthIndex = 0,
  spawnMode = "reset"
) {
  const edge = max(1, scale);

  if (spawnMode === "initial") {
    return findInitialCascadePlant(
      board,
      prefer,
      edge,
      occupied,
      seed,
      index,
      layout,
      laneIndex,
      depthIndex
    );
  }

  const plant = findResetCascadePlant(
    board,
    prefer,
    edge,
    occupied,
    seed,
    index,
    layout,
    laneIndex,
    depthIndex
  );

  return plant;
}

function findInitialCascadePlant(
  board,
  prefer,
  edge,
  occupied,
  seed,
  index,
  layout,
  laneIndex,
  depthIndex
) {
  const laneCount = layout ? layout.lanes : 1;

  const slot = getCascadeStartCell(
    board,
    prefer,
    laneIndex,
    laneCount,
    seed,
    depthIndex,
    layout,
    edge,
    "initial"
  );

  const anchorI = round(slot.i / edge);
  const anchorJ = round(slot.j / edge);
  const candidates = [];

  for (
    let j = board.minJ;
    j <= board.maxJ - (edge - 1);
    j += edge
  ) {
    for (
      let i = board.minI;
      i <= board.maxI - (edge - 1);
      i += edge
    ) {
      const logicalI = round(i / edge);
      const logicalJ = round(j / edge);
      const plant = [logicalI, logicalJ];

      if (
        !cascadePlantOnBoard(
          plant,
          board,
          edge
        )
      ) {
        continue;
      }

      candidates.push({
        i: logicalI,
        j: logicalJ,
        travel: preferScore(
          logicalI * edge,
          logicalJ * edge,
          prefer
        ),
        dist:
          abs(logicalI - anchorI) +
          abs(logicalJ - anchorJ),
        order: cellHash(
          coordinateKey(logicalI, logicalJ),
          index + placementSeed + edge * 17
        )
      });
    }
  }

  return pickFreeCascadeCandidate(
    candidates,
    edge,
    occupied,
    seed,
    index,
    (a, b) => {
      if (a.dist !== b.dist) {
        return a.dist - b.dist;
      }

      if (a.travel !== b.travel) {
        return a.travel - b.travel;
      }

      return a.order - b.order;
    }
  );
}

function findResetCascadePlant(
  board,
  prefer,
  edge,
  occupied,
  seed,
  index,
  layout,
  laneIndex,
  depthIndex
) {
  const range =
    layout
      ? {
          travelMin: layout.travelMin,
          travelMax: layout.travelMax,
          perpMin: layout.perpMin,
          perpMax: layout.perpMax
        }
      : getBoardTravelRange(board, prefer);

  const laneCount =
    layout ? max(1, layout.lanes) : 1;

  const laneT =
    laneCount <= 1
      ? 0.5
      : constrain(
          laneIndex / (laneCount - 1),
          0,
          1
        );

  const targetPerp =
    range.perpMin +
    laneT * (range.perpMax - range.perpMin);

  const behindMax =
    cascadeSourceMargin(edge) + 3;

  const candidates = [];

  for (
    let behind = 1;
    behind <= behindMax;
    behind++
  ) {
    const travel =
      range.travelMin - behind * edge;

    for (
      let perp = floor(range.perpMin) - 4;
      perp <= ceil(range.perpMax) + 4;
      perp++
    ) {
      const cell =
        latticeFromTravelPerp(
          travel,
          perp,
          prefer
        );

      const logicalI = round(cell[0] / edge);
      const logicalJ = round(cell[1] / edge);
      const plant = [logicalI, logicalJ];

      if (
        !cascadePlantOffSourceBoard(
          plant,
          board,
          prefer,
          edge
        )
      ) {
        continue;
      }

      candidates.push({
        i: logicalI,
        j: logicalJ,
        dist:
          behind * 8 +
          abs(perp - targetPerp) +
          abs(behind - 1) * 0.25,
        order: cellHash(
          coordinateKey(logicalI, logicalJ),
          index +
            placementSeed +
            edge * 17 +
            depthIndex * 5.3
        )
      });
    }
  }

  return pickFreeCascadeCandidate(
    candidates,
    edge,
    occupied,
    seed,
    index,
    (a, b) => {
      if (a.dist !== b.dist) {
        return a.dist - b.dist;
      }

      return a.order - b.order;
    }
  );
}

function pickFreeCascadeCandidate(
  candidates,
  edge,
  occupied,
  seed,
  index,
  sortFn
) {
  if (candidates.length === 0) {
    return null;
  }

  candidates.sort(sortFn);

  const start =
    floor(
      unitHash(seed * 0.71 + index * 3.1) *
      candidates.length
    );

  for (let n = 0; n < candidates.length; n++) {
    const candidate =
      candidates[(start + n) % candidates.length];

    const keys = footprintKeys(
      [[candidate.i, candidate.j]],
      edge
    );

    let free = true;

    for (const key of keys) {
      if (occupied.has(key)) {
        free = false;
        break;
      }
    }

    if (free) {
      return [candidate.i, candidate.j];
    }
  }

  return null;
}

function buildCascadeNetAtPlant(
  typeIndex,
  prefer,
  plant,
  scale,
  seed
) {
  const base = CUBE_NETS[typeIndex];
  let best = null;
  let bestScore = -Infinity;

  for (let flip = 0; flip < 2; flip++) {
    for (let rot = 0; rot < 4; rot++) {
      const local =
        normalizeCells(
          transformCells(base, rot, flip === 1)
        );

      const trailing =
        getLocalExtreme(local, prefer, false);

      const leading =
        getLocalExtreme(local, prefer, true);

      const span =
        (leading[0] - trailing[0]) * prefer.di +
        (leading[1] - trailing[1]) * prefer.dj;

      if (span <= 0) {
        continue;
      }

      const score =
        span * 8 -
        abs(span - 3) * 2.5 +
        unitHash(seed + rot * 3 + flip) * 0.2;

      if (score > bestScore) {
        bestScore = score;
        best = { local, trailing, leading, span };
      }
    }
  }

  if (!best) {
    return null;
  }

  const ox = plant[0] - best.trailing[0];
  const oy = plant[1] - best.trailing[1];

  const cells = best.local.map((cell) => [
    cell[0] + ox,
    cell[1] + oy
  ]);

  return { cells, span: best.span, scale };
}

function cascadePhaseRoll(seed, salt = 0) {
  const a = fract(Math.abs(seed) * 0.6180339887);
  const b = fract(Math.abs(placementSeed) * 1.6180339887e-6);
  const c = fract(Math.abs(salt) * 0.3819660113);

  return unitHash(a * 127.1 + b * 311.7 + c * 74.9 + 3.1);
}

function buildCascadeNetPlacement(
  typeIndex,
  prefer,
  board,
  laneIndex,
  laneCount,
  seed,
  depthIndex = 0,
  layout = null,
  scale = 1,
  slot = null
) {
  const cubeScale = max(1, scale || 1);
  const base = CUBE_NETS[typeIndex];
  let best = null;
  let bestScore = -Infinity;

  for (let flip = 0; flip < 2; flip++) {
    for (let rot = 0; rot < 4; rot++) {
      const local =
        normalizeCells(
          transformCells(base, rot, flip === 1)
        );

      const trailing = getLocalExtreme(local, prefer, false);
      const leading = getLocalExtreme(local, prefer, true);

      const span =
        (leading[0] - trailing[0]) * prefer.di +
        (leading[1] - trailing[1]) * prefer.dj;

      if (span <= 0) {
        continue;
      }

      const score =
        span * 8 -
        abs(span - 3) * 2.5 +
        unitHash(seed + rot * 3 + flip) * 0.2;

      if (score > bestScore) {
        bestScore = score;
        best = { local, trailing, leading, span };
      }
    }
  }

  if (!best) {
    const local = normalizeCells(base);
    best = {
      local,
      trailing: getLocalExtreme(local, prefer, false),
      leading: getLocalExtreme(local, prefer, true),
      span: 1
    };
  }

  const startBase =
    slot
      ? { i: slot.i, j: slot.j }
      : getCascadeStartCell(
          board,
          prefer,
          laneIndex,
          laneCount,
          seed,
          depthIndex,
          layout,
          cubeScale
        );

  /*
   * Keep stream positions in base lattice units, then
   * quantize into this cube's logical face grid.
   */
  const start = {
    i: round(startBase.i / cubeScale),
    j: round(startBase.j / cubeScale)
  };

  const ox = start.i - best.trailing[0];
  const oy = start.j - best.trailing[1];

  const cells = best.local.map((cell) => [
    cell[0] + ox,
    cell[1] + oy
  ]);

  return {
    cells,
    span: best.span,
    scale: cubeScale,
    nudgeX: slot ? slot.nudgeX || 0 : 0,
    nudgeZ: slot ? slot.nudgeZ || 0 : 0
  };
}

function getLocalExtreme(cells, prefer, wantLeading) {
  let best = cells[0];
  let bestScore = preferScore(best[0], best[1], prefer);

  for (const cell of cells) {
    const score =
      preferScore(cell[0], cell[1], prefer);

    if (wantLeading) {
      if (score > bestScore) {
        bestScore = score;
        best = cell;
      }
    } else if (score < bestScore) {
      bestScore = score;
      best = cell;
    }
  }

  return best;
}

function preferScore(i, j, prefer) {
  return i * prefer.di + j * prefer.dj;
}

function getCascadeStartCell(
  board,
  prefer,
  laneIndex,
  laneCount,
  seed,
  depthIndex = 0,
  layout = null,
  scale = 1,
  spawnMode = "reset"
) {
  const margin = cascadeSourceMargin(scale);
  const inset = max(1, max(1, round(scale) || 1));
  const onBoard = spawnMode === "initial";
  const lanes = max(1, laneCount);

  if (!onBoard) {
    const range =
      layout
        ? {
            travelMin: layout.travelMin,
            travelMax: layout.travelMax,
            perpMin: layout.perpMin,
            perpMax: layout.perpMax
          }
        : getBoardTravelRange(board, prefer);

    const laneT =
      lanes <= 1
        ? 0.5
        : constrain(
            laneIndex / (lanes - 1),
            0,
            1
          );

    const perp =
      range.perpMin +
      laneT * (range.perpMax - range.perpMin);

    /*
     * Keep recycled cubes on the source lip so the
     * next hop can enter the frame. Deep stacking
     * behind the board starved the stream.
     */
    const travel =
      range.travelMin - margin;

    const cell =
      latticeFromTravelPerp(
        travel,
        perp,
        prefer
      );

    return { i: cell[0], j: cell[1] };
  }

  /* spacing is in travel / perp score units */
  const range = getBoardTravelRange(board, prefer);
  const lane = laneIndex - (lanes - 1) * 0.5;

  const laneSpacing =
    layout
      ? layout.laneSpacing
      : (range.perpMax - range.perpMin) * 0.16;

  const stepSpacing =
    layout
      ? max(1, layout.stepSpacing)
      : 10.8;

  const laneStep = max(laneSpacing, lanes > 12 ? 1.3 : 2);
  const depth = max(0, depthIndex);

  const cell = latticeFromTravelPerp(
    range.travelMin + inset + depth * stepSpacing,
    (range.perpMin + range.perpMax) * 0.5 +
      lane * laneStep,
    prefer
  );

  return { i: cell[0], j: cell[1] };
}

function getCascadeTravelExtremes(net, prefer) {
  let trailingIndex = 0;
  let leadingIndex = 0;
  let trailingScore = Infinity;
  let leadingScore = -Infinity;

  for (const face of net.faces) {
    const score =
      preferScore(face.gridX, face.gridY, prefer);

    if (score < trailingScore) {
      trailingScore = score;
      trailingIndex = face.index;
    }

    if (score > leadingScore) {
      leadingScore = score;
      leadingIndex = face.index;
    }
  }

  return { trailingIndex, leadingIndex };
}

function advanceCascadeTraveler(traveler, settings) {
  const trailing =
    traveler.net.faces[traveler.trailingIndex];

  const leading =
    traveler.net.faces[traveler.leadingIndex];

  const dx = leading.gridX - trailing.gridX;
  const dy = leading.gridY - trailing.gridY;

  if (dx === 0 && dy === 0) {
    resetCascadeTravelerToStart(traveler, settings);
    return;
  }

  const nextCells = traveler.cells.map((cell) => [
    cell[0] + dx,
    cell[1] + dy
  ]);

  traveler.cells = nextCells;
  traveler.net = prepareNet(nextCells);

  const extremes =
    getCascadeTravelExtremes(
      traveler.net,
      traveler.prefer
    );

  traveler.trailingIndex = extremes.trailingIndex;
  traveler.leadingIndex = extremes.leadingIndex;

  if (cascadeTravelerOffBoard(traveler, settings)) {
    resetCascadeTravelerToStart(traveler, settings);
  }
}

function cascadeTravelerOffBoard(traveler, settings) {
  const board = getVisibleFaceBoard(settings);
  const scale = max(1, traveler.scale || 1);
  const prefer = traveler.prefer;
  const range = getBoardTravelRange(board, prefer);
  const trailing =
    traveler.net &&
    traveler.net.faces[traveler.trailingIndex];

  if (!trailing) {
    return false;
  }

  /*
   * Recycle only after the cube has passed the EXIT
   * of the frame. Source-side hops must keep moving
   * in — treating "anywhere off-board" as done was
   * resetting cubes before they could re-enter.
   */
  const score =
    preferScore(
      trailing.gridX * scale,
      trailing.gridY * scale,
      prefer
    );

  return (
    score >
    range.travelMax +
      cascadeSourceMargin(scale)
  );
}

function resetCascadeTravelerToStart(traveler, settings) {
  const board = getVisibleFaceBoard(settings);
  const occupied = buildCascadeOccupancy(traveler);
  const scale = max(1, traveler.scale || 1);
  const layout =
    traveler.streamLayout ||
    getCascadeStreamLayout(
      board,
      traveler.prefer,
      max(1, cascadeTravelers.length),
      scale
    );

  let plant = findFreeCascadePlant(
    board,
    traveler.prefer,
    scale,
    occupied,
    traveler.seed + cascadeTime * 17,
    max(0, cascadeTravelers.indexOf(traveler)),
    layout,
    traveler.laneIndex || 0,
    traveler.depthIndex || 0,
    "reset"
  );

  if (!plant) {
    const slot = getCascadeStartCell(
      board,
      traveler.prefer,
      traveler.laneIndex || 0,
      traveler.laneCount || layout.lanes || 1,
      traveler.seed + cascadeTime * 0.31,
      (traveler.depthIndex || 0) +
        floor(cascadeTime * 0.07) % 6,
      layout,
      scale,
      "reset"
    );

    plant = [
      round(slot.i / scale),
      round(slot.j / scale)
    ];
  }

  const typeIndex =
    traveler.typeIndex ??
    pickAllowedTypeIndex(
      traveler.seed + cascadeTime,
      settings
    );

  const placement =
    buildCascadeNetAtPlant(
      typeIndex,
      traveler.prefer,
      plant,
      scale,
      traveler.seed
    );

  if (!placement) {
    traveler.plantX = plant[0];
    traveler.plantY = plant[1];
    traveler.phase = "waiting";
    traveler.waitTimer = 0;
    traveler.waitDelay = 0.1;
    return;
  }

  traveler.typeIndex = typeIndex;
  if (traveler.colorIndex === undefined) {
    traveler.colorIndex = typeIndex;
  }
  traveler.cells = placement.cells;
  traveler.net = prepareNet(placement.cells);
  traveler.plantX = plant[0];
  traveler.plantY = plant[1];
  traveler.nudgeX = 0;
  traveler.nudgeZ = 0;
  traveler.scale = scale;

  const extremes =
    getCascadeTravelExtremes(
      traveler.net,
      traveler.prefer
    );

  traveler.trailingIndex = extremes.trailingIndex;
  traveler.leadingIndex = extremes.leadingIndex;
  traveler.phase = "folded";
  traveler.animProgress = 0;
  traveler.pauseTimer = 0;
  traveler.waitTimer = 0;
  traveler.waitDelay = 0;

  tryBeginCascadeUnfold(traveler, settings);
}

function cascadeCellsOverlap(
  cellsA,
  cellsB,
  scaleA = 1,
  scaleB = 1
) {
  const keys =
    new Set(footprintKeys(cellsB, scaleB));

  for (const key of footprintKeys(cellsA, scaleA)) {
    if (keys.has(key)) {
      return true;
    }
  }

  return false;
}

function getCascadePlantFaceIndex(traveler) {
  if (!traveler.net || !traveler.net.faces) {
    return 0;
  }

  for (const face of traveler.net.faces) {
    if (
      face.gridX === traveler.plantX &&
      face.gridY === traveler.plantY
    ) {
      return face.index;
    }
  }

  return traveler.trailingIndex || 0;
}

function drawCascadeNets(settings) {
  ensureCascadeTravelers(settings);

  const size = settings.faceSize;

  for (const traveler of cascadeTravelers) {
    if (!cascadeTravelerVisible(traveler, settings)) {
      continue;
    }

    const folded = cascadeTravelerIsFolded(traveler);
    const unraveling =
      traveler.phase === "unravel";
    const pauseOpen =
      traveler.phase === "pause-open";

    const plantIndex = folded
      ? getCascadePlantFaceIndex(traveler)
      : unraveling || pauseOpen
        ? traveler.trailingIndex
        : traveler.leadingIndex;

    let foldProgress;

    if (folded) {
      foldProgress = 1;
    } else if (pauseOpen) {
      foldProgress = 0;
    } else if (unraveling) {
      foldProgress = 1 - traveler.animProgress;
    } else {
      foldProgress = traveler.animProgress;
    }

    const plantFace =
      traveler.net.faces[plantIndex] ||
      traveler.net.faces[0];

    const scale = max(1, traveler.scale || 1);
    const origin = worldOriginForFace(
      plantFace.gridX,
      plantFace.gridY,
      scale,
      size
    );

    drawNet(
      traveler.net,
      origin.x,
      origin.z,
      getNetColor(
        traveler.colorIndex !== undefined
          ? traveler.colorIndex
          : traveler.typeIndex,
        settings
      ),
      settings,
      traveler.creaseStyle,
      traveler.seed,
      0,
      {
        foldMode: "one-side",
        foldProgress,
        plantFaceIndex: plantFace.index,
        useOriginAsPlant: true,
        drapeAmount: 0,
        cubeScale: scale,
        colorKey: traveler,
        motionCurve: settings.cascadeMotionCurve
      }
    );
  }
}



/*
 * Build every rotation / mirror of the 11 cube nets
 * so the packer can puzzle-piece them together.
 */
function buildAllNetVariants() {
  const variants = [];

  for (
    let typeIndex = 0;
    typeIndex < CUBE_NETS.length;
    typeIndex++
  ) {
    const base = CUBE_NETS[typeIndex];
    const seen = new Set();

    for (let flip = 0; flip < 2; flip++) {
      for (let rot = 0; rot < 4; rot++) {
        const cells =
          normalizeCells(
            transformCells(base, rot, flip === 1)
          );

        const signature =
          cells
            .map((cell) => coordinateKey(cell[0], cell[1]))
            .join("|");

        if (seen.has(signature)) {
          continue;
        }

        seen.add(signature);

        variants.push({
          typeIndex,
          cells,
          rot,
          flip: flip === 1
        });
      }
    }
  }

  return variants;
}

function transformCells(cells, rot, flip) {
  return cells.map((cell) => {
    let x = cell[0];
    let y = cell[1];

    if (flip) {
      x = -x;
    }

    for (let step = 0; step < rot; step++) {
      const nextX = -y;
      const nextY = x;
      x = nextX;
      y = nextY;
    }

    return [x, y];
  });
}

function normalizeCells(cells) {
  let minX = Infinity;
  let minY = Infinity;

  for (const cell of cells) {
    minX = min(minX, cell[0]);
    minY = min(minY, cell[1]);
  }

  return cells
    .map((cell) => [
      cell[0] - minX,
      cell[1] - minY
    ])
    .sort((a, b) => {
      if (a[1] !== b[1]) {
        return a[1] - b[1];
      }

      return a[0] - b[0];
    });
}

function ensurePackedLayout(settings) {
  const key = [
    settings.faceSize.toFixed(5),
    settings.cameraZoom.toFixed(3),
    settings.gridSize,
    settings.gridPlacement,
    settings.placementSkew.toFixed(3),
    allowedTypesCacheKey(settings),
    scaleWeightsCacheKey(settings),
    placementSeed,
    width,
    height
  ].join("|");

  if (key === packCacheKey && packedPlacements.placements) {
    return;
  }

  packCacheKey = key;
  packedPlacements = buildHexominoPacking(settings);

  if (
    settings.sketchMode === "gridded" &&
    settings.gridPlacement === "centered"
  ) {
    syncCenteredCountSliderMax();
  }
}

/*
 * Cube-net hexominoes that tile the plane by
 * lattice translation. Used to puzzle-piece a
 * gapless cover of the visible face lattice.
 */
const HEXOMINO_TILINGS = [
  {
    typeIndex: 5,
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
      [2, 3]
    ],
    u: [0, 2],
    v: [-3, 0]
  },
  {
    typeIndex: 6,
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
      [1, 3],
      [1, 4]
    ],
    u: [0, 3],
    v: [2, 0]
  },
  {
    typeIndex: 8,
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 2]
    ],
    u: [0, 3],
    v: [2, 0]
  },
  {
    typeIndex: 4,
    cells: [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 2]
    ],
    u: [1, -3],
    v: [1, 3]
  },
  {
    typeIndex: 7,
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 1]
    ],
    u: [0, 3],
    v: [2, 2]
  },
  {
    typeIndex: 9,
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [3, 2]
    ],
    u: [0, 3],
    v: [2, 2]
  },
  {
    typeIndex: 10,
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 3]
    ],
    u: [0, 3],
    v: [2, 1]
  }
];

/*
 * Cover the visible face lattice with non-overlapping
 * cube nets. Pure 1× keeps the gapless hexomino tiling;
 * mixed / larger scales use occupancy packing that
 * preserves the requested size mix and allows gaps.
 */
function buildHexominoPacking(settings) {
  if (onlyUnitScaleActive(settings)) {
    return buildUnitScalePacking(settings);
  }

  return buildMixedScalePacking(settings);
}

function buildUnitScalePacking(settings) {
  const board = getVisibleFaceBoard(settings);
  const totalCells = board.cells.length;
  const placement = settings.gridPlacement;
  const skew = settings.placementSkew;
  const allowedTypes =
    getAllowedTypeIndexes(settings);

  const tiling =
    selectTilingForPlacement(
      placement,
      board,
      allowedTypes
    );

  let raw = stampFullTiling(tiling, board);
  raw = diversifyPackedNets(
    raw,
    allowedTypes.length < CUBE_NETS.length
      ? 160
      : 64,
    placement,
    skew,
    allowedTypes
  );
  raw = filterPackedByPlacement(raw, placement, skew);

  return finalizePackedPlacements(
    raw,
    settings,
    totalCells
  );
}

function buildMixedScalePacking(settings) {
  const board = getVisibleFaceBoard(settings);
  const totalCells = board.cells.length;
  const weights = getNormalizedScaleWeights(settings);
  const avgFootprint =
    6 * (
      weights[1] * 1 +
      weights[2] * 4 +
      weights[3] * 9
    );

  const totalTarget = max(
    1,
    floor(totalCells / max(1, avgFootprint))
  );

  const quotas = allocateScaleQuotas(totalTarget, weights);
  const occupied = new Set();
  const raw = [];

  /*
   * Place largest cubes first so the mix can claim
   * contiguous blocks before small cubes fill leftovers.
   */
  for (const scale of [3, 2, 1]) {
    placeScaledQuota(
      raw,
      occupied,
      board,
      settings,
      scale,
      quotas[scale]
    );
  }

  const filtered = filterPackedByPlacement(
    raw,
    settings.gridPlacement,
    settings.placementSkew
  );

  return finalizePackedPlacements(
    filtered,
    settings,
    totalCells
  );
}

function allocateScaleQuotas(totalTarget, weights) {
  const quotas = {
    1: round(totalTarget * weights[1]),
    2: round(totalTarget * weights[2]),
    3: round(totalTarget * weights[3])
  };

  let sum = quotas[1] + quotas[2] + quotas[3];

  const order = [1, 2, 3].sort((a, b) => {
    return weights[b] - weights[a];
  });

  while (sum > totalTarget) {
    let trimmed = false;

    for (const scale of order) {
      if (quotas[scale] > 0) {
        quotas[scale] -= 1;
        sum -= 1;
        trimmed = true;
        break;
      }
    }

    if (!trimmed) {
      break;
    }
  }

  while (sum < totalTarget) {
    let grown = false;

    for (const scale of order) {
      if (weights[scale] > 0) {
        quotas[scale] += 1;
        sum += 1;
        grown = true;
        break;
      }
    }

    if (!grown) {
      quotas[1] += 1;
      sum += 1;
    }
  }

  if (quotas[1] + quotas[2] + quotas[3] === 0) {
    quotas[1] = 1;
  }

  return quotas;
}

function placeScaledQuota(
  raw,
  occupied,
  board,
  settings,
  scale,
  want
) {
  if (want <= 0 || scale < 1) {
    return;
  }

  const placement = settings.gridPlacement;
  const skew = settings.placementSkew;
  const allowedTypes = getAllowedTypeIndexes(settings);
  const margin = 2;

  const minMI = floor(board.minI / scale) - margin;
  const maxMI = ceil(board.maxI / scale) + margin;
  const minMJ = floor(board.minJ / scale) - margin;
  const maxMJ = ceil(board.maxJ / scale) + margin;

  const anchors = [];

  for (let mj = minMJ; mj <= maxMJ; mj++) {
    for (let mi = minMI; mi <= maxMI; mi++) {
      anchors.push({
        mi,
        mj,
        order: cellHash(
          coordinateKey(mi * scale, mj * scale),
          scale * 19 + placementSeed
        )
      });
    }
  }

  anchors.sort((a, b) => a.order - b.order);

  let placed = 0;

  for (const anchor of anchors) {
    if (placed >= want) {
      break;
    }

    const salt =
      anchor.order +
      scale * 131 +
      placed * 7 +
      placementSeed;

    const candidate = tryPlaceScaledNetAt(
      anchor.mi,
      anchor.mj,
      scale,
      occupied,
      board,
      allowedTypes,
      placement,
      skew,
      salt
    );

    if (!candidate) {
      continue;
    }

    for (const key of candidate.footprintKeys) {
      occupied.add(key);
    }

    raw.push(candidate.entry);
    placed += 1;
  }
}

function tryPlaceScaledNetAt(
  mi,
  mj,
  scale,
  occupied,
  board,
  allowedTypes,
  placement,
  skew,
  salt
) {
  const variants = netVariants
    .filter((variant) => {
      if (
        allowedTypes &&
        allowedTypes.length > 0 &&
        !allowedTypes.includes(variant.typeIndex)
      ) {
        return false;
      }

      return variantMatchesPlacement(
        variant,
        placement,
        skew,
        salt
      );
    })
    .map((variant, index) => {
      return {
        variant,
        score:
          placementBiasScore(variant.cells, placement) *
            10 +
          unitHash(salt * 0.17 + index * 3.1 + scale)
      };
    })
    .sort((a, b) => b.score - a.score);

  for (const { variant } of variants) {
    const absolute = variant.cells.map((cell) => [
      cell[0] + mi,
      cell[1] + mj
    ]);

    if (!pieceIntersectsBoard(
      expandCellsToFootprint(absolute, scale),
      board
    )) {
      continue;
    }

    const keys = footprintKeys(absolute, scale);
    let free = true;

    for (const key of keys) {
      if (occupied.has(key)) {
        free = false;
        break;
      }
    }

    if (!free) {
      continue;
    }

    const rootCell = absolute[0];

    return {
      footprintKeys: keys,
      entry: {
        cells: absolute,
        scale,
        typeIndex: variant.typeIndex,
        creaseStyle:
          floor(
            unitHash(
              rootCell[0] * 19.7 +
              rootCell[1] * 47.3 +
              salt * 3.1 +
              placementSeed * 0.71 +
              scale * 5.9
            ) * 5
          ),
        seed:
          rootCell[0] * 131 +
          rootCell[1] * 17 +
          salt +
          placementSeed +
          scale * 97,
        order: cellHash(
          coordinateKey(
            rootCell[0] * scale,
            rootCell[1] * scale
          ),
          scale
        )
      }
    };
  }

  return null;
}

function finalizePackedPlacements(raw, settings, totalCells) {
  const size = settings.faceSize;
  const placement = settings.gridPlacement;
  const skew = settings.placementSkew;

  const placements = raw.map((entry) => {
    const scale = max(1, entry.scale || 1);
    const net = prepareNet(entry.cells);
    const root = net.faces[net.rootIndex];
    const skews =
      unitHash(entry.seed * 0.83) < skew;
    const origin = worldOriginForFace(
      root.gridX,
      root.gridY,
      scale,
      size
    );

    return {
      net,
      scale,
      /*
       * Centers sit on half-face offsets so face
       * corners land on the isometric lattice nodes.
       */
      originX: origin.x,
      originZ: origin.z,
      colorIndex: entry.typeIndex,
      creaseStyle:
        creaseStyleForPlacement(
          entry,
          placement,
          skews
        ),
      seed: entry.seed,
      order: entry.order,
      skews,
      foldDelay:
        unitHash(
          root.gridX * 73.1 +
          root.gridY * 29.7 +
          entry.seed * 0.17 +
          scale * 4.3
        ) * FOLD_STAGGER_MAX
    };
  });

  placements.sort((a, b) => a.order - b.order);

  return {
    placements,
    totalCells
  };
}

function selectTilingForPlacement(
  placement,
  board,
  allowedTypes = null
) {
  const restrict = (tilings) => {
    if (!allowedTypes || allowedTypes.length === 0) {
      return tilings;
    }

    const matched = tilings.filter((tiling) => {
      return allowedTypes.includes(tiling.typeIndex);
    });

    /*
     * Some of the 11 nets don't tile the plane. If
     * none of the selected types can seed a cover,
     * fall back so the frame still packs gaplessly.
     */
    return matched.length > 0
      ? matched
      : tilings;
  };

  const pick = (typeIndexes) => {
    const pool = restrict(
      HEXOMINO_TILINGS.filter((tiling) => {
        return typeIndexes.includes(tiling.typeIndex);
      })
    );

    if (pool.length === 0) {
      return HEXOMINO_TILINGS[0];
    }

    return pool[
      Math.abs(
        board.minI * 5 +
        board.minJ * 11 +
        placementSeed
      ) %
      pool.length
    ];
  };

  const family = placementFamily(placement);

  if (family === "diagonal") {
    return pick([4, 5, 7, 10]);
  }

  if (family === "vertical") {
    return pick([6, 8, 7, 10]);
  }

  if (family === "horizontal") {
    return pick([9, 5, 4]);
  }

  const pool = restrict(HEXOMINO_TILINGS);

  return pool[
    Math.abs(
      board.minI * 5 +
      board.minJ * 11 +
      placementSeed
    ) %
    pool.length
  ];
}

function pieceBounds(cells) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const cell of cells) {
    minX = min(minX, cell[0]);
    maxX = max(maxX, cell[0]);
    minY = min(minY, cell[1]);
    maxY = max(maxY, cell[1]);
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function pieceCentroid(cells) {
  let sumX = 0;
  let sumY = 0;

  for (const cell of cells) {
    sumX += cell[0];
    sumY += cell[1];
  }

  return {
    x: sumX / cells.length,
    y: sumY / cells.length
  };
}

/*
 * Spaced variants keep only every other band so the
 * gap between rows / columns / diagonals doubles.
 */
function pieceOnSpacedBand(cells, family) {
  const centroid = pieceCentroid(cells);

  if (family === "vertical") {
    return floor(centroid.x) % 2 === 0;
  }

  if (family === "horizontal") {
    return floor(centroid.y) % 2 === 0;
  }

  if (family === "diagonal") {
    return floor(centroid.x + centroid.y) % 2 === 0;
  }

  return true;
}

function filterPackedByPlacement(raw, placement, skew = 0) {
  const family = placementFamily(placement);

  if (family === "random") {
    return raw;
  }

  const spaced = placementIsSpaced(placement);

  return raw.filter((entry) => {
    if (unitHash(entry.seed * 0.57) < skew) {
      return true;
    }

    const bounds = pieceBounds(entry.cells);

    let matches = true;

    if (family === "vertical") {
      matches = bounds.height >= bounds.width;
    } else if (family === "horizontal") {
      matches = bounds.width >= bounds.height;
    } else if (family === "diagonal") {
      matches =
        bounds.width >= 2 && bounds.height >= 2;
    }

    if (!matches) {
      return false;
    }

    if (spaced && !pieceOnSpacedBand(entry.cells, family)) {
      return false;
    }

    return true;
  });
}

function creaseStyleForPlacement(entry, placement, skews = false) {
  const family = placementFamily(placement);

  if (skews || family === "random") {
    return entry.creaseStyle;
  }

  if (family === "vertical") {
    /*
     * Odd-depth folds — reads as a vertical cascade.
     */
    return 0;
  }

  if (family === "horizontal") {
    return 2;
  }

  if (family === "diagonal") {
    return unitHash(entry.seed * 0.27) < 0.78
      ? 0
      : floor(unitHash(entry.seed * 0.91) * 5);
  }

  return entry.creaseStyle;
}

/*
 * Stamp one translational cube-net tiling across the
 * board. Because it tiles the infinite lattice, every
 * visible cell is covered exactly once.
 */
function stampFullTiling(tiling, board) {
  const raw = [];
  const occupied = new Set();
  const range = 36;

  for (let i = -range; i <= range; i++) {
    for (let j = -range; j <= range; j++) {
      const ox =
        i * tiling.u[0] +
        j * tiling.v[0];

      const oy =
        i * tiling.u[1] +
        j * tiling.v[1];

      const absolute = tiling.cells.map((cell) => [
        cell[0] + ox,
        cell[1] + oy
      ]);

      if (!pieceIntersectsBoard(absolute, board)) {
        continue;
      }

      const rootCell = absolute[0];

      /*
       * Stable spatial hash so a low coverage %
       * picks pieces scattered across the canvas
       * instead of clustering near the center.
       */
      const order = cellHash(
        coordinateKey(rootCell[0], rootCell[1]),
        3
      );

      pushPackedPiece(
        absolute,
        tiling.typeIndex,
        i * 31 + j * 7 + placementSeed,
        occupied,
        raw,
        order
      );
    }
  }

  return raw;
}

function pieceIntersectsBoard(absolute, board) {
  for (const cell of absolute) {
    if (
      cell[0] >= board.minI &&
      cell[0] <= board.maxI &&
      cell[1] >= board.minJ &&
      cell[1] <= board.maxJ
    ) {
      return true;
    }
  }

  return false;
}

function pushPackedPiece(
  absolute,
  typeIndex,
  salt,
  occupied,
  raw,
  order
) {
  for (const cell of absolute) {
    occupied.add(coordinateKey(cell[0], cell[1]));
  }

  const rootCell = absolute[0];

  raw.push({
    cells: absolute,
    typeIndex,
    creaseStyle:
      floor(
        unitHash(
          rootCell[0] * 19.7 +
          rootCell[1] * 47.3 +
          salt * 3.1 +
          placementSeed * 0.71
        ) * 5
      ),
    seed:
      rootCell[0] * 131 +
      rootCell[1] * 17 +
      salt +
      placementSeed,
    order:
      order === undefined
        ? cellHash(
            coordinateKey(rootCell[0], rootCell[1]),
            0
          )
        : order
  });
}

/*
 * Rematch neighboring piece pairs with other cube
 * nets that cover the same 12 cells, mixing types
 * while preserving a perfect non-overlapping cover.
 */
function diversifyPackedNets(
  raw,
  attempts,
  placement = "random",
  skew = 0,
  allowedTypes = null
) {
  const pieces = raw.map((entry) => ({
    ...entry,
    cells: entry.cells.map((cell) => cell.slice())
  }));

  const cellToPiece = new Map();

  const rebuildMap = () => {
    cellToPiece.clear();

    for (
      let index = 0;
      index < pieces.length;
      index++
    ) {
      for (const cell of pieces[index].cells) {
        cellToPiece.set(
          coordinateKey(cell[0], cell[1]),
          index
        );
      }
    }
  };

  rebuildMap();

  const filtering =
    allowedTypes &&
    allowedTypes.length > 0 &&
    allowedTypes.length < CUBE_NETS.length;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (pieces.length < 2) {
      break;
    }

    let indexA = floor(
      unitHash(
        attempt * 17.9 + 3.1 + placementSeed
      ) *
      pieces.length
    );

    /*
     * When filtering types, prefer rematching pieces
     * that still use a disallowed seed tiling type.
     */
    if (filtering) {
      const offenders = [];

      for (let i = 0; i < pieces.length; i++) {
        if (
          !allowedTypes.includes(pieces[i].typeIndex)
        ) {
          offenders.push(i);
        }
      }

      if (offenders.length > 0) {
        indexA =
          offenders[
            floor(
              unitHash(
                attempt * 13.7 + placementSeed
              ) *
              offenders.length
            )
          ];
      }
    }

    const neighbors = findNeighborPieceIndexes(
      pieces[indexA],
      indexA,
      cellToPiece
    );

    if (neighbors.length === 0) {
      continue;
    }

    const indexB =
      neighbors[
        floor(
          unitHash(
            attempt * 41.3 + placementSeed
          ) *
          neighbors.length
        )
      ];

    const regionSet = new Set(
      [
        ...pieces[indexA].cells,
        ...pieces[indexB].cells
      ].map((cell) =>
        coordinateKey(cell[0], cell[1])
      )
    );

    const replacement = rematchTwoHexominoes(
      regionSet,
      attempt + placementSeed * 17,
      pieces[indexA].typeIndex,
      pieces[indexB].typeIndex,
      placement,
      skew,
      allowedTypes
    );

    if (!replacement) {
      continue;
    }

    pieces[indexA] = replacement[0];
    pieces[indexB] = replacement[1];
    rebuildMap();
  }

  return pieces;
}

function findNeighborPieceIndexes(
  piece,
  selfIndex,
  cellToPiece
) {
  const found = new Set();
  const deltas = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  for (const cell of piece.cells) {
    for (const delta of deltas) {
      const key = coordinateKey(
        cell[0] + delta[0],
        cell[1] + delta[1]
      );

      if (!cellToPiece.has(key)) {
        continue;
      }

      const other = cellToPiece.get(key);

      if (other !== selfIndex) {
        found.add(other);
      }
    }
  }

  return [...found];
}

function rematchTwoHexominoes(
  regionSet,
  salt,
  avoidA,
  avoidB,
  placement = "random",
  skew = 0,
  allowedTypes = null
) {
  const remaining = new Set(regionSet);
  const seedKey = [...remaining][0];
  const firstOptions = listPlacementsForSeed(
    seedKey,
    remaining,
    salt,
    placement,
    skew,
    allowedTypes
  );

  for (const first of firstOptions) {
    for (const key of first.keys) {
      remaining.delete(key);
    }

    if (remaining.size !== 6) {
      for (const key of first.keys) {
        remaining.add(key);
      }

      continue;
    }

    const secondSeed = [...remaining][0];
    const secondOptions = listPlacementsForSeed(
      secondSeed,
      remaining,
      salt + 9,
      placement,
      skew,
      allowedTypes
    );

    for (const second of secondOptions) {
      let covers = true;

      for (const key of second.keys) {
        if (!remaining.has(key)) {
          covers = false;
          break;
        }
      }

      if (!covers || second.keys.length !== 6) {
        continue;
      }

      if (
        first.entry.typeIndex === avoidA &&
        second.entry.typeIndex === avoidB
      ) {
        continue;
      }

      return [first.entry, second.entry];
    }

    for (const key of first.keys) {
      remaining.add(key);
    }
  }

  return null;
}

function listPlacementsForSeed(
  seedKey,
  remaining,
  salt,
  placement = "random",
  skew = 0,
  allowedTypes = null
) {
  const seed = parseCoordinateKey(seedKey);
  const results = [];

  for (const variant of netVariants) {
    if (
      allowedTypes &&
      allowedTypes.length > 0 &&
      !allowedTypes.includes(variant.typeIndex)
    ) {
      continue;
    }

    if (
      !variantMatchesPlacement(
        variant,
        placement,
        skew,
        salt
      )
    ) {
      continue;
    }

    for (
      let anchor = 0;
      anchor < variant.cells.length;
      anchor++
    ) {
      const ox =
        seed[0] - variant.cells[anchor][0];
      const oy =
        seed[1] - variant.cells[anchor][1];

      const absolute = [];
      const keys = [];
      let fits = true;

      for (const cell of variant.cells) {
        const gx = cell[0] + ox;
        const gy = cell[1] + oy;
        const key = coordinateKey(gx, gy);

        if (!remaining.has(key)) {
          fits = false;
          break;
        }

        absolute.push([gx, gy]);
        keys.push(key);
      }

      if (!fits) {
        continue;
      }

      const rootCell = absolute[0];

      results.push({
        keys,
        entry: {
          cells: absolute,
          typeIndex: variant.typeIndex,
          creaseStyle:
            floor(
              unitHash(
                rootCell[0] * 19.7 +
                rootCell[1] * 47.3 +
                salt * 3.1
              ) * 5
            ),
          seed:
            rootCell[0] * 131 +
            rootCell[1] * 17 +
            salt,
          order: cellHash(
            coordinateKey(rootCell[0], rootCell[1]),
            0
          )
        }
      });
    }
  }

  results.sort((a, b) => {
    const biasA =
      placementBiasScore(a.entry.cells, placement);
    const biasB =
      placementBiasScore(b.entry.cells, placement);

    if (biasA !== biasB) {
      return biasB - biasA;
    }

    return (
      unitHash(a.entry.seed * 0.11 + salt) -
      unitHash(b.entry.seed * 0.11 + salt + 1)
    );
  });

  return results;
}

function variantMatchesPlacement(
  variant,
  placement,
  skew = 0,
  salt = 0
) {
  const family = placementFamily(placement);

  if (family === "random") {
    return true;
  }

  if (
    unitHash(
      variant.typeIndex * 19.1 +
      variant.rot * 3.7 +
      (variant.flip ? 8 : 0) +
      salt
    ) < skew
  ) {
    return true;
  }

  const bounds = pieceBounds(variant.cells);

  if (family === "vertical") {
    return bounds.height >= bounds.width;
  }

  if (family === "horizontal") {
    return bounds.width >= bounds.height;
  }

  if (family === "diagonal") {
    return bounds.width >= 2 && bounds.height >= 2;
  }

  return true;
}

function placementBiasScore(cells, placement) {
  const bounds = pieceBounds(cells);
  const family = placementFamily(placement);

  if (family === "vertical") {
    return bounds.height - bounds.width;
  }

  if (family === "horizontal") {
    return bounds.width - bounds.height;
  }

  if (family === "diagonal") {
    return min(bounds.width, bounds.height);
  }

  return 0;
}

function getVisibleFaceBoard(settings) {
  const size = settings.faceSize;
  const samples = [];

  const cols = 28;
  const rows = 20;

  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      const sx =
        map(col, 0, cols, -width * 0.5, width * 0.5);

      const sy =
        map(row, 0, rows, -height * 0.5, height * 0.5);

      const world =
        screenToUnfoldedRootOrigin(
          sx,
          sy,
          settings
        );

      samples.push([
        round(world.x / size),
        round(world.z / size)
      ]);
    }
  }

  let minI = Infinity;
  let maxI = -Infinity;
  let minJ = Infinity;
  let maxJ = -Infinity;

  for (const sample of samples) {
    minI = min(minI, sample[0]);
    maxI = max(maxI, sample[0]);
    minJ = min(minJ, sample[1]);
    maxJ = max(maxJ, sample[1]);
  }

  if (maxI < minI) {
    maxI = minI;
  }

  if (maxJ < minJ) {
    maxJ = minJ;
  }

  const cells = [];

  for (let j = minJ; j <= maxJ; j++) {
    for (let i = minI; i <= maxI; i++) {
      cells.push(coordinateKey(i, j));
    }
  }

  /*
   * The i/j box overshoots the screen a lot along the
   * isometric diagonals; travel ranges use the real
   * screen corners in lattice units instead.
   */
  const screenCorners = [
    [-width * 0.5, -height * 0.5],
    [width * 0.5, -height * 0.5],
    [-width * 0.5, height * 0.5],
    [width * 0.5, height * 0.5]
  ].map(([sx, sy]) => {
    const world =
      screenToUnfoldedRootOrigin(sx, sy, settings);

    return [world.x / size, world.z / size];
  });

  return {
    minI,
    maxI,
    minJ,
    maxJ,
    cells,
    screenCorners
  };
}

function getBoardTravelCorners(board) {
  return (
    board.screenCorners || [
      [board.minI, board.minJ],
      [board.minI, board.maxJ],
      [board.maxI, board.minJ],
      [board.maxI, board.maxJ]
    ]
  );
}

function parseCoordinateKey(key) {
  const parts = key.split(",");

  return [
    Number(parts[0]),
    Number(parts[1])
  ];
}

function cellHash(key, salt) {
  const parts = parseCoordinateKey(key);

  return unitHash(
    parts[0] * 127.1 +
    parts[1] * 311.7 +
    salt * 74.9
  );
}

function variantHash(variant, x, y, salt) {
  return unitHash(
    variant.typeIndex * 91.7 +
    variant.rot * 13.3 +
    (variant.flip ? 47.1 : 0) +
    x * 5.9 +
    y * 17.3 +
    salt * 29.7
  );
}

function unitHash(value) {
  return fract(sin(value) * 43758.5453);
}

function drawNet(
  net,
  originX,
  originZ,
  netColor,
  settings,
  creaseStyle = 0,
  creaseSeed = 0,
  foldDelay = 0,
  options = {}
) {
  const foldMode =
    options.foldMode || settings.foldMode;

  const cubeScale = max(1, options.cubeScale || 1);
  const edgeSize = settings.faceSize * cubeScale;
  const motionCurve =
    options.motionCurve ||
    settings.cascadeMotionCurve ||
    (options.linearFold ? "linear" : "ease");

  let staggeredProgress;

  if (options.foldProgress !== undefined) {
    staggeredProgress = constrain(
      options.foldProgress,
      0,
      1
    );
  } else {
    /*
     * Per-net fold stagger: some cubes begin folding
     * later so the field doesn't turn over in lockstep.
     */
    staggeredProgress = staggeredNetFoldProgress(
      settings.foldProgress,
      foldDelay,
      settings
    );
  }

  const globalCurvedProgress =
    applyMotionCurve(
      staggeredProgress,
      motionCurve
    );

  /*
   * One side: plant an end face and fold the sheet
   * onto it. Cascade passes a traveling plant origin;
   * gridded mode plants on the absolute lattice cell.
   */
  let activeNet = net;
  let plantX = originX;
  let plantZ = originZ;

  if (foldMode === "one-side") {
    let endIndex;

    if (options.plantFaceIndex !== undefined) {
      endIndex = options.plantFaceIndex;
    } else {
      const fromMaxX =
        options.plantFromMaxX !== undefined
          ? options.plantFromMaxX
          : unitHash(creaseSeed * 0.91 + 2.3) < 0.5;

      endIndex =
        getExtremeFaceIndex(net, fromMaxX);
    }

    activeNet = rerootNet(net, endIndex);

    if (options.useOriginAsPlant) {
      plantX = originX;
      plantZ = originZ;
    } else {
      const endFace =
        activeNet.faces[endIndex];

      const plant = worldOriginForFace(
        endFace.gridX,
        endFace.gridY,
        cubeScale,
        settings.faceSize
      );

      plantX = plant.x;
      plantZ = plant.z;
    }
  }

  /*
   * One crease tree. Faces only rotate about shared
   * edges, so the hexomino stays connected.
   *
   * Unfolded: each crease sits at a draped angle so
   * the sheet rests along the cube grid (over tops,
   * down sides, onto the next top).
   *
   * Folded: the same creases rotate to the cube's
   * 90° dihedrals.
   */
  const creaseProgress =
    getFaceFoldProgress(
      activeNet,
      staggeredProgress,
      foldMode,
      creaseSeed,
      motionCurve,
      options.oneSideNearestFirst
    );

  const creaseDepth =
    getCreaseDepthByFace(activeNet);

  /*
   * Cascade / traveling nets: keep drape flat so the
   * roll reads as a clean one-side fold along the path.
   */
  const drapeAmount =
    options.drapeAmount !== undefined
      ? options.drapeAmount
      : settings.drapeAmount;

  const transforms =
    buildConnectedFaceTransforms(
      activeNet,
      plantX,
      plantZ,
      edgeSize,
      (childIndex) => {
        const progress =
          creaseProgress[childIndex];

        const depth =
          creaseDepth[childIndex];

        const hinge =
          getCreaseHingeToFace(
            activeNet,
            childIndex
          );

        const drapedAngle =
          getDrapedCreaseAngle(
            depth,
            creaseStyle,
            drapeAmount,
            childIndex,
            creaseSeed,
            hinge.dx,
            hinge.dy,
            effectivePlacementForDrape(
              settings,
              creaseSeed
            )
          );

        if (options.insideOutFlow) {
          return lerp(
            HALF_PI,
            -HALF_PI,
            progress
          );
        }

        const foldedAngle =
          options.invertFold
            ? -HALF_PI
            : HALF_PI;

        return lerp(
          drapedAngle,
          foldedAngle,
          progress
        );
      }
    );

  let baseColor =
    color(netColor);

  /* sealed with the inside facing in (not inverted) */
  const insideHidden = options.insideOutFlow
    ? staggeredProgress <= 0.001
    : !options.invertFold && staggeredProgress >= 0.999;

  const isInsideOut =
    settings.sketchMode === "inside-out";

  /*
   * Inside-out cubes seal in both directions, so the
   * side shut inside is read from the geometry at each
   * closed moment and only that side is reshuffled.
   */
  const sealedSide = isInsideOut
    ? getSealedNetSide(
        transforms,
        options.insideOutFlow
          ? staggeredProgress <= 0.001 ||
              staggeredProgress >= 0.999
          : staggeredProgress >= 0.999
      )
    : null;

  const shuffleMoment = isInsideOut
    ? sealedSide === "inner"
    : SHUFFLE_SWAP_WHEN_FLAT.has(settings.sketchMode)
      ? staggeredProgress <= 0.001
      : insideHidden;

  const shuffleKey = options.colorKey ?? creaseSeed;

  const outsideHidden = sealedSide === "outer";

  const shuffleOuter =
    isInsideOut &&
    isShuffleColorMode(settings.colorMode);

  const outerHex = shuffleOuter
    ? getOuterShuffleColorFor(
        shuffleKey,
        outsideHidden,
        settings,
        netColor
      )
    : netColor;

  if (shuffleOuter) {
    baseColor = color(outerHex);
  }

  const innerBaseColor =
    !options.singleSided &&
    isTwoToneColorMode(settings.colorMode)
      ? color(
          getInnerColorFor(
            shuffleKey,
            shuffleMoment,
            settings,
            outerHex
          )
        )
      : null;

  const multiOuter =
    settings.colorMode === "two-tone-multi";

  const rootNormal =
    transforms[activeNet.rootIndex].normal;

  const outlineMasks = isOutlineDivisionMode(settings)
    ? getNetOutlineEdgeMasks(transforms, edgeSize)
    : null;

  const drawOrder = [];

  for (
    let faceIndex = 0;
    faceIndex < activeNet.faces.length;
    faceIndex++
  ) {
    drawOrder.push({
      faceIndex,
      dist: getFaceViewerDistance(
        transforms[faceIndex].center
      )
    });
  }

  drawOrder.sort((a, b) => b.dist - a.dist);

  for (let order = 0; order < drawOrder.length; order++) {
    const faceIndex = drawOrder[order].faceIndex;

    /*
     * Faces still coplanar with the plant share the
     * net's overall fold progress for shading. That
     * keeps a flat sheet evenly lit — otherwise the
     * planted "bottom" (crease progress stuck at 1
     * in one-side mode) reads darker than neighbors
     * on the same plane.
     */
    const transform =
      transforms[faceIndex];

    const aligned =
      abs(
        dotVectors(
          normalizeVector(transform.normal),
          normalizeVector(rootNormal)
        )
      );

    const shadeProgress =
      aligned > 0.98
        ? globalCurvedProgress
        : creaseProgress[faceIndex];

    const faceBaseColor =
      options.faceColorFor
        ? color(
            options.faceColorFor(
              faceIndex,
              transform,
              activeNet
            )
          )
        : multiOuter
          ? color(
              getFaceOuterColor(
                faceIndex,
                netColor,
                settings,
                creaseSeed
              )
            )
          : baseColor;

    drawConnectedFace(
      transform,
      faceBaseColor,
      shadeProgress,
      settings,
      innerBaseColor,
      edgeSize,
      false,
      order,
      getSharedEdgeOverlap(
        activeNet,
        faceIndex,
        edgeSize,
        creaseProgress[faceIndex],
        settings
      ),
      outlineMasks ? outlineMasks[faceIndex] : null
    );
  }
}

function isOutlineDivisionMode(settings) {
  return (
    settings.showDivisions &&
    settings.divisionAngleFilter === "outline"
  );
}

function isFacingCamera(normal) {
  return dotVectors(normal, getIsometricViewDirection()) > 0;
}

/*
 * Outline edges: an edge no other face shares (the
 * open rim of a net), or one where the sheet turns
 * from facing the camera to facing away (a fold-over
 * silhouette, e.g. the hexagon around a sealed cube).
 * Edge k runs corner k → k+1, matching drawConnectedFace.
 */
function getNetOutlineEdgeMasks(transforms, size) {
  const half = size * 0.5;
  const epsilon = size * 0.02;
  const edges = [];

  transforms.forEach((t, faceIndex) => {
    const u = scaleVector(t.u, half);
    const v = scaleVector(t.v, half);
    const corners = [
      subtractVectors(subtractVectors(t.center, u), v),
      subtractVectors(addVectors(t.center, u), v),
      addVectors(addVectors(t.center, u), v),
      addVectors(subtractVectors(t.center, u), v)
    ];

    for (let k = 0; k < 4; k++) {
      const a = corners[k];
      const b = corners[(k + 1) % 4];

      edges.push({
        faceIndex,
        k,
        mid: scaleVector(addVectors(a, b), 0.5),
        facing: isFacingCamera(t.normal)
      });
    }
  });

  const masks = transforms.map(() => [true, true, true, true]);

  for (const edge of edges) {
    for (const other of edges) {
      if (
        other.faceIndex === edge.faceIndex ||
        vectorLength(
          subtractVectors(edge.mid, other.mid)
        ) > epsilon
      ) {
        continue;
      }

      if (other.facing === edge.facing) {
        masks[edge.faceIndex][edge.k] = false;
      }
    }
  }

  return masks;
}

/*
 * Drape creases can fold either way over a grid
 * edge: up (+) or down (−). Placement mode biases
 * which hinges fold and in which direction.
 */
function effectivePlacementForDrape(settings, seed) {
  const placement =
    settings.gridPlacement || "random";

  const family = placementFamily(placement);

  if (family === "random") {
    return "random";
  }

  const skew = settings.placementSkew || 0;

  if (unitHash(seed * 0.83) < skew) {
    return "random";
  }

  return family;
}

function getDrapedCreaseAngle(
  depth,
  creaseStyle,
  drapeAmount,
  childIndex,
  seed,
  hingeDx = 0,
  hingeDy = 0,
  placement = "random"
) {
  const amount = drapeAmount * HALF_PI;
  const style = ((creaseStyle % 5) + 5) % 5;
  const family = placementFamily(placement);

  if (amount <= 0 || depth <= 0) {
    return 0;
  }

  let shouldFold = false;

  if (style === 0) {
    shouldFold = depth % 2 === 1;
  } else if (style === 1) {
    shouldFold = false;
  } else if (style === 2) {
    shouldFold = depth % 2 === 0;
  } else if (style === 3) {
    shouldFold = depth === 1;
  } else {
    shouldFold =
      unitHash(seed * 0.37 + childIndex * 11.9) < 0.5;
  }

  /*
   * Placement biases: prefer hinges that push the
   * drape along the chosen axis, with occasional
   * exceptions so it doesn't look mechanical.
   */
  const alongVertical = hingeDy !== 0;
  const alongHorizontal = hingeDx !== 0;
  const exception =
    unitHash(seed * 1.9 + childIndex * 7.3) < 0.18;

  if (family === "vertical" && !exception) {
    shouldFold = alongVertical
      ? depth % 2 === 1
      : false;
  } else if (family === "horizontal" && !exception) {
    shouldFold = alongHorizontal
      ? depth % 2 === 1
      : false;
  } else if (family === "diagonal" && !exception) {
    shouldFold =
      depth % 2 === 1 ||
      unitHash(seed * 0.51 + childIndex) < 0.22;
  }

  if (!shouldFold) {
    return 0;
  }

  let foldDown =
    unitHash(
      seed * 0.61 +
      childIndex * 23.7 +
      depth * 4.1
    ) < 0.5;

  if (family === "diagonal" && !exception) {
    /*
     * Bias fold side by diagonal lane so drapes
     * lean consistently, with rare flips.
     */
    foldDown =
      unitHash(
        seed * 0.13 +
        childIndex * 0.71
      ) < 0.62
        ? hingeDx + hingeDy > 0
        : foldDown;
  } else if (family === "vertical" && !exception) {
    foldDown = hingeDy > 0;
  } else if (family === "horizontal" && !exception) {
    foldDown = hingeDx > 0;
  }

  return foldDown ? -amount : amount;
}

function getCreaseHingeToFace(net, childIndex) {
  for (
    let parentIndex = 0;
    parentIndex < net.children.length;
    parentIndex++
  ) {
    for (const child of net.children[parentIndex]) {
      if (child.index === childIndex) {
        return {
          dx: child.dx,
          dy: child.dy
        };
      }
    }
  }

  return { dx: 0, dy: 0 };
}

function getCreaseDepthByFace(net) {
  const depth =
    new Array(net.faces.length).fill(0);

  const queue = [net.rootIndex];

  while (queue.length > 0) {
    const parentIndex = queue.shift();

    for (const child of net.children[parentIndex]) {
      depth[child.index] =
        depth[parentIndex] + 1;

      queue.push(child.index);
    }
  }

  return depth;
}

function getFaceFoldProgress(
  net,
  globalProgress,
  foldMode,
  foldSeed = 0,
  motionCurve = "ease",
  nearestFirst = false
) {
  const count = net.faces.length;
  const progress =
    new Array(count).fill(globalProgress);

  if (foldMode === "both") {
    const curved =
      applyMotionCurve(
        globalProgress,
        motionCurve
      );

    return new Array(count).fill(curved);
  }

  /*
   * One side: strictly one plane at a time, rolling
   * from the free end onto the planted edge face so
   * the finished cube sits on that edge.
   */
  if (foldMode === "one-side") {
    return getOneSideFoldProgress(
      net,
      globalProgress,
      motionCurve,
      nearestFirst
    );
  }

  /*
   * One at a time: overlapping crease wave from
   * the left edge across the connected shape.
   */
  const distance =
    new Array(count).fill(Infinity);

  const queue = [];

  let minimumX = Infinity;

  for (const face of net.faces) {
    minimumX =
      min(minimumX, face.gridX);
  }

  for (const face of net.faces) {
    if (face.gridX === minimumX) {
      distance[face.index] = 0;
      queue.push(face.index);
    }
  }

  const adjacency =
    buildNetAdjacency(net);

  while (queue.length > 0) {
    const index = queue.shift();

    for (const neighbor of adjacency[index]) {
      const next =
        distance[index] + 1;

      if (next < distance[neighbor]) {
        distance[neighbor] = next;
        queue.push(neighbor);
      }
    }
  }

  let maximumDistance = 0;

  for (let i = 0; i < count; i++) {
    if (distance[i] === Infinity) {
      distance[i] = 0;
    }

    maximumDistance =
      max(maximumDistance, distance[i]);
  }

  const blend = max(1, maximumDistance * 0.35);

  for (let i = 0; i < count; i++) {
    const local =
      globalProgress *
        (maximumDistance + blend) -
      distance[i];

    progress[i] =
      applyMotionCurve(
        constrain(local / blend, 0, 1),
        motionCurve
      );
  }

  return progress;
}

/*
 * Sequential single-plane folds onto the planted
 * root. Farthest faces move first so the sheet
 * rolls onto the edge plane.
 */
function getOneSideFoldProgress(
  net,
  globalProgress,
  motionCurve = "ease",
  nearestFirst = false
) {
  const count = net.faces.length;
  const progress =
    new Array(count).fill(0);

  const depth =
    getCreaseDepthByFace(net);

  const folding = [];

  for (let i = 0; i < count; i++) {
    if (i === net.rootIndex) {
      /*
       * Planted face never hinges, but its shade
       * progress must follow the global fold — if it
       * stayed at 1, the flat sheet would keep one
       * darker "bottom" while every neighbor is lit
       * as unfolded.
       */
      progress[i] = globalProgress;
      continue;
    }

    folding.push({
      index: i,
      depth: depth[i]
    });
  }

  folding.sort((a, b) => {
    if (a.depth !== b.depth) {
      /*
       * Nearest-first: sides fold up from the planted
       * bottom, lid last. Unfolding then opens the
       * top first instead of tipping the whole cube.
       */
      return nearestFirst
        ? a.depth - b.depth
        : b.depth - a.depth;
    }

    return a.index - b.index;
  });

  const slots = max(1, folding.length);

  for (let slot = 0; slot < folding.length; slot++) {
    /*
     * Hard non-overlapping windows: only one face
     * has 0 < progress < 1 at any global time.
     */
    const local =
      globalProgress * slots - slot;

    progress[folding[slot].index] =
      applyMotionCurve(
        constrain(local, 0, 1),
        motionCurve
      );
  }

  return progress;
}

function getExtremeFaceIndex(net, fromMaxX) {
  const adjacency =
    buildNetAdjacency(net);

  /*
   * Prefer true end leaves so the cube settles on
   * an edge plane, not a middle face that happens
   * to sit at min/max X.
   */
  const leaves = [];

  for (
    let index = 0;
    index < net.faces.length;
    index++
  ) {
    if (adjacency[index].length <= 1) {
      leaves.push(index);
    }
  }

  const pool =
    leaves.length > 0
      ? leaves
      : net.faces.map((face) => face.index);

  let bestIndex = pool[0];
  let bestX = fromMaxX ? -Infinity : Infinity;

  for (const index of pool) {
    const x = net.faces[index].gridX;

    if (fromMaxX) {
      if (x > bestX) {
        bestX = x;
        bestIndex = index;
      }
    } else if (x < bestX) {
      bestX = x;
      bestIndex = index;
    }
  }

  return bestIndex;
}

/*
 * Rebuild the crease tree so a chosen face is the
 * planted root. Used by one-side folding.
 */
function rerootNet(net, rootIndex) {
  const adjacency =
    buildNetAdjacency(net);

  const children =
    net.faces.map(() => []);

  const visited =
    new Set([rootIndex]);

  const queue = [rootIndex];

  while (queue.length > 0) {
    const parentIndex = queue.shift();
    const parent = net.faces[parentIndex];

    for (const childIndex of adjacency[parentIndex]) {
      if (visited.has(childIndex)) {
        continue;
      }

      visited.add(childIndex);

      const child = net.faces[childIndex];

      children[parentIndex].push({
        index: childIndex,
        dx: child.gridX - parent.gridX,
        dy: child.gridY - parent.gridY
      });

      queue.push(childIndex);
    }
  }

  return {
    faces: net.faces,
    rootIndex,
    children
  };
}

function buildNetAdjacency(net) {
  const adjacency =
    net.faces.map(() => []);

  for (
    let parentIndex = 0;
    parentIndex < net.children.length;
    parentIndex++
  ) {
    for (const child of net.children[parentIndex]) {
      adjacency[parentIndex].push(
        child.index
      );

      adjacency[child.index].push(
        parentIndex
      );
    }
  }

  const byCell = new Map();

  for (const face of net.faces) {
    byCell.set(
      coordinateKey(face.gridX, face.gridY),
      face.index
    );
  }

  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  for (const face of net.faces) {
    for (const direction of directions) {
      const key = coordinateKey(
        face.gridX + direction[0],
        face.gridY + direction[1]
      );

      if (!byCell.has(key)) {
        continue;
      }

      const other = byCell.get(key);

      if (
        !adjacency[face.index].includes(other)
      ) {
        adjacency[face.index].push(other);
      }
    }
  }

  return adjacency;
}

/*
 * Build the net from its crease tree. getHingeAngle
 * may be a number or (childIndex) => angle.
 * Root stays planted; children only rotate about
 * shared edges so the hexomino stays connected.
 */
function buildConnectedFaceTransforms(
  net,
  originX,
  originZ,
  size,
  getHingeAngle
) {
  const transforms =
    new Array(net.faces.length);

  const rootIndex =
    net.rootIndex;

  transforms[rootIndex] = {
    center: [
      originX,
      0,
      originZ
    ],

    u: [1, 0, 0],
    v: [0, 0, 1],
    normal: [0, -1, 0]
  };

  const queue = [rootIndex];

  while (queue.length > 0) {
    const parentIndex =
      queue.shift();

    const parentTransform =
      transforms[parentIndex];

    const children =
      net.children[parentIndex];

    for (const childLink of children) {
      const hingeAngle =
        typeof getHingeAngle === "function"
          ? getHingeAngle(childLink.index)
          : getHingeAngle;

      transforms[childLink.index] =
        createChildTransform(
          parentTransform,
          childLink.dx,
          childLink.dy,
          size,
          hingeAngle
        );

      queue.push(childLink.index);
    }
  }

  return transforms;
}

function createChildTransform(
  parent,
  dx,
  dy,
  size,
  angle
) {
  const half =
    size * 0.5;

  let hingeCenter;
  let hingeAxis;
  let outwardDirection;
  let signedAngle;

  if (dx === 1) {
    hingeCenter =
      addVectors(
        parent.center,
        scaleVector(
          parent.u,
          half
        )
      );

    hingeAxis =
      parent.v;

    outwardDirection =
      parent.u;

    signedAngle =
      -angle;
  } else if (dx === -1) {
    hingeCenter =
      addVectors(
        parent.center,
        scaleVector(
          parent.u,
          -half
        )
      );

    hingeAxis =
      parent.v;

    outwardDirection =
      scaleVector(
        parent.u,
        -1
      );

    signedAngle =
      angle;
  } else if (dy === 1) {
    hingeCenter =
      addVectors(
        parent.center,
        scaleVector(
          parent.v,
          half
        )
      );

    hingeAxis =
      parent.u;

    outwardDirection =
      parent.v;

    signedAngle =
      angle;
  } else {
    hingeCenter =
      addVectors(
        parent.center,
        scaleVector(
          parent.v,
          -half
        )
      );

    hingeAxis =
      parent.u;

    outwardDirection =
      scaleVector(
        parent.v,
        -1
      );

    signedAngle =
      -angle;
  }

  const rotatedOutward =
    rotateVectorAroundAxis(
      outwardDirection,
      hingeAxis,
      signedAngle
    );

  const childCenter =
    addVectors(
      hingeCenter,
      scaleVector(
        rotatedOutward,
        half
      )
    );

  return {
    center: childCenter,

    u: normalizeVector(
      rotateVectorAroundAxis(
        parent.u,
        hingeAxis,
        signedAngle
      )
    ),

    v: normalizeVector(
      rotateVectorAroundAxis(
        parent.v,
        hingeAxis,
        signedAngle
      )
    ),

    normal: normalizeVector(
      rotateVectorAroundAxis(
        parent.normal,
        hingeAxis,
        signedAngle
      )
    )
  };
}

/*
 * For a sealed net, which shell ends up inside the
 * cube: "inner" when outer normals point away from the
 * cube's center, "outer" when they point into it.
 */
function getSealedNetSide(transforms, closed) {
  if (!closed || !transforms.length) {
    return null;
  }

  let cx = 0;
  let cy = 0;
  let cz = 0;

  for (const t of transforms) {
    cx += t.center[0];
    cy += t.center[1];
    cz += t.center[2];
  }

  const center = [
    cx / transforms.length,
    cy / transforms.length,
    cz / transforms.length
  ];

  let outward = 0;

  for (const t of transforms) {
    outward += dotVectors(
      t.normal,
      subtractVectors(t.center, center)
    );
  }

  return outward > 0 ? "inner" : "outer";
}

function getSharedEdgeOverlap(
  net,
  faceIndex,
  faceSize,
  progress,
  settings = null
) {
  const extras = {
    px: 0,
    nx: 0,
    py: 0,
    ny: 0
  };

  /*
   * Only enough overlap to hide antialiasing seams.
   * At convex hinges the overlap pokes out past the
   * neighbouring face as a sliver of this face's tone,
   * so keep it to a fraction of a device pixel.
   */
  const worldPerPixel =
    settings && settings.verticalView && height > 0
      ? (settings.verticalView * 2) /
        (height * max(1, pixelDensity()))
      : 1;

  const amount =
    min(faceSize * 0.01, worldPerPixel * 0.3) *
    Math.pow(
      Math.sin(constrain(progress, 0, 1) * PI),
      2
    );

  if (amount <= 1e-6 || !net || !net.faces) {
    return extras;
  }

  const face = net.faces[faceIndex];

  if (!face) {
    return extras;
  }

  for (const other of net.faces) {
    if (other.index === face.index) {
      continue;
    }

    const dx = other.gridX - face.gridX;
    const dy = other.gridY - face.gridY;

    if (abs(dx) + abs(dy) !== 1) {
      continue;
    }

    if (dx === 1) {
      extras.px = amount;
    } else if (dx === -1) {
      extras.nx = amount;
    } else if (dy === 1) {
      extras.py = amount;
    } else if (dy === -1) {
      extras.ny = amount;
    }
  }

  return extras;
}

function drawConnectedFace(
  transform,
  baseColor,
  progress,
  settings,
  innerBaseColor = null,
  faceSize = null,
  exactColor = false,
  depthRank = 0,
  edgeOverlap = null,
  edgeMask = null
) {
  const resolvedFaceSize =
    faceSize == null
      ? settings.faceSize
      : faceSize;

  const extras = edgeOverlap || {
    px: 0,
    nx: 0,
    py: 0,
    ny: 0
  };

  const uPos =
    scaleVector(
      transform.u,
      resolvedFaceSize * 0.5 + extras.px
    );

  const uNeg =
    scaleVector(
      transform.u,
      resolvedFaceSize * 0.5 + extras.nx
    );

  const vPos =
    scaleVector(
      transform.v,
      resolvedFaceSize * 0.5 + extras.py
    );

  const vNeg =
    scaleVector(
      transform.v,
      resolvedFaceSize * 0.5 + extras.ny
    );

  const corners = [
    addVectors(
      addVectors(
        transform.center,
        scaleVector(uNeg, -1)
      ),
      scaleVector(vNeg, -1)
    ),

    addVectors(
      addVectors(
        transform.center,
        uPos
      ),
      scaleVector(vNeg, -1)
    ),

    addVectors(
      addVectors(
        transform.center,
        uPos
      ),
      vPos
    ),

    addVectors(
      addVectors(
        transform.center,
        scaleVector(uNeg, -1)
      ),
      vPos
    )
  ];

  const normal =
    normalizeVector(transform.normal);

  const needsInner = Boolean(innerBaseColor);

  const outwardFacing =
    dotVectors(normal, getIsometricViewDirection()) > 0;

  const outerCorners = corners;
  const inward = scaleVector(normal, -1);
  const innerCorners =
    needsInner
      ? corners.slice().reverse()
      : null;

  const viewerBias =
    constrain(
      map(
        getFaceViewerDistance(transform.center),
        1600,
        3200,
        -36,
        0
      ),
      -48,
      0
    ) -
    depthRank * 3;

  const closerBias =
    viewerBias - 6;

  if (!needsInner) {
    drawFaceSide(
      outerCorners,
      baseColor,
      normal,
      progress,
      settings,
      true,
      exactColor,
      closerBias,
      edgeMask
    );
    return;
  }

  /*
   * Keep inner/outer on the same plane so creases
   * stay sealed. Draw only the shell facing the
   * camera so they never z-fight.
   */
  if (outwardFacing) {
    drawFaceSide(
      outerCorners,
      baseColor,
      normal,
      progress,
      settings,
      true,
      exactColor,
      closerBias,
      edgeMask
    );
  } else {
    /* reversed corners: inner edge k is outer edge 2,1,0,3 */
    const innerMask = edgeMask
      ? [edgeMask[2], edgeMask[1], edgeMask[0], edgeMask[3]]
      : null;

    drawFaceSide(
      innerCorners,
      innerBaseColor,
      inward,
      progress,
      settings,
      Boolean(innerMask),
      exactColor,
      closerBias,
      innerMask
    );
  }
}

function offsetCorners(corners, direction, amount) {
  if (amount === 0) {
    return corners;
  }

  const step =
    scaleVector(
      normalizeVector(direction),
      amount
    );

  return corners.map((corner) => {
    return addVectors(corner, step);
  });
}

function drawFaceSide(
  corners,
  baseColor,
  normal,
  progress,
  settings,
  drawStroke,
  exactColor = false,
  depthBias = 0,
  edgeMask = null
) {
  const faceColor =
    exactColor || !settings.showFaceShading
      ? baseColor
      : getFaceColor(
          baseColor,
          normal,
          progress,
          settings.showFaceShading,
          settings.lightAngle
        );

  fill(faceColor);
  beginCloserFaceDepthBias(depthBias);

  if (!drawStroke) {
    noStroke();
    drawFaceQuad(corners);
    endCloserFaceDepthBias();
    return;
  }

  if (!settings.showDivisions) {
    noStroke();
    drawFaceQuad(corners);
    endCloserFaceDepthBias();
    return;
  }

  /*
   * Fill first, then stroke only the edges that
   * match the selected isometric angle family.
   */
  noStroke();
  drawFaceQuad(corners);

  const strokeColor =
    getDivisionStrokeColor(settings);

  stroke(strokeColor);
  strokeWeight(getDivisionStrokeWeight(settings));

  const filter =
    settings.divisionAngleFilter || "all";

  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];

    if (edgeMask) {
      if (!edgeMask[i]) {
        continue;
      }
    } else if (
      filter !== "all" &&
      !edgeMatchesDivisionFilter(
        edgeScreenFamily(a, b),
        filter
      )
    ) {
      continue;
    }

    line(
      a[0],
      a[1],
      a[2],
      b[0],
      b[1],
      b[2]
    );
  }

  endCloserFaceDepthBias();
}

function drawFaceQuad(corners) {
  beginShape(QUADS);

  for (const corner of corners) {
    vertex(
      corner[0],
      corner[1],
      corner[2]
    );
  }

  endShape(CLOSE);
}

function getDivisionStrokeColor(settings) {
  if (settings.divisionMatchBackground) {
    const hex =
      BACKGROUNDS[settings.backgroundTheme] ||
      BACKGROUNDS.light;

    return color(hex);
  }

  if (settings.backgroundTheme === "dark") {
    return color(254, 249, 243, 160);
  }

  return color(18, 185);
}

function edgeMatchesDivisionFilter(family, filter) {
  if (filter === "all") {
    return true;
  }

  if (filter === family) {
    return true;
  }

  if (
    filter === "diagonal-up-vertical" &&
    (family === "diagonal-up" ||
      family === "vertical")
  ) {
    return true;
  }

  if (
    filter === "diagonal-down-vertical" &&
    (family === "diagonal-down" ||
      family === "vertical")
  ) {
    return true;
  }

  return false;
}

/*
 * Map a world-space edge onto the isometric screen
 * line families used by the overlay grid:
 * vertical, ↗ (~30°), ↘ (~150°).
 */
function worldDeltaToScreen(dx, dy, dz) {
  return {
    sx: (dx - dz) / sqrt(2),
    sy: dy * sqrt(2 / 3) + (dx + dz) / sqrt(6)
  };
}

function edgeScreenFamily(a, b) {
  const screen = worldDeltaToScreen(
    b[0] - a[0],
    b[1] - a[1],
    b[2] - a[2]
  );

  const length = Math.hypot(screen.sx, screen.sy);

  if (length < 1e-8) {
    return "vertical";
  }

  let angle = atan2(screen.sy, screen.sx);

  /*
   * Undirected edges — fold angle into [0, π).
   */
  if (angle < 0) {
    angle += PI;
  }

  const dist = (target) => {
    let delta = abs(angle - target);
    return min(delta, PI - delta);
  };

  const dVertical = dist(HALF_PI);
  const dUp = dist(PI / 6);
  const dDown = dist((5 * PI) / 6);

  if (dVertical <= dUp && dVertical <= dDown) {
    return "vertical";
  }

  if (dUp <= dDown) {
    return "diagonal-up";
  }

  return "diagonal-down";
}

const FACE_SHADE_LIGHTER = 0.22;
const FACE_SHADE_DARKER = -0.22;

/*
 * Tone per visible isometric side for each light
 * direction: 1 = lighter, 0 = original, -1 = darker.
 * World +x is the right side, +z the left, −y the top.
 */
const LIGHT_ANGLE_TONES = {
  left: { top: 0, left: 1, right: -1 },
  right: { top: 0, left: -1, right: 1 },
  "top-left": { top: 1, left: 0, right: -1 },
  "top-right": { top: 1, left: -1, right: 0 },
  "low-left": { top: -1, left: 1, right: 0 },
  "low-right": { top: -1, left: 0, right: 1 }
};

function toneToShadeAmount(tone) {
  if (tone > 0) {
    return FACE_SHADE_LIGHTER;
  }

  if (tone < 0) {
    return FACE_SHADE_DARKER;
  }

  return 0;
}

function getFaceColor(
  baseColor,
  normal,
  progress,
  useShading,
  lightAngle = "left"
) {
  if (!useShading) {
    return baseColor;
  }

  const tones =
    LIGHT_ANGLE_TONES[lightAngle] ||
    LIGHT_ANGLE_TONES.left;

  /*
   * Squared normal components sum to 1, so faces
   * mid-fold blend smoothly between the side tones.
   */
  const n = normalizeVector(normal);
  const shade =
    n[0] * n[0] * toneToShadeAmount(tones.right) +
    n[1] * n[1] * toneToShadeAmount(tones.top) +
    n[2] * n[2] * toneToShadeAmount(tones.left);

  const finalShade =
    lerp(
      shade * 0.45,
      shade,
      progress
    );

  const target = finalShade >= 0 ? 255 : 0;
  const amount = abs(finalShade);

  return color(
    lerp(red(baseColor), target, amount),
    lerp(green(baseColor), target, amount),
    lerp(blue(baseColor), target, amount)
  );
}

function prepareNet(cells) {
  const faces =
    cells.map(
      (cell, index) => {
        return {
          index,
          gridX: cell[0],
          gridY: cell[1]
        };
      }
    );

  const coordinateMap =
    new Map();

  for (const face of faces) {
    coordinateMap.set(
      coordinateKey(
        face.gridX,
        face.gridY
      ),
      face.index
    );
  }

  const centerX =
    average(
      faces.map(
        (face) => face.gridX
      )
    );

  const centerY =
    average(
      faces.map(
        (face) => face.gridY
      )
    );

  let rootIndex = 0;
  let nearestDistance =
    Infinity;

  for (const face of faces) {
    const distance =
      sq(
        face.gridX -
        centerX
      ) +
      sq(
        face.gridY -
        centerY
      );

    if (
      distance <
      nearestDistance
    ) {
      nearestDistance =
        distance;

      rootIndex =
        face.index;
    }
  }

  const children =
    faces.map(() => []);

  const visited =
    new Set([rootIndex]);

  const queue =
    [rootIndex];

  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  while (queue.length > 0) {
    const parentIndex =
      queue.shift();

    const parent =
      faces[parentIndex];

    for (const direction of directions) {
      const dx =
        direction[0];

      const dy =
        direction[1];

      const key =
        coordinateKey(
          parent.gridX + dx,
          parent.gridY + dy
        );

      if (
        !coordinateMap.has(key)
      ) {
        continue;
      }

      const childIndex =
        coordinateMap.get(key);

      if (
        visited.has(childIndex)
      ) {
        continue;
      }

      visited.add(childIndex);

      children[parentIndex].push({
        index: childIndex,
        dx,
        dy
      });

      queue.push(childIndex);
    }
  }

  return {
    faces,
    rootIndex,
    children
  };
}

function rotateVectorAroundAxis(
  vector,
  axis,
  angle
) {
  const normalizedAxis =
    normalizeVector(axis);

  const cosine =
    cos(angle);

  const sine =
    sin(angle);

  const parallel =
    scaleVector(
      normalizedAxis,
      dotVectors(
        normalizedAxis,
        vector
      )
    );

  const perpendicular =
    subtractVectors(
      vector,
      parallel
    );

  const cross =
    crossVectors(
      normalizedAxis,
      vector
    );

  return addVectors(
    addVectors(
      parallel,
      scaleVector(
        perpendicular,
        cosine
      )
    ),

    scaleVector(
      cross,
      sine
    )
  );
}

function coordinateKey(x, y) {
  return `${x},${y}`;
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  let total = 0;

  for (const value of values) {
    total += value;
  }

  return total /
    values.length;
}

function addVectors(a, b) {
  return [
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2]
  ];
}

function lerpVectorArray(a, b, amount) {
  return [
    lerp(a[0], b[0], amount),
    lerp(a[1], b[1], amount),
    lerp(a[2], b[2], amount)
  ];
}

function subtractVectors(a, b) {
  return [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2]
  ];
}

function scaleVector(vector, amount) {
  return [
    vector[0] * amount,
    vector[1] * amount,
    vector[2] * amount
  ];
}

function dotVectors(a, b) {
  return (
    a[0] * b[0] +
    a[1] * b[1] +
    a[2] * b[2]
  );
}

function crossVectors(a, b) {
  return [
    a[1] * b[2] -
      a[2] * b[1],

    a[2] * b[0] -
      a[0] * b[2],

    a[0] * b[1] -
      a[1] * b[0]
  ];
}

function vectorLength(vector) {
  return sqrt(
    vector[0] * vector[0] +
    vector[1] * vector[1] +
    vector[2] * vector[2]
  );
}

function normalizeVector(vector) {
  const length =
    vectorLength(vector);

  if (length < 0.000001) {
    return [0, 0, 0];
  }

  return [
    vector[0] / length,
    vector[1] / length,
    vector[2] / length
  ];
}

function smootherstep(value) {
  const t =
    constrain(
      value,
      0,
      1
    );

  return (
    t *
    t *
    t *
    (
      t *
      (
        t * 6 - 15
      ) +
      10
    )
  );
}

function applyMotionCurve(value, curve = "ease") {
  const t = constrain(value, 0, 1);

  if (curve === "linear") {
    return t;
  }

  return smootherstep(t);
}
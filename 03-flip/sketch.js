const ASPECT_PRESETS = {
  "16:9": { width: 1440, height: 810 },
  "1:1": { width: 1000, height: 1000 },
  "4:5": { width: 960, height: 1200 }
};

const CANVAS_WIDTH = ASPECT_PRESETS["16:9"].width;
const CANVAS_HEIGHT = ASPECT_PRESETS["16:9"].height;

const controls = {};

const PALETTE = [
  "#032932",
  "#0A4552",
  "#32EEFF",
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

const BACKGROUNDS = {
  light: "#FEF9F3",
  dark: "#032932"
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
  "gridPlacement",
  "placementSkew",
  "foldProgress",
  "foldMode",
  "drapeAmount",
  "cubeCoverage",
  "cubeCount",
  "animationSpeed",
  "gridSize",
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
  "showFaceShading"
];

const PACKED_VERTEX_ONLY = true;
const PACKED_CUBE_NET_INDEX = 3;

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
let monoColor = PALETTE[2];
let outerColor = PALETTE[1];
let innerColor = PALETTE[3];

let cascadeTravelers = [];
let cascadeCacheKey = "";
let cascadeTime = 0;

let syncingQuickToggle = false;

function setup() {
  const canvas = createCanvas(
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    WEBGL
  );

  canvas.parent("canvas-container");

  pixelDensity(1);
  smooth();

  getControls();
  connectControls();

  /*
   * Explicitly enforce the initial flat state,
   * even if the browser restores prior input values.
   */
  controls.foldProgress.value = 1;
  controls.drapeAmount.value = 0;
  controls.cubeCoverage.value = 100;
  controls.gridPlacement.value = "random";
  controls.foldMode.value = "vertex-spread";
  controls.sketchMode.value = "gridded";

  animatedProgress = 1;
  animationDirection = 1;

  updateAllValueLabels();

  processedNets = CUBE_NETS.map((cells) => {
    return prepareNet(cells);
  });

  netVariants = buildAllNetVariants();

  buildPaletteSwatches();
  buildNetTypeSlotOptions();
  refreshPresetSelect();
  syncColorModeUI();
  syncSketchModeUI();
  syncNetTypeUI();
  syncCoverageControlsUI();
  applyBackgroundTheme();
  applyAspectRatio();
}

function draw() {
  const settings = getSettings();

  background(getBackgroundColor(settings));
  applyBackgroundTheme(settings);

  updateAnimation();

  if (settings.showCubeGrid) {
    drawIsometricCubeGrid(settings);
  }

  if (settings.showGrid) {
    drawScreenIsometricGrid(settings);
  }

  setIsometricCamera(settings);

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

  drawAllNets(settings);
}

function applyPackedDefaults(settings) {
  if (!PACKED_VERTEX_ONLY) {
    return settings;
  }

  settings.sketchMode = "gridded";
  settings.cubeCoverage = 1;
  settings.drapeAmount = 0;

  settings.cameraZoom =
    getAutoPackCameraZoom(settings);

  return settings;
}

function getAutoPackCameraZoom(settings) {
  const userZoom =
    Number(controls.cameraZoom.value);

  // Scale with cell size so packed cubes fill the frame.
  return (
    userZoom *
    constrain(
      78 / settings.gridSize,
      0.85,
      1.45
    )
  );
}

function getIsometricEyePosition() {
  const elevation =
    atan(1 / sqrt(2));

  const distance = 2400;

  const horizontalDistance =
    distance * cos(elevation);

  return {
    x:
      horizontalDistance *
      cos(QUARTER_PI),
    y:
      -distance *
      sin(elevation),
    z:
      horizontalDistance *
      sin(QUARTER_PI)
  };
}

function getNetWorldCorners(
  net,
  originX,
  originZ,
  size
) {
  const root = net.faces[net.rootIndex];
  const half = size * 0.5;
  const corners = [];

  const offsets = [
  [-half, -half],
  [half, -half],
  [half, half],
  [-half, half]
  ];

  for (const face of net.faces) {
    const centerX =
      originX +
      (face.gridX - root.gridX) *
        size;

    const centerZ =
      originZ +
      (face.gridY - root.gridY) *
        size;

    for (const [ox, oz] of offsets) {
      corners.push({
        x: centerX + ox,
        z: centerZ + oz,
        faceIndex: face.index,
        offsetX: ox,
        offsetZ: oz
      });
    }
  }

  return corners;
}

function pickCornerClosestToCamera(corners) {
  const eye =
    getIsometricEyePosition();

  let best = corners[0];
  let bestDist = Infinity;

  for (const corner of corners) {
    const dx = corner.x - eye.x;
    const dz = corner.z - eye.z;
    const dist =
      dx * dx +
      dz * dz +
      eye.y * eye.y;

    if (dist < bestDist) {
      bestDist = dist;
      best = corner;
    }
  }

  return best;
}

/*
 * Pin the lattice corner nearest the camera and
 * plant the rerooted net so that vertex stays
 * fixed while the sheet opens around it.
 */
function setupVertexPinnedPlant(
  net,
  originX,
  originZ,
  size
) {
  const pinned =
    pickCornerClosestToCamera(
      getNetWorldCorners(
        net,
        originX,
        originZ,
        size
      )
    );

  const activeNet =
    rerootNet(net, pinned.faceIndex);

  const origRoot =
    net.faces[net.rootIndex];

  const root =
    activeNet.faces[
      activeNet.rootIndex
    ];

  const rootCenterX =
    originX +
    (root.gridX - origRoot.gridX) *
      size;

  const rootCenterZ =
    originZ +
    (root.gridY - origRoot.gridY) *
      size;

  const half = size * 0.5;
  const offsets = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half]
  ];

  let plantX = rootCenterX;
  let plantZ = rootCenterZ;

  for (const [ox, oz] of offsets) {
    if (
      abs(rootCenterX + ox - pinned.x) <
        0.01 &&
      abs(rootCenterZ + oz - pinned.z) <
        0.01
    ) {
      plantX = pinned.x - ox;
      plantZ = pinned.z - oz;
      break;
    }
  }

  return {
    activeNet,
    plantX,
    plantZ
  };
}

/*
 * Radial unfold from the pinned vertex: outer
 * faces peel away first while inner creases stay
 * closed near the anchor corner.
 */
function getVertexSpreadFoldProgress(
  net,
  globalProgress
) {
  const count = net.faces.length;
  const depth =
    getCreaseDepthByFace(net);

  let maxDepth = 0;

  for (let i = 0; i < count; i++) {
    maxDepth = max(maxDepth, depth[i]);
  }

  const range = max(1, maxDepth + 1);
  const progress =
    new Array(count);

  for (let i = 0; i < count; i++) {
    if (i === net.rootIndex) {
      progress[i] = globalProgress;
      continue;
    }

    const local =
      globalProgress * range -
      depth[i];

    progress[i] =
      smootherstep(
        constrain(local, 0, 1)
      );
  }

  return progress;
}

function cloneTransform(transform) {
  return {
    center: [
      transform.center[0],
      transform.center[1],
      transform.center[2]
    ],
    u: [
      transform.u[0],
      transform.u[1],
      transform.u[2]
    ],
    v: [
      transform.v[0],
      transform.v[1],
      transform.v[2]
    ],
    normal: [
      transform.normal[0],
      transform.normal[1],
      transform.normal[2]
    ]
  };
}

function lerpTransform(a, b, amount) {
  return {
    center: lerpVectorArray(
      a.center,
      b.center,
      amount
    ),
    u: lerpVectorArray(a.u, b.u, amount),
    v: lerpVectorArray(a.v, b.v, amount),
    normal: normalizeVector(
      lerpVectorArray(
        a.normal,
        b.normal,
        amount
      )
    )
  };
}

function rotatePointAroundAxis(
  point,
  origin,
  axis,
  angle
) {
  const relative =
    subtractVectors(point, origin);

  const rotated =
    rotateVectorAroundAxis(
      relative,
      axis,
      angle
    );

  return addVectors(rotated, origin);
}

function rotateTransformAroundEdge(
  transform,
  pointA,
  pointB,
  angle
) {
  const axis =
    normalizeVector(
      subtractVectors(pointB, pointA)
    );

  return {
    center: rotatePointAroundAxis(
      transform.center,
      pointA,
      axis,
      angle
    ),
    u: rotateVectorAroundAxis(
      transform.u,
      axis,
      angle
    ),
    v: rotateVectorAroundAxis(
      transform.v,
      axis,
      angle
    ),
    normal: normalizeVector(
      rotateVectorAroundAxis(
        transform.normal,
        axis,
        angle
      )
    )
  };
}

function getFaceCornersWorld(
  transform,
  half
) {
  const u =
    scaleVector(transform.u, half);

  const v =
    scaleVector(transform.v, half);

  const center =
    transform.center;

  return [
    addVectors(
      center,
      addVectors(
        scaleVector(u, -1),
        scaleVector(v, -1)
      )
    ),
    addVectors(
      center,
      addVectors(
        u,
        scaleVector(v, -1)
      )
    ),
    addVectors(
      center,
      addVectors(u, v)
    ),
    addVectors(
      center,
      addVectors(
        scaleVector(u, -1),
        v
      )
    )
  ];
}

function cornerKey(point) {
  return (
    round(point[0] * 100) +
    "," +
    round(point[1] * 100) +
    "," +
    round(point[2] * 100)
  );
}

function vectorDistSquared(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];

  return dx * dx + dy * dy + dz * dz;
}

function buildCubeCornerMap(
  transforms,
  half
) {
  const map = new Map();

  for (
    let faceIndex = 0;
    faceIndex < transforms.length;
    faceIndex++
  ) {
    const corners =
      getFaceCornersWorld(
        transforms[faceIndex],
        half
      );

    for (const corner of corners) {
      const key = cornerKey(corner);

      if (!map.has(key)) {
        map.set(key, {
          point: corner,
          faces: []
        });
      }

      const entry = map.get(key);

      if (
        !entry.faces.includes(faceIndex)
      ) {
        entry.faces.push(faceIndex);
      }
    }
  }

  return map;
}

function pickCubeCornerClosestToEye(
  cornerMap,
  eye
) {
  let best = null;
  let bestDist = Infinity;

  for (const entry of cornerMap.values()) {
    const point = entry.point;
    const dx = point[0] - eye.x;
    const dy = point[1] - eye.y;
    const dz = point[2] - eye.z;
    const dist =
      dx * dx + dy * dy + dz * dz;

    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }

  return best;
}

function getCubeCenterFromCorners(
  cornerMap
) {
  const points = [];

  for (const entry of cornerMap.values()) {
    points.push(entry.point);
  }

  return [
    average(points.map((p) => p[0])),
    average(points.map((p) => p[1])),
    average(points.map((p) => p[2]))
  ];
}

function findOppositeCornerEntry(
  cornerMap,
  pinnedEntry,
  center
) {
  const pinned = pinnedEntry.point;
  const target = [
    2 * center[0] - pinned[0],
    2 * center[1] - pinned[1],
    2 * center[2] - pinned[2]
  ];

  let best = null;
  let bestDist = Infinity;

  for (const entry of cornerMap.values()) {
    const dist =
      vectorDistSquared(
        entry.point,
        target
      );

    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }

  return best;
}

function computePeelRotation(
  transform,
  pinnedPoint,
  cubeCenter,
  half,
  peelAngle
) {
  const corners =
    getFaceCornersWorld(
      transform,
      half
    );

  let pinnedIndex = 0;
  let nearest = Infinity;

  for (let i = 0; i < 4; i++) {
    const dist =
      vectorDistSquared(
        corners[i],
        pinnedPoint
      );

    if (dist < nearest) {
      nearest = dist;
      pinnedIndex = i;
    }
  }

  const edgeA =
    corners[(pinnedIndex + 1) % 4];

  const edgeB =
    corners[(pinnedIndex + 2) % 4];

  const axis =
    normalizeVector(
      subtractVectors(edgeB, edgeA)
    );

  for (const sign of [1, -1]) {
    const testCenter =
      rotatePointAroundAxis(
        transform.center,
        edgeA,
        axis,
        sign * peelAngle
      );

    const newDist =
      vectorDistSquared(
        testCenter,
        cubeCenter
      );

    const oldDist =
      vectorDistSquared(
        transform.center,
        cubeCenter
      );

    if (newDist > oldDist + 0.001) {
      return {
        edgeA,
        edgeB,
        angle: sign * peelAngle
      };
    }
  }

  return { edgeA, edgeB, angle: peelAngle };
}

/*
 * Peel only the three faces at the front corner.
 * The back half of the cube stays folded in place.
 */
function buildVertexPeelTransforms(
  folded,
  flat,
  size,
  openAmount,
  eye
) {
  const half = size * 0.5;

  if (openAmount <= 0) {
    return folded.map(cloneTransform);
  }

  const cornerMap =
    buildCubeCornerMap(folded, half);

  const pinned =
    pickCubeCornerClosestToEye(
      cornerMap,
      eye
    );

  const center =
    getCubeCenterFromCorners(
      cornerMap
    );

  const peelAngle =
    openAmount * HALF_PI * 1.18;

  const flatBlend =
    smootherstep(
      constrain(
        (openAmount - 0.55) / 0.45,
        0,
        1
      )
    );

  const result =
    folded.map(cloneTransform);

  for (const faceIndex of pinned.faces) {
    const peel =
      computePeelRotation(
        folded[faceIndex],
        pinned.point,
        center,
        half,
        peelAngle
      );

    let transform =
      rotateTransformAroundEdge(
        folded[faceIndex],
        peel.edgeA,
        peel.edgeB,
        peel.angle
      );

    if (flatBlend > 0) {
      transform = lerpTransform(
        transform,
        flat[faceIndex],
        flatBlend * 0.9
      );
    }

    result[faceIndex] = transform;
  }

  return result;
}

function drawPackedVertexCube(
  net,
  originX,
  originZ,
  netColor,
  settings,
  creaseSeed,
  foldAmount
) {
  const size = settings.faceSize;
  const flatTransforms =
    buildConnectedFaceTransforms(
      net,
      originX,
      originZ,
      size,
      () => 0
    );

  const foldedTransforms =
    buildConnectedFaceTransforms(
      net,
      originX,
      originZ,
      size,
      () => HALF_PI
    );

  let transforms;

  if (foldAmount >= 0.999) {
    transforms = foldedTransforms;
  } else {
    transforms =
      buildVertexPeelTransforms(
        foldedTransforms,
        flatTransforms,
        size,
        smootherstep(1 - foldAmount),
        getIsometricEyePosition()
      );
  }

  const baseColor =
    color(netColor);

  const innerBaseColor =
    isTwoToneColorMode(settings.colorMode)
      ? color(settings.innerColor)
      : null;

  const multiOuter =
    settings.colorMode === "two-tone-multi";

  const rootNormal =
    transforms[net.rootIndex].normal;

  for (
    let faceIndex = 0;
    faceIndex < net.faces.length;
    faceIndex++
  ) {
    const transform =
      transforms[faceIndex];

    const aligned =
      abs(
        dotVectors(
          normalizeVector(
            transform.normal
          ),
          normalizeVector(rootNormal)
        )
      );

    const shadeProgress =
      aligned > 0.98
        ? foldAmount
        : foldAmount;

    const faceBaseColor =
      multiOuter
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
      innerBaseColor
    );
  }
}


function getBackgroundColor(settings) {
  return (
    BACKGROUNDS[settings.backgroundTheme] ||
    BACKGROUNDS.light
  );
}

function applyBackgroundTheme(settings) {
  const theme =
    settings
      ? settings.backgroundTheme
      : controls.backgroundTheme.value;

  const wrap =
    document.getElementById(
      "canvas-container"
    );

  if (wrap) {
    wrap.style.background =
      BACKGROUNDS[theme] ||
      BACKGROUNDS.light;
  }
}

function getNetColor(index, settings) {
  if (settings.colorMode === "monochromatic") {
    return monoColor;
  }

  if (
    settings.colorMode === "two-tone" ||
    settings.colorMode === "two-tone-multi"
  ) {
    return outerColor;
  }

  return PALETTE[index % PALETTE.length];
}

function isTwoToneColorMode(mode) {
  return (
    mode === "two-tone" ||
    mode === "two-tone-multi"
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

  const index =
    ((salt % PALETTE.length) + PALETTE.length) %
    PALETTE.length;

  return PALETTE[index];
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
}

function randomizePlacements() {
  placementSeed =
    floor(Math.random() * 1000000000);

  invalidateNetTypeCaches();
}

function readPresetStore() {
  try {
    const raw =
      localStorage.getItem(PRESET_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object"
      ? parsed
      : {};
  } catch (error) {
    return {};
  }
}

function writePresetStore(store) {
  localStorage.setItem(
    PRESET_STORAGE_KEY,
    JSON.stringify(store)
  );
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

  if (
    previous &&
    names.includes(previous)
  ) {
    select.value = previous;
  }
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
    } else {
      el.value = String(fields[id]);
    }
  }

  if (typeof preset.monoColor === "string") {
    monoColor = preset.monoColor;
  }

  if (typeof preset.outerColor === "string") {
    outerColor = preset.outerColor;
  }

  if (typeof preset.innerColor === "string") {
    innerColor = preset.innerColor;
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
    controls.showCubeGrid.checked &&
    controls.showFaceShading.checked;
  syncingQuickToggle = false;

  if (controls.presetSelect.value) {
    controls.presetName.value =
      controls.presetSelect.value;
  }
}

function syncColorModeUI() {
  const mode = controls.colorMode.value;
  const isMono = mode === "monochromatic";
  const isTwoTone = isTwoToneColorMode(mode);
  const isMultiOuter = mode === "two-tone-multi";

  controls.monoColorGroup.classList.toggle(
    "hidden",
    !isMono
  );

  controls.twoToneColorGroup.classList.toggle(
    "hidden",
    !isTwoTone
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
        : "Outside of each face uses the outer color; the inside uses the inner color.";
  }

  refreshPaletteSelection();
}

function buildPaletteSwatches() {
  fillPalette(
    controls.monoPalette,
    () => monoColor,
    (hex) => {
      monoColor = hex;
      controls.colorMode.value =
        "monochromatic";
      syncColorModeUI();
    }
  );

  fillPalette(
    controls.outerPalette,
    () => outerColor,
    (hex) => {
      outerColor = hex;
      if (
        controls.colorMode.value !== "two-tone" &&
        controls.colorMode.value !== "two-tone-multi"
      ) {
        controls.colorMode.value = "two-tone";
      }
      syncColorModeUI();
    }
  );

  fillPalette(
    controls.innerPalette,
    () => innerColor,
    (hex) => {
      innerColor = hex;
      if (
        controls.colorMode.value !== "two-tone" &&
        controls.colorMode.value !== "two-tone-multi"
      ) {
        controls.colorMode.value = "two-tone";
      }
      syncColorModeUI();
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
    "cascadeDirectionGroup",
    "cascadeCountGroup",
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
    "foldProgress",
    "foldMode",
    "drapeAmount",
    "cubeCoverage",
    "coveragePercentControls",
    "coverageCountControls",
    "cubeCount",
    "animationSpeed",
    "gridSize",
    "layoutSpacing",
    "cameraZoom",
    "backgroundTheme",
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
    "showFaceShading",
    "unfoldButton",
    "foldButton",
    "randomizePlacementsButton",
    "exportButton"
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
    "cascadeCount",
    "animationSpeed",
    "gridSize",
    "layoutSpacing",
    "cameraZoom"
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
    }
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
      controls.showCubeGrid.checked = on;
      controls.showFaceShading.checked = on;
      syncingQuickToggle = false;
    }
  );

  const syncQuickFromParts = () => {
    if (syncingQuickToggle) {
      return;
    }

    syncingQuickToggle = true;
    controls.quickToggle.checked =
      controls.showDivisions.checked &&
      controls.showCubeGrid.checked &&
      controls.showFaceShading.checked;
    syncingQuickToggle = false;
  };

  controls.showDivisions.addEventListener(
    "change",
    syncQuickFromParts
  );

  controls.showCubeGrid.addEventListener(
    "change",
    syncQuickFromParts
  );

  controls.showFaceShading.addEventListener(
    "change",
    syncQuickFromParts
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

  controls.cascadeCount.addEventListener(
    "input",
    () => {
      cascadeCacheKey = "";
      updateAllValueLabels();
    }
  );

  controls.unfoldButton.addEventListener(
    "click",
    () => {
      animatedProgress = 0;
      animationDirection = 1;

      controls.foldProgress.value = 0;
      controls.animateFolding.checked = false;

      updateAllValueLabels();
    }
  );

  controls.foldButton.addEventListener(
    "click",
    () => {
      animatedProgress = 1;
      animationDirection = -1;

      controls.foldProgress.value = 1;
      controls.animateFolding.checked = false;

      updateAllValueLabels();
    }
  );

  controls.randomizePlacementsButton.addEventListener(
    "click",
    randomizePlacements
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
      if (controls.presetSelect.value) {
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
    syncColorModeUI
  );
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
    height / (getVerticalView(1) * 2);

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

  return applyPackedDefaults({
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

    gridPlacement:
      controls.gridPlacement.value,

    placementSkew:
      Number(controls.placementSkew.value) / 100,

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

    /*
     * Authoring cell size in screen pixels at zoom 1.
     */
    gridSize,

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

    showFaceShading:
      controls.showFaceShading.checked
  });
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
    "cascadeCount",
    `${controls.cascadeCount.value}`
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
}

function syncSketchModeUI() {
  if (REMOVED_SKETCH_MODES.has(controls.sketchMode.value)) {
    controls.sketchMode.value = "gridded";
  }

  const mode = controls.sketchMode.value;
  const isCascade = mode === "cascade";
  const isGridded = mode === "gridded";
  const isGradient = mode === "gradient";

  controls.cascadeDirectionGroup.classList.toggle(
    "hidden",
    isGridded
  );

  controls.cascadeCountGroup.classList.toggle(
    "hidden",
    !isCascade
  );

  controls.directionLabel.textContent =
    isGradient
      ? "Dense → empty"
      : "Cascade direction";

  controls.griddedPlacementControls.classList.toggle(
    "hidden",
    !isGridded
  );

  controls.sharedFoldControls.classList.toggle(
    "hidden",
    !isGridded
  );

  controls.griddedCoverageControls.classList.toggle(
    "hidden",
    !isGridded && !isGradient
  );

  controls.griddedActionControls.classList.toggle(
    "hidden",
    !isGridded
  );

  controls.griddedFoldButtons.classList.toggle(
    "hidden",
    !isGridded
  );
}

function applyAspectRatio() {
  const key =
    controls.aspectRatio
      ? controls.aspectRatio.value
      : "16:9";

  const preset =
    ASPECT_PRESETS[key] || ASPECT_PRESETS["16:9"];

  if (
    width === preset.width &&
    height === preset.height
  ) {
    return;
  }

  resizeCanvas(preset.width, preset.height);

  /*
   * Layout depends on canvas bounds — rebuild packs
   * and cascade paths for the new frame.
   */
  packCacheKey = "";
  cascadeCacheKey = "";
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

    return;
  }

  const speed = Number(
    controls.animationSpeed.value
  );

  animatedProgress +=
    speed * animationDirection;

  if (animatedProgress >= 1) {
    animatedProgress = 1;
    animationDirection = -1;
  }

  if (animatedProgress <= 0) {
    animatedProgress = 0;
    animationDirection = 1;
  }

  controls.foldProgress.value =
    animatedProgress;

  setValueLabel(
    "foldProgress",
    animatedProgress.toFixed(2)
  );
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

function beginScreenSpaceCamera() {
  ortho(
    -width * 0.5,
    width * 0.5,
    -height * 0.5,
    height * 0.5,
    -1000,
    1000
  );

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
      PACKED_VERTEX_ONLY
        ? 0
        : placement.foldDelay,
      PACKED_VERTEX_ONLY
        ? { drapeAmount: 0 }
        : {}
    );
  }
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
        foldMode: "both"
      }
    );
  }
}



/*
 * Random placement: scatter by hash.
 * Patterned placements: coverage reduces how many
 * parallel paths/bands stay visible (e.g. 10 vertical
 * lines → 2), spaced evenly across the field.
 */
function selectPlacementsForCoverage(placements, settings) {
  if (PACKED_VERTEX_ONLY) {
    return placements;
  }

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
    let sumX = 0;
    let sumZ = 0;

    for (const face of placement.net.faces) {
      sumX += (face.gridX + 0.5) * size;
      sumZ += (face.gridY + 0.5) * size;
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
  let sumX = 0;
  let sumY = 0;

  for (const face of faces) {
    sumX += face.gridX;
    sumY += face.gridY;
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
 * only one-side unfold / refold. No sliding — each
 * cycle plants the trailing face, unrolls onto the
 * grid, then folds onto the leading face so the cube
 * reassembles one net-span further along.
 */
function updateCascade(settings) {
  ensureCascadeTravelers(settings);

  const speed =
    settings.animationSpeed * 1.65;

  cascadeTime += speed;

  for (const traveler of cascadeTravelers) {
    traveler.animProgress += speed;

    while (traveler.animProgress >= 1) {
      traveler.animProgress -= 1;

      if (traveler.phase === "unravel") {
        traveler.phase = "refold";
      } else {
        advanceCascadeTraveler(traveler, settings);
        traveler.phase = "unravel";
      }
    }
  }
}

function ensureCascadeTravelers(settings) {
  const key = [
    settings.cascadeDirection,
    settings.cascadeCount,
    settings.faceSize.toFixed(5),
    settings.cameraZoom.toFixed(3),
    settings.gridSize,
    allowedTypesCacheKey(settings),
    placementSeed,
    width,
    height
  ].join("|");

  if (key === cascadeCacheKey && cascadeTravelers.length) {
    return;
  }

  cascadeCacheKey = key;
  cascadeTravelers = [];

  const prefer =
    getCascadeCellPrefer(settings.cascadeDirection);

  const board = getVisibleFaceBoard(settings);
  const count = settings.cascadeCount;
  const layout =
    getCascadeStreamLayout(board, prefer, count);

  for (let i = 0; i < count; i++) {
    cascadeTravelers.push(
      createCascadeTraveler(
        i,
        count,
        prefer,
        board,
        settings,
        layout
      )
    );
  }
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
 * along travel so a high count keeps a continuous
 * conveyor across the visible board.
 */
function getCascadeStreamLayout(board, prefer, count) {
  const travelI = prefer.di;
  const travelJ = prefer.dj;
  const perpI = -prefer.dj;
  const perpJ = prefer.di;

  const corners = [
    [board.minI, board.minJ],
    [board.minI, board.maxJ],
    [board.maxI, board.minJ],
    [board.maxI, board.maxJ]
  ];

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
    max(8, travelMax - travelMin);

  const perpExtent =
    max(4, perpMax - perpMin);

  const minLaneSpacing = 4.6;
  const minStepSpacing = 5.4;

  const maxLanes =
    max(1, floor(perpExtent / minLaneSpacing) + 1);

  const maxDepth =
    max(1, floor(travelLength / minStepSpacing) + 1);

  let lanes =
    min(count, maxLanes);

  let depth =
    max(1, ceil(count / max(1, lanes)));

  if (depth > maxDepth) {
    depth = maxDepth;
    lanes =
      min(
        count,
        max(1, ceil(count / max(1, depth)))
      );
  }

  const laneSpacing =
    lanes <= 1
      ? 0
      : perpExtent / (lanes - 1);

  const stepSpacing =
    depth <= 1
      ? minStepSpacing
      : travelLength / depth;

  return {
    lanes,
    depth,
    laneSpacing,
    stepSpacing,
    travelLength,
    perpExtent,
    perpI,
    perpJ
  };
}

function getCascadeLaneDepth(index, layout, count) {
  const lanes =
    max(1, layout.lanes);

  /*
   * Fill lane-major so neighboring indexes share a
   * lane and pipeline along travel.
   */
  const lane =
    index % lanes;

  const depthIndex =
    floor(index / lanes);

  return {
    lane,
    depthIndex,
    laneCount: lanes,
    depthCount:
      max(1, ceil(count / lanes))
  };
}

function createCascadeTraveler(
  index,
  count,
  prefer,
  board,
  settings,
  layout
) {
  const seed =
    index * 97.3 +
    prefer.di * 11 +
    prefer.dj * 19 +
    placementSeed * 0.013;

  const typeIndex =
    pickAllowedTypeIndex(seed, settings);

  const slot =
    getCascadeLaneDepth(index, layout, count);

  const placement =
    buildCascadeNetPlacement(
      typeIndex,
      prefer,
      board,
      slot.lane,
      slot.laneCount,
      seed,
      slot.depthIndex,
      layout
    );

  const net = prepareNet(placement.cells);
  const extremes =
    getCascadeTravelExtremes(net, prefer);

  /*
   * Small phase offset by lane keeps the parade
   * orderly without locking every fold to one beat.
   */
  const phaseOffset =
    (slot.lane / max(1, slot.laneCount)) * 0.35;

  return {
    typeIndex,
    seed,
    laneIndex: slot.lane,
    depthIndex: slot.depthIndex,
    laneCount: slot.laneCount,
    creaseStyle: floor(unitHash(seed * 1.7) * 5),
    prefer,
    cells: placement.cells,
    net,
    trailingIndex: extremes.trailingIndex,
    leadingIndex: extremes.leadingIndex,
    phase: "unravel",
    animProgress: phaseOffset
  };
}

function buildCascadeNetPlacement(
  typeIndex,
  prefer,
  board,
  laneIndex,
  laneCount,
  seed,
  depthIndex = 0,
  layout = null
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

      const trailing = getLocalExtreme(local, prefer, false);
      const leading = getLocalExtreme(local, prefer, true);

      const span =
        (leading[0] - trailing[0]) * prefer.di +
        (leading[1] - trailing[1]) * prefer.dj;

      if (span <= 0) {
        continue;
      }

      /*
       * Prefer compact, even spans so pipelined
       * travelers advance at similar rates.
       */
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

  const start =
    getCascadeStartCell(
      board,
      prefer,
      laneIndex,
      laneCount,
      seed,
      depthIndex,
      layout
    );

  /*
   * Place so the trailing leaf sits on the start cell.
   */
  const ox = start.i - best.trailing[0];
  const oy = start.j - best.trailing[1];

  const cells = best.local.map((cell) => [
    cell[0] + ox,
    cell[1] + oy
  ]);

  return { cells, span: best.span };
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
  layout = null
) {
  const midI = (board.minI + board.maxI) * 0.5;
  const midJ = (board.minJ + board.maxJ) * 0.5;

  /*
   * Enter from the anti-travel side of the board.
   */
  let startI;
  let startJ;

  if (prefer.di < 0) {
    startI = board.maxI - 1;
  } else if (prefer.di > 0) {
    startI = board.minI + 1;
  } else {
    startI = round(midI);
  }

  if (prefer.dj < 0) {
    startJ = board.maxJ - 1;
  } else if (prefer.dj > 0) {
    startJ = board.minJ + 1;
  } else {
    startJ = round(midJ);
  }

  const perpI =
    layout ? layout.perpI : -prefer.dj;

  const perpJ =
    layout ? layout.perpJ : prefer.di;

  const laneSpacing =
    layout
      ? layout.laneSpacing
      : 2.2;

  const stepSpacing =
    layout
      ? layout.stepSpacing
      : 5.4;

  const lane =
    laneIndex - (laneCount - 1) * 0.5;

  startI = round(startI + perpI * lane * laneSpacing);
  startJ = round(startJ + perpJ * lane * laneSpacing);

  /*
   * Pipeline along travel so the board starts full
   * and stays in a continuous stream.
   */
  const depth =
    max(0, depthIndex);

  startI = round(startI + prefer.di * depth * stepSpacing);
  startJ = round(startJ + prefer.dj * depth * stepSpacing);

  return { i: startI, j: startJ };
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
  const margin = 3;

  let anyOn = false;

  for (const cell of traveler.cells) {
    if (
      cell[0] >= board.minI - margin &&
      cell[0] <= board.maxI + margin &&
      cell[1] >= board.minJ - margin &&
      cell[1] <= board.maxJ + margin
    ) {
      anyOn = true;
      break;
    }
  }

  if (!anyOn) {
    return true;
  }

  /*
   * Past the exit side far enough that the trailing
   * face has cleared the frame.
   */
  const trailing =
    traveler.net.faces[traveler.trailingIndex];

  const score =
    preferScore(
      trailing.gridX,
      trailing.gridY,
      traveler.prefer
    );

  const exitScore = preferScore(
    traveler.prefer.di > 0
      ? board.maxI + margin
      : traveler.prefer.di < 0
        ? board.minI - margin
        : (board.minI + board.maxI) * 0.5,
    traveler.prefer.dj > 0
      ? board.maxJ + margin
      : traveler.prefer.dj < 0
        ? board.minJ - margin
        : (board.minJ + board.maxJ) * 0.5,
    traveler.prefer
  );

  return score > exitScore;
}

function resetCascadeTravelerToStart(traveler, settings) {
  const board = getVisibleFaceBoard(settings);
  const count = max(1, cascadeTravelers.length);
  const layout =
    getCascadeStreamLayout(
      board,
      traveler.prefer,
      count
    );

  const laneIndex =
    traveler.laneIndex ??
    max(0, cascadeTravelers.indexOf(traveler));

  const laneCount =
    traveler.laneCount ?? layout.lanes;

  /*
   * Re-enter at the back of this lane. Other cubes
   * already pipeline ahead, so the stream stays full.
   */
  let placement =
    buildCascadeNetPlacement(
      traveler.typeIndex,
      traveler.prefer,
      board,
      laneIndex,
      laneCount,
      traveler.seed,
      0,
      layout
    );

  let cells = placement.cells;

  /*
   * If the entry slot is still occupied, nudge further
   * behind along anti-travel so cubes don't stack.
   */
  for (let attempt = 0; attempt < 4; attempt++) {
    const blocked =
      cascadeTravelers.some((other) => {
        if (other === traveler) {
          return false;
        }

        return cascadeCellsOverlap(cells, other.cells);
      });

    if (!blocked) {
      break;
    }

    const back =
      max(2, round(layout.stepSpacing * 0.85));

    cells = cells.map((cell) => [
      cell[0] - traveler.prefer.di * back,
      cell[1] - traveler.prefer.dj * back
    ]);
  }

  traveler.cells = cells;
  traveler.net = prepareNet(cells);
  traveler.laneIndex = laneIndex;
  traveler.laneCount = laneCount;
  traveler.depthIndex = 0;

  const extremes =
    getCascadeTravelExtremes(
      traveler.net,
      traveler.prefer
    );

  traveler.trailingIndex = extremes.trailingIndex;
  traveler.leadingIndex = extremes.leadingIndex;
  traveler.phase = "unravel";
  traveler.animProgress =
    (laneIndex / max(1, laneCount)) * 0.35;
}

function cascadeCellsOverlap(cellsA, cellsB) {
  const keys =
    new Set(
      cellsB.map(
        (cell) => `${cell[0]},${cell[1]}`
      )
    );

  let hits = 0;

  for (const cell of cellsA) {
    if (keys.has(`${cell[0]},${cell[1]}`)) {
      hits += 1;

      if (hits >= 2) {
        return true;
      }
    }
  }

  return false;
}

function drawCascadeNets(settings) {
  ensureCascadeTravelers(settings);

  const size = settings.faceSize;

  for (const traveler of cascadeTravelers) {
    const unraveling =
      traveler.phase === "unravel";

    const plantIndex = unraveling
      ? traveler.trailingIndex
      : traveler.leadingIndex;

    const foldProgress = unraveling
      ? 1 - traveler.animProgress
      : traveler.animProgress;

    const plantFace =
      traveler.net.faces[plantIndex];

    const originX =
      (plantFace.gridX + 0.5) * size;

    const originZ =
      (plantFace.gridY + 0.5) * size;

    drawNet(
      traveler.net,
      originX,
      originZ,
      getNetColor(traveler.typeIndex, settings),
      settings,
      traveler.creaseStyle,
      traveler.seed,
      0,
      {
        foldMode: "one-side",
        foldProgress,
        plantFaceIndex: plantIndex,
        useOriginAsPlant: true,
        drapeAmount: 0
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
  const key = PACKED_VERTEX_ONLY
    ? [
        settings.faceSize.toFixed(5),
        settings.cameraZoom.toFixed(3),
        settings.gridSize,
        placementSeed,
        width,
        height
      ].join("|")
    : [
        settings.faceSize.toFixed(5),
        settings.cameraZoom.toFixed(3),
        settings.gridSize,
        settings.gridPlacement,
        settings.placementSkew.toFixed(3),
        allowedTypesCacheKey(settings),
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
 * One cube per isometric hex cell — staggered
 * lattice so top and side faces read as tiers.
 */
function buildPackedCubeGrid(settings) {
  const edge =
    settings.screenGridSize;

  const columnSpacing =
    edge * sqrt(3) * 0.5;

  const hexRangeI =
    ceil(width / (columnSpacing * 2)) + 2;

  const hexRangeJ =
    ceil(height / (edge * 1.5)) + 2;

  const marginX = width * 0.55;
  const marginY = height * 0.55;

  const net =
    prepareNet(
      CUBE_NETS[PACKED_CUBE_NET_INDEX]
    );

  const placements = [];

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
      const hexScreen =
        getHexCenterScreen(
          hexI,
          hexJ,
          edge
        );

      if (
        abs(hexScreen.x) > marginX ||
        abs(hexScreen.y) > marginY
      ) {
        continue;
      }

      const world =
        screenToUnfoldedRootOrigin(
          hexScreen.x,
          hexScreen.y,
          settings
        );

      placements.push({
        net,
        originX: world.x,
        originZ: world.z,
        hexI,
        hexJ,
        colorIndex:
          abs(hexI * 3 + hexJ * 7) %
          CUBE_NETS.length,
        creaseStyle: 0,
        seed:
          hexI * 131 +
          hexJ * 17,
        order: 0,
        skews: false,
        foldDelay: 0
      });
    }
  }

  /*
   * Back rows first so nearer tiers paint over
   * farther ones on the isometric lattice.
   */
  placements.sort((a, b) => {
    if (a.hexJ !== b.hexJ) {
      return a.hexJ - b.hexJ;
    }

    return a.hexI - b.hexI;
  });

  for (
    let index = 0;
    index < placements.length;
    index++
  ) {
    placements[index].order = index;
  }

  return {
    placements,
    totalCells: placements.length
  };
}

/*
 * Cover every visible face-lattice cell with
 * non-overlapping cube-net hexominoes via a plane
 * tiling, then locally rematch pairs so multiple
 * net types / crease styles appear across the field.
 */
function buildHexominoPacking(settings) {
  if (PACKED_VERTEX_ONLY) {
    return buildPackedCubeGrid(settings);
  }

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

  if (!PACKED_VERTEX_ONLY) {
    raw = diversifyPackedNets(
      raw,
      allowedTypes.length < CUBE_NETS.length
        ? 160
        : 64,
      placement,
      skew,
      allowedTypes
    );
    raw = filterPackedByPlacement(
      raw,
      placement,
      skew
    );
  }

  const size = settings.faceSize;
  const placements = raw.map((entry) => {
    const net = prepareNet(entry.cells);
    const root = net.faces[net.rootIndex];
    const skews =
      unitHash(entry.seed * 0.83) < skew;

    return {
      net,
      /*
       * Centers sit on half-cell offsets so face
       * corners land on the isometric lattice nodes.
       */
      originX: (root.gridX + 0.5) * size,
      originZ: (root.gridY + 0.5) * size,
      colorIndex: entry.typeIndex,
      creaseStyle:
        PACKED_VERTEX_ONLY
          ? 0
          : creaseStyleForPlacement(
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
          entry.seed * 0.17
        ) * 0.72
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
    occupied.add(
      coordinateKey(cell[0], cell[1])
    );
  }

  const rootCell = absolute[0];

  raw.push({
    cells: absolute,
    typeIndex,
    creaseStyle:
      PACKED_VERTEX_ONLY
        ? 0
        : floor(
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
            coordinateKey(
              rootCell[0],
              rootCell[1]
            ),
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

  return {
    minI,
    maxI,
    minJ,
    maxJ,
    cells
  };
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

  let staggeredProgress;

  if (options.foldProgress !== undefined) {
    const clamped = constrain(
      options.foldProgress,
      0,
      1
    );

    staggeredProgress = options.linearFold
      ? clamped
      : smootherstep(clamped);
  } else {
    const delay = constrain(foldDelay, 0, 0.85);
    const span = max(0.001, 1 - delay);

    staggeredProgress =
      smootherstep(
        constrain(
          (settings.foldProgress - delay) / span,
          0,
          1
        )
      );
  }

  if (PACKED_VERTEX_ONLY) {
    drawPackedVertexCube(
      net,
      originX,
      originZ,
      netColor,
      settings,
      creaseSeed,
      staggeredProgress
    );

    return;
  }

  /*
   * One side: plant an end face and fold the sheet
   * onto it. Cascade passes a traveling plant origin;
   * gridded mode plants on the absolute lattice cell.
   */
  let activeNet = net;
  let plantX = originX;
  let plantZ = originZ;

  const useVertexSpread =
    PACKED_VERTEX_ONLY ||
    foldMode === "vertex-spread";

  const packedFolded =
    PACKED_VERTEX_ONLY &&
    staggeredProgress >= 0.99;

  if (packedFolded) {
    activeNet = net;
    plantX = originX;
    plantZ = originZ;
  } else if (useVertexSpread) {
    const planted =
      setupVertexPinnedPlant(
        net,
        originX,
        originZ,
        settings.faceSize
      );

    activeNet = planted.activeNet;
    plantX = planted.plantX;
    plantZ = planted.plantZ;
  }

  else if (foldMode === "one-side") {
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

      plantX =
        (endFace.gridX + 0.5) *
        settings.faceSize;

      plantZ =
        (endFace.gridY + 0.5) *
        settings.faceSize;
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
    packedFolded
      ? new Array(
          activeNet.faces.length
        ).fill(staggeredProgress)
      : useVertexSpread
        ? getVertexSpreadFoldProgress(
            activeNet,
            staggeredProgress
          )
        : foldMode === "one-side"
          ? getOneSideFoldProgress(
              activeNet,
              staggeredProgress
            )
          : getFaceFoldProgress(
              activeNet,
              staggeredProgress,
              foldMode,
              creaseSeed
            );

  const creaseDepth =
    getCreaseDepthByFace(activeNet);

  /*
   * Cascade / traveling nets: keep drape flat so the
   * roll reads as a clean one-side fold along the path.
   */
  const drapeAmount =
    PACKED_VERTEX_ONLY
      ? 0
      : options.drapeAmount !== undefined
        ? options.drapeAmount
        : settings.drapeAmount;

  const transforms =
    buildConnectedFaceTransforms(
      activeNet,
      plantX,
      plantZ,
      settings.faceSize,
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

        const foldedAngle = HALF_PI;

        return lerp(
          drapedAngle,
          foldedAngle,
          progress
        );
      }
    );

  const baseColor =
    color(netColor);

  const innerBaseColor =
    isTwoToneColorMode(settings.colorMode)
      ? color(settings.innerColor)
      : null;

  const multiOuter =
    settings.colorMode === "two-tone-multi";

  const rootNormal =
    transforms[activeNet.rootIndex].normal;

  for (
    let faceIndex = 0;
    faceIndex < activeNet.faces.length;
    faceIndex++
  ) {
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
        ? staggeredProgress
        : creaseProgress[faceIndex];

    const faceBaseColor =
      multiOuter
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
      innerBaseColor
    );
  }
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
  foldSeed = 0
) {
  const count = net.faces.length;
  const progress =
    new Array(count).fill(globalProgress);

  if (foldMode === "both") {
    return progress;
  }

  /*
   * One side: strictly one plane at a time, rolling
   * from the free end onto the planted edge face so
   * the finished cube sits on that edge.
   */
  if (foldMode === "one-side") {
    return getOneSideFoldProgress(
      net,
      globalProgress
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
      smootherstep(
        constrain(local / blend, 0, 1)
      );
  }

  return progress;
}

/*
 * Sequential single-plane folds onto the planted
 * root. Farthest faces move first so the sheet
 * rolls onto the edge plane.
 */
function getOneSideFoldProgress(net, globalProgress) {
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
      return b.depth - a.depth;
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
      smootherstep(
        constrain(local, 0, 1)
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

function drawConnectedFace(
  transform,
  baseColor,
  progress,
  settings,
  innerBaseColor = null
) {
  const half =
    settings.faceSize * 0.5;

  const u =
    scaleVector(
      transform.u,
      half
    );

  const v =
    scaleVector(
      transform.v,
      half
    );

  const corners = [
    addVectors(
      addVectors(
        transform.center,
        scaleVector(u, -1)
      ),
      scaleVector(v, -1)
    ),

    addVectors(
      addVectors(
        transform.center,
        u
      ),
      scaleVector(v, -1)
    ),

    addVectors(
      addVectors(
        transform.center,
        u
      ),
      v
    ),

    addVectors(
      addVectors(
        transform.center,
        scaleVector(u, -1)
      ),
      v
    )
  ];

  const normal =
    normalizeVector(transform.normal);

  const separation = 0.12;
  const needsInner = Boolean(innerBaseColor);

  const outerCorners =
    offsetCorners(
      corners,
      normal,
      needsInner ? separation : 0
    );

  drawFaceSide(
    outerCorners,
    baseColor,
    normal,
    progress,
    settings,
    true
  );

  if (!needsInner) {
    return;
  }

  const inward =
    scaleVector(normal, -1);

  const innerCorners =
    offsetCorners(
      corners.slice().reverse(),
      inward,
      separation
    );

  drawFaceSide(
    innerCorners,
    innerBaseColor,
    inward,
    progress,
    settings,
    false
  );
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
  exactColor = false
) {
  const faceColor =
    exactColor || !settings.showFaceShading
      ? baseColor
      : getFaceColor(
          baseColor,
          normal,
          progress,
          settings.showFaceShading
        );

  fill(faceColor);

  if (!drawStroke) {
    noStroke();
    drawFaceQuad(corners);
    return;
  }

  if (!settings.showDivisions) {
    noStroke();
    drawFaceQuad(corners);
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
  strokeWeight(1);

  const filter =
    settings.divisionAngleFilter || "all";

  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];

    if (
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

function getFaceColor(
  baseColor,
  normal,
  progress,
  useShading
) {
  if (!useShading) {
    return baseColor;
  }

  const lightDirection =
    normalizeVector([
      -0.5,
      -1,
      -0.45
    ]);

  const brightness =
    dotVectors(
      normalizeVector(normal),
      scaleVector(
        lightDirection,
        -1
      )
    );

  const shade =
    map(
      constrain(
        brightness,
        -1,
        1
      ),
      -1,
      1,
      0.58,
      1.15
    );

  const finalShade =
    lerp(
      lerp(
        1,
        shade,
        0.45
      ),
      shade,
      progress
    );

  return color(
    constrain(
      red(baseColor) *
      finalShade,
      0,
      255
    ),

    constrain(
      green(baseColor) *
      finalShade,
      0,
      255
    ),

    constrain(
      blue(baseColor) *
      finalShade,
      0,
      255
    )
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
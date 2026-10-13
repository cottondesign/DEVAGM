const TILE_IMAGE_PATH = "AGM CUBE.png";
const BACKGROUND = "#FEF9F3";
const IMAGE_ASPECT = 377 / 274;

// Collision bounds closely follow the visible artwork.
// 0.76 was too small and allowed overlap.
// 1.0 was too large because it included too much transparent PNG space.
const COLLISION_INSET = 0.80;

// Tiny safety buffer so images can get nearly tangential
// without visually crossing into each other.
const COLLISION_SAFETY = 0.5;

// Reduced enough to keep sliders responsive,
// but still high enough to find dense placements.
const PLACEMENT_ATTEMPTS = 450;

const controls = {};

let tileImage = null;
let placements = [];
let packSeed = 0;

let canvasWidth = 1440;
let canvasHeight = 810;

let repackTimer = null;


function setup() {
  getControls();
  connectControls();
  syncModeUI();

  const container =
    document.getElementById("canvas-container");

  canvasWidth = max(
    container.clientWidth,
    320
  );

  canvasHeight =
    round(canvasWidth * 9 / 16);

  const canvas = createCanvas(
    canvasWidth,
    canvasHeight
  );

  canvas.parent("canvas-container");

  pixelDensity(
    min(2, window.devicePixelRatio || 1)
  );

  smooth();

  loadImage(
    TILE_IMAGE_PATH,

    img => {
      tileImage = img;
      repack();
    },

    () => {
      console.error(
        `Could not load ${TILE_IMAGE_PATH}`
      );
    }
  );
}


function draw() {
  background(BACKGROUND);

  if (!tileImage) {
    return;
  }

  for (const placement of placements) {
    drawPlacement(placement);
  }
}


function drawPlacement(placement) {
  const {
    cx,
    cy,
    drawW,
    drawH,
    rotation
  } = placement;

  push();

  imageMode(CENTER);

  translate(
    cx,
    cy
  );

  rotate(
    radians(rotation)
  );

  image(
    tileImage,
    0,
    0,
    drawW,
    drawH
  );

  pop();
}


function repack() {
  if (!tileImage) {
    return;
  }

  const settings =
    getSettings();

  const specs =
    settings.mode === "fixed"
      ? buildFixedSpecs(settings)
      : buildVariableSpecs(settings);

  placements =
    scatterPack(
      specs,
      canvasWidth,
      canvasHeight,
      settings.gap
    );

  updateStats();
}


function buildFixedSpecs(settings) {
  const drawW =
    canvasWidth *
    settings.fixedScale;

  const drawH =
    drawW *
    IMAGE_ASPECT;

  const collisionW =
    drawW *
    COLLISION_INSET;

  const collisionH =
    drawH *
    COLLISION_INSET;

  const tileArea =
    collisionW *
    collisionH;

  const maxTiles =
    ceil(
      (canvasWidth * canvasHeight) /
      (tileArea * 0.62)
    ) + 60;

  const rng =
    mulberry32(packSeed);

  const specs = [];

  for (
    let i = 0;
    i < maxTiles;
    i++
  ) {
    specs.push({
      id: i,

      drawW,
      drawH,

      rotation:
        rng() * 360
    });
  }

  return specs;
}


function buildVariableSpecs(settings) {
  const minScale =
    min(
      settings.minScale,
      settings.maxScale
    );

  const maxScale =
    max(
      settings.minScale,
      settings.maxScale
    );

  const rng =
    mulberry32(packSeed);

  const maxTiles = 260;

  const specs = [];

  for (
    let i = 0;
    i < maxTiles;
    i++
  ) {
    const drawW =
      canvasWidth *
      lerp(
        minScale,
        maxScale,
        rng()
      );

    const drawH =
      drawW *
      IMAGE_ASPECT;

    specs.push({
      id: i,

      drawW,
      drawH,

      rotation:
        rng() * 360
    });
  }

  return specs;
}


function scatterPack(
  specs,
  canvasW,
  canvasH,
  gap
) {
  const sorted =
    [...specs].sort(
      (a, b) => {
        return (
          b.drawW * b.drawH -
          a.drawW * a.drawH
        );
      }
    );

  const placed = [];

  const rng =
    mulberry32(
      packSeed + 17
    );

  for (const spec of sorted) {
    const placement =
      findScatteredPlacement(
        spec,
        placed,
        canvasW,
        canvasH,
        gap,
        rng
      );

    if (placement) {
      placed.push(
        placement
      );
    }
  }

  return placed;
}


function findScatteredPlacement(
  spec,
  placed,
  canvasW,
  canvasH,
  gap,
  rng
) {
  const halfW =
    spec.drawW *
    0.5 *
    COLLISION_INSET;

  const halfH =
    spec.drawH *
    0.5 *
    COLLISION_INSET;

  const angleRad =
    radians(
      spec.rotation
    );

  let best = null;
  let bestScore = -Infinity;

  for (
    let attempt = 0;
    attempt < PLACEMENT_ATTEMPTS;
    attempt++
  ) {
    let cx;
    let cy;

    /*
      Most candidate positions are generated near
      existing images so the system actively tries
      to form a dense packed cluster.
    */
    if (
      placed.length > 0 &&
      rng() < 0.88
    ) {
      const neighbor =
        placed[
          floor(
            rng() *
            placed.length
          )
        ];

      const direction =
        rng() *
        TWO_PI;

      const neighborRadius =
        sqrt(
          neighbor.halfW *
            neighbor.halfW +
          neighbor.halfH *
            neighbor.halfH
        );

      const thisRadius =
        sqrt(
          halfW * halfW +
          halfH * halfH
        );

      /*
        Try positions that are already close
        enough to potentially touch.
      */
      const distance =
        (
          neighborRadius +
          thisRadius
        ) *
        lerp(
          0.42,
          0.95,
          rng()
        );

      cx =
        neighbor.cx +
        cos(direction) *
        distance;

      cy =
        neighbor.cy +
        sin(direction) *
        distance;
    } else {
      cx =
        halfW +
        rng() *
        (
          canvasW -
          halfW * 2
        );

      cy =
        halfH +
        rng() *
        (
          canvasH -
          halfH * 2
        );
    }

    if (
      !fitsCanvas(
        cx,
        cy,
        halfW,
        halfH,
        angleRad,
        canvasW,
        canvasH
      )
    ) {
      continue;
    }

    if (
      collidesWithPlaced(
        cx,
        cy,
        halfW,
        halfH,
        angleRad,
        placed,
        gap + COLLISION_SAFETY
      )
    ) {
      continue;
    }

    const score =
      placementScore(
        cx,
        cy,
        halfW,
        halfH,
        placed
      ) +
      rng() * 0.05;

    if (
      score >
      bestScore
    ) {
      bestScore = score;

      best = {
        id:
          spec.id,

        cx,
        cy,

        drawW:
          spec.drawW,

        drawH:
          spec.drawH,

        rotation:
          spec.rotation,

        halfW,
        halfH
      };
    }
  }

  return best;
}


function placementScore(
  cx,
  cy,
  halfW,
  halfH,
  placed
) {
  if (!placed.length) {
    return 0;
  }

  let nearestSurfaceGap =
    Infinity;

  let nearNeighbors = 0;
  let veryNearNeighbors = 0;

  const thisRadius =
    sqrt(
      halfW * halfW +
      halfH * halfH
    );

  for (
    const tile
    of placed
  ) {
    const dx =
      cx -
      tile.cx;

    const dy =
      cy -
      tile.cy;

    const centerDistance =
      sqrt(
        dx * dx +
        dy * dy
      );

    const tileRadius =
      sqrt(
        tile.halfW *
          tile.halfW +
        tile.halfH *
          tile.halfH
      );

    const approximateSurfaceGap =
      centerDistance -
      thisRadius -
      tileRadius;

    nearestSurfaceGap =
      min(
        nearestSurfaceGap,
        abs(
          approximateSurfaceGap
        )
      );

    if (
      centerDistance <
      (
        thisRadius +
        tileRadius
      ) * 1.6
    ) {
      nearNeighbors++;
    }

    if (
      centerDistance <
      (
        thisRadius +
        tileRadius
      ) * 1.2
    ) {
      veryNearNeighbors++;
    }
  }

  /*
    Strongly favor:
    1. Nearly touching another tile
    2. Having several nearby neighbors
    3. Filling dense local pockets
  */
  return (
    veryNearNeighbors * 14 +
    nearNeighbors * 5 -
    nearestSurfaceGap * 0.45
  );
}


function fitsCanvas(
  cx,
  cy,
  halfW,
  halfH,
  angleRad,
  canvasW,
  canvasH
) {
  const corners =
    getObbCorners(
      cx,
      cy,
      halfW,
      halfH,
      angleRad
    );

  for (
    const [x, y]
    of corners
  ) {
    if (
      x < 0 ||
      x > canvasW ||
      y < 0 ||
      y > canvasH
    ) {
      return false;
    }
  }

  return true;
}


function collidesWithPlaced(
  cx,
  cy,
  halfW,
  halfH,
  angleRad,
  placed,
  gap
) {
  const cornersA =
    getObbCorners(
      cx,
      cy,
      halfW,
      halfH,
      angleRad
    );

  const radiusA =
    sqrt(
      halfW * halfW +
      halfH * halfH
    );

  for (
    const tile
    of placed
  ) {
    const dx =
      cx -
      tile.cx;

    const dy =
      cy -
      tile.cy;

    const radiusB =
      sqrt(
        tile.halfW *
          tile.halfW +
        tile.halfH *
          tile.halfH
      );

    const maxDist =
      radiusA +
      radiusB +
      max(
        0,
        gap
      );

    /*
      Fast broad-phase check:
      if their bounding circles cannot touch,
      skip the SAT test.
    */
    if (
      dx * dx +
      dy * dy >
      maxDist *
      maxDist
    ) {
      continue;
    }

    const cornersB =
      getObbCorners(
        tile.cx,
        tile.cy,
        tile.halfW,
        tile.halfH,
        radians(
          tile.rotation
        )
      );

    if (
      satOverlap(
        cornersA,
        cornersB,
        gap
      )
    ) {
      return true;
    }
  }

  return false;
}


function getObbCorners(
  cx,
  cy,
  halfW,
  halfH,
  angleRad
) {
  const cosA =
    cos(angleRad);

  const sinA =
    sin(angleRad);

  const local = [
    [
      -halfW,
      -halfH
    ],
    [
      halfW,
      -halfH
    ],
    [
      halfW,
      halfH
    ],
    [
      -halfW,
      halfH
    ]
  ];

  return local.map(
    ([lx, ly]) => {
      return [
        cx +
          lx * cosA -
          ly * sinA,

        cy +
          lx * sinA +
          ly * cosA
      ];
    }
  );
}


function satOverlap(
  cornersA,
  cornersB,
  gap
) {
  const polygons = [
    cornersA,
    cornersB
  ];

  const safeGap =
    max(
      0,
      gap
    );

  for (
    const polygon
    of polygons
  ) {
    for (
      let i = 0;
      i < polygon.length;
      i++
    ) {
      const p1 =
        polygon[i];

      const p2 =
        polygon[
          (
            i + 1
          ) %
          polygon.length
        ];

      const edgeX =
        p2[0] -
        p1[0];

      const edgeY =
        p2[1] -
        p1[1];

      const axis =
        normalizeVector([
          -edgeY,
          edgeX
        ]);

      const [
        minA,
        maxA
      ] =
        projectPolygon(
          cornersA,
          axis
        );

      const [
        minB,
        maxB
      ] =
        projectPolygon(
          cornersB,
          axis
        );

      /*
        For no collision, polygons need to be
        separated by at least safeGap.

        At 0 px gap they can touch exactly.
      */
      if (
        maxA + safeGap <
          minB ||
        maxB + safeGap <
          minA
      ) {
        return false;
      }
    }
  }

  return true;
}


function projectPolygon(
  corners,
  axis
) {
  let minProj =
    Infinity;

  let maxProj =
    -Infinity;

  for (
    const corner
    of corners
  ) {
    const value =
      dotVector(
        corner,
        axis
      );

    minProj =
      min(
        minProj,
        value
      );

    maxProj =
      max(
        maxProj,
        value
      );
  }

  return [
    minProj,
    maxProj
  ];
}


function normalizeVector(v) {
  const length =
    sqrt(
      v[0] *
        v[0] +
      v[1] *
        v[1]
    );

  if (
    length <
    0.00001
  ) {
    return [
      0,
      0
    ];
  }

  return [
    v[0] /
      length,

    v[1] /
      length
  ];
}


function dotVector(
  a,
  b
) {
  return (
    a[0] * b[0] +
    a[1] * b[1]
  );
}


function getSettings() {
  return {
    mode:
      controls
        .packMode
        .value,

    fixedScale:
      Number(
        controls
          .fixedScale
          .value
      ) / 100,

    minScale:
      Number(
        controls
          .minScale
          .value
      ) / 100,

    maxScale:
      Number(
        controls
          .maxScale
          .value
      ) / 100,

    gap:
      max(
        0,
        Number(
          controls
            .tileGap
            .value
        )
      )
  };
}


function updateStats() {
  let area = 0;

  for (
    const placement
    of placements
  ) {
    area +=
      placement.drawW *
      placement.drawH;
  }

  const coverage =
    area /
    (
      canvasWidth *
      canvasHeight
    );

  controls
    .tileCountValue
    .textContent =
      String(
        placements.length
      );

  controls
    .coverageValue
    .textContent =
      `${round(
        coverage * 100
      )}%`;
}


function updateLabels() {
  controls
    .fixedScaleValue
    .textContent =
      `${controls.fixedScale.value}%`;

  controls
    .minScaleValue
    .textContent =
      `${controls.minScale.value}%`;

  controls
    .maxScaleValue
    .textContent =
      `${controls.maxScale.value}%`;

  controls
    .tileGapValue
    .textContent =
      `${controls.tileGap.value}px`;
}


function syncModeUI() {
  const isFixed =
    controls
      .packMode
      .value ===
    "fixed";

  controls
    .fixedControls
    .classList
    .toggle(
      "hidden",
      !isFixed
    );

  controls
    .variableControls
    .classList
    .toggle(
      "hidden",
      isFixed
    );
}


function getControls() {
  const ids = [
    "packMode",

    "fixedControls",
    "variableControls",

    "fixedScale",
    "fixedScaleValue",

    "minScale",
    "minScaleValue",

    "maxScale",
    "maxScaleValue",

    "tileGap",
    "tileGapValue",

    "tileCountValue",
    "coverageValue",

    "regenerateButton"
  ];

  for (
    const id
    of ids
  ) {
    const element =
      document
        .getElementById(
          id
        );

    if (!element) {
      throw new Error(
        `Missing interface element: ${id}`
      );
    }

    controls[id] =
      element;
  }
}


function scheduleRepack(
  delay = 40
) {
  if (
    repackTimer !==
    null
  ) {
    clearTimeout(
      repackTimer
    );
  }

  repackTimer =
    setTimeout(
      () => {
        repackTimer = null;
        repack();
      },
      delay
    );
}


function connectControls() {
  controls
    .packMode
    .addEventListener(
      "change",
      () => {
        updateLabels();
        syncModeUI();
        repack();
      }
    );

  const sliderInputs = [
    "fixedScale",
    "minScale",
    "maxScale",
    "tileGap"
  ];

  for (
    const id
    of sliderInputs
  ) {
    controls[id]
      .addEventListener(
        "input",
        () => {
          updateLabels();

          scheduleRepack();
        }
      );

    controls[id]
      .addEventListener(
        "change",
        () => {
          if (
            repackTimer !==
            null
          ) {
            clearTimeout(
              repackTimer
            );

            repackTimer =
              null;
          }

          updateLabels();
          repack();
        }
      );
  }

  controls
    .regenerateButton
    .addEventListener(
      "click",
      () => {
        packSeed =
          floor(
            random(
              1000000000
            )
          );

        repack();
      }
    );

  updateLabels();
}


function windowResized() {
  const container =
    document
      .getElementById(
        "canvas-container"
      );

  if (!container) {
    return;
  }

  const nextWidth =
    max(
      container
        .clientWidth,
      320
    );

  const nextHeight =
    round(
      nextWidth *
      9 / 16
    );

  if (
    nextWidth ===
      canvasWidth &&
    nextHeight ===
      canvasHeight
  ) {
    return;
  }

  canvasWidth =
    nextWidth;

  canvasHeight =
    nextHeight;

  resizeCanvas(
    canvasWidth,
    canvasHeight
  );

  repack();
}


function mulberry32(seed) {
  let value =
    seed >>> 0;

  return function next() {
    value +=
      0x6d2b79f5;

    let t =
      value;

    t =
      Math.imul(
        t ^
          (t >>> 15),

        t | 1
      );

    t ^=
      t +
      Math.imul(
        t ^
          (t >>> 7),

        t | 61
      );

    return (
      (
        (
          t ^
          (t >>> 14)
        ) >>> 0
      ) /
      4294967296
    );
  };
}
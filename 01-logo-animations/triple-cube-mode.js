// ============================================================
// TRIPLE CUBE MODE
// 3 cubes stacked. Phase 1: up + down separate vertically until
// corner tips touch the center cube (center stays). Phase 2:
// center moves right one full cube width. Then reveal rotation,
// then reverses back to stacked.
// ============================================================

const TripleCubeMode = (() => {
  const OUTER_COLOR = "#032932";

  function smootherstep(value) {
    const t = Math.max(
      0,
      Math.min(1, value)
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

  function getControls() {
    return (
      typeof controls !== "undefined"
        ? controls
        : window.controls
    );
  }
  // One full cube height between centers = corner/face contact.
  const VERTICAL_OFFSET = 1;

  // Center slides one full cube width toward screen-right
  // (not along the isometric grid X axis).
  const HORIZONTAL_OFFSET = 1.4;

  // Matches isometric camera azimuth in sketch.js.
  const SCREEN_RIGHT = [
    1 / Math.sqrt(2),
    0,
    -1 / Math.sqrt(2)
  ];

  const CUBES = [
    {
      id: "up",
      image: "A.png",
      // Bottom starts hidden; 180° X reveal lands on top plane.
      letterFace: "bottom",
      revealRot: [Math.PI, 0, 0]
    },

    {
      id: "down",
      image: "M.png",
      letterFace: "back",
      revealRot: [0, Math.PI, Math.PI]
    },

    {
      id: "center",
      image: "G.png",
      // Left starts hidden; 180° Y reveal lands on right plane.
      letterFace: "left",
      revealRot: [0, Math.PI, 0]
    }
  ];

  /*
   * Viewer-space corrections after the reveal rotation
   * finishes — not local face UV flips.
   */
  const VIEWER_UV_ADJUSTMENTS = {
    down: {
      flipH: true,
      flipV: true
    },

    center: {
      flipH: true,
      flipV: true,
      rotate90: 2
    }
  };

  let images = {};

  let animationState = "stackedHold";
  let stateStartTime = 0;
  let verticalSep = 0;
  let horizontalSep = 0;
  let reveal = 0;
  const uvCache = {};

  function init() {
    animationState = "stackedHold";
    stateStartTime = millis();
    verticalSep = 0;
    horizontalSep = 0;
    reveal = 0;
    Object.keys(uvCache).forEach(
      key => delete uvCache[key]
    );
    loadImages();
  }

  function loadImages() {
    for (const cube of CUBES) {
      loadImage(
        cube.image,

        img => {
          images[cube.id] = img;
        },

        () => {
          console.warn(
            `Could not load triple-cube image: ${cube.image}`
          );
        }
      );
    }
  }

  function restart() {
    init();
  }

  function getMoveDuration() {
    const ui = getControls();

    return 1 / Number(
      ui.animationSpeed.value
    );
  }

  function getStackedPause() {
    return Number(
      getControls().foldedPause.value
    );
  }

  function getSeparatedPause() {
    return Number(
      getControls().unfoldedPause.value
    );
  }

  function getRevealedPause() {
    const ui = getControls();

    return Number(
      ui.revealedPause
        ? ui.revealedPause.value
        : ui.unfoldedPause.value
    );
  }

  function update() {
    const now = millis();
    const elapsed = (now - stateStartTime) / 1000;
    const moveDuration = getMoveDuration();

    if (animationState === "stackedHold") {
      verticalSep = 0;
      horizontalSep = 0;
      reveal = 0;

      if (elapsed >= getStackedPause()) {
        animationState = "separatingVertical";
        stateStartTime = now;
      }

      return;
    }

    if (animationState === "separatingVertical") {
      const t = constrain(
        elapsed / moveDuration,
        0,
        1
      );

      verticalSep = smootherstep(t);
      horizontalSep = 0;
      reveal = 0;

      if (t >= 1) {
        verticalSep = 1;
        animationState = "separatingHorizontal";
        stateStartTime = now;
      }

      return;
    }

    if (animationState === "separatingHorizontal") {
      const t = constrain(
        elapsed / moveDuration,
        0,
        1
      );

      verticalSep = 1;
      horizontalSep = smootherstep(t);
      reveal = 0;

      if (t >= 1) {
        horizontalSep = 1;
        animationState = "separatedHold";
        stateStartTime = now;
      }

      return;
    }

    if (animationState === "separatedHold") {
      verticalSep = 1;
      horizontalSep = 1;
      reveal = 0;

      if (elapsed >= getSeparatedPause()) {
        animationState = "rotating";
        stateStartTime = now;
      }

      return;
    }

    if (animationState === "rotating") {
      const t = constrain(
        elapsed / moveDuration,
        0,
        1
      );

      verticalSep = 1;
      horizontalSep = 1;
      reveal = smootherstep(t);

      if (t >= 1) {
        reveal = 1;
        animationState = "revealedHold";
        stateStartTime = now;
      }

      return;
    }

    if (animationState === "revealedHold") {
      verticalSep = 1;
      horizontalSep = 1;
      reveal = 1;

      if (elapsed >= getRevealedPause()) {
        animationState = "unrotating";
        stateStartTime = now;
      }

      return;
    }

    if (animationState === "unrotating") {
      const t = constrain(
        elapsed / moveDuration,
        0,
        1
      );

      verticalSep = 1;
      horizontalSep = 1;
      reveal = 1 - smootherstep(t);

      if (t >= 1) {
        reveal = 0;
        animationState = "collapsingHorizontal";
        stateStartTime = now;
      }

      return;
    }

    if (animationState === "collapsingHorizontal") {
      const t = constrain(
        elapsed / moveDuration,
        0,
        1
      );

      verticalSep = 1;
      horizontalSep = 1 - smootherstep(t);
      reveal = 0;

      if (t >= 1) {
        horizontalSep = 0;
        animationState = "collapsingVertical";
        stateStartTime = now;
      }

      return;
    }

    if (animationState === "collapsingVertical") {
      const t = constrain(
        elapsed / moveDuration,
        0,
        1
      );

      verticalSep = 1 - smootherstep(t);
      horizontalSep = 0;
      reveal = 0;

      if (t >= 1) {
        verticalSep = 0;
        animationState = "stackedHold";
        stateStartTime = now;
      }
    }
  }

  function getCubePosition(
    cube,
    size
  ) {
    const vertical =
      size *
      VERTICAL_OFFSET;

    if (cube.id === "up") {
      return [
        0,
        -vertical * verticalSep,
        0
      ];
    }

    if (cube.id === "down") {
      return [
        0,
        vertical * verticalSep,
        0
      ];
    }

    const horizontal =
      size *
      HORIZONTAL_OFFSET *
      horizontalSep;

    // Center: stays put during phase 1, then moves screen-right.
    return [
      SCREEN_RIGHT[0] * horizontal,
      SCREEN_RIGHT[1] * horizontal,
      SCREEN_RIGHT[2] * horizontal
    ];
  }

  function getCubeRotation(cube) {
    return {
      x: reveal * cube.revealRot[0],
      y: reveal * cube.revealRot[1],
      z: reveal * cube.revealRot[2]
    };
  }

  function shouldDrawAsSingleCube() {
    return animationState === "stackedHold";
  }

  function draw(size) {
    if (shouldDrawAsSingleCube()) {
      drawCube(
        0,
        0,
        0,
        size,
        { x: 0, y: 0, z: 0 },
        null,
        null
      );
      return;
    }

    const showImages =
      reveal > 0.001;

    const drawOrder = [
      "down",
      "center",
      "up"
    ];

    for (const id of drawOrder) {
      const cube = CUBES.find(
        entry => entry.id === id
      );

      const position =
        getCubePosition(
          cube,
          size
        );

      drawCube(
        position[0],
        position[1],
        position[2],
        size,
        getCubeRotation(cube),
        showImages
          ? images[cube.id]
          : null,
        cube
      );
    }
  }

  function getFaceCorners(
    h,
    faceId
  ) {
    const faces = {
      front: [
        [-h, -h, h],
        [h, -h, h],
        [h, h, h],
        [-h, h, h]
      ],

      back: [
        [h, -h, -h],
        [-h, -h, -h],
        [-h, h, -h],
        [h, h, -h]
      ],

      right: [
        [h, -h, h],
        [h, -h, -h],
        [h, h, -h],
        [h, h, h]
      ],

      left: [
        [-h, -h, -h],
        [-h, -h, h],
        [-h, h, h],
        [-h, h, -h]
      ],

      top: [
        [-h, -h, -h],
        [h, -h, -h],
        [h, -h, h],
        [-h, -h, h]
      ],

      bottom: [
        [-h, h, h],
        [h, h, h],
        [h, h, -h],
        [-h, h, -h]
      ]
    };

    return faces[faceId];
  }

  function rotatePointX(
    point,
    angle
  ) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = point[0];
    const y = point[1];
    const z = point[2];

    return [
      x,
      y * cos - z * sin,
      y * sin + z * cos
    ];
  }

  function rotatePointY(
    point,
    angle
  ) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = point[0];
    const y = point[1];
    const z = point[2];

    return [
      x * cos + z * sin,
      y,
      -x * sin + z * cos
    ];
  }

  function rotatePointZ(
    point,
    angle
  ) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = point[0];
    const y = point[1];
    const z = point[2];

    return [
      x * cos - y * sin,
      x * sin + y * cos,
      z
    ];
  }

  function applyCubeRotation(
    point,
    rotation
  ) {
    let result = point;

    result = rotatePointY(
      result,
      rotation.y
    );

    result = rotatePointZ(
      result,
      rotation.z
    );

    result = rotatePointX(
      result,
      rotation.x
    );

    return result;
  }

  function worldToScreenOffset(
    x,
    y,
    z
  ) {
    const invSqrt2 =
      1 / Math.sqrt(2);

    const invSqrt6 =
      1 / Math.sqrt(6);

    const sqrtTwoThirds =
      Math.sqrt(2 / 3);

    return {
      x: (x - z) * invSqrt2,
      y:
        x * invSqrt6 +
        y * sqrtTwoThirds +
        z * invSqrt6
    };
  }

  function addPoints(a, b) {
    return [
      a[0] + b[0],
      a[1] + b[1],
      a[2] + b[2]
    ];
  }

  function normalize2D(vector) {
    const length = Math.hypot(
      vector[0],
      vector[1]
    );

    if (length < 0.0001) {
      return [0, 0];
    }

    return [
      vector[0] / length,
      vector[1] / length
    ];
  }

  function buildSquareUVCandidates() {
    const base = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1]
    ];

    const candidates = [];

    for (
      let mirrored = 0;
      mirrored <= 1;
      mirrored++
    ) {
      for (
        let turns = 0;
        turns < 4;
        turns++
      ) {
        let uv = base.map(
          ([x, y]) => [x, y]
        );

        if (mirrored) {
          uv = uv.map(
            ([x, y]) => [1 - x, y]
          );
        }

        for (
          let i = 0;
          i < turns;
          i++
        ) {
          uv = uv.map(
            ([x, y]) => [y, 1 - x]
          );
        }

        candidates.push(uv);
      }
    }

    return candidates;
  }

  function getScreenAxesForUV(
    screenCorners,
    uv
  ) {
    let u0 = [0, 0];
    let u1 = [0, 0];
    let v0 = [0, 0];
    let v1 = [0, 0];
    let u0Count = 0;
    let u1Count = 0;
    let v0Count = 0;
    let v1Count = 0;

    for (let i = 0; i < 4; i++) {
      const point = screenCorners[i];

      if (uv[i][0] < 0.5) {
        u0 = [
          u0[0] + point[0],
          u0[1] + point[1]
        ];
        u0Count++;
      }

      else {
        u1 = [
          u1[0] + point[0],
          u1[1] + point[1]
        ];
        u1Count++;
      }

      if (uv[i][1] < 0.5) {
        v0 = [
          v0[0] + point[0],
          v0[1] + point[1]
        ];
        v0Count++;
      }

      else {
        v1 = [
          v1[0] + point[0],
          v1[1] + point[1]
        ];
        v1Count++;
      }
    }

    u0 = [
      u0[0] / u0Count,
      u0[1] / u0Count
    ];

    u1 = [
      u1[0] / u1Count,
      u1[1] / u1Count
    ];

    v0 = [
      v0[0] / v0Count,
      v0[1] / v0Count
    ];

    v1 = [
      v1[0] / v1Count,
      v1[1] / v1Count
    ];

    return {
      right: normalize2D([
        u1[0] - u0[0],
        u1[1] - u0[1]
      ]),

      down: normalize2D([
        v1[0] - v0[0],
        v1[1] - v0[1]
      ])
    };
  }

  function applyViewerScreenAdjustment(
    axes,
    adjustment
  ) {
    if (!adjustment) {
      return axes;
    }

    let right = [...axes.right];
    let down = [...axes.down];

    if (adjustment.flipH) {
      right[0] *= -1;
    }

    if (adjustment.flipV) {
      down[1] *= -1;
    }

    const turns =
      adjustment.rotate90 || 0;

    if (turns > 0) {
      for (
        let i = 0;
        i < turns % 4;
        i++
      ) {
        const nextRight = [...down];
        const nextDown = [
          -right[0],
          -right[1]
        ];
        right = nextRight;
        down = nextDown;
      }
    }

    else if (turns < 0) {
      for (
        let i = 0;
        i < ((-turns) % 4);
        i++
      ) {
        const nextRight = [
          -down[0],
          -down[1]
        ];
        const nextDown = [...right];
        right = nextRight;
        down = nextDown;
      }
    }

    return {
      right: normalize2D(right),
      down: normalize2D(down)
    };
  }

  function computeViewerLockedUVs(
    cube,
    position,
    size
  ) {
    const h = size * 0.5;
    const corners =
      getFaceCorners(
        h,
        cube.letterFace
      );

    const rotation = {
      x: cube.revealRot[0],
      y: cube.revealRot[1],
      z: cube.revealRot[2]
    };

    const screenCorners =
      corners.map(local => {
        const world = addPoints(
          applyCubeRotation(
            local,
            rotation
          ),
          position
        );

        const screen =
          worldToScreenOffset(
            world[0],
            world[1],
            world[2]
          );

        return [screen.x, screen.y];
      });

    const natural =
      getScreenAxesForUV(
        screenCorners,
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1]
        ]
      );

    const target =
      applyViewerScreenAdjustment(
        natural,
        VIEWER_UV_ADJUSTMENTS[
          cube.id
        ]
      );

    let bestUV = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1]
    ];

    let bestScore = -Infinity;

    for (const uv of buildSquareUVCandidates()) {
      const axes =
        getScreenAxesForUV(
          screenCorners,
          uv
        );

      const score =
        axes.right[0] *
          target.right[0] +
        axes.right[1] *
          target.right[1] +
        axes.down[0] *
          target.down[0] +
        axes.down[1] *
          target.down[1];

      if (score > bestScore) {
        bestScore = score;
        bestUV = uv;
      }
    }

    return bestUV;
  }

  function getCachedCubeUVs(
    cube,
    position,
    size
  ) {
    const key =
      cube.id +
      "|" +
      size.toFixed(2) +
      "|" +
      position[0].toFixed(2) +
      "|" +
      position[1].toFixed(2) +
      "|" +
      position[2].toFixed(2);

    if (!uvCache[key]) {
      uvCache[key] =
        computeViewerLockedUVs(
          cube,
          position,
          size
        );
    }

    return uvCache[key];
  }

  function drawCube(
    cx,
    cy,
    cz,
    size,
    rotation,
    letterImage,
    cube
  ) {
    const letterUVs =
      cube && letterImage
        ? getCachedCubeUVs(
            cube,
            [cx, cy, cz],
            size
          )
        : null;

    push();

    translate(
      cx,
      cy,
      cz
    );

    rotateY(rotation.y);
    rotateZ(rotation.z);
    rotateX(rotation.x);

    const h = size * 0.5;

    const faces = [
      {
        id: "front",
        corners: [
          [-h, -h, h],
          [h, -h, h],
          [h, h, h],
          [-h, h, h]
        ]
      },

      {
        id: "back",
        corners: [
          [h, -h, -h],
          [-h, -h, -h],
          [-h, h, -h],
          [h, h, -h]
        ]
      },

      {
        id: "right",
        corners: [
          [h, -h, h],
          [h, -h, -h],
          [h, h, -h],
          [h, h, h]
        ]
      },

      {
        id: "left",
        corners: [
          [-h, -h, -h],
          [-h, -h, h],
          [-h, h, h],
          [-h, h, -h]
        ]
      },

      {
        id: "top",
        corners: [
          [-h, -h, -h],
          [h, -h, -h],
          [h, -h, h],
          [-h, -h, h]
        ]
      },

      {
        id: "bottom",
        corners: [
          [-h, h, h],
          [h, h, h],
          [h, h, -h],
          [-h, h, -h]
        ]
      }
    ];

    for (const face of faces) {
      if (
        letterImage &&
        cube &&
        face.id === cube.letterFace
      ) {
        drawTexturedQuad(
          face.corners,
          letterImage,
          letterUVs
        );
      }

      else {
        drawSolidQuad(
          face.corners,
          OUTER_COLOR
        );
      }
    }

    pop();
  }

  function drawSolidQuad(
    corners,
    faceColor
  ) {
    push();

    noStroke();
    fill(faceColor);

    beginShape(QUADS);

    for (const p of corners) {
      vertex(
        p[0],
        p[1],
        p[2]
      );
    }

    endShape(CLOSE);

    pop();
  }

  function drawTexturedQuad(
    corners,
    img,
    uvs
  ) {
    push();

    noStroke();
    texture(img);

    beginShape(QUADS);

    for (
      let i = 0;
      i < 4;
      i++
    ) {
      vertex(
        corners[i][0],
        corners[i][1],
        corners[i][2],
        uvs[i][0],
        uvs[i][1]
      );
    }

    endShape(CLOSE);

    pop();
  }

  return {
    init,
    update,
    draw,
    restart,
    loadImages
  };
})();

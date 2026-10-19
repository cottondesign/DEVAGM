// ============================================================
// LOGO CUBE UNFOLD
// ============================================================

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

const OUTER_COLOR = "#032932";

const PAGE_BACKGROUND_LIGHT =
  "#FEF9F3";

// Non-logo exterior shell when colorful insides are on (matches face PNG bg).
const SHELL_EXTERIOR_COLOR =
  PAGE_BACKGROUND_LIGHT;

const DARK_MODE_SHELL_COLOR =
  "#012131";
const DARK_MODE_PAGE_BACKGROUND =
  PAGE_BACKGROUND_LIGHT;
const PAGE_BACKGROUND_DARK =
  "#08303A";

/*
 * Slightly lower isometric tilt + vertical stretch so square
 * face art reads taller on screen (less “squashed” at this angle).
 */
const ISO_ELEVATION_DENOM = 1.72;
const ISO_VERTICAL_STRETCH = 1.05;

const PANEL_FACE_SEPARATION = 0.28;

// Tiny in-plane grow for folded cream shell panels (not logo PNGs).
const FOLDED_SOLID_PLANE_EXPAND = 1.004;

// Inner random picks exclude the exterior teal so faces read clearly.
const INNER_PALETTE = PALETTE.filter(
  hex => hex !== OUTER_COLOR
);

const INNER_PALETTE_EXCLUDED_DARKS = [
  "#032932",
  "#03323C",
  "#0A4552",
  "#235C58"
];

// 11 cube nets
const CUBE_NETS = [
    [[0,0],[0,1],[1,1],[1,2],[2,1],[3,1]],
    [[0,0],[0,1],[1,1],[2,1],[2,2],[3,1]],
    [[0,1],[1,0],[1,1],[1,2],[1,3],[2,1]],
    [[0,0],[0,1],[0,2],[1,1],[2,1],[3,1]],
    [[0,1],[1,0],[1,1],[1,2],[1,3],[2,2]],
    [[0,0],[0,1],[1,1],[1,2],[2,2],[2,3]],
    [[0,0],[0,1],[0,2],[1,2],[1,3],[1,4]],
    [[0,0],[0,1],[1,1],[1,2],[1,3],[2,1]],
    [[0,0],[0,1],[1,1],[1,2],[1,3],[2,2]],
    [[0,0],[0,1],[1,1],[2,1],[3,1],[3,2]],
    [[0,0],[0,1],[1,1],[1,2],[1,3],[2,3]]
  ];
  
  // ============================================================
  // IMAGES
  // ============================================================
  
  let faceImages = {
    top: null,   // a.png
    left: null,  // g.png
    right: null  // m.png
  };
  
  const DEFAULT_FACE_IMAGES = {
    top: "a.png",
    left: "g.png",
    right: "m.png"
  };

  const DARK_FACE_IMAGES = {
    top: "A-darkbg.png",
    left: "G-darkbg.png",
    right: "M-darkbg.png"
  };
  
  // ============================================================
  // LOCKED LOGO ORIENTATION
  // ============================================================
  //
  // These are fixed WORLD directions for the PNG artwork when
  // the cube is folded.
  //
  // The important part: these DO NOT change from net to net.
  // The code finds the UV mapping that matches these directions,
  // then that PNG rides with that square like ink printed on cardboard.
  //
  // Requested PNG adjustments (applied after locked
  // world orientation is resolved):
  // M = flip horizontal
  // G = flip vertical
  // A = flip horizontal, then flip top and bottom,
  // then flip horizontal again
  const FACE_UV_ADJUSTMENTS = {
    right: {
      flipH: true,
      flipV: false
    },

    left: {
      flipH: false,
      flipV: true
    },

    top: {
      flipH: false,
      flipV: true
    }
  };

  const FACE_WORLD_ORIENTATION = {
    left: {
      right: [1, 0, 0],
      down: [0, -1, 0]
    },
  
    right: {
      right: [0, 0, 1],
      down: [0, 1, 0]
    },
  
    top: {
      right: [1, 0, 0],
      down: [0, 0, -1]
    }
  };
  
  // ============================================================
  // STATE
  // ============================================================
  
  let currentNetIndex = 0;
  let currentNet;
  
  let progress = 1;
  // 0 = fully unfolded
  // 1 = fully folded
  
  let animationState = "foldedHold";
  let stateStartTime = 0;
  let unfoldStateElapsed = 0;

  let logoExporting = false;
  const LOGO_EXPORT_FPS = 30;

  const LOGO_EXPORT_AVC_LEVELS = [
    {
      codec: "avc1.42001f",
      maxCodedArea: 921600
    },
    {
      codec: "avc1.420028",
      maxCodedArea: 2097152
    },
    {
      codec: "avc1.420033",
      maxCodedArea: 8912896
    }
  ];

  let logoExportCaptureCanvas = null;
  
  let controls = {};

let panelInnerColors = [];
  
  // ============================================================
  // SETUP
  // ============================================================
  
  function setup() {
    const container = document.getElementById("canvas-container");

    setAttributes(
      "preserveDrawingBuffer",
      true
    );
  
    const canvas = createCanvas(
      container.clientWidth,
      container.clientHeight,
      WEBGL
    );
  
    canvas.parent("canvas-container");
  
    pixelDensity(1);
    textureMode(NORMAL);
  
    getControls();
    connectControls();
    applyPageBackgroundTheme();
    updateModePanels();
  
    currentNet = prepareNet(CUBE_NETS[currentNetIndex]);
    assignRandomInnerColors(currentNet.faces.length);

    progress = 1;
    animationState = "foldedHold";
    stateStartTime = millis();
  
    loadDefaultFaceAssets();
    TripleCubeMode.init();
    updateLabels();
  }
  
  // ============================================================
  // DRAW
  // ============================================================
  
  function draw() {
    if (logoExporting) {
      return;
    }

    renderLogoScene();
  }

  function renderLogoScene() {
    background(
      getPageBackgroundColor()
    );
  
    const size = Number(controls.cubeSize.value);
  
    setIsometricCamera();

    push();
    applyIsometricVerticalStretch();

    if (isTripleMode()) {
      if (!logoExporting) {
        TripleCubeMode.update();
      }

      if (controls.showGridTriple.checked) {
        drawGrid(size);
      }

      TripleCubeMode.draw(size);
      pop();
      return;
    }

    if (!logoExporting) {
      updateAnimation();
    }
  
    if (controls.showGrid.checked) {
      drawGrid(size);
    }
  
    drawCubeNet(currentNet, size, progress);
    pop();
  }

  function applyIsometricVerticalStretch() {
    scale(1, ISO_VERTICAL_STRETCH, 1);
  }

  function isTripleMode() {
    return controls.animationMode.value === "triple";
  }
  
  // ============================================================
  // ANIMATION
  // ============================================================
  
  function updateAnimation() {
    const now = millis();
    const elapsed = (now - stateStartTime) / 1000;
  
    const speed = Number(controls.animationSpeed.value);
    const moveDuration = 1 / speed;
  
    const foldedPause = Number(controls.foldedPause.value);
    const unfoldedPause = Number(controls.unfoldedPause.value);
  
    if (animationState === "foldedHold") {
      progress = 1;
  
      if (elapsed >= foldedPause) {
        maybeRandomizeInnerColorsOnUnfold();

        animationState = "unfolding";
        stateStartTime = now;
      }
  
      return;
    }
  
    if (animationState === "unfolding") {
      const t = constrain(elapsed / moveDuration, 0, 1);
  
      progress = 1 - applyMotionCurve(t);
  
      if (t >= 1) {
        progress = 0;
  
        animationState = "unfoldedHold";
        stateStartTime = now;
      }
  
      return;
    }
  
    if (animationState === "unfoldedHold") {
      progress = 0;
  
      if (elapsed >= unfoldedPause) {
        animationState = "folding";
        stateStartTime = now;
      }
  
      return;
    }
  
    if (animationState === "folding") {
      const t = constrain(elapsed / moveDuration, 0, 1);
  
      progress = applyMotionCurve(t);
  
      if (t >= 1) {
        progress = 1;
  
        // Only switch net when fully folded.
        chooseNewNet();
  
        animationState = "foldedHold";
        stateStartTime = now;
      }
    }
  }

  function resetUnfoldStateElapsed() {
    unfoldStateElapsed = 0;
  }

  function advanceUnfoldAnimation(deltaSec) {
    let remaining = deltaSec;

    while (remaining > 1e-9) {
      remaining -=
        stepUnfoldAnimationOnce(
          remaining
        );
    }
  }

  function stepUnfoldAnimationOnce(dt) {
    const speed =
      Number(
        controls.animationSpeed.value
      );
    const moveDuration =
      1 / speed;
    const foldedPause =
      Number(
        controls.foldedPause.value
      );
    const unfoldedPause =
      Number(
        controls.unfoldedPause.value
      );

    if (
      animationState ===
      "foldedHold"
    ) {
      progress = 1;

      const need =
        foldedPause -
        unfoldStateElapsed;

      if (dt < need) {
        unfoldStateElapsed += dt;
        return dt;
      }

      const used = need;

      unfoldStateElapsed = 0;

      maybeRandomizeInnerColorsOnUnfold();

      animationState =
        "unfolding";

      if (dt - used <= 1e-9) {
        return used;
      }

      return (
        used +
        stepUnfoldAnimationOnce(
          dt - used
        )
      );
    }

    if (
      animationState ===
      "unfolding"
    ) {
      const after =
        unfoldStateElapsed + dt;

      if (
        after <
        moveDuration
      ) {
        unfoldStateElapsed =
          after;

        progress =
          1 -
          applyMotionCurve(
            unfoldStateElapsed /
              moveDuration
          );

        return dt;
      }

      const used =
        moveDuration -
        unfoldStateElapsed;

      unfoldStateElapsed = 0;
      progress = 0;
      animationState =
        "unfoldedHold";

      if (dt - used <= 1e-9) {
        return dt;
      }

      return (
        used +
        stepUnfoldAnimationOnce(
          dt - used
        )
      );
    }

    if (
      animationState ===
      "unfoldedHold"
    ) {
      progress = 0;

      const need =
        unfoldedPause -
        unfoldStateElapsed;

      if (dt < need) {
        unfoldStateElapsed += dt;
        return dt;
      }

      const used = need;

      unfoldStateElapsed = 0;
      animationState =
        "folding";

      if (dt - used <= 1e-9) {
        return used;
      }

      return (
        used +
        stepUnfoldAnimationOnce(
          dt - used
        )
      );
    }

    if (
      animationState ===
      "folding"
    ) {
      const after =
        unfoldStateElapsed + dt;

      if (
        after <
        moveDuration
      ) {
        unfoldStateElapsed =
          after;

        progress =
          applyMotionCurve(
            unfoldStateElapsed /
              moveDuration
          );

        return dt;
      }

      const used =
        moveDuration -
        unfoldStateElapsed;

      unfoldStateElapsed = 0;
      progress = 1;
      chooseNewNet();
      animationState =
        "foldedHold";

      if (dt - used <= 1e-9) {
        return dt;
      }

      return (
        used +
        stepUnfoldAnimationOnce(
          dt - used
        )
      );
    }

    return dt;
  }
  
  // ============================================================
  // NET PICKER
  // ============================================================
  
  function chooseNewNet() {
    let next = currentNetIndex;
  
    while (next === currentNetIndex) {
      next = floor(random(CUBE_NETS.length));
    }
  
    currentNetIndex = next;
    currentNet = prepareNet(CUBE_NETS[currentNetIndex]);
  }
  
  // ============================================================
  // DRAW CUBE / NET
  // ============================================================
  
  function drawCubeNet(
    net,
    size,
    globalProgress
  ) {
    const faceProgress =
      getSequentialFoldProgress(
        net,
        globalProgress
      );
  
    const transforms =
      buildConnectedFaceTransforms(
        net,
        0,
        0,
        size,
        childIndex => {
          return (
            HALF_PI *
            faceProgress[childIndex]
          );
        }
      );
  
    // Center current moving object.
    centerTransforms(transforms);
  
    // Make a completely folded reference of THIS net.
    //
    // This reference never animates.
    //
    // We use it only to determine:
    // 1. which panel becomes top / left / right
    // 2. which material side is exterior
    // 3. what the permanent PNG UV mapping should be
    const foldedTransforms =
      buildConnectedFaceTransforms(
        net,
        0,
        0,
        size,
        HALF_PI
      );
  
    centerTransforms(foldedTransforms);
  
    const roles =
      classifyLogoFaces(
        foldedTransforms
      );
  
    for (
      let i = 0;
      i < transforms.length;
      i++
    ) {
      drawPanel(
        transforms[i],
        foldedTransforms[i],
        size,
        roles[i] || null,
        i
      );
    }
  }
  
  // ============================================================
  // FACE ROLE CLASSIFICATION
  // ============================================================
  //
  // Folded cube:
  //
  // smallest Y = top
  // largest X = right
  // largest Z = left
  //
  function classifyLogoFaces(
    transforms
  ) {
    const result =
      new Array(
        transforms.length
      ).fill(null);
  
    let topIndex = -1;
    let rightIndex = -1;
    let leftIndex = -1;
  
    let minY = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
  
    // TOP
    for (
      let i = 0;
      i < transforms.length;
      i++
    ) {
      const c =
        transforms[i].center;
  
      if (c[1] < minY) {
        minY = c[1];
        topIndex = i;
      }
    }
  
    // LEFT + RIGHT
    for (
      let i = 0;
      i < transforms.length;
      i++
    ) {
      if (i === topIndex) {
        continue;
      }
  
      const c =
        transforms[i].center;
  
      if (c[0] > maxX) {
        maxX = c[0];
        rightIndex = i;
      }
  
      if (c[2] > maxZ) {
        maxZ = c[2];
        leftIndex = i;
      }
    }
  
    if (topIndex >= 0) {
      result[topIndex] =
        "top";
    }
  
    if (
      rightIndex >= 0 &&
      rightIndex !== topIndex
    ) {
      result[rightIndex] =
        "right";
    }
  
    if (
      leftIndex >= 0 &&
      leftIndex !== topIndex &&
      leftIndex !== rightIndex
    ) {
      result[leftIndex] =
        "left";
    }
  
    return result;
  }
  
  // ============================================================
  // DRAW PANEL
  // ============================================================
  //
  // Think of each square as a piece of cardboard:
  //
  // ONE MATERIAL SIDE = logo / outside
  // OTHER MATERIAL SIDE = solid color / inside
  //
  // Those sides NEVER swap during animation.
  //
  function drawPanel(
    transform,
    foldedTransform,
    size,
    role,
    panelIndex
  ) {
    const half =
      size * 0.5;
  
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
  
    // IMPORTANT:
    // Both material sides keep this exact same corner order.
    //
    // We NEVER reverse the PNG's corner order.
    //
    // Reversing corners was one reason textures appeared to
    // suddenly mirror/rotate.
    const corners = [
      addVectors(
        addVectors(
          transform.center,
          scaleVector(
            u,
            -1
          )
        ),
  
        scaleVector(
          v,
          -1
        )
      ),
  
      addVectors(
        addVectors(
          transform.center,
          u
        ),
  
        scaleVector(
          v,
          -1
        )
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
          scaleVector(
            u,
            -1
          )
        ),
  
        v
      )
    ];
  
    const normal =
      normalizeVector(
        transform.normal
      );
  
    const foldedNormal =
      normalizeVector(
        foldedTransform.normal
      );
  
    const useRandomInner =
      controls.randomInnerColors.checked;

    const insideColor =
      getPanelInsideColor(panelIndex);

    const exteriorColor =
      useRandomInner
        ? getShellExteriorColor()
        : insideColor;

    const outwardDirection =
      normalizeVector(
        foldedTransform.center
      );

    const positiveSideIsExterior =
      dotVectors(
        foldedNormal,
        outwardDirection
      ) >= 0;

    const image =
      role
        ? faceImages[role]
        : null;

    const separation =
      PANEL_FACE_SEPARATION;

    // Material side along +normal.
    const positiveSide =
      offsetCorners(
        corners,
        normal,
        separation
      );
  
    // Material side along -normal.
    const negativeSide =
      offsetCorners(
        corners,
        scaleVector(
          normal,
          -1
        ),
        separation
      );
  
    const foldedSeamFix =
      shouldUseFoldedSeamFix(
        useRandomInner
      );

    // Non-logo panels: exterior shell + interior color.
    if (!image) {
      if (foldedSeamFix) {
        const exteriorCorners =
          positiveSideIsExterior
            ? positiveSide
            : negativeSide;

        drawFoldedExteriorSolid(
          exteriorCorners,
          exteriorColor
        );
      }

      else if (positiveSideIsExterior) {
        drawSolidFace(
          positiveSide,
          exteriorColor
        );

        drawSolidFace(
          negativeSide,
          insideColor
        );
      }

      else {
        drawSolidFace(
          positiveSide,
          insideColor
        );

        drawSolidFace(
          negativeSide,
          exteriorColor
        );
      }

      return;
    }
  
    // ----------------------------------------------------------
    // WHICH MATERIAL SIDE IS OUTSIDE?
    // ----------------------------------------------------------
    //
    // Determine this ONLY from the fully folded reference.
    //
    // It does NOT change during animation.
    //
    if (foldedSeamFix) {
      const exteriorCorners =
        positiveSideIsExterior
          ? positiveSide
          : negativeSide;

      drawTexturedFace(
        exteriorCorners,
        image,
        role,
        foldedTransform
      );

      return;
    }

    if (positiveSideIsExterior) {
      // OUTSIDE = PNG
      drawTexturedFace(
        positiveSide,
        image,
        role,
        foldedTransform
      );
  
      // INSIDE = solid
      drawSolidFace(
        negativeSide,
        insideColor
      );
    }
  
    else {
      // INSIDE = solid
      drawSolidFace(
        positiveSide,
        insideColor
      );
  
      // OUTSIDE = PNG
      drawTexturedFace(
        negativeSide,
        image,
        role,
        foldedTransform
      );
    }
  }

  function shouldUseFoldedSeamFix(
    useRandomInner
  ) {
    if (!useRandomInner) {
      return false;
    }

    if (progress < 0.998) {
      return false;
    }

    return (
      animationState ===
        "foldedHold" ||
      animationState ===
        "folding" ||
      animationState ===
        "unfolding"
    );
  }

  function drawFoldedExteriorSolid(
    exteriorCorners,
    exteriorColor
  ) {
    drawSolidFace(
      expandCornersInPlane(
        exteriorCorners,
        FOLDED_SOLID_PLANE_EXPAND
      ),
      exteriorColor
    );
  }

  // ============================================================
  // INNER COLORS
  // ============================================================

  function maybeRandomizeInnerColorsOnUnfold() {
    if (
      !controls.randomInnerColors.checked
    ) {
      return;
    }

    assignRandomInnerColors(
      currentNet.faces.length
    );
  }

  function shuffleArray(items) {
    const array =
      items.slice();

    for (
      let i =
        array.length - 1;
      i > 0;
      i--
    ) {
      const j =
        floor(
          random(
            i + 1
          )
        );
      const swap =
        array[i];

      array[i] =
        array[j];
      array[j] =
        swap;
    }

    return array;
  }

  function createVariationSeed(
    index
  ) {
    return (
      (Date.now() ^
        Math.imul(
          index + 1,
          2654435761
        )) >>>
      0
    );
  }

  function randomizeInnerLayout() {
    controls.randomInnerColors.checked =
      true;
    updateInsideColorControl();

    assignRandomInnerColors(
      currentNet.faces.length
    );

    if (!logoExporting) {
      restartAnimation();
    }
  }

  function getActiveInnerPalette() {
    let pool =
      INNER_PALETTE.slice();

    if (
      controls
        .excludeDarkTealsFromInner
        .checked
    ) {
      const excluded =
        new Set(
          INNER_PALETTE_EXCLUDED_DARKS.map(
            hex =>
              hex.toUpperCase()
          )
        );

      pool =
        pool.filter(
          hex =>
            !excluded.has(
              hex.toUpperCase()
            )
        );
    }

    if (!pool.length) {
      pool =
        INNER_PALETTE.slice();
    }

    return pool;
  }

  function assignRandomInnerColors(
    panelCount
  ) {
    const shuffled =
      shuffleArray(
        getActiveInnerPalette()
      );

    panelInnerColors =
      shuffled.slice(
        0,
        panelCount
      );
  }

  function getPanelInsideColor(
    panelIndex
  ) {
    if (
      controls.randomInnerColors.checked &&
      panelInnerColors[panelIndex]
    ) {
      return panelInnerColors[panelIndex];
    }

    return controls.insideColor.value;
  }

  function updateInsideColorControl() {
    controls.insideColor.disabled =
      controls.randomInnerColors.checked;
  }

  // ============================================================
  // SOLID FACE
  // ============================================================
  
  function drawSolidFace(
    corners,
    faceColor
  ) {
    push();
  
    noStroke();
    fill(faceColor);
  
    beginShape(QUADS);
  
    for (
      const p
      of corners
    ) {
      vertex(
        p[0],
        p[1],
        p[2]
      );
    }
  
    endShape(CLOSE);
  
    pop();
  }
  
  // ============================================================
  // TEXTURED FACE
  // ============================================================
  
  function drawTexturedFace(
    corners,
    img,
    role,
    foldedTransform
  ) {
    push();
  
    noStroke();
  
    texture(img);
  
    // This is calculated ONLY from the fully folded reference.
    //
    // The current animated transform is deliberately NOT used.
    const uv =
      applyFaceUVAdjustment(
        getLockedFaceUVs(
          role,
          foldedTransform
        ),
        role
      );
  
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
  
        uv[i][0],
        uv[i][1]
      );
    }
  
    endShape(CLOSE);
  
    pop();
  }
  
  // ============================================================
  // PERMANENT / LOCKED PNG ORIENTATION
  // ============================================================
  //
  // There are only 8 possible ways a square image can be placed
  // onto a square plane:
  //
  // 4 rotations
  // ×
  // mirrored or not mirrored
  //
  // We test those 8 possibilities and choose whichever one matches
  // the FIXED world-space orientation defined at the top.
  //
  // This gives us:
  //
  // G:
  // image right = world +X
  // image down  = world -Y
  //
  // M:
  // image right = world +Z
  // image down  = world +Y
  //
  // A:
  // image right = world +X
  // image down  = world -Z
  //
  // Then per-letter UV flips are applied (see
  // FACE_UV_ADJUSTMENTS above).
  //
  function getLockedFaceUVs(
    role,
    foldedTransform
  ) {
    const target =
      FACE_WORLD_ORIENTATION[role];
  
    if (!target) {
      return [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1]
      ];
    }
  
    const candidates =
      buildSquareUVCandidates();
  
    let bestUV =
      candidates[0];
  
    let bestScore =
      -Infinity;
  
    for (
      const uv
      of candidates
    ) {
      const axes =
        getWorldAxesForUV(
          foldedTransform,
          uv
        );
  
      const score =
        dotVectors(
          axes.right,
          target.right
        ) +
  
        dotVectors(
          axes.down,
          target.down
        );
  
      if (
        score >
        bestScore
      ) {
        bestScore =
          score;
  
        bestUV =
          uv;
      }
    }
  
    return bestUV;
  }

  function applyFaceUVAdjustment(
    uv,
    role
  ) {
    const adjustment =
      FACE_UV_ADJUSTMENTS[role];

    if (!adjustment) {
      return uv;
    }

    return uv.map(
      ([u, v]) => {
        let x = u;
        let y = v;

        if (adjustment.flipH) {
          x = 1 - x;
        }

        if (adjustment.flipV) {
          y = 1 - y;
        }

        return [x, y];
      }
    );
  }
  
  // ============================================================
  // ALL POSSIBLE SQUARE UV ORIENTATIONS
  // ============================================================
  
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
        let uv =
          base.map(
            ([x, y]) => [
              x,
              y
            ]
          );
  
        // Mirror.
        if (mirrored) {
          uv =
            uv.map(
              ([x, y]) => [
                1 - x,
                y
              ]
            );
        }
  
        // Rotate clockwise in 90° increments.
        for (
          let i = 0;
          i < turns;
          i++
        ) {
          uv =
            uv.map(
              ([x, y]) => [
                y,
                1 - x
              ]
            );
        }
  
        candidates.push(uv);
      }
    }
  
    return candidates;
  }
  
  // ============================================================
  // FIND WORLD DIRECTIONS OF A UV MAPPING
  // ============================================================
  
  function getWorldAxesForUV(
    transform,
    uv
  ) {
    const u =
      normalizeVector(
        transform.u
      );
  
    const v =
      normalizeVector(
        transform.v
      );
  
    // Same four corner positions used in drawPanel.
    //
    // 0 = -u -v
    // 1 = +u -v
    // 2 = +u +v
    // 3 = -u +v
    const positions = [
      addVectors(
        scaleVector(
          u,
          -1
        ),
  
        scaleVector(
          v,
          -1
        )
      ),
  
      addVectors(
        u,
  
        scaleVector(
          v,
          -1
        )
      ),
  
      addVectors(
        u,
        v
      ),
  
      addVectors(
        scaleVector(
          u,
          -1
        ),
  
        v
      )
    ];
  
    let u0 = [0, 0, 0];
    let u1 = [0, 0, 0];
  
    let v0 = [0, 0, 0];
    let v1 = [0, 0, 0];
  
    let u0Count = 0;
    let u1Count = 0;
  
    let v0Count = 0;
    let v1Count = 0;
  
    for (
      let i = 0;
      i < 4;
      i++
    ) {
      const p =
        positions[i];
  
      if (
        uv[i][0] < 0.5
      ) {
        u0 =
          addVectors(
            u0,
            p
          );
  
        u0Count++;
      }
  
      else {
        u1 =
          addVectors(
            u1,
            p
          );
  
        u1Count++;
      }
  
      if (
        uv[i][1] < 0.5
      ) {
        v0 =
          addVectors(
            v0,
            p
          );
  
        v0Count++;
      }
  
      else {
        v1 =
          addVectors(
            v1,
            p
          );
  
        v1Count++;
      }
    }
  
    u0 =
      scaleVector(
        u0,
        1 / u0Count
      );
  
    u1 =
      scaleVector(
        u1,
        1 / u1Count
      );
  
    v0 =
      scaleVector(
        v0,
        1 / v0Count
      );
  
    v1 =
      scaleVector(
        v1,
        1 / v1Count
      );
  
    return {
      // Direction the image's +X/right points in world space.
      right:
        normalizeVector(
          subtractVectors(
            u1,
            u0
          )
        ),
  
      // Direction the image's +Y/down points in world space.
      down:
        normalizeVector(
          subtractVectors(
            v1,
            v0
          )
        )
    };
  }
  
  // ============================================================
  // STRICT ONE-PANEL-AT-A-TIME FOLDING
  // ============================================================
  
  function getSequentialFoldProgress(
    net,
    globalProgress
  ) {
    const count =
      net.faces.length;
  
    const result =
      new Array(
        count
      ).fill(0);
  
    const depths =
      getFaceDepths(
        net
      );
  
    const sequence = [];
  
    for (
      let i = 0;
      i < count;
      i++
    ) {
      if (
        i === net.rootIndex
      ) {
        continue;
      }
  
      sequence.push({
        index: i,
        depth: depths[i]
      });
    }
  
    // Farthest panel folds first.
    sequence.sort(
      (a, b) => {
        if (
          a.depth !== b.depth
        ) {
          return (
            b.depth -
            a.depth
          );
        }
  
        return (
          a.index -
          b.index
        );
      }
    );
  
    const slots =
      sequence.length;
  
    for (
      let slot = 0;
      slot < sequence.length;
      slot++
    ) {
      const local =
        globalProgress *
        slots -
        slot;
  
      result[
        sequence[slot].index
      ] =
        applyMotionCurve(
          constrain(
            local,
            0,
            1
          )
        );
    }
  
    result[
      net.rootIndex
    ] =
      globalProgress;
  
    return result;
  }
  
  // ============================================================
  // FACE DEPTHS
  // ============================================================
  
  function getFaceDepths(
    net
  ) {
    const depths =
      new Array(
        net.faces.length
      ).fill(0);
  
    const queue = [
      net.rootIndex
    ];
  
    while (
      queue.length > 0
    ) {
      const parentIndex =
        queue.shift();
  
      for (
        const child
        of
        net.children[parentIndex]
      ) {
        depths[
          child.index
        ] =
          depths[parentIndex] + 1;
  
        queue.push(
          child.index
        );
      }
    }
  
    return depths;
  }
  
  // ============================================================
  // PREPARE NET
  // ============================================================
  
  function prepareNet(
    cells
  ) {
    const faces =
      cells.map(
        (
          cell,
          index
        ) => ({
          index,
          gridX: cell[0],
          gridY: cell[1]
        })
      );
  
    const map =
      new Map();
  
    for (
      const face
      of faces
    ) {
      map.set(
        coordinateKey(
          face.gridX,
          face.gridY
        ),
  
        face.index
      );
    }
  
    // Use face nearest the center as root.
    const centerX =
      average(
        faces.map(
          face =>
            face.gridX
        )
      );
  
    const centerY =
      average(
        faces.map(
          face =>
            face.gridY
        )
      );
  
    let rootIndex = 0;
    let closest = Infinity;
  
    for (
      const face
      of faces
    ) {
      const d =
        sq(
          face.gridX -
          centerX
        ) +
  
        sq(
          face.gridY -
          centerY
        );
  
      if (
        d < closest
      ) {
        closest = d;
        rootIndex = face.index;
      }
    }
  
    const children =
      faces.map(
        () => []
      );
  
    const visited =
      new Set([
        rootIndex
      ]);
  
    const queue = [
      rootIndex
    ];
  
    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];
  
    while (
      queue.length > 0
    ) {
      const parentIndex =
        queue.shift();
  
      const parent =
        faces[parentIndex];
  
      for (
        const [dx, dy]
        of directions
      ) {
        const key =
          coordinateKey(
            parent.gridX + dx,
            parent.gridY + dy
          );
  
        if (
          !map.has(key)
        ) {
          continue;
        }
  
        const childIndex =
          map.get(key);
  
        if (
          visited.has(
            childIndex
          )
        ) {
          continue;
        }
  
        visited.add(
          childIndex
        );
  
        children[
          parentIndex
        ].push({
          index: childIndex,
          dx,
          dy
        });
  
        queue.push(
          childIndex
        );
      }
    }
  
    return {
      faces,
      rootIndex,
      children
    };
  }
  
  // ============================================================
  // BUILD CONNECTED 3D TRANSFORMS
  // ============================================================
  
  function buildConnectedFaceTransforms(
    net,
    originX,
    originZ,
    size,
    getHingeAngle
  ) {
    const transforms =
      new Array(
        net.faces.length
      );
  
    const rootIndex =
      net.rootIndex;
  
    transforms[
      rootIndex
    ] = {
      center: [
        originX,
        0,
        originZ
      ],
  
      u: [
        1,
        0,
        0
      ],
  
      v: [
        0,
        0,
        1
      ],
  
      normal: [
        0,
        -1,
        0
      ]
    };
  
    const queue = [
      rootIndex
    ];
  
    while (
      queue.length > 0
    ) {
      const parentIndex =
        queue.shift();
  
      const parent =
        transforms[
          parentIndex
        ];
  
      for (
        const link
        of
        net.children[
          parentIndex
        ]
      ) {
        const angle =
          typeof getHingeAngle ===
          "function"
  
            ? getHingeAngle(
                link.index
              )
  
            : getHingeAngle;
  
        transforms[
          link.index
        ] =
          createChildTransform(
            parent,
            link.dx,
            link.dy,
            size,
            angle
          );
  
        queue.push(
          link.index
        );
      }
    }
  
    return transforms;
  }
  
  // ============================================================
  // CHILD HINGE
  // ============================================================
  
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
    let outward;
    let signedAngle;
  
    // +X neighbor
    if (
      dx === 1
    ) {
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
  
      outward =
        parent.u;
  
      signedAngle =
        -angle;
    }
  
    // -X neighbor
    else if (
      dx === -1
    ) {
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
  
      outward =
        scaleVector(
          parent.u,
          -1
        );
  
      signedAngle =
        angle;
    }
  
    // +Z neighbor
    else if (
      dy === 1
    ) {
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
  
      outward =
        parent.v;
  
      signedAngle =
        angle;
    }
  
    // -Z neighbor
    else {
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
  
      outward =
        scaleVector(
          parent.v,
          -1
        );
  
      signedAngle =
        -angle;
    }
  
    const rotatedOutward =
      rotateVectorAroundAxis(
        outward,
        hingeAxis,
        signedAngle
      );
  
    return {
      center:
        addVectors(
          hingeCenter,
  
          scaleVector(
            rotatedOutward,
            half
          )
        ),
  
      u:
        normalizeVector(
          rotateVectorAroundAxis(
            parent.u,
            hingeAxis,
            signedAngle
          )
        ),
  
      v:
        normalizeVector(
          rotateVectorAroundAxis(
            parent.v,
            hingeAxis,
            signedAngle
          )
        ),
  
      normal:
        normalizeVector(
          rotateVectorAroundAxis(
            parent.normal,
            hingeAxis,
            signedAngle
          )
        )
    };
  }
  
  // ============================================================
  // CAMERA
  // ============================================================
  
  function setIsometricCamera() {
    const verticalView =
      700;
  
    const horizontalView =
      verticalView *
      (
        width /
        height
      );
  
    ortho(
      -horizontalView,
      horizontalView,
  
      -verticalView,
      verticalView,
  
      -10000,
      10000
    );
  
    const elevation =
      atan(
        1 /
        ISO_ELEVATION_DENOM
      );
  
    const azimuth =
      QUARTER_PI;
  
    const distance =
      2400;
  
    const horizontalDistance =
      distance *
      cos(
        elevation
      );
  
    camera(
      horizontalDistance *
        cos(
          azimuth
        ),
  
      -distance *
        sin(
          elevation
        ),
  
      horizontalDistance *
        sin(
          azimuth
        ),
  
      0,
      0,
      0,
  
      0,
      1,
      0
    );
  }
  
  // ============================================================
  // GRID
  // ============================================================
  
  function drawGrid(
    size
  ) {
    push();
  
    stroke(
      0,
      0,
      0,
      28
    );
  
    strokeWeight(1);
  
    noFill();
  
    const amount =
      16;
  
    for (
      let i = -amount;
      i <= amount;
      i++
    ) {
      line(
        -amount *
          size,
  
        0.5,
  
        i *
          size,
  
        amount *
          size,
  
        0.5,
  
        i *
          size
      );
  
      line(
        i *
          size,
  
        0.5,
  
        -amount *
          size,
  
        i *
          size,
  
        0.5,
  
        amount *
          size
      );
    }
  
    pop();
  }
  
  // ============================================================
  // CENTER TRANSFORMS
  // ============================================================
  
  function centerTransforms(
    transforms
  ) {
    const center =
      getTransformCenter(
        transforms
      );
  
    for (
      const transform
      of transforms
    ) {
      transform.center[0] -=
        center[0];
  
      transform.center[1] -=
        center[1];
  
      transform.center[2] -=
        center[2];
    }
  }
  
  function getTransformCenter(
    transforms
  ) {
    let x = 0;
    let y = 0;
    let z = 0;
  
    for (
      const transform
      of transforms
    ) {
      x +=
        transform.center[0];
  
      y +=
        transform.center[1];
  
      z +=
        transform.center[2];
    }
  
    const count =
      transforms.length;
  
    return [
      x / count,
      y / count,
      z / count
    ];
  }
  
  // ============================================================
  // IMAGE LOADING
  // ============================================================
  
  function setFaceImage(
    role,
    img
  ) {
    faceImages[
      role
    ] =
      img;
  }
  
  function isDarkFaceMode() {
    return Boolean(
      controls.darkFaceMode
        ?.checked
    );
  }

  function getDefaultFaceImagePaths() {
    return isDarkFaceMode()
      ? DARK_FACE_IMAGES
      : DEFAULT_FACE_IMAGES;
  }

  function getShellExteriorColor() {
    return isDarkFaceMode()
      ? DARK_MODE_SHELL_COLOR
      : SHELL_EXTERIOR_COLOR;
  }

  function applyDarkFaceMode() {
    if (
      typeof TripleCubeMode
        .setDarkFaceArt ===
      "function"
    ) {
      TripleCubeMode.setDarkFaceArt(
        isDarkFaceMode()
      );
    }

    loadDefaultFaceAssets();
    applyPageBackgroundTheme();
  }

  function loadDefaultFaceAssets() {
    for (
      const [
        role,
        path
      ]
  
      of
  
      Object.entries(
        getDefaultFaceImagePaths()
      )
    ) {
      loadImage(
        path,
  
        img => {
          setFaceImage(
            role,
            img
          );
        },
  
        () => {
          console.warn(
            `Could not load default ${role} face: ${path}`
          );
        }
      );
    }
  }
  
  function loadFaceImage(
    fileInput,
    role
  ) {
    const file =
      fileInput.files[0];
  
    if (!file) {
      return;
    }
  
    const url =
      URL.createObjectURL(
        file
      );
  
    loadImage(
      url,
  
      img => {
        setFaceImage(
          role,
          img
        );
  
        URL.revokeObjectURL(
          url
        );
      },
  
      () => {
        URL.revokeObjectURL(
          url
        );
      }
    );
  }
  
  // ============================================================
  // CONTROLS
  // ============================================================
  
  function normalizePageBackgroundHex(
    value
  ) {
    const raw = String(
      value || PAGE_BACKGROUND_DARK
    ).trim();

    if (raw.startsWith("#")) {
      return raw.toUpperCase();
    }

    return `#${raw.toUpperCase()}`;
  }

  function getPageBackgroundColor() {
    if (isDarkFaceMode()) {
      return DARK_MODE_PAGE_BACKGROUND;
    }

    const value =
      controls.pageBackground
        ? controls.pageBackground.value
        : PAGE_BACKGROUND_DARK.replace(
            "#",
            ""
          );

    return normalizePageBackgroundHex(
      value
    );
  }

  function applyPageBackgroundTheme() {
    const color =
      getPageBackgroundColor();
    const isDark =
      color ===
      PAGE_BACKGROUND_DARK;

    document.body.classList.toggle(
      "theme-dark",
      isDark
    );
    document.body.classList.toggle(
      "theme-light",
      !isDark
    );
    document.body.style.background =
      color;

    const container =
      document.getElementById(
        "canvas-container"
      );

    if (container) {
      container.style.background =
        color;
    }
  }

  function getControls() {
    const ids = [
      "pageBackground",
      "darkFaceMode",
      "animationMode",
      "unfoldControls",
      "tripleControls",
      "revealedPauseGroup",
      "foldedPauseLabel",
      "unfoldedPauseLabel",

      "topImage",
      "leftImage",
      "rightImage",
  
      "insideColor",
      "randomInnerColors",
      "excludeDarkTealsFromInner",

      "cubeSize",
      "cubeSizeValue",
  
      "motionCurve",
      "animationSpeed",
      "animationSpeedValue",
  
      "foldedPause",
      "foldedPauseValue",
  
      "unfoldedPause",
      "unfoldedPauseValue",

      "revealedPause",
      "revealedPauseValue",
  
      "showGrid",
      "showGridTriple",
      "randomizeInnerLayoutButton",
      "exportLoops",
      "exportEstimate",
      "exportVariations",
      "exportVariationsButton",
      "exportVideoButton",
      "exportNote",
      "restartButton"
    ];
  
    for (
      const id
      of ids
    ) {
      controls[id] =
        document.getElementById(
          id
        );
    }
  }
  
  function connectControls() {
    controls
      .pageBackground
      .addEventListener(
        "change",
        applyPageBackgroundTheme
      );

    controls
      .darkFaceMode
      .addEventListener(
        "change",
        applyDarkFaceMode
      );

    controls
      .animationMode
      .addEventListener(
        "change",
        () => {
          updateModePanels();
          restartAnimation();
        }
      );

    controls
      .topImage
      .addEventListener(
        "change",
  
        () => {
          loadFaceImage(
            controls.topImage,
            "top"
          );
        }
      );
  
    controls
      .leftImage
      .addEventListener(
        "change",
  
        () => {
          loadFaceImage(
            controls.leftImage,
            "left"
          );
        }
      );
  
    controls
      .rightImage
      .addEventListener(
        "change",
  
        () => {
          loadFaceImage(
            controls.rightImage,
            "right"
          );
        }
      );
  
    controls
      .randomInnerColors
      .addEventListener(
        "change",
        () => {
          updateInsideColorControl();

          if (
            controls.randomInnerColors.checked
          ) {
            assignRandomInnerColors(
              currentNet.faces.length
            );
          }
        }
      );

    controls
      .excludeDarkTealsFromInner
      .addEventListener(
        "change",
        () => {
          if (
            controls.randomInnerColors.checked
          ) {
            assignRandomInnerColors(
              currentNet.faces.length
            );
          }
        }
      );

    updateInsideColorControl();

    controls
      .cubeSize
      .addEventListener(
        "input",
        updateLabels
      );
  
    controls
      .animationSpeed
      .addEventListener(
        "input",
        updateLabels
      );
  
    controls
      .foldedPause
      .addEventListener(
        "input",
        updateLabels
      );
  
    controls
      .unfoldedPause
      .addEventListener(
        "input",
        updateLabels
      );

    controls
      .revealedPause
      .addEventListener(
        "input",
        updateLabels
      );

    controls
      .exportLoops
      .addEventListener(
        "input",
        updateExportEstimate
      );

    controls
      .motionCurve
      .addEventListener(
        "change",
        updateExportEstimate
      );

    controls
      .randomizeInnerLayoutButton
      .addEventListener(
        "click",
        randomizeInnerLayout
      );

    controls
      .exportVariationsButton
      .addEventListener(
        "click",
        () => {
          exportInnerColorVariations().catch(
            error => {
              console.error(error);
              setExportNote(
                `Export failed: ${error.message || error}`
              );
              logoExporting = false;
              syncExportBusyUI();
              loop();
            }
          );
        }
      );
  
    controls
      .restartButton
      .addEventListener(
        "click",
        restartAnimation
      );

    controls
      .exportVideoButton
      .addEventListener(
        "click",
        () => {
          exportLogoVideo({}).catch(
            error => {
              console.error(error);
              setExportNote(
                `Export failed: ${error.message || error}`
              );
              logoExporting = false;
              syncExportBusyUI();
              loop();
            }
          );
        }
      );
  }
  
  function updateModePanels() {
    const triple =
      isTripleMode();

    controls.unfoldControls.classList.toggle(
      "active",
      !triple
    );

    controls.tripleControls.classList.toggle(
      "active",
      triple
    );

    controls.revealedPauseGroup.style.display =
      triple
        ? "flex"
        : "none";

    controls.foldedPauseLabel.textContent =
      triple
        ? "Stacked pause"
        : "Folded pause";

    controls.unfoldedPauseLabel.textContent =
      triple
        ? "Separated pause"
        : "Unfolded pause";

    updateExportEstimate();
  }

  function getUnfoldCycleDuration() {
    const moveDuration =
      1 /
      Number(
        controls.animationSpeed.value
      );

    return (
      Number(
        controls.foldedPause.value
      ) +
      Number(
        controls.unfoldedPause.value
      ) +
      2 *
        moveDuration
    );
  }

  function getAnimationCycleDuration() {
    if (isTripleMode()) {
      return TripleCubeMode.getCycleDuration();
    }

    return getUnfoldCycleDuration();
  }

  function formatExportDuration(
    seconds
  ) {
    if (seconds < 60) {
      return `${seconds.toFixed(1)} s`;
    }

    const minutes =
      Math.floor(
        seconds / 60
      );
    const remainder =
      seconds -
      minutes * 60;

    return `${minutes}m ${remainder.toFixed(0)}s`;
  }

  function updateExportEstimate() {
    if (
      !controls.exportLoops ||
      !controls.exportEstimate
    ) {
      return;
    }

    const loops =
      Math.max(
        1,
        Math.round(
          Number(
            controls.exportLoops.value
          ) || 1
        )
      );

    const cycle =
      getAnimationCycleDuration();
    const total =
      loops * cycle;

    controls.exportEstimate.textContent =
      `${loops} loop${loops === 1 ? "" : "s"} · ${formatExportDuration(cycle)} per loop · ≈ ${formatExportDuration(total)} total`;
  }

  function updateLabels() {
    controls
      .cubeSizeValue
      .textContent =
        controls
          .cubeSize
          .value;
  
    controls
      .animationSpeedValue
      .textContent =
        `${Number(
          controls
            .animationSpeed
            .value
        ).toFixed(2)}×`;
  
    controls
      .foldedPauseValue
      .textContent =
        `${Number(
          controls
            .foldedPause
            .value
        ).toFixed(1)}s`;
  
    controls
      .unfoldedPauseValue
      .textContent =
        `${Number(
          controls
            .unfoldedPause
            .value
        ).toFixed(1)}s`;

    controls
      .revealedPauseValue
      .textContent =
        `${Number(
          controls
            .revealedPause
            .value
        ).toFixed(1)}s`;

    updateExportEstimate();
  }
  
  function restartAnimation() {
    if (isTripleMode()) {
      TripleCubeMode.restart();
      return;
    }

    currentNetIndex =
      0;
  
    currentNet =
      prepareNet(
        CUBE_NETS[
          currentNetIndex
        ]
      );

    if (
      controls.randomInnerColors.checked
    ) {
      assignRandomInnerColors(
        currentNet.faces.length
      );
    }

    progress =
      1;
  
    animationState =
      "foldedHold";
  
    stateStartTime =
      millis();

    resetUnfoldStateElapsed();
  }

  function setExportNote(text) {
    controls.exportNote.textContent =
      text || "";
  }

  function syncExportBusyUI() {
    const busy = logoExporting;

    controls.exportVideoButton.disabled =
      busy;
    controls.exportVariationsButton.disabled =
      busy;
    controls.randomizeInnerLayoutButton.disabled =
      busy;
    controls.restartButton.disabled =
      busy;
    controls.animationMode.disabled =
      busy;
  }

  function getAvcCodedArea(
    width,
    height
  ) {
    const codedWidth =
      (width + 15) & ~15;
    const codedHeight =
      (height + 15) & ~15;

    return {
      codedWidth,
      codedHeight,
      codedArea:
        codedWidth *
        codedHeight
    };
  }

  function pickAvcCodecForSize(
    width,
    height
  ) {
    const codedArea =
      getAvcCodedArea(
        width,
        height
      ).codedArea;

    for (
      const level of
        LOGO_EXPORT_AVC_LEVELS
    ) {
      if (
        codedArea <=
        level.maxCodedArea
      ) {
        return level.codec;
      }
    }

    return LOGO_EXPORT_AVC_LEVELS[
      LOGO_EXPORT_AVC_LEVELS.length -
        1
    ].codec;
  }

  function fitLogoExportDimensions(
    width,
    height
  ) {
    const maxCodedArea =
      LOGO_EXPORT_AVC_LEVELS[
        LOGO_EXPORT_AVC_LEVELS.length -
          1
      ].maxCodedArea;

    let encodeWidth =
      Math.max(
        2,
        width & ~1
      );
    let encodeHeight =
      Math.max(
        2,
        height & ~1
      );

    while (
      getAvcCodedArea(
        encodeWidth,
        encodeHeight
      ).codedArea >
      maxCodedArea
    ) {
      encodeWidth =
        Math.max(
          2,
          Math.floor(
            encodeWidth * 0.95
          ) & ~1
        );
      encodeHeight =
        Math.max(
          2,
          Math.floor(
            encodeHeight * 0.95
          ) & ~1
        );
    }

    return {
      encodeWidth,
      encodeHeight
    };
  }

  async function configureLogoVideoEncoder(
    encoder,
    encodeWidth,
    encodeHeight,
    fps
  ) {
    const codec =
      pickAvcCodecForSize(
        encodeWidth,
        encodeHeight
      );
    const config = {
      codec,
      width: encodeWidth,
      height: encodeHeight,
      bitrate: 8_000_000,
      framerate: fps
    };

    if (
      typeof VideoEncoder
        .isConfigSupported ===
      "function"
    ) {
      const codecsToTry = [
        codec,
        ...LOGO_EXPORT_AVC_LEVELS
          .map(
            level => level.codec
          )
          .filter(
            candidate =>
              candidate !== codec
          )
      ];

      for (
        const candidate of
          codecsToTry
      ) {
        const candidateConfig =
          {
            ...config,
            codec: candidate
          };
        const support =
          await VideoEncoder.isConfigSupported(
            candidateConfig
          );

        if (support.supported) {
          encoder.configure(
            support.config ||
              candidateConfig
          );
          return;
        }
      }
    }

    encoder.configure(config);
  }

  function getLogoExportCaptureCanvas(
    width,
    height
  ) {
    if (
      !logoExportCaptureCanvas
    ) {
      logoExportCaptureCanvas =
        document.createElement(
          "canvas"
        );
    }

    if (
      logoExportCaptureCanvas.width !==
        width ||
      logoExportCaptureCanvas.height !==
        height
    ) {
      logoExportCaptureCanvas.width =
        width;
      logoExportCaptureCanvas.height =
        height;
    }

    return logoExportCaptureCanvas;
  }

  function getWebGLCanvasElement() {
    const fromContext =
      drawingContext &&
      drawingContext.canvas;

    if (
      fromContext &&
      typeof fromContext.getContext ===
        "function"
    ) {
      return fromContext;
    }

    const fromDom =
      document.querySelector(
        "#canvas-container canvas"
      );

    return fromDom || fromContext;
  }

  function copyWebGLFrameToCapture(
    sourceCanvas,
    width,
    height
  ) {
    const capture =
      getLogoExportCaptureCanvas(
        width,
        height
      );

    if (drawingContext?.finish) {
      drawingContext.finish();
    }

    const ctx =
      capture.getContext("2d");

    ctx.fillStyle =
      getPageBackgroundColor();
    ctx.fillRect(
      0,
      0,
      width,
      height
    );
    ctx.drawImage(
      sourceCanvas,
      0,
      0,
      width,
      height
    );

    return capture;
  }

  async function encodeLogoVideoFrame(
    encoder,
    sourceCanvas,
    frameIndex,
    fps,
    encodeWidth,
    encodeHeight
  ) {
    const capture =
      copyWebGLFrameToCapture(
        sourceCanvas,
        encodeWidth,
        encodeHeight
      );
    const frameDuration =
      Math.round(
        1_000_000 / fps
      );
    const timestamp =
      frameIndex *
      frameDuration;
    const videoFrame =
      new VideoFrame(
        capture,
        {
          timestamp,
          duration: frameDuration
        }
      );

    while (
      encoder.encodeQueueSize > 24
    ) {
      await new Promise(resolve => {
        setTimeout(resolve, 0);
      });
    }

    encoder.encode(videoFrame, {
      keyFrame:
        frameIndex % fps === 0
    });
    videoFrame.close();
  }

  async function exportLogoVideo(
    options = {}
  ) {
    if (logoExporting) {
      return;
    }

    if (
      typeof VideoEncoder ===
        "undefined" ||
      typeof Mp4Muxer ===
        "undefined"
    ) {
      setExportNote(
        "Video export needs a browser with WebCodecs (Chrome or Edge)."
      );
      return;
    }

    const loops =
      Math.max(
        1,
        Math.round(
          Number(
            controls.exportLoops.value
          ) || 1
        )
      );

    const cycleDuration =
      getAnimationCycleDuration();
    const duration =
      loops * cycleDuration;

    const fps = LOGO_EXPORT_FPS;
    const totalFrames =
      Math.max(
        1,
        Math.ceil(
          duration * fps
        )
      );
    const dt = 1 / fps;

    const downloadName =
      options.downloadName ||
      `logo-animation-${loops}loops.mp4`;

    logoExporting = true;
    syncExportBusyUI();
    noLoop();

    restartAnimation();

    const sourceCanvas =
      getWebGLCanvasElement();

    if (
      !sourceCanvas ||
      typeof sourceCanvas.getContext !==
        "function"
    ) {
      throw new Error(
        "Could not read WebGL canvas for export."
      );
    }
    const fitted =
      fitLogoExportDimensions(
        sourceCanvas.width,
        sourceCanvas.height
      );
    const encodeWidth =
      fitted.encodeWidth;
    const encodeHeight =
      fitted.encodeHeight;

    const muxer =
      new Mp4Muxer.Muxer({
        target:
          new Mp4Muxer.ArrayBufferTarget(),
        video: {
          codec: "avc",
          width: encodeWidth,
          height: encodeHeight
        },
        fastStart: "in-memory"
      });

    let encoderError = null;

    const encoder =
      new VideoEncoder({
        output: (
          chunk,
          meta
        ) => {
          muxer.addVideoChunk(
            chunk,
            meta
          );
        },

        error: error => {
          encoderError = error;
        }
      });

    await configureLogoVideoEncoder(
      encoder,
      encodeWidth,
      encodeHeight,
      fps
    );

    try {
      for (
        let frame = 0;
        frame < totalFrames;
        frame++
      ) {
        if (encoderError) {
          throw encoderError;
        }

        if (
          encoder.state ===
          "closed"
        ) {
          throw new Error(
            "Video encoder closed unexpectedly."
          );
        }

        renderLogoScene();

        await encodeLogoVideoFrame(
          encoder,
          sourceCanvas,
          frame,
          fps,
          encodeWidth,
          encodeHeight
        );

        if (frame < totalFrames - 1) {
          if (isTripleMode()) {
            TripleCubeMode.advance(dt);
          } else {
            advanceUnfoldAnimation(dt);
          }
        }

        if (
          frame === 0 ||
          frame ===
            totalFrames - 1 ||
          frame %
            fps ===
            0
        ) {
          setExportNote(
            `Encoding ${frame + 1} / ${totalFrames} frames…`
          );
        }

        if (
          frame %
            15 ===
          14
        ) {
          await new Promise(
            resolve => {
              setTimeout(
                resolve,
                0
              );
            }
          );
        }
      }

      if (encoderError) {
        throw encoderError;
      }

      await encoder.flush();
      muxer.finalize();

      const blob =
        new Blob(
          [
            muxer.target.buffer
          ],
          {
            type: "video/mp4"
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );
      const link =
        document.createElement(
          "a"
        );

      link.href = url;
      link.download = downloadName;
      link.click();
      URL.revokeObjectURL(url);

      if (!options.silentNote) {
        setExportNote(
          `Saved ${loops} loop${loops === 1 ? "" : "s"} · ${formatExportDuration(duration)} · ${encodeWidth}×${encodeHeight} · ${fps} fps.`
        );
      }

      return {
        loops,
        duration,
        encodeWidth,
        encodeHeight,
        fps
      };
    } finally {
      if (encoder.state !== "closed") {
        encoder.close();
      }

      logoExporting = false;
      syncExportBusyUI();
      loop();
    }
  }

  async function exportInnerColorVariations() {
    if (isTripleMode()) {
      setExportNote(
        "Color variation export is for cube unfold mode."
      );
      return;
    }

    const count =
      Math.max(
        1,
        Math.round(
          Number(
            controls.exportVariations.value
          ) || 4
        )
      );

    for (
      let index = 0;
      index < count;
      index++
    ) {
      setExportNote(
        `Exporting color variation ${index + 1} / ${count}…`
      );

      randomSeed(
        createVariationSeed(
          index
        )
      );

      await exportLogoVideo({
        downloadName: `logo-animation-colors-${index + 1}.mp4`,
        silentNote: true
      });
    }

    randomSeed(
      Date.now()
    );

    setExportNote(
      `Saved ${count} color variation${count === 1 ? "" : "s"} · ${count}× ${controls.exportLoops.value} loop(s) each.`
    );
  }
  
  // ============================================================
  // RESIZE
  // ============================================================
  
  function windowResized() {
    const container =
      document.getElementById(
        "canvas-container"
      );
  
    resizeCanvas(
      container.clientWidth,
      container.clientHeight
    );
  }
  
  // ============================================================
  // VECTOR HELPERS
  // ============================================================
  
  function coordinateKey(
    x,
    y
  ) {
    return `${x},${y}`;
  }
  
  function average(
    values
  ) {
    let total =
      0;
  
    for (
      const value
      of values
    ) {
      total +=
        value;
    }
  
    return (
      values.length
  
        ? total /
          values.length
  
        : 0
    );
  }
  
  function addVectors(
    a,
    b
  ) {
    return [
      a[0] + b[0],
      a[1] + b[1],
      a[2] + b[2]
    ];
  }
  
  function subtractVectors(
    a,
    b
  ) {
    return [
      a[0] - b[0],
      a[1] - b[1],
      a[2] - b[2]
    ];
  }
  
  function scaleVector(
    v,
    amount
  ) {
    return [
      v[0] *
        amount,
  
      v[1] *
        amount,
  
      v[2] *
        amount
    ];
  }
  
  function dotVectors(
    a,
    b
  ) {
    return (
      a[0] *
        b[0] +
  
      a[1] *
        b[1] +
  
      a[2] *
        b[2]
    );
  }
  
  function crossVectors(
    a,
    b
  ) {
    return [
      a[1] *
        b[2] -
        a[2] *
        b[1],
  
      a[2] *
        b[0] -
        a[0] *
        b[2],
  
      a[0] *
        b[1] -
        a[1] *
        b[0]
    ];
  }
  
  function vectorLength(
    v
  ) {
    return sqrt(
      v[0] *
        v[0] +
  
      v[1] *
        v[1] +
  
      v[2] *
        v[2]
    );
  }
  
  function normalizeVector(
    v
  ) {
    const length =
      vectorLength(
        v
      );
  
    if (
      length <
      0.000001
    ) {
      return [
        0,
        0,
        0
      ];
    }
  
    return [
      v[0] /
        length,
  
      v[1] /
        length,
  
      v[2] /
        length
    ];
  }
  
  function rotateVectorAroundAxis(
    vector,
    axis,
    angle
  ) {
    const a =
      normalizeVector(
        axis
      );
  
    const c =
      cos(
        angle
      );
  
    const s =
      sin(
        angle
      );
  
    const parallel =
      scaleVector(
        a,
  
        dotVectors(
          a,
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
        a,
        vector
      );
  
    return addVectors(
      addVectors(
        parallel,
  
        scaleVector(
          perpendicular,
          c
        )
      ),
  
      scaleVector(
        cross,
        s
      )
    );
  }
  
  function expandCornersInPlane(
    corners,
    scale
  ) {
    const center = [
      0,
      0,
      0
    ];

    for (
      const point
      of corners
    ) {
      center[0] += point[0];
      center[1] += point[1];
      center[2] += point[2];
    }

    center[0] /= 4;
    center[1] /= 4;
    center[2] /= 4;

    return corners.map(
      point =>
        addVectors(
          center,
          scaleVector(
            subtractVectors(
              point,
              center
            ),
            scale
          )
        )
    );
  }

  function offsetCorners(
    corners,
    direction,
    amount
  ) {
    const step =
      scaleVector(
        normalizeVector(
          direction
        ),
  
        amount
      );
  
    return corners.map(
      p =>
        addVectors(
          p,
          step
        )
    );
  }
  
  function applyMotionCurve(
    value
  ) {
    const t =
      constrain(
        value,
        0,
        1
      );
    const mode =
      controls.motionCurve
        ? controls.motionCurve.value
        : "ease";

    if (mode === "linear") {
      return t;
    }

    if (mode === "ease-in-out") {
      return (
        t *
        t *
        (3 - 2 * t)
      );
    }

    return smootherstep(t);
  }

  function smootherstep(
    value
  ) {
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
          t *
          6 -
          15
        ) +
        10
      )
    );
  }
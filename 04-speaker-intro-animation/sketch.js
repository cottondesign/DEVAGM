const BASE_WIDTH = 1440;
const BASE_HEIGHT = 810;
const MAX_PIXEL_DENSITY = 2;


function getRenderDensity() {
  return min(
    MAX_PIXEL_DENSITY,
    displayDensity()
  );
}


function getCanvasDimensions() {
  const aspect =
    BASE_WIDTH /
    BASE_HEIGHT;

  let width =
    windowWidth;

  let height =
    windowHeight;

  if (
    width / height >
    aspect
  ) {
    width =
      height *
      aspect;
  } else {
    height =
      width /
      aspect;
  }

  return {
    width: max(
      1,
      floor(width)
    ),

    height: max(
      1,
      floor(height)
    )
  };
}


/* ---------------------------------------------------------
   PALETTE
--------------------------------------------------------- */

const PALETTE = [
  "#FFFFFF",
  "#FEF9F3",
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


let selectedColor = PALETTE[0];

let controls = {};

let singleImage = null;
let leftImage = null;
let rightImage = null;


/* ---------------------------------------------------------
   ANIMATION
--------------------------------------------------------- */

let animationProgress = 1;
let animationRunning = false;
let animationStartTime = 0;

let activeRevealDirection = "left";

/*
 * 2-way loop phases:
 * reveal — rotate in from the start pose
 * spin   — continue a full turn in the same direction
 * hide   — rotate back out to the start pose
 */
let loopPhase = "reveal";

const LOOP_HOLD_MS = 700;


/* ---------------------------------------------------------
   SETUP
--------------------------------------------------------- */

function setup() {
  setAttributes(
    "antialias",
    true
  );

  const dimensions =
    getCanvasDimensions();

  const canvas = createCanvas(
    dimensions.width,
    dimensions.height,
    WEBGL
  );

  canvas.parent("canvas-container");

  pixelDensity(
    getRenderDensity()
  );

  textureMode(NORMAL);

  getControls();
  buildPalette();
  connectControls();
  updateControlUI();

  applyBackgroundColor();
}


function windowResized() {
  const dimensions =
    getCanvasDimensions();

  resizeCanvas(
    dimensions.width,
    dimensions.height
  );

  pixelDensity(
    getRenderDensity()
  );
}


/* ---------------------------------------------------------
   DRAW
--------------------------------------------------------- */

function draw() {
  const settings = getSettings();

  background(selectedColor);

  updateAnimation(settings);

  if (settings.showGrid) {
    drawScreenIsometricGrid(settings);
  }

  setIsometricCamera(settings);

  drawCube(settings);
}


/* ---------------------------------------------------------
   SETTINGS
--------------------------------------------------------- */

function getSettings() {
  const cameraZoom =
    Number(controls.cameraZoom.value);

  const verticalView =
    getVerticalView(cameraZoom);

  return {
    cubeSize:
      Number(controls.cubeSize.value),

    cubeY:
      Number(controls.cubeY.value),

    debugMode:
      controls.debugMode.checked,

    imageMode:
      controls.imageMode.value,

    oneFaceSide:
      controls.oneFaceSide.value,

    leftImageAlign:
      controls.leftImageAlign.value,

    rightImageAlign:
      controls.rightImageAlign.value,

    backingOutline:
      controls.backingOutline.checked,

    backingGrow:
      Number(controls.backingGrow.value) / 100,

    revealDirection:
      controls.revealDirection.value,

    animationDuration:
      Number(controls.animationDuration.value),

    holdDuration:
      Number(controls.holdDuration.value),

    rotationAmount:
      radians(
        Number(controls.rotationAmount.value)
      ),

    autoLoop:
      controls.autoLoop.checked,

    loopStyle:
      controls.loopStyle.value,

    showGrid:
      controls.showGrid.checked,

    gridSize:
      Number(controls.gridSize.value),

    gridOpacity:
      Number(controls.gridOpacity.value) / 100,

    cameraZoom,

    verticalView
  };
}


/* ---------------------------------------------------------
   CUBE
--------------------------------------------------------- */

function drawCube(settings) {
  push();

  translate(
    0,
    settings.cubeY,
    0
  );

  const eased =
    easeInOutCubic(animationProgress);

  if (isTwoWayActive(settings)) {
    drawTwoWayCubes(settings, eased);
    pop();
    return;
  }

  const rotations =
    getRevealRotation(
      activeRevealDirection,
      settings.rotationAmount
    );

  let currentX;
  let currentY;
  let currentZ;

  if (isDiagonalReveal(activeRevealDirection)) {
    /*
     * Diagonal reveals keep full yaw at the start so both
     * image faces stay hidden, then arc through X mid-flight.
     */
    const arc =
      sin(eased * PI);

    currentY =
      rotations.y *
      (1 - eased);

    currentX =
      rotations.x *
      arc;

    currentZ = 0;
  } else {
    currentX =
      lerp(
        rotations.x,
        0,
        eased
      );

    currentY =
      lerp(
        rotations.y,
        0,
        eased
      );

    currentZ =
      lerp(
        rotations.z,
        0,
        eased
      );
  }

  /*
   * Rotation ordering matters.
   *
   * Y is applied first for the main left/right spin,
   * followed by X and Z for angled reveal modes.
   */

  rotateY(currentY);
  rotateX(currentX);
  rotateZ(currentZ);

  drawCubeFaces(settings);

  pop();
}


/* ---------------------------------------------------------
   2-WAY REVEALS

   Each image is its own face so the two can turn in
   opposite directions, pivoting about the cube center.
   At rest they sit where the cube's left / right faces
   would be.
--------------------------------------------------------- */

function isTwoWayReveal(direction) {
  return (
    direction === "2-way-horizontal" ||
    direction === "2-way-vertical"
  );
}


function isTwoWayActive(settings) {
  return (
    settings.imageMode === "two" &&
    isTwoWayReveal(activeRevealDirection)
  );
}


function drawTwoWayCubes(settings, eased) {
  const amount =
    loopPhase === "spin"
      ? TWO_PI
      : settings.rotationAmount;

  const remaining =
    amount * (1 - eased);

  const horizontal =
    activeRevealDirection === "2-way-horizontal";

  /*
   * Left image (+Z): horizontal swings in from the left
   * moving right; vertical rolls up from underneath.
   */
  push();

  if (horizontal) {
    rotateY(-remaining);
  } else {
    rotateX(-remaining);
  }

  drawImageFaceOnly(settings, "left");
  pop();

  /*
   * Right image (+X): horizontal swings in from the right
   * moving left; vertical rolls down over the top.
   */
  push();

  if (horizontal) {
    rotateY(remaining);
  } else {
    rotateZ(-remaining);
  }

  drawImageFaceOnly(settings, "right");
  pop();
}


/*
 * Only the image face is drawn: blank sides would
 * clip through the other image's cube mid-turn.
 */
function drawImageFaceOnly(settings, side) {
  if (!shouldShowFaceTextures()) {
    return;
  }

  const h = settings.cubeSize * 0.5;

  /*
   * Backing just behind the image so its reverse side
   * reads as the background + cube color. It covers only
   * the image's rectangle inside the square frame.
   */
  const b = h - 0.1;

  if (side === "left") {
    const img = getLeftTexture(settings);

    drawFramedImageBacking(
      img,
      [
        [-h, -h, b],
        [ h, -h, b],
        [ h,  h, b],
        [-h,  h, b]
      ],
      settings,
      0,
      settings.leftImageAlign
    );

    drawFramedImage(
      img,
      [
        [-h, -h, h],
        [ h, -h, h],
        [ h,  h, h],
        [-h,  h, h]
      ],
      settings,
      0,
      settings.leftImageAlign
    );
    return;
  }

  const img = getRightTexture(settings);

  drawFramedImageBacking(
    img,
    [
      [b, -h, -h],
      [b,  h, -h],
      [b,  h,  h],
      [b, -h,  h]
    ],
    settings,
    HALF_PI,
    settings.rightImageAlign
  );

  drawFramedImage(
    img,
    [
      [h, -h, -h],
      [h,  h, -h],
      [h,  h,  h],
      [h, -h,  h]
    ],
    settings,
    HALF_PI,
    settings.rightImageAlign
  );
}


/* ---------------------------------------------------------
   REVEAL DIRECTIONS
--------------------------------------------------------- */

function getBaseRevealDirection(direction) {
  if (direction.endsWith("-old")) {
    return direction.slice(0, -4);
  }

  return direction;
}


function isDiagonalReveal(direction) {
  return (
    direction === "left-up" ||
    direction === "right-up" ||
    direction === "left-down" ||
    direction === "right-down"
  );
}


function getRevealRotation(direction, amount) {
  const baseDirection =
    getBaseRevealDirection(direction);

  /*
   * The normal cube position is:
   *
   * X = 0
   * Y = 0
   * Z = 0
   *
   * These values describe ONLY the starting position.
   */

  if (baseDirection === "left") {
    return {
      x: 0,
      y: amount,
      z: 0
    };
  }

  if (baseDirection === "right") {
    return {
      x: 0,
      y: -amount,
      z: 0
    };
  }

  if (baseDirection === "up") {
    return {
      x: amount,
      y: 0,
      z: 0
    };
  }

  if (baseDirection === "down") {
    return {
      x: -amount,
      y: 0,
      z: 0
    };
  }

  if (baseDirection === "left-up") {
    return {
      x: amount * 0.7,
      y: amount,
      z: 0
    };
  }

  if (baseDirection === "right-up") {
    return {
      x: amount * 0.7,
      y: -amount,
      z: 0
    };
  }

  if (baseDirection === "left-down") {
    return {
      x: -amount * 0.7,
      y: amount,
      z: 0
    };
  }

  if (baseDirection === "right-down") {
    return {
      x: -amount * 0.7,
      y: -amount,
      z: 0
    };
  }

  return {
    x: 0,
    y: amount,
    z: 0
  };
}


/* ---------------------------------------------------------
   CUSTOM CUBE FACES
--------------------------------------------------------- */

function drawCubeFaces(settings) {
  const s = settings.cubeSize;
  const h = s * 0.5;

  const leftTexture =
    shouldShowFaceTextures()
      ? getLeftTexture(settings)
      : null;

  const rightTexture =
    shouldShowFaceTextures()
      ? getRightTexture(settings)
      : null;


  /* ---------------- TOP ---------------- */

  drawSolidQuad(
    [
      [-h, -h, -h],
      [ h, -h, -h],
      [ h, -h,  h],
      [-h, -h,  h]
    ],
    settings
  );


  /* ---------------- LEFT / +Z ---------------- */

  if (leftTexture) {
    drawFramedImage(
      leftTexture,
      [
        [-h, -h, h],
        [ h, -h, h],
        [ h,  h, h],
        [-h,  h, h]
      ],
      settings,
      0,
      settings.leftImageAlign
    );
  } else {
    drawSolidQuad(
      [
        [-h, -h, h],
        [ h, -h, h],
        [ h,  h, h],
        [-h,  h, h]
      ],
      settings
    );
  }


  /* ---------------- RIGHT / +X ---------------- */

  if (rightTexture) {
    drawFramedImage(
      rightTexture,
      [
        [h, -h, -h],
        [h,  h, -h],
        [h,  h,  h],
        [h, -h,  h]
      ],
      settings,

      /*
       * RIGHT SIDE PNG:
       * 90° CCW aligns texture top with screen top
       * on this +X face in isometric view.
       */
      HALF_PI,
      settings.rightImageAlign
    );
  } else {
    drawSolidQuad(
      [
        [h, -h, -h],
        [h,  h, -h],
        [h,  h,  h],
        [h, -h,  h]
      ],
      settings
    );
  }


  /* ---------------- BACK / -Z ---------------- */

  drawSolidQuad(
    [
      [ h, -h, -h],
      [-h, -h, -h],
      [-h,  h, -h],
      [ h,  h, -h]
    ],
    settings
  );


  /* ---------------- BACK / -X ---------------- */

  drawSolidQuad(
    [
      [-h, -h,  h],
      [-h,  h,  h],
      [-h,  h, -h],
      [-h, -h, -h]
    ],
    settings
  );


  /* ---------------- BOTTOM ---------------- */

  drawSolidQuad(
    [
      [-h, h,  h],
      [ h, h,  h],
      [ h, h, -h],
      [-h, h, -h]
    ],
    settings
  );
}


/* ---------------------------------------------------------
   FACE TEXTURE SELECTION
--------------------------------------------------------- */

function shouldShowFaceTextures() {
  /*
   * Keep PNGs hidden at animation start. Diagonal reveal
   * directions can leave a textured face facing camera
   * even when the cube is fully rotated away.
   *
   * A 2-way spin starts and ends at the rest pose, where
   * the images are already showing.
   */
  if (loopPhase === "spin") {
    return true;
  }

  return animationProgress > 0.001;
}


function getLeftTexture(settings) {
  if (settings.imageMode === "none") {
    return null;
  }

  if (settings.imageMode === "one") {
    if (settings.oneFaceSide === "left") {
      return singleImage;
    }

    return null;
  }

  if (settings.imageMode === "two") {
    return leftImage;
  }

  return null;
}


function getRightTexture(settings) {
  if (settings.imageMode === "none") {
    return null;
  }

  if (settings.imageMode === "one") {
    if (settings.oneFaceSide === "right") {
      return singleImage;
    }

    return null;
  }

  if (settings.imageMode === "two") {
    return rightImage;
  }

  return null;
}


/* ---------------------------------------------------------
   SOLID FACE
--------------------------------------------------------- */

function drawSolidQuad(points, settings) {
  push();

  fill(selectedColor);

  if (settings.debugMode) {
    stroke(getDebugColor());
    strokeWeight(2);
  } else {
    noStroke();
  }

  beginShape(QUADS);

  for (const point of points) {
    vertex(
      point[0],
      point[1],
      point[2]
    );
  }

  endShape(CLOSE);

  pop();
}


/* ---------------------------------------------------------
   TEXTURED FACE

   textureRotation lets individual faces rotate their
   PNG without rotating the actual cube face.
--------------------------------------------------------- */

function drawTexturedQuad(
  img,
  points,
  settings,
  textureRotation = 0
) {
  if (!img) {
    drawSolidQuad(points, settings);
    return;
  }

  push();

  fill(255);

  if (settings.debugMode) {
    stroke(getDebugColor());
    strokeWeight(2);
  } else {
    noStroke();
  }

  texture(img);
  applyTextureQuality();

  const uv0 =
    rotateUV(
      0,
      0,
      textureRotation
    );

  const uv1 =
    rotateUV(
      1,
      0,
      textureRotation
    );

  const uv2 =
    rotateUV(
      1,
      1,
      textureRotation
    );

  const uv3 =
    rotateUV(
      0,
      1,
      textureRotation
    );


  beginShape(QUADS);

  vertex(
    points[0][0],
    points[0][1],
    points[0][2],
    uv0.u,
    uv0.v
  );

  vertex(
    points[1][0],
    points[1][1],
    points[1][2],
    uv1.u,
    uv1.v
  );

  vertex(
    points[2][0],
    points[2][1],
    points[2][2],
    uv2.u,
    uv2.v
  );

  vertex(
    points[3][0],
    points[3][1],
    points[3][2],
    uv3.u,
    uv3.v
  );

  endShape(CLOSE);

  pop();
}


/* ---------------------------------------------------------
   FRAMED IMAGE

   PNGs cropped to their artwork are fit inside the square
   face: the longer side spans the frame and the image is
   placed along the other axis by `align` (top / center /
   bottom), keeping its aspect. `points` are the full
   square face; textureRotation orients the image the same
   way drawTexturedQuad would.
--------------------------------------------------------- */

function getFramedImageQuad(
  img,
  points,
  textureRotation,
  align = "center"
) {
  const aspect = img.width / img.height;

  let u0 = 0;
  let u1 = 1;
  let v0 = 0;
  let v1 = 1;

  if (aspect >= 1) {
    const span = 1 / aspect;
    const slack = 1 - span;

    v0 =
      align === "top"
        ? 0
        : align === "bottom"
          ? slack
          : slack * 0.5;
    v1 = v0 + span;
  } else {
    const span = aspect;
    u0 = (1 - span) * 0.5;
    u1 = u0 + span;
  }

  /*
   * Image-space corners → face parameters (undo the UV
   * rotation) → 3D point on the face.
   */
  const toFace = (u, v) => {
    const p = rotateUV(u, v, -textureRotation);
    const a = p.u;
    const b = p.v;

    return [0, 1, 2].map((axis) =>
      points[0][axis] +
      (points[1][axis] - points[0][axis]) * a +
      (points[3][axis] - points[0][axis]) * b
    );
  };

  return [
    toFace(u0, v0),
    toFace(u1, v0),
    toFace(u1, v1),
    toFace(u0, v1)
  ];
}


function drawFramedImage(
  img,
  points,
  settings,
  textureRotation = 0,
  align = "center"
) {
  if (!img) {
    drawSolidQuad(points, settings);
    return;
  }

  drawAlphaMaskedQuad(
    img,
    getFramedImageQuad(
      img,
      points,
      textureRotation,
      align
    ),
    settings
  );
}


/*
 * With an image, the backing is a box around the PNG's
 * opaque pixels, padded by the overshoot setting.
 */
function drawFramedImageBacking(
  img,
  points,
  settings,
  textureRotation = 0,
  align = "center"
) {
  let quad = points;

  if (img) {
    const bounds =
      getOpaqueBounds(img);

    if (!bounds) {
      return;
    }

    const padding =
      max(img.width, img.height) *
      settings.backingGrow;

    const pu = padding / img.width;
    const pv = padding / img.height;

    quad = getSubQuad(
      getFramedImageQuad(
        img,
        points,
        textureRotation,
        align
      ),
      bounds.u0 - pu,
      bounds.v0 - pv,
      bounds.u1 + pu,
      bounds.v1 + pv
    );
  }

  drawSolidQuad(quad, settings);

  if (settings.backingOutline) {
    drawBackingOutline(quad);
  }
}


/* Point on a quad at image coordinates (u, v). */
function getSubQuad(points, u0, v0, u1, v1) {
  const at = (u, v) =>
    [0, 1, 2].map((axis) =>
      points[0][axis] +
      (points[1][axis] - points[0][axis]) * u +
      (points[3][axis] - points[0][axis]) * v
    );

  return [
    at(u0, v0),
    at(u1, v0),
    at(u1, v1),
    at(u0, v1)
  ];
}


/* ---------------------------------------------------------
   OPAQUE BOUNDS

   Bounding box of the PNG's visible pixels in image
   coordinates (0–1). Scanned once per image.
--------------------------------------------------------- */

const OPAQUE_ALPHA_THRESHOLD = 8;

const opaqueBoundsCache = new WeakMap();


function getOpaqueBounds(img) {
  if (opaqueBoundsCache.has(img)) {
    return opaqueBoundsCache.get(img);
  }

  img.loadPixels();

  const pixels = img.pixels;

  const density =
    Math.sqrt(
      pixels.length /
      4 /
      (img.width * img.height)
    );

  const pw = Math.round(img.width * density);
  const ph = Math.round(img.height * density);

  let minX = pw;
  let minY = ph;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < ph; y++) {
    const row = y * pw * 4;

    for (let x = 0; x < pw; x++) {
      if (pixels[row + x * 4 + 3] > OPAQUE_ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const bounds =
    maxX < 0
      ? null
      : {
        u0: minX / pw,
        v0: minY / ph,
        u1: (maxX + 1) / pw,
        v1: (maxY + 1) / ph
      };

  opaqueBoundsCache.set(img, bounds);

  return bounds;
}


/* ---------------------------------------------------------
   ALPHA-MASKED QUADS

   p5's default texture shader still writes depth for
   fully transparent pixels, so an invisible part of one
   plane hides whatever passes behind it. This shader
   discards those pixels instead.
--------------------------------------------------------- */

const ALPHA_MASK_VERT = `
precision highp float;

attribute vec3 aPosition;
attribute vec2 aTexCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  gl_Position =
    uProjectionMatrix *
    uModelViewMatrix *
    vec4(aPosition, 1.0);
}
`;

const ALPHA_MASK_FRAG = `
precision highp float;

varying vec2 vTexCoord;

uniform sampler2D uImage;
uniform float uCutoff;

void main() {
  vec4 texel = texture2D(uImage, vTexCoord);

  if (texel.a <= uCutoff) {
    discard;
  }

  gl_FragColor = vec4(texel.rgb * texel.a, texel.a);
}
`;

const IMAGE_ALPHA_CUTOFF = 0.01;

let alphaMaskShader = null;


function getAlphaMaskShader() {
  if (!alphaMaskShader) {
    alphaMaskShader = createShader(
      ALPHA_MASK_VERT,
      ALPHA_MASK_FRAG
    );
  }

  return alphaMaskShader;
}


function drawAlphaMaskedQuad(
  img,
  points,
  settings
) {
  const maskShader =
    getAlphaMaskShader();

  push();

  shader(maskShader);

  maskShader.setUniform("uImage", img);
  maskShader.setUniform("uCutoff", IMAGE_ALPHA_CUTOFF);

  noStroke();

  beginShape(QUADS);

  vertex(points[0][0], points[0][1], points[0][2], 0, 0);
  vertex(points[1][0], points[1][1], points[1][2], 1, 0);
  vertex(points[2][0], points[2][1], points[2][2], 1, 1);
  vertex(points[3][0], points[3][1], points[3][2], 0, 1);

  endShape(CLOSE);

  resetShader();

  pop();

  if (settings.debugMode) {
    push();
    noFill();
    stroke(getDebugColor());
    strokeWeight(2);
    beginShape();

    for (const point of points) {
      vertex(point[0], point[1], point[2]);
    }

    endShape(CLOSE);
    pop();
  }
}


function drawBackingOutline(quad) {
  push();

  noFill();
  stroke(255, 0, 0);
  strokeWeight(3);

  beginShape();

  for (const point of quad) {
    vertex(
      point[0],
      point[1],
      point[2]
    );
  }

  endShape(CLOSE);

  pop();
}


/* ---------------------------------------------------------
   UV ROTATION

   Rotates texture coordinates around the center
   of the square face.
--------------------------------------------------------- */

function rotateUV(u, v, angle) {
  const cx = 0.5;
  const cy = 0.5;

  const x =
    u - cx;

  const y =
    v - cy;

  const cosA =
    cos(angle);

  const sinA =
    sin(angle);

  const rotatedX =
    x * cosA -
    y * sinA;

  const rotatedY =
    x * sinA +
    y * cosA;

  return {
    u:
      rotatedX + cx,

    v:
      rotatedY + cy
  };
}


function applyTextureQuality() {
  const gl =
    drawingContext;

  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR
  );

  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MAG_FILTER,
    gl.LINEAR
  );

  const anisotropic =
    gl.getExtension(
      "EXT_texture_filter_anisotropic"
    ) ||
    gl.getExtension(
      "MOZ_EXT_texture_filter_anisotropic"
    ) ||
    gl.getExtension(
      "WEBKIT_EXT_texture_filter_anisotropic"
    );

  if (anisotropic) {
    const maxAnisotropy =
      gl.getParameter(
        anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT
      );

    gl.texParameterf(
      gl.TEXTURE_2D,
      anisotropic.TEXTURE_MAX_ANISOTROPY_EXT,
      maxAnisotropy
    );
  }
}


/* ---------------------------------------------------------
   DEBUG COLOR
--------------------------------------------------------- */

function getDebugColor() {
  const c =
    color(selectedColor);

  const brightnessValue =
    (
      red(c) +
      green(c) +
      blue(c)
    ) / 3;

  if (brightnessValue > 145) {
    return color(
      3,
      41,
      50
    );
  }

  return color(
    254,
    249,
    243
  );
}


/* ---------------------------------------------------------
   TRUE ISOMETRIC CAMERA
--------------------------------------------------------- */

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

  const elevation =
    atan(1 / sqrt(2));

  const azimuth =
    QUARTER_PI;

  const distance =
    2400;

  const horizontalDistance =
    distance *
    cos(elevation);

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


/* ---------------------------------------------------------
   SCREEN SPACE CAMERA
--------------------------------------------------------- */

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


/* ---------------------------------------------------------
   ISOMETRIC GRID
--------------------------------------------------------- */

function drawScreenIsometricGrid(settings) {
  push();

  beginScreenSpaceCamera();

  const edge =
    settings.gridSize;

  const columnSpacing =
    edge *
    sqrt(3) *
    0.5;

  const overscan =
    max(
      width,
      height
    ) * 1.5;

  const gridColor =
    getGridColor(
      settings.gridOpacity
    );

  stroke(gridColor);
  strokeWeight(1);


  /* ---------------- VERTICAL ---------------- */

  const verticalCount =
    ceil(
      width /
      columnSpacing
    ) + 8;

  for (
    let column = -verticalCount;
    column <= verticalCount;
    column++
  ) {
    const x =
      column *
      columnSpacing;

    line(
      x,
      -overscan,
      0,

      x,
      overscan,
      0
    );
  }


  /* ---------------- DIAGONALS ---------------- */

  const rowCount =
    ceil(
      height /
      edge
    ) +
    ceil(
      width /
      edge
    ) +
    12;


  for (
    let row = -rowCount;
    row <= rowCount;
    row++
  ) {
    const intercept =
      row *
      edge;


    /* DOWN-RIGHT */

    line(
      -overscan,

      intercept -
        overscan /
        sqrt(3),

      0,

      overscan,

      intercept +
        overscan /
        sqrt(3),

      0
    );


    /* DOWN-LEFT */

    line(
      -overscan,

      intercept +
        overscan /
        sqrt(3),

      0,

      overscan,

      intercept -
        overscan /
        sqrt(3),

      0
    );
  }

  pop();
}


/* ---------------------------------------------------------
   GRID COLOR
--------------------------------------------------------- */

function getGridColor(alphaAmount) {
  const bg =
    color(selectedColor);

  const brightnessValue =
    (
      red(bg) +
      green(bg) +
      blue(bg)
    ) / 3;

  const a =
    255 *
    alphaAmount;

  if (brightnessValue > 145) {
    return color(
      3,
      41,
      50,
      a
    );
  }

  return color(
    254,
    249,
    243,
    a
  );
}


/* ---------------------------------------------------------
   ANIMATION
--------------------------------------------------------- */

function playAnimation() {
  const settings =
    getSettings();

  /*
   * If RANDOM is selected, pick one direction
   * only when the animation begins.
   *
   * This keeps the direction stable throughout
   * the full animation.
   */

  if (
    settings.revealDirection ===
    "random"
  ) {
    activeRevealDirection =
      getRandomRevealDirection();
  } else {
    activeRevealDirection =
      settings.revealDirection;
  }

  loopPhase = "reveal";

  animationProgress = 0;

  animationRunning = true;

  animationStartTime =
    millis();
}


function resetAnimation() {
  const settings =
    getSettings();

  if (
    settings.revealDirection ===
    "random"
  ) {
    activeRevealDirection =
      getRandomRevealDirection();
  } else {
    activeRevealDirection =
      settings.revealDirection;
  }

  loopPhase = "reveal";

  animationProgress = 0;

  animationRunning = false;
}


function getPhaseDurationMs(settings) {
  const durationMs =
    settings.animationDuration *
    1000;

  /*
   * A full-turn spin keeps the same angular speed as
   * the reveal, so it takes proportionally longer.
   */
  if (loopPhase === "spin") {
    return (
      durationMs *
      TWO_PI /
      max(settings.rotationAmount, 0.001)
    );
  }

  return durationMs;
}


function startNextTwoWayLoop(settings) {
  if (settings.loopStyle === "reverse") {
    loopPhase =
      loopPhase === "hide"
        ? "reveal"
        : "hide";
  } else {
    loopPhase =
      loopPhase === "hide"
        ? "reveal"
        : "spin";
  }

  animationProgress =
    loopPhase === "hide" ? 1 : 0;

  animationStartTime =
    millis();
}


function updateAnimation(settings) {
  if (!animationRunning) {
    return;
  }

  const durationMs =
    getPhaseDurationMs(settings);

  const elapsed =
    millis() -
    animationStartTime;

  const t =
    constrain(
      elapsed /
      durationMs,
      0,
      1
    );

  animationProgress =
    loopPhase === "hide"
      ? 1 - t
      : t;

  if (t < 1) {
    return;
  }

  if (!settings.autoLoop) {
    animationRunning = false;
    return;
  }

  /*
   * Reveal and spin end with the images in view; hide
   * ends with them turned away.
   */
  const holdMs =
    loopPhase === "hide"
      ? LOOP_HOLD_MS
      : settings.holdDuration * 1000;

  if (elapsed <= durationMs + holdMs) {
    return;
  }

  if (isTwoWayActive(settings)) {
    startNextTwoWayLoop(settings);
  } else {
    playAnimation();
  }
}


/* ---------------------------------------------------------
   RANDOM DIRECTION
--------------------------------------------------------- */

function getRandomRevealDirection() {
  const directions = [
    "left",
    "right",
    "up",
    "down",
    "left-up",
    "right-up",
    "left-down",
    "right-down"
  ];

  return random(
    directions
  );
}


/* ---------------------------------------------------------
   EASING
--------------------------------------------------------- */

function easeInOutCubic(t) {
  if (t < 0.5) {
    return (
      4 *
      t *
      t *
      t
    );
  }

  return (
    1 -
    pow(
      -2 * t + 2,
      3
    ) / 2
  );
}


/* ---------------------------------------------------------
   IMAGE LOADING
--------------------------------------------------------- */

function loadImageFromInput(
  file,
  callback
) {
  if (!file) {
    callback(null);
    return;
  }

  const reader =
    new FileReader();

  reader.onload =
    (event) => {
      loadImage(
        event.target.result,

        (img) => {
          callback(img);
        },

        () => {
          console.error(
            "Could not load image."
          );

          callback(null);
        }
      );
    };

  reader.readAsDataURL(
    file
  );
}


/* ---------------------------------------------------------
   CONTROLS
--------------------------------------------------------- */

function getControls() {
  const ids = [
    "controls",

    "palette",

    "cubeSize",
    "cubeSizeValue",

    "cubeY",
    "cubeYValue",

    "debugMode",

    "imageMode",

    "oneFaceControls",
    "twoFaceControls",

    "oneFaceSide",

    "leftImageAlign",
    "rightImageAlign",
    "backingOutline",
    "backingGrow",
    "backingGrowValue",

    "singleImageInput",
    "leftImageInput",
    "rightImageInput",

    "revealDirection",

    "animationDuration",
    "animationDurationValue",

    "holdDuration",
    "holdDurationValue",

    "rotationAmount",
    "rotationAmountValue",

    "autoLoop",
    "loopStyleControls",
    "loopStyle",

    "playButton",
    "resetButton",

    "showGrid",

    "gridSize",
    "gridSizeValue",

    "gridOpacity",
    "gridOpacityValue",

    "cameraZoom",
    "cameraZoomValue"
  ];

  for (const id of ids) {
    controls[id] =
      document.getElementById(id);
  }
}


/* ---------------------------------------------------------
   CONNECT CONTROLS
--------------------------------------------------------- */

function connectControls() {
  const rangeControls = [
    controls.cubeSize,
    controls.cubeY,
    controls.animationDuration,
    controls.holdDuration,
    controls.rotationAmount,
    controls.gridSize,
    controls.gridOpacity,
    controls.cameraZoom,
    controls.backingGrow
  ];

  rangeControls.forEach(
    (control) => {
      control.addEventListener(
        "input",
        updateControlUI
      );
    }
  );


  controls.imageMode.addEventListener(
    "change",
    updateControlUI
  );


  controls.revealDirection.addEventListener(
    "change",
    () => {
      if (
        controls.revealDirection.value !==
        "random"
      ) {
        activeRevealDirection =
          controls.revealDirection.value;
      }

      updateControlUI();
    }
  );


  controls.autoLoop.addEventListener(
    "change",
    updateControlUI
  );


  controls.playButton.addEventListener(
    "click",
    playAnimation
  );


  controls.resetButton.addEventListener(
    "click",
    resetAnimation
  );


  controls.singleImageInput.addEventListener(
    "change",
    (event) => {
      const file =
        event.target.files[0];

      loadImageFromInput(
        file,
        (img) => {
          singleImage = img;
        }
      );
    }
  );


  controls.leftImageInput.addEventListener(
    "change",
    (event) => {
      const file =
        event.target.files[0];

      loadImageFromInput(
        file,
        (img) => {
          leftImage = img;
        }
      );
    }
  );


  controls.rightImageInput.addEventListener(
    "change",
    (event) => {
      const file =
        event.target.files[0];

      loadImageFromInput(
        file,
        (img) => {
          rightImage = img;
        }
      );
    }
  );
}


/* ---------------------------------------------------------
   UI
--------------------------------------------------------- */

function updateControlUI() {
  controls.cubeSizeValue.textContent =
    controls.cubeSize.value;

  controls.cubeYValue.textContent =
    controls.cubeY.value;

  controls.animationDurationValue.textContent =
    `${Number(
      controls.animationDuration.value
    ).toFixed(2)}s`;

  controls.holdDurationValue.textContent =
    `${Number(
      controls.holdDuration.value
    ).toFixed(2)}s`;

  controls.rotationAmountValue.textContent =
    `${controls.rotationAmount.value}°`;

  controls.gridSizeValue.textContent =
    `${controls.gridSize.value}px`;

  controls.gridOpacityValue.textContent =
    `${controls.gridOpacity.value}%`;

  controls.backingGrowValue.textContent =
    `${controls.backingGrow.value}%`;

  controls.cameraZoomValue.textContent =
    Number(
      controls.cameraZoom.value
    ).toFixed(2);


  const mode =
    controls.imageMode.value;

  controls.oneFaceControls.classList.toggle(
    "hidden-control",
    mode !== "one"
  );

  controls.twoFaceControls.classList.toggle(
    "hidden-control",
    mode !== "two"
  );


  /* 2-way reveals only exist in Two images mode */

  const twoImages =
    mode === "two";

  controls.revealDirection
    .querySelectorAll("[data-two-images]")
    .forEach(
      (option) => {
        option.hidden = !twoImages;
        option.disabled = !twoImages;
      }
    );

  if (
    !twoImages &&
    isTwoWayReveal(controls.revealDirection.value)
  ) {
    controls.revealDirection.value = "left";
    activeRevealDirection = "left";
  }

  controls.loopStyleControls.classList.toggle(
    "hidden-control",
    !(
      controls.autoLoop.checked &&
      isTwoWayReveal(controls.revealDirection.value)
    )
  );
}


/* ---------------------------------------------------------
   PALETTE
--------------------------------------------------------- */

function buildPalette() {
  controls.palette.innerHTML =
    "";

  PALETTE.forEach(
    (hex) => {
      const swatch =
        document.createElement(
          "button"
        );

      swatch.type =
        "button";

      swatch.className =
        "swatch";

      swatch.style.background =
        hex;

      swatch.dataset.color =
        hex;

      swatch.title =
        hex;

      if (
        hex === selectedColor
      ) {
        swatch.classList.add(
          "selected"
        );
      }

      swatch.addEventListener(
        "click",
        () => {
          selectedColor =
            hex;

          refreshPalette();

          applyBackgroundColor();
        }
      );

      controls.palette.appendChild(
        swatch
      );
    }
  );
}


function refreshPalette() {
  controls.palette
    .querySelectorAll(
      ".swatch"
    )
    .forEach(
      (swatch) => {
        swatch.classList.toggle(
          "selected",

          swatch.dataset.color ===
            selectedColor
        );
      }
    );
}


function applyBackgroundColor() {
  document.body.style.background =
    selectedColor;

  document
    .getElementById(
      "canvas-container"
    )
    .style.background =
      selectedColor;
}


/* ---------------------------------------------------------
   KEYBOARD
--------------------------------------------------------- */

function keyPressed() {
  if (
    key === "p" ||
    key === "P"
  ) {
    playAnimation();
  }

  if (
    keyCode === ESCAPE
  ) {
    controls.controls
      .classList
      .toggle(
        "hidden"
      );

    return false;
  }
}
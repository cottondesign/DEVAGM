/*
 * Reel compiler & exporter.
 *
 * Clips are full preset snapshots (collectPresetSnapshot)
 * plus a thumbnail and per-clip trim. Playback / export
 * re-applies each snapshot to the live sketch, forces the
 * sequence aspect ratio, and steps draw() with a fixed
 * time step so every mode advances deterministically.
 */

const REEL_STORAGE_KEY =
  "devagm-11-cube-unfold-reel";
const REEL_PRESET_STORAGE_KEY =
  "devagm-11-cube-unfold-reel-presets";

/*
 * Simulation always advances at 60 steps / second —
 * several modes move a fixed amount per frame, so this
 * keeps their speed identical to the live sketch.
 */
const REEL_SIM_FPS = 60;
const REEL_MAX_TRIM_SECONDS = 30;
const REEL_MAX_CLIP_SECONDS = 1200;
const REEL_THUMB_WIDTH = 320;

const reel = {
  clips: [],
  aspectRatio: "16:9",
  defaultDuration: 4,
  fps: 30,
  resolutionScale: 1,
  cameraZoomScale: 1,
  expanded: false,
  job: null,
  preview: null,
  dragId: null
};

const reelEls = {};
let reelPersistTimer = null;

function initReel() {
  const ids = [
    "reelSummary",
    "reelAddClipButton",
    "reelEditorHead",
    "reelBackButton",
    "reelAutoArrangeButton",
    "reelAlternateArrangeButton",
    "reelContrastNote",
    "reelAspectRatio",
    "reelCameraZoomScale",
    "reelCameraZoomScaleValue",
    "reelDefaultDuration",
    "reelDefaultDurationValue",
    "reelClipList",
    "reelEmptyNote",
    "reelArrangeButton",
    "reelClearSequenceButton",
    "reelFps",
    "reelResolution",
    "reelPreviewButton",
    "reelExportButton",
    "reelProgress",
    "reelProgressBar",
    "reelProgressText",
    "reelProgressPercent",
    "reelCancelButton",
    "reelExportNote",
    "reelSavePresetButton",
    "reelPreviewControls",
    "reelScrubber",
    "reelPreviewClip",
    "reelPreviewTime",
    "reelPlayButton",
    "reelExitPreviewButton",
    "reelPresetControls",
    "reelPresetSelect",
    "reelLoadPresetButton",
    "reelDeletePresetButton"
  ];

  for (const id of ids) {
    const element = document.getElementById(id);

    if (!element) {
      throw new Error(`Missing reel element: ${id}`);
    }

    reelEls[id] = element;
  }

  reelEls.reelAspectRatio.innerHTML =
    controls.aspectRatio.innerHTML;

  reel.aspectRatio = controls.aspectRatio.value;
  restoreReelState();
  syncReelSettingInputs();

  connectReelControls();
  refreshReelPresetSelect();
  renderReel();
}

function syncReelSettingInputs() {
  reelEls.reelAspectRatio.value = reel.aspectRatio;
  reelEls.reelCameraZoomScale.value = String(
    reel.cameraZoomScale || 1
  );
  reelEls.reelDefaultDuration.value =
    String(reel.defaultDuration);
  reelEls.reelFps.value = String(reel.fps);
  reelEls.reelResolution.value =
    String(reel.resolutionScale);
}

function connectReelControls() {
  reelEls.reelAddClipButton.addEventListener(
    "click",
    addClipToSequence
  );

  reelEls.reelArrangeButton.addEventListener(
    "click",
    () => setReelExpanded(true)
  );

  reelEls.reelClearSequenceButton.addEventListener(
    "click",
    clearReelSequence
  );

  reelEls.reelBackButton.addEventListener(
    "click",
    () => setReelExpanded(false)
  );

  reelEls.reelAutoArrangeButton.addEventListener(
    "click",
    autoArrangeClips
  );

  reelEls.reelAlternateArrangeButton.addEventListener(
    "click",
    alternateArrangeClips
  );

  reelEls.reelAspectRatio.addEventListener(
    "change",
    () => {
      reel.aspectRatio = reelEls.reelAspectRatio.value;
      persistReelState();
      renderReel();
      refreshReelThumbnails(reel.clips.slice());
    }
  );

  reelEls.reelCameraZoomScale.addEventListener(
    "input",
    () => {
      reel.cameraZoomScale =
        Number(reelEls.reelCameraZoomScale.value) || 1;
      renderReel();
    }
  );

  reelEls.reelCameraZoomScale.addEventListener(
    "change",
    () => {
      reel.cameraZoomScale =
        Number(reelEls.reelCameraZoomScale.value) || 1;
      persistReelState();

      if (reel.clips.length && !reel.job) {
        refreshReelThumbnails(reel.clips.slice());
      }
    }
  );

  reelEls.reelDefaultDuration.addEventListener(
    "input",
    () => {
      reel.defaultDuration = Number(
        reelEls.reelDefaultDuration.value
      );
      persistReelState();
      renderReel();
    }
  );

  reelEls.reelFps.addEventListener("change", () => {
    reel.fps = Number(reelEls.reelFps.value) || 30;
    persistReelState();
  });

  reelEls.reelResolution.addEventListener(
    "change",
    () => {
      reel.resolutionScale =
        Number(reelEls.reelResolution.value) || 1;
      persistReelState();
      renderReel();
    }
  );

  reelEls.reelPreviewButton.addEventListener(
    "click",
    previewReel
  );

  reelEls.reelExportButton.addEventListener(
    "click",
    exportReel
  );

  reelEls.reelCancelButton.addEventListener(
    "click",
    () => {
      if (reel.job) {
        reel.job.cancelled = true;
      }
    }
  );

  reelEls.reelPlayButton.addEventListener(
    "click",
    toggleReelPreviewPlayback
  );

  reelEls.reelExitPreviewButton.addEventListener(
    "click",
    exitReelPreview
  );

  reelEls.reelScrubber.addEventListener(
    "pointerdown",
    beginReelScrub
  );

  reelEls.reelScrubber.addEventListener("input", () => {
    const preview = reel.preview;

    if (!preview) {
      return;
    }

    beginReelScrub();
    preview.seekTo = Number(reelEls.reelScrubber.value);
    syncReelPreviewUI();
  });

  reelEls.reelScrubber.addEventListener(
    "change",
    endReelScrub
  );

  reelEls.reelScrubber.addEventListener(
    "pointerup",
    endReelScrub
  );

  reelEls.reelScrubber.addEventListener(
    "pointercancel",
    endReelScrub
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && reel.preview) {
      exitReelPreview();
    }
  });

  reelEls.reelSavePresetButton.addEventListener(
    "click",
    saveSequenceAsPreset
  );

  reelEls.reelPresetSelect.addEventListener(
    "change",
    () => {
      if (reelEls.reelPresetSelect.value) {
        loadSelectedSequencePreset();
      }
    }
  );

  reelEls.reelLoadPresetButton.addEventListener(
    "click",
    loadSelectedSequencePreset
  );

  reelEls.reelDeletePresetButton.addEventListener(
    "click",
    deleteSelectedSequencePreset
  );

  connectReelDragAndDrop();
}

/* ------------------------------------------------------------------
 * Clips
 * ---------------------------------------------------------------- */

function createReelClipId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 7)
  );
}

function reelOptionLabel(select, value) {
  const option = [...select.options].find(
    (entry) => entry.value === value
  );

  if (!option) {
    return String(value);
  }

  return option.textContent
    .replace(/\s+/g, " ")
    .replace(/\s*\(.*\)\s*$/, "")
    .trim();
}

function buildReelClipName(snapshot) {
  const fields = snapshot.fields || {};
  const mode = fields.sketchMode || "gridded";

  const colorLabel =
    mode === "image"
      ? reelOptionLabel(
          controls.imageColorMode,
          fields.imageColorMode
        )
      : reelOptionLabel(
          controls.colorMode,
          fields.colorMode
        );

  return [
    reelOptionLabel(controls.sketchMode, mode),
    colorLabel,
    reelOptionLabel(
      controls.backgroundTheme,
      fields.backgroundTheme
    ),
    `${Number(fields.cameraZoom || 1).toFixed(2)}× zoom`
  ].join(" – ");
}

function uniqueReelClipName(base) {
  const names = new Set(
    reel.clips.map((clip) => clip.name)
  );

  if (!names.has(base)) {
    return base;
  }

  let n = 2;

  while (names.has(`${base} (${n})`)) {
    n++;
  }

  return `${base} (${n})`;
}

function addClipToSequence() {
  if (reel.job) {
    return;
  }

  const snapshot = JSON.parse(
    JSON.stringify(collectPresetSnapshot())
  );

  if (!reel.clips.length) {
    reel.aspectRatio = snapshot.fields.aspectRatio;
    reelEls.reelAspectRatio.value = reel.aspectRatio;
  }

  const clip = {
    id: createReelClipId(),
    name: uniqueReelClipName(
      buildReelClipName(snapshot)
    ),
    snapshot,
    thumbnail: "",
    duration: null,
    trimStart: 0,
    image:
      snapshot.fields.sketchMode === "image" &&
      sourceImageData
        ? {
            data: sourceImageData,
            key: sourceImageKey,
            name: sourceImageName
          }
        : null,
    imageMissing: false
  };

  const sameAspect =
    snapshot.fields.aspectRatio === reel.aspectRatio;

  if (sameAspect) {
    clip.thumbnail = captureReelThumbnail();
  }

  reel.clips.push(clip);
  persistReelState();
  renderReel();

  if (!sameAspect) {
    refreshReelThumbnails([clip]);
  }
}

function removeReelClip(id) {
  reel.clips = reel.clips.filter(
    (clip) => clip.id !== id
  );
  persistReelState();
  renderReel();
}

function clearReelSequence() {
  if (reel.job || !reel.clips.length) {
    return;
  }

  if (
    !window.confirm(
      "Remove all clips from this sequence? This can't be undone."
    )
  ) {
    return;
  }

  reel.clips = [];
  setReelExpanded(false);
  persistReelState();
  renderReel();
}

function moveReelClip(id, delta) {
  const from = reel.clips.findIndex(
    (clip) => clip.id === id
  );
  const to = from + delta;

  if (from < 0 || to < 0 || to >= reel.clips.length) {
    return;
  }

  const [clip] = reel.clips.splice(from, 1);
  reel.clips.splice(to, 0, clip);
  persistReelState();
  renderReel();
}

function getReelClipDuration(clip) {
  const value =
    clip.duration === null || clip.duration === undefined
      ? reel.defaultDuration
      : clip.duration;

  return constrain(
    Number(value) || reel.defaultDuration,
    0.1,
    REEL_MAX_CLIP_SECONDS
  );
}

function getReelClipTrim(clip) {
  return constrain(
    Number(clip.trimStart) || 0,
    0,
    REEL_MAX_TRIM_SECONDS
  );
}

function getReelTotalSeconds() {
  return reel.clips.reduce(
    (sum, clip) => sum + getReelClipDuration(clip),
    0
  );
}

/*
 * Applies a clip to the live sketch. The sequence
 * aspect ratio replaces the clip's own so the frame
 * is re-laid-out (not cropped) at the reel size.
 */
function applyReelClip(clip) {
  const snapshot = JSON.parse(
    JSON.stringify(clip.snapshot)
  );

  snapshot.fields.aspectRatio = reel.aspectRatio;

  if (clip.image) {
    sourceImageData = clip.image.data;
    sourceImageKey = clip.image.key;
    sourceImageName = clip.image.name;
  }

  applyPresetSnapshot(snapshot);

  const zoomScale = reel.cameraZoomScale || 1;

  if (zoomScale !== 1) {
    const baseZoom =
      Number(controls.cameraZoom.value) || 1;

    controls.cameraZoom.value = String(
      constrain(baseZoom * zoomScale, 0.15, 4.5)
    );
  }

  resetOneAtATimeState();
  resetShuffleInnerColors();
  animationPauseTimer = 0;
  cascadeTime = 0;
  rollGridTime = 0;
  wanderTime = 0;
  insideOutTime = 0;
  randomSeed(Number(snapshot.placementSeed) || 0);
  updateImageUploadNote();
}

function loadReelClipIntoSketch(id) {
  const clip = reel.clips.find(
    (entry) => entry.id === id
  );

  if (!clip || reel.job) {
    return;
  }

  applyReelClip(clip);
}

/* ------------------------------------------------------------------
 * Thumbnails
 * ---------------------------------------------------------------- */

function getSketchCanvasElement() {
  return drawingContext.canvas;
}

function captureReelThumbnail() {
  const source = getSketchCanvasElement();
  const w = REEL_THUMB_WIDTH;
  const h = Math.max(
    1,
    Math.round((w * source.height) / source.width)
  );

  const thumb = document.createElement("canvas");
  thumb.width = w;
  thumb.height = h;

  const ctx = thumb.getContext("2d");
  ctx.drawImage(source, 0, 0, w, h);

  return thumb.toDataURL("image/jpeg", 0.82);
}

async function refreshReelThumbnails(clips) {
  if (!clips.length) {
    return;
  }

  await runReelJob("thumbnails", async (job) => {
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];

      if (!reel.clips.includes(clip)) {
        continue;
      }

      setReelProgress(
        `Rendering thumbnail ${i + 1} / ${clips.length}`,
        i / clips.length
      );

      applyReelClip(clip);

      if (!(await prerollReelClip(job, clip))) {
        return;
      }

      reelStepFrame();
      clip.thumbnail = captureReelThumbnail();
      renderReelClips();
      await reelYield();

      if (job.cancelled) {
        return;
      }
    }
  });

  persistReelState();
}

/* ------------------------------------------------------------------
 * Auto arrange — visual difference between clips
 * ---------------------------------------------------------------- */

const REEL_MODE_FAMILY = {
  gridded: "nets",
  gradient: "nets",
  image: "nets",
  "one-at-a-time": "nets",
  cascade: "stream",
  "roll-grid": "solids",
  "wander-roll": "solids",
  wander: "wander",
  "inside-out": "wander"
};

const REEL_COLOR_FAMILY = {
  monochromatic: "mono",
  multicolored: "multi",
  "two-tone": "two-tone",
  "two-tone-multi": "two-tone",
  "two-tone-shuffle": "shuffle",
  "two-tone-shuffle-sync": "shuffle"
};

const REEL_ZOOM_LOG_RANGE = [
  Math.log(0.15),
  Math.log(4.5)
];

function getScaledReelClipCameraZoom(fields) {
  const base = constrain(
    Number(fields.cameraZoom) || 1,
    0.15,
    4.5
  );
  const scale = constrain(
    reel.cameraZoomScale || 1,
    0.25,
    4
  );

  return constrain(base * scale, 0.15, 4.5);
}

function getReelClipFeatures(clip) {
  const snapshot = clip.snapshot;
  const fields = snapshot.fields || {};
  const mode = fields.sketchMode || "gridded";
  const colorMode =
    mode === "image"
      ? `image-${fields.imageColorMode || "faces"}`
      : fields.colorMode || "monochromatic";

  const bgHex =
    BACKGROUNDS[fields.backgroundTheme] ||
    BACKGROUNDS.light;
  const bg = hexToRgb(bgHex);
  const bgLum =
    (0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b) / 255;

  const zoom = Math.log(
    getScaledReelClipCameraZoom(fields)
  );

  let accent = null;

  if (colorMode === "monochromatic") {
    accent = snapshot.monoColor;
  } else if (
    colorMode === "two-tone" ||
    colorMode.startsWith("two-tone-shuffle")
  ) {
    accent = snapshot.outerColor;
  } else if (colorMode === "two-tone-multi") {
    accent = snapshot.innerColor;
  }

  let accentHsl = null;

  if (typeof accent === "string") {
    const rgb = hexToRgb(accent);
    accentHsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  }

  return {
    mode,
    modeFamily: REEL_MODE_FAMILY[mode] || mode,
    colorMode,
    colorFamily:
      REEL_COLOR_FAMILY[colorMode] || "image",
    bgLum,
    zoom:
      (zoom - REEL_ZOOM_LOG_RANGE[0]) /
      (REEL_ZOOM_LOG_RANGE[1] - REEL_ZOOM_LOG_RANGE[0]),
    accentHsl,
    density:
      (Number(fields.gridSize) || 64) / 100
  };
}

function reelCategoryDistance(a, b, familyA, familyB) {
  if (a === b) {
    return 0;
  }

  return familyA === familyB ? 0.5 : 1;
}

function reelAccentDistance(a, b) {
  if (!a.accentHsl || !b.accentHsl) {
    return a.accentHsl || b.accentHsl ? 0.6 : 0.25;
  }

  const ca = a.accentHsl;
  const cb = b.accentHsl;

  let hue = Math.abs(ca.h - cb.h) / 360;
  hue = Math.min(hue, 1 - hue) * 2;

  return constrain(
    hue * Math.min(ca.s, cb.s) * 0.6 +
      Math.abs(ca.l - cb.l) * 0.4,
    0,
    1
  );
}

/*
 * 0 = visually identical, 1 = maximal contrast.
 * Background brightness and zoom dominate because they
 * change the whole frame at a cut.
 */
function reelClipDifference(a, b) {
  return (
    0.32 * Math.abs(a.bgLum - b.bgLum) +
    0.22 * Math.abs(a.zoom - b.zoom) +
    0.2 *
      reelCategoryDistance(
        a.mode,
        b.mode,
        a.modeFamily,
        b.modeFamily
      ) +
    0.12 *
      reelCategoryDistance(
        a.colorMode,
        b.colorMode,
        a.colorFamily,
        b.colorFamily
      ) +
    0.1 * reelAccentDistance(a, b) +
    0.04 * Math.abs(a.density - b.density)
  );
}

function buildReelDifferenceMatrix(clips) {
  const features = clips.map(getReelClipFeatures);

  return features.map((a) =>
    features.map((b) => reelClipDifference(a, b))
  );
}

/*
 * Concave reward: a tiny gap costs far more than a big
 * gap gains, so the order avoids near-duplicate cuts
 * instead of trading them for a few huge ones. The
 * second-neighbor term spreads similar clips apart but
 * is kept light so it never outweighs an adjacent cut.
 */
const REEL_SECOND_NEIGHBOR_WEIGHT = 0.15;

function reelOrderScore(order, matrix) {
  const reward = (d) => 1 - Math.exp(-3.2 * d);
  let score = 0;

  for (let i = 0; i + 1 < order.length; i++) {
    score += reward(matrix[order[i]][order[i + 1]]);
  }

  for (let i = 0; i + 2 < order.length; i++) {
    score +=
      REEL_SECOND_NEIGHBOR_WEIGHT *
      reward(matrix[order[i]][order[i + 2]]);
  }

  return score;
}

function permuteReelOrders(n, visit) {
  const order = [...Array(n).keys()];

  const recurse = (k) => {
    if (k === n) {
      visit(order);
      return;
    }

    for (let i = k; i < n; i++) {
      [order[k], order[i]] = [order[i], order[k]];
      recurse(k + 1);
      [order[k], order[i]] = [order[i], order[k]];
    }
  };

  recurse(0);
}

function greedyReelOrder(start, matrix) {
  const n = matrix.length;
  const used = new Array(n).fill(false);
  const order = [start];
  used[start] = true;

  while (order.length < n) {
    const last = order[order.length - 1];
    const prev =
      order.length > 1 ? order[order.length - 2] : -1;
    let best = -1;
    let bestScore = -Infinity;

    for (let j = 0; j < n; j++) {
      if (used[j]) {
        continue;
      }

      const score =
        matrix[last][j] +
        (prev >= 0
          ? REEL_SECOND_NEIGHBOR_WEIGHT * matrix[prev][j]
          : 0);

      if (score > bestScore) {
        bestScore = score;
        best = j;
      }
    }

    used[best] = true;
    order.push(best);
  }

  return order;
}

function improveReelOrder(order, matrix) {
  let best = order.slice();
  let bestScore = reelOrderScore(best, matrix);
  let improved = true;

  while (improved) {
    improved = false;

    for (let i = 0; i < best.length; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidates = [];

        const swapped = best.slice();
        [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
        candidates.push(swapped);

        const reversed = best
          .slice(0, i)
          .concat(best.slice(i, j + 1).reverse())
          .concat(best.slice(j + 1));
        candidates.push(reversed);

        const moved = best.slice();
        const [item] = moved.splice(i, 1);
        moved.splice(j, 0, item);
        candidates.push(moved);

        for (const candidate of candidates) {
          const score = reelOrderScore(candidate, matrix);

          if (score > bestScore + 1e-9) {
            best = candidate;
            bestScore = score;
            improved = true;
          }
        }
      }
    }
  }

  return { order: best, score: bestScore };
}

function reelOrderKey(order) {
  return order.join(",");
}

function listReelContrastOrders(clips) {
  const n = clips.length;
  const matrix = buildReelDifferenceMatrix(clips);
  const ranked = new Map();

  const addOrder = (order) => {
    const key = reelOrderKey(order);
    const score = reelOrderScore(order, matrix);
    const existing = ranked.get(key);

    if (existing === undefined || score > existing) {
      ranked.set(key, score);
    }
  };

  if (n <= 1) {
    addOrder([0]);
  } else if (n === 2) {
    addOrder([0, 1]);
    addOrder([1, 0]);
  } else if (n <= 8) {
    permuteReelOrders(n, (order) => {
      addOrder(order.slice());
    });
  } else {
    for (let start = 0; start < n; start++) {
      const result = improveReelOrder(
        greedyReelOrder(start, matrix),
        matrix
      );

      addOrder(result.order);
    }
  }

  return [...ranked.entries()]
    .map(([key, score]) => ({
      order: key.split(",").map(Number),
      score
    }))
    .sort((a, b) => b.score - a.score);
}

function computeReelContrastOrder(clips, rank = 0) {
  const orders = listReelContrastOrders(clips);

  if (!orders.length) {
    return [...Array(clips.length).keys()];
  }

  const index = Math.min(
    Math.max(0, rank),
    orders.length - 1
  );

  return orders[index].order;
}

function applyReelContrastOrder(order) {
  reel.clips = order.map((index) => reel.clips[index]);
  persistReelState();
  renderReel();
}

function autoArrangeClips() {
  if (reel.job || reel.clips.length < 3) {
    return;
  }

  applyReelContrastOrder(computeReelContrastOrder(reel.clips, 0));
}

function alternateArrangeClips() {
  if (reel.job || reel.clips.length < 3) {
    return;
  }

  const orders = listReelContrastOrders(reel.clips);
  const currentKey = reelOrderKey(
    [...Array(reel.clips.length).keys()]
  );
  const currentIndex = orders.findIndex(
    (entry) => reelOrderKey(entry.order) === currentKey
  );
  const start = currentIndex >= 0 ? currentIndex : 0;

  for (let offset = 1; offset <= orders.length; offset++) {
    const entry = orders[(start + offset) % orders.length];

    if (reelOrderKey(entry.order) !== currentKey) {
      applyReelContrastOrder(entry.order);
      return;
    }
  }
}

/* ------------------------------------------------------------------
 * Rendering engine
 * ---------------------------------------------------------------- */

function reelYield() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function reelWait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reelNextAnimationFrame() {
  return new Promise((resolve) =>
    requestAnimationFrame(resolve)
  );
}

function reelStepFrame() {
  reelFrameStep = true;

  try {
    redraw();
  } finally {
    reelFrameStep = false;
  }
}

/* Advances one step without rendering it. */
function reelSimulateFrame() {
  reelSimulateOnly = true;

  try {
    reelStepFrame();
  } finally {
    reelSimulateOnly = false;
  }
}

async function prerollReelClip(job, clip) {
  const steps = Math.round(
    getReelClipTrim(clip) * REEL_SIM_FPS
  );
  let sliceStart = performance.now();

  for (let i = 0; i < steps; i++) {
    reelSimulateFrame();

    if (performance.now() - sliceStart > 30) {
      await reelYield();
      sliceStart = performance.now();

      if (job.cancelled) {
        return false;
      }
    }
  }

  return !job.cancelled;
}

/*
 * Takes over the sketch for a render job, then puts
 * the user's live settings (and uploaded image) back.
 */
async function runReelJob(kind, work) {
  if (reel.job) {
    return { ok: false, job: null };
  }

  const job = { kind, cancelled: false, error: null };
  const restoreSnapshot = collectPresetSnapshot();
  const restoreImage = {
    data: sourceImageData,
    key: sourceImageKey,
    name: sourceImageName
  };

  reel.job = job;
  reelRendering = true;
  fixedFrameDeltaMs = 1000 / REEL_SIM_FPS;
  noLoop();
  document.body.classList.add("reel-busy");
  syncReelBusyUI();

  let result = false;

  try {
    result = await work(job);
  } catch (error) {
    console.error(error);
    job.error = error;
  } finally {
    reelRendering = false;

    sourceImageData = restoreImage.data;
    sourceImageKey = restoreImage.key;
    sourceImageName = restoreImage.name;

    applyPresetSnapshot(restoreSnapshot);
    resetOneAtATimeState();
    resetShuffleInnerColors();
    updateImageUploadNote();

    reel.job = null;
    document.body.classList.remove("reel-busy");

    /*
     * loop() draws one frame synchronously; keep the
     * fixed step for it so the time since the job
     * started isn't applied as one giant jump.
     */
    loop();
    fixedFrameDeltaMs = null;
    syncReelBusyUI();
  }

  if (job.error) {
    setReelNote(
      `Render failed: ${job.error.message || job.error}`
    );
  }

  return { ok: Boolean(result) && !job.error, job };
}

function getReelExportSize() {
  const preset =
    ASPECT_PRESETS[reel.aspectRatio] ||
    ASPECT_PRESETS["16:9"];
  const size = resolveAspectCanvasSize(preset);
  const scale = reel.resolutionScale || 1;
  const even = (value) =>
    Math.max(2, Math.floor(value / 2) * 2);

  return {
    width: even(size.width * size.pixelDensity * scale),
    height: even(size.height * size.pixelDensity * scale)
  };
}

/*
 * Preview stays open until exited. Seeking re-applies
 * the target clip and steps from its start (or keeps
 * stepping forward when the target is later in the
 * clip already on screen), so any frame matches what
 * playback and export would show.
 */
async function previewReel() {
  const clips = reel.clips.slice();

  if (!clips.length || reel.job) {
    return;
  }

  const starts = [];
  let total = 0;

  for (const clip of clips) {
    starts.push(total);
    total += getReelClipDuration(clip);
  }

  const preview = {
    clips,
    starts,
    total,
    time: 0,
    seekTo: 0,
    playing: true,
    scrubbing: false,
    resumeAfterScrub: false,
    clipIndex: -1,
    stepsDone: 0
  };

  reel.preview = preview;

  await runReelJob("preview", async (job) => {
    syncReelPreviewUI();

    let last = performance.now();

    while (!job.cancelled) {
      if (preview.seekTo !== null) {
        const target = preview.seekTo;
        preview.seekTo = null;

        if (!(await seekReelPreview(job, preview, target))) {
          return false;
        }

        syncReelPreviewUI();
        last = performance.now();
      }

      await reelNextAnimationFrame();

      const now = performance.now();

      if (preview.playing && preview.seekTo === null) {
        const dt = Math.min(
          (now - last) / 1000,
          4 / REEL_SIM_FPS
        );
        const target = Math.min(
          preview.total,
          preview.time + dt
        );

        if (!(await seekReelPreview(job, preview, target))) {
          return false;
        }

        if (target >= preview.total) {
          preview.playing = false;
        }

        syncReelPreviewUI();
      }

      last = now;
    }

    return false;
  });

  reel.preview = null;
  syncReelBusyUI();
}

function getReelPreviewLocation(preview, seconds) {
  const t = constrain(seconds, 0, preview.total);
  const last = preview.clips.length - 1;
  let index = last;

  for (let i = 0; i < last; i++) {
    if (t < preview.starts[i + 1]) {
      index = i;
      break;
    }
  }

  const steps = Math.max(
    1,
    Math.round(
      getReelClipDuration(preview.clips[index]) *
        REEL_SIM_FPS
    )
  );
  const step = Math.min(
    steps,
    Math.floor((t - preview.starts[index]) * REEL_SIM_FPS) + 1
  );

  return { index, step };
}

async function seekReelPreview(job, preview, seconds) {
  const { index, step } = getReelPreviewLocation(
    preview,
    seconds
  );

  if (
    index !== preview.clipIndex ||
    step < preview.stepsDone
  ) {
    const clip = preview.clips[index];

    preview.clipIndex = -1;
    applyReelClip(clip);

    if (!(await prerollReelClip(job, clip))) {
      return false;
    }

    preview.clipIndex = index;
    preview.stepsDone = 0;
  }

  let sliceStart = performance.now();

  while (preview.stepsDone < step) {
    if (preview.stepsDone === step - 1) {
      reelStepFrame();
    } else {
      reelSimulateFrame();
    }

    preview.stepsDone++;

    if (performance.now() - sliceStart > 30) {
      await reelYield();
      sliceStart = performance.now();

      if (job.cancelled) {
        return false;
      }
    }
  }

  preview.time = constrain(seconds, 0, preview.total);
  return true;
}

function syncReelPreviewUI() {
  const preview = reel.preview;

  if (!preview) {
    return;
  }

  const shown = preview.scrubbing
    ? Number(reelEls.reelScrubber.value)
    : preview.time;
  const { index } = getReelPreviewLocation(preview, shown);

  reelEls.reelScrubber.max = String(preview.total);

  if (!preview.scrubbing) {
    reelEls.reelScrubber.value = String(preview.time);
  }

  reelEls.reelPreviewClip.textContent =
    `${index + 1} / ${preview.clips.length} · ${preview.clips[index].name}`;
  reelEls.reelPreviewTime.textContent =
    `${formatReelSeconds(Math.floor(shown * 10) / 10)} / ${formatReelSeconds(preview.total)}`;
  reelEls.reelPlayButton.textContent =
    preview.playing || preview.resumeAfterScrub
      ? "Pause"
      : "Play";
}

function beginReelScrub() {
  const preview = reel.preview;

  if (!preview || preview.scrubbing) {
    return;
  }

  preview.scrubbing = true;
  preview.resumeAfterScrub = preview.playing;
  preview.playing = false;
}

function endReelScrub() {
  const preview = reel.preview;

  if (!preview || !preview.scrubbing) {
    return;
  }

  const value = Number(reelEls.reelScrubber.value);

  preview.scrubbing = false;
  preview.seekTo = value;
  preview.playing =
    preview.resumeAfterScrub && value < preview.total;
  preview.resumeAfterScrub = false;
  syncReelPreviewUI();
}

function toggleReelPreviewPlayback() {
  const preview = reel.preview;

  if (!preview) {
    return;
  }

  if (preview.playing) {
    preview.playing = false;
  } else {
    if (preview.time >= preview.total) {
      preview.seekTo = 0;
    }

    preview.playing = true;
  }

  syncReelPreviewUI();
}

function exitReelPreview() {
  if (reel.job && reel.job.kind === "preview") {
    reel.job.cancelled = true;
  }
}

async function exportReel() {
  const clips = reel.clips.slice();

  if (!clips.length) {
    return;
  }

  const fps = reel.fps === 60 ? 60 : 30;
  const stepsPerFrame = Math.round(REEL_SIM_FPS / fps);
  const size = getReelExportSize();

  const out = document.createElement("canvas");
  out.width = size.width;
  out.height = size.height;

  const outCtx = out.getContext("2d", { alpha: false });

  const frameCounts = clips.map((clip) =>
    Math.max(1, Math.round(getReelClipDuration(clip) * fps))
  );
  const totalFrames = frameCounts.reduce(
    (sum, count) => sum + count,
    0
  );

  let blob = null;
  let extension = "mp4";

  const { ok, job: finishedJob } = await runReelJob("export", async (job) => {
    setReelProgress("Preparing encoder…", 0);

    const encoder =
      (await createWebCodecsReelEncoder(
        size.width,
        size.height,
        fps
      )) ||
      createMediaRecorderReelEncoder(out, fps);

    if (!encoder) {
      throw new Error(
        "This browser can't encode video (no WebCodecs or MediaRecorder)."
      );
    }

    extension = encoder.extension;

    let frameIndex = 0;

    try {
      for (let c = 0; c < clips.length; c++) {
        const clip = clips[c];

        setReelProgress(
          `Clip ${c + 1} / ${clips.length} · ${clip.name}`,
          frameIndex / totalFrames
        );

        applyReelClip(clip);

        if (!(await prerollReelClip(job, clip))) {
          encoder.abort();
          return false;
        }

        for (let f = 0; f < frameCounts[c]; f++) {
          for (let s = 0; s < stepsPerFrame; s++) {
            reelStepFrame();
          }

          outCtx.drawImage(
            getSketchCanvasElement(),
            0,
            0,
            size.width,
            size.height
          );

          await encoder.addFrame(out, frameIndex);
          frameIndex++;

          if (frameIndex % 4 === 0) {
            setReelProgress(
              `Clip ${c + 1} / ${clips.length} · ${clip.name}`,
              frameIndex / totalFrames
            );
            await reelYield();
          }

          if (job.cancelled) {
            encoder.abort();
            return false;
          }
        }
      }

      setReelProgress("Finalizing video…", 1);
      blob = await encoder.finish();
    } catch (error) {
      encoder.abort();
      throw error;
    }

    return true;
  });

  if (ok && blob) {
    downloadReelBlob(blob, extension);
    setReelNote(
      `Exported ${totalFrames} frames · ${size.width}×${size.height} · ${fps} fps · ${extension.toUpperCase()}.`
    );
  } else if (finishedJob && finishedJob.cancelled) {
    setReelNote("Export cancelled.");
  }
}

function downloadReelBlob(blob, extension) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);

  link.href = url;
  link.download = `cube-reel-${stamp}.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function createWebCodecsReelEncoder(width, height, fps) {
  if (
    typeof VideoEncoder === "undefined" ||
    typeof VideoFrame === "undefined" ||
    typeof Mp4Muxer === "undefined"
  ) {
    return null;
  }

  const bitrate = Math.round(
    constrain(width * height * fps * 0.12, 6e6, 60e6)
  );

  const codecs = [
    "avc1.640034",
    "avc1.640033",
    "avc1.64002A",
    "avc1.4D0034",
    "avc1.42003E"
  ];

  let config = null;

  for (const codec of codecs) {
    const candidate = {
      codec,
      width,
      height,
      bitrate,
      framerate: fps,
      avc: { format: "avc" }
    };

    try {
      const support =
        await VideoEncoder.isConfigSupported(candidate);

      if (support.supported) {
        config = candidate;
        break;
      }
    } catch (error) {
      /* Try the next profile. */
    }
  }

  if (!config) {
    return null;
  }

  const target = new Mp4Muxer.ArrayBufferTarget();
  const muxer = new Mp4Muxer.Muxer({
    target,
    video: {
      codec: "avc",
      width,
      height,
      frameRate: fps
    },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset"
  });

  let failure = null;

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (error) => {
      failure = error;
    }
  });

  encoder.configure(config);

  const frameDuration = Math.round(1e6 / fps);

  return {
    extension: "mp4",

    async addFrame(canvas, index) {
      if (failure) {
        throw failure;
      }

      const frame = new VideoFrame(canvas, {
        timestamp: index * frameDuration,
        duration: frameDuration
      });

      encoder.encode(frame, {
        keyFrame: index % (fps * 2) === 0
      });
      frame.close();

      while (encoder.encodeQueueSize > 6) {
        await reelWait(2);
      }
    },

    async finish() {
      await encoder.flush();

      if (failure) {
        throw failure;
      }

      muxer.finalize();
      encoder.close();

      return new Blob([target.buffer], {
        type: "video/mp4"
      });
    },

    abort() {
      try {
        if (encoder.state !== "closed") {
          encoder.close();
        }
      } catch (error) {
        /* Already closed. */
      }
    }
  };
}

/*
 * Fallback when WebCodecs is missing: records the
 * output canvas in real time, so each frame is held
 * for 1 / fps seconds of wall clock.
 */
function createMediaRecorderReelEncoder(canvas, fps) {
  if (
    typeof MediaRecorder === "undefined" ||
    !canvas.captureStream
  ) {
    return null;
  }

  const types = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];
  const mimeType =
    types.find((type) => MediaRecorder.isTypeSupported(type)) ||
    "";

  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const manualFrames =
    track && typeof track.requestFrame === "function";
  const recorderStream = manualFrames
    ? stream
    : canvas.captureStream(fps);

  const recorder = new MediaRecorder(recorderStream, {
    mimeType: mimeType || undefined,
    videoBitsPerSecond: Math.round(
      constrain(canvas.width * canvas.height * fps * 0.12, 6e6, 40e6)
    )
  });

  const chunks = [];

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size) {
      chunks.push(event.data);
    }
  });

  recorder.start(250);

  let start = null;

  const stopTracks = () => {
    for (const t of recorderStream.getTracks()) {
      t.stop();
    }

    if (recorderStream !== stream) {
      for (const t of stream.getTracks()) {
        t.stop();
      }
    }
  };

  return {
    extension: mimeType.includes("mp4") ? "mp4" : "webm",

    async addFrame(_, index) {
      if (start === null) {
        start = performance.now();
      }

      if (manualFrames) {
        track.requestFrame();
      }

      const delay =
        start + ((index + 1) * 1000) / fps - performance.now();

      if (delay > 0) {
        await reelWait(delay);
      }
    },

    finish() {
      return new Promise((resolve) => {
        recorder.addEventListener(
          "stop",
          () => {
            stopTracks();
            resolve(
              new Blob(chunks, {
                type: mimeType || "video/webm"
              })
            );
          },
          { once: true }
        );
        recorder.stop();
      });
    },

    abort() {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }

      stopTracks();
    }
  };
}

/* ------------------------------------------------------------------
 * Persistence
 * ---------------------------------------------------------------- */

function persistReelState() {
  if (reelPersistTimer !== null) {
    clearTimeout(reelPersistTimer);
  }

  reelPersistTimer = setTimeout(() => {
    reelPersistTimer = null;
    writeReelState();
  }, 200);
}

function serializeReelClip(clip) {
  return {
    id: clip.id,
    name: clip.name,
    snapshot: clip.snapshot,
    thumbnail: clip.thumbnail,
    duration: clip.duration,
    trimStart: clip.trimStart,
    usesImage:
      clip.snapshot.fields.sketchMode === "image"
  };
}

function deserializeReelClips(clips) {
  return clips
    .filter((clip) => clip && clip.snapshot && clip.snapshot.fields)
    .map((clip) => ({
      id: clip.id || createReelClipId(),
      name: clip.name || buildReelClipName(clip.snapshot),
      snapshot: clip.snapshot,
      thumbnail: clip.thumbnail || "",
      duration:
        clip.duration === null || clip.duration === undefined
          ? null
          : Number(clip.duration),
      trimStart: Number(clip.trimStart) || 0,
      image: null,
      imageMissing: Boolean(clip.usesImage)
    }));
}

function serializeReelState() {
  return {
    version: 1,
    aspectRatio: reel.aspectRatio,
    defaultDuration: reel.defaultDuration,
    fps: reel.fps,
    resolutionScale: reel.resolutionScale,
    cameraZoomScale: reel.cameraZoomScale || 1,
    clips: reel.clips.map(serializeReelClip)
  };
}

function applyReelStateSettings(state) {
  if (ASPECT_PRESETS[state.aspectRatio]) {
    reel.aspectRatio = state.aspectRatio;
  }

  if (Number(state.defaultDuration) > 0) {
    reel.defaultDuration = Number(state.defaultDuration);
  }

  if ([30, 60].includes(Number(state.fps))) {
    reel.fps = Number(state.fps);
  }

  if ([1, 0.75, 0.5].includes(Number(state.resolutionScale))) {
    reel.resolutionScale = Number(state.resolutionScale);
  }

  if (Number(state.cameraZoomScale) > 0) {
    reel.cameraZoomScale = constrain(
      Number(state.cameraZoomScale),
      0.25,
      4
    );
  }

  reel.clips = deserializeReelClips(state.clips);
}

function writeReelState() {
  const state = serializeReelState();

  try {
    localStorage.setItem(
      REEL_STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch (error) {
    /*
     * Quota exceeded: keep the sequence without
     * thumbnails rather than losing it.
     */
    try {
      state.clips.forEach((clip) => {
        clip.thumbnail = "";
      });
      localStorage.setItem(
        REEL_STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch (innerError) {
      /* Storage unavailable. */
    }
  }
}

function restoreReelState() {
  let state = null;

  try {
    state = JSON.parse(
      localStorage.getItem(REEL_STORAGE_KEY) || "null"
    );
  } catch (error) {
    state = null;
  }

  if (!state || !Array.isArray(state.clips)) {
    return;
  }

  applyReelStateSettings(state);
}

/* ------------------------------------------------------------------
 * Sequence presets
 * ---------------------------------------------------------------- */

function readReelPresetStore() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(REEL_PRESET_STORAGE_KEY) || "null"
    );

    return parsed && typeof parsed === "object"
      ? parsed
      : {};
  } catch (error) {
    return {};
  }
}

/*
 * On quota errors the new preset is retried without
 * thumbnails; they re-render when it's loaded.
 */
function writeReelPresetStore(store, name) {
  try {
    localStorage.setItem(
      REEL_PRESET_STORAGE_KEY,
      JSON.stringify(store)
    );
    return true;
  } catch (error) {
    if (!name || !store[name]) {
      return false;
    }

    store[name].clips.forEach((clip) => {
      clip.thumbnail = "";
    });

    try {
      localStorage.setItem(
        REEL_PRESET_STORAGE_KEY,
        JSON.stringify(store)
      );
      return true;
    } catch (innerError) {
      return false;
    }
  }
}

function refreshReelPresetSelect(selectedName = "") {
  const store = readReelPresetStore();
  const names = Object.keys(store).sort((a, b) =>
    a.localeCompare(b)
  );
  const select = reelEls.reelPresetSelect;

  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Load a sequence…";
  select.appendChild(placeholder);

  for (const name of names) {
    const preset = store[name];
    const count = Array.isArray(preset.clips)
      ? preset.clips.length
      : 0;
    const option = document.createElement("option");

    option.value = name;
    option.textContent =
      `${name} · ${count} clip${count === 1 ? "" : "s"}`;
    select.appendChild(option);
  }

  select.value = names.includes(selectedName)
    ? selectedName
    : "";

  reelEls.reelPresetControls.classList.toggle(
    "hidden",
    names.length === 0
  );
}

function saveSequenceAsPreset() {
  if (reel.job || !reel.clips.length) {
    return;
  }

  const store = readReelPresetStore();
  const input = window.prompt(
    "Name this sequence preset",
    `Sequence ${Object.keys(store).length + 1}`
  );

  if (input === null) {
    return;
  }

  const name = input.trim().slice(0, 40);

  if (!name) {
    return;
  }

  if (
    store[name] &&
    !window.confirm(`Replace the sequence preset “${name}”?`)
  ) {
    return;
  }

  store[name] = JSON.parse(
    JSON.stringify({
      ...serializeReelState(),
      savedAt: Date.now()
    })
  );

  if (!writeReelPresetStore(store, name)) {
    setReelNote(
      "Couldn't save the sequence preset — browser storage is full."
    );
    return;
  }

  refreshReelPresetSelect(name);
  setReelNote(
    `Saved sequence preset “${name}” · ${reel.clips.length} clip${reel.clips.length === 1 ? "" : "s"}.`
  );
}

function loadSelectedSequencePreset() {
  const name = reelEls.reelPresetSelect.value;

  if (!name || reel.job) {
    return;
  }

  const preset = readReelPresetStore()[name];

  if (!preset || !Array.isArray(preset.clips)) {
    return;
  }

  if (
    reel.clips.length &&
    !window.confirm(
      `Replace the current sequence with “${name}”?`
    )
  ) {
    return;
  }

  applyReelStateSettings(preset);
  syncReelSettingInputs();
  persistReelState();
  renderReel();
  refreshReelThumbnails(
    reel.clips.filter((clip) => !clip.thumbnail)
  );
}

function deleteSelectedSequencePreset() {
  const name = reelEls.reelPresetSelect.value;

  if (!name || reel.job) {
    return;
  }

  if (
    !window.confirm(`Delete the sequence preset “${name}”?`)
  ) {
    return;
  }

  const store = readReelPresetStore();
  delete store[name];
  writeReelPresetStore(store);
  refreshReelPresetSelect("");
}

/* ------------------------------------------------------------------
 * UI
 * ---------------------------------------------------------------- */

function setReelExpanded(expanded) {
  reel.expanded = expanded;
  document.body.classList.toggle(
    "reel-expanded",
    expanded
  );
  renderReel();
}

function formatReelSeconds(seconds) {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;
    return `${m}:${s.toFixed(1).padStart(4, "0")}`;
  }

  return `${Number(seconds.toFixed(2))}s`;
}

function setReelNote(text) {
  reelEls.reelExportNote.textContent = text;
}

function setReelProgress(text, fraction) {
  const pct = Math.round(constrain(fraction, 0, 1) * 100);

  reelEls.reelProgressText.textContent = text;
  reelEls.reelProgressPercent.textContent = `${pct}%`;
  reelEls.reelProgressBar.style.width = `${pct}%`;
}

function syncReelBusyUI() {
  const busy = Boolean(reel.job);
  const previewing = busy && reel.job.kind === "preview";
  const count = reel.clips.length;

  reelEls.reelProgress.classList.toggle(
    "hidden",
    !busy || previewing
  );
  reelEls.reelPreviewControls.classList.toggle(
    "hidden",
    !previewing
  );
  document.body.classList.toggle("reel-previewing", previewing);
  reelEls.reelSavePresetButton.disabled = busy || !count;
  reelEls.reelPresetSelect.disabled = busy;
  reelEls.reelLoadPresetButton.disabled = busy;
  reelEls.reelDeletePresetButton.disabled = busy;

  if (!busy) {
    setReelProgress("", 0);
  }

  reelEls.reelAddClipButton.disabled = busy;
  reelEls.reelAutoArrangeButton.disabled =
    busy || count < 3;
  reelEls.reelAlternateArrangeButton.disabled =
    busy || count < 3;
  reelEls.reelAspectRatio.disabled = busy;
  reelEls.reelCameraZoomScale.disabled = busy;
  reelEls.reelDefaultDuration.disabled = busy;
  reelEls.reelFps.disabled = busy;
  reelEls.reelResolution.disabled = busy;
  reelEls.reelPreviewButton.disabled = busy || !count;
  reelEls.reelExportButton.disabled = busy || !count;
  reelEls.reelArrangeButton.disabled = busy;
  reelEls.reelClearSequenceButton.disabled =
    busy || !count;
  reelEls.reelBackButton.disabled = busy;
  reelEls.reelClipList.classList.toggle(
    "reel-lockable",
    busy
  );
}

function renderReel() {
  const count = reel.clips.length;
  const preset =
    ASPECT_PRESETS[reel.aspectRatio] ||
    ASPECT_PRESETS["16:9"];
  const size = getReelExportSize();

  document.body.style.setProperty(
    "--reel-aspect",
    `${preset.width} / ${preset.height}`
  );

  reelEls.reelDefaultDurationValue.textContent =
    formatReelSeconds(reel.defaultDuration);

  reelEls.reelCameraZoomScaleValue.textContent =
    `${Number(reel.cameraZoomScale || 1).toFixed(2)}×`;

  reelEls.reelSummary.textContent = count
    ? `${count} clip${count === 1 ? "" : "s"} · ${formatReelSeconds(getReelTotalSeconds())}`
    : "No clips";

  reelEls.reelEmptyNote.classList.toggle(
    "hidden",
    count > 0
  );
  reelEls.reelEditorHead.classList.toggle(
    "hidden",
    !reel.expanded
  );
  reelEls.reelArrangeButton.classList.toggle(
    "hidden",
    reel.expanded
  );

  for (const option of reelEls.reelResolution.options) {
    const scale = Number(option.value);
    const even = (value) =>
      Math.max(2, Math.floor(value / 2) * 2);
    const base = resolveAspectCanvasSize(preset);
    const w = even(base.width * base.pixelDensity * scale);
    const h = even(base.height * base.pixelDensity * scale);
    const label =
      scale === 1 ? "Full" : `${Math.round(scale * 100)}%`;

    option.textContent = `${label} · ${w}×${h}`;
  }

  if (!reel.job) {
    setReelNote(
      count
        ? `Renders each clip's live animation frame by frame into one ${size.width}×${size.height} video.`
        : "Renders each clip's live animation frame by frame and downloads one video file."
    );
  }

  renderReelClips();
  syncReelBusyUI();
}

function renderReelClips() {
  const list = reelEls.reelClipList;
  const features = reel.clips.map(getReelClipFeatures);
  let contrastSum = 0;

  list.innerHTML = "";

  reel.clips.forEach((clip, index) => {
    const card = document.createElement("div");
    card.className = "reel-clip";
    card.draggable = true;
    card.dataset.id = clip.id;

    /*
     * A draggable ancestor swallows text selection in
     * the trim inputs, so only arm dragging elsewhere.
     */
    card.addEventListener("pointerdown", (event) => {
      card.draggable = !event.target.closest(
        "input, button"
      );
    });

    const thumb = document.createElement("div");
    thumb.className = "reel-thumb";

    if (clip.thumbnail) {
      const img = document.createElement("img");
      img.src = clip.thumbnail;
      img.alt = clip.name;
      img.draggable = false;
      thumb.appendChild(img);
    }

    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "6px";
    body.style.minWidth = "0";

    const name = document.createElement("div");
    name.className = "reel-clip-name";

    const number = document.createElement("span");
    number.className = "reel-clip-index";
    number.textContent = `${String(index + 1).padStart(2, "0")}  `;

    name.appendChild(number);
    name.appendChild(document.createTextNode(clip.name));

    const meta = document.createElement("div");
    meta.className = "reel-clip-meta";

    const duration = document.createElement("span");
    duration.textContent =
      formatReelSeconds(getReelClipDuration(clip)) +
      (clip.duration !== null ? " · trimmed" : "");

    const contrast = document.createElement("span");

    if (index > 0) {
      const d = reelClipDifference(
        features[index - 1],
        features[index]
      );
      contrastSum += d;
      contrast.textContent = `Δ ${Math.round(d * 100)}`;
      contrast.title =
        "Visual contrast with the previous clip (0–100)";
    }

    meta.appendChild(duration);
    meta.appendChild(contrast);

    body.appendChild(name);
    body.appendChild(meta);

    if (clip.imageMissing && !clip.image) {
      const warn = document.createElement("div");
      warn.className = "note";
      warn.style.margin = "0";
      warn.textContent =
        "Image clip: uses the currently uploaded image.";
      body.appendChild(warn);
    }

    body.appendChild(buildReelTrimControls(clip));
    body.appendChild(buildReelClipActions(clip, index));

    card.appendChild(thumb);
    card.appendChild(body);
    list.appendChild(card);
  });

  if (reel.clips.length > 1) {
    const average = contrastSum / (reel.clips.length - 1);
    reelEls.reelContrastNote.textContent =
      `Average contrast between neighbors: ${Math.round(average * 100)} / 100. ` +
      "Drag clips to reorder, or Auto Arrange for the strongest cuts.";
  } else {
    reelEls.reelContrastNote.textContent =
      "Add at least two clips to arrange a sequence.";
  }
}

function buildReelTrimControls(clip) {
  const wrap = document.createElement("div");
  wrap.className = "reel-clip-trim reel-editor-only";

  const durationLabel = document.createElement("label");
  durationLabel.textContent = "Duration (s)";

  const durationInput = document.createElement("input");
  durationInput.type = "number";
  durationInput.min = "0.1";
  durationInput.max = String(REEL_MAX_CLIP_SECONDS);
  durationInput.step = "0.1";
  durationInput.placeholder = String(reel.defaultDuration);
  durationInput.value =
    clip.duration === null ? "" : String(clip.duration);
  durationInput.title =
    "Leave empty to use the sequence clip duration";

  durationInput.addEventListener("change", () => {
    const value = durationInput.value.trim();
    clip.duration =
      value === "" || !(Number(value) > 0)
        ? null
        : Math.min(Number(value), REEL_MAX_CLIP_SECONDS);
    persistReelState();
    renderReel();
  });

  durationLabel.appendChild(durationInput);

  const startLabel = document.createElement("label");
  startLabel.textContent = "Start at (s)";

  const startInput = document.createElement("input");
  startInput.type = "number";
  startInput.min = "0";
  startInput.max = String(REEL_MAX_TRIM_SECONDS);
  startInput.step = "0.1";
  startInput.value = String(clip.trimStart || 0);
  startInput.title =
    "Skip this many seconds of the clip's animation";

  startInput.addEventListener("change", () => {
    clip.trimStart = constrain(
      Number(startInput.value) || 0,
      0,
      REEL_MAX_TRIM_SECONDS
    );
    persistReelState();
    renderReel();
  });

  startLabel.appendChild(startInput);

  wrap.appendChild(durationLabel);
  wrap.appendChild(startLabel);

  return wrap;
}

function buildReelClipActions(clip, index) {
  const wrap = document.createElement("div");
  wrap.className = "reel-clip-actions reel-editor-only";

  const make = (label, title, onClick, disabled = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.disabled = disabled;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
    return button;
  };

  wrap.appendChild(
    make("Load", "Load this clip's settings into the sketch", () =>
      loadReelClipIntoSketch(clip.id)
    )
  );
  wrap.appendChild(
    make("←", "Move earlier", () => moveReelClip(clip.id, -1), index === 0)
  );
  wrap.appendChild(
    make(
      "→",
      "Move later",
      () => moveReelClip(clip.id, 1),
      index === reel.clips.length - 1
    )
  );
  wrap.appendChild(
    make("Remove", "Remove from the sequence", () =>
      removeReelClip(clip.id)
    )
  );

  return wrap;
}

function clearReelDropMarkers() {
  reelEls.reelClipList
    .querySelectorAll(".drop-before, .drop-after")
    .forEach((el) => {
      el.classList.remove("drop-before", "drop-after");
    });
}

function getReelDropTarget(event) {
  const card = event.target.closest
    ? event.target.closest(".reel-clip")
    : null;

  if (!card || card.dataset.id === reel.dragId) {
    return null;
  }

  const rect = card.getBoundingClientRect();
  const before = reel.expanded
    ? event.clientX < rect.left + rect.width / 2
    : event.clientY < rect.top + rect.height / 2;

  return { card, before };
}

function connectReelDragAndDrop() {
  const list = reelEls.reelClipList;

  list.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".reel-clip");

    if (!card || reel.job) {
      event.preventDefault();
      return;
    }

    reel.dragId = card.dataset.id;
    card.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", reel.dragId);
  });

  list.addEventListener("dragover", (event) => {
    if (!reel.dragId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    clearReelDropMarkers();

    const target = getReelDropTarget(event);

    if (target) {
      target.card.classList.add(
        target.before ? "drop-before" : "drop-after"
      );
    }
  });

  list.addEventListener("dragleave", (event) => {
    if (!list.contains(event.relatedTarget)) {
      clearReelDropMarkers();
    }
  });

  list.addEventListener("drop", (event) => {
    if (!reel.dragId) {
      return;
    }

    event.preventDefault();

    const target = getReelDropTarget(event);
    const dragId = reel.dragId;

    clearReelDropMarkers();
    reel.dragId = null;

    if (!target) {
      renderReelClips();
      return;
    }

    const from = reel.clips.findIndex(
      (clip) => clip.id === dragId
    );

    if (from < 0) {
      return;
    }

    const [clip] = reel.clips.splice(from, 1);
    let to = reel.clips.findIndex(
      (entry) => entry.id === target.card.dataset.id
    );

    if (!target.before) {
      to += 1;
    }

    reel.clips.splice(to, 0, clip);
    persistReelState();
    renderReel();
  });

  list.addEventListener("dragend", () => {
    reel.dragId = null;
    clearReelDropMarkers();
    list
      .querySelectorAll(".dragging")
      .forEach((el) => el.classList.remove("dragging"));
  });
}

const elements = {
  baseInput: document.getElementById("baseInput"),
  testInput: document.getElementById("testInput"),
  thresholdInput: document.getElementById("thresholdInput"),
  thresholdValue: document.getElementById("thresholdValue"),
  modeSelect: document.getElementById("modeSelect"),
  overlayOpacityInput: document.getElementById("overlayOpacityInput"),
  overlayValue: document.getElementById("overlayValue"),
  statusMessage: document.getElementById("statusMessage"),
  mismatchCount: document.getElementById("mismatchCount"),
  mismatchPercent: document.getElementById("mismatchPercent"),
  imageSize: document.getElementById("imageSize"),
  baseCanvas: document.getElementById("baseCanvas"),
  testCanvas: document.getElementById("testCanvas"),
  overlayView: document.getElementById("overlayView"),
  sliderView: document.getElementById("sliderView"),
  overlayBaseCanvas: document.getElementById("overlayBaseCanvas"),
  overlayTopCanvas: document.getElementById("overlayTopCanvas"),
  sliderCanvas: document.getElementById("sliderCanvas"),
  diffCanvas: document.getElementById("diffCanvas"),
};

const state = {
  baseImage: null,
  testImage: null,
  width: 0,
  height: 0,
  threshold: Number(elements.thresholdInput.value),
  overlayOpacity: Number(elements.overlayOpacityInput.value) / 100,
  sliderPosition: 0.5,
  isDragging: false,
  basePixels: null,
  testPixels: null,
};

const scratchCanvas = document.createElement("canvas");
const scratchCtx = scratchCanvas.getContext("2d", { willReadFrequently: true });

const contexts = {
  base: elements.baseCanvas.getContext("2d"),
  test: elements.testCanvas.getContext("2d"),
  overlayBase: elements.overlayBaseCanvas.getContext("2d"),
  overlayTop: elements.overlayTopCanvas.getContext("2d"),
  slider: elements.sliderCanvas.getContext("2d"),
  diff: elements.diffCanvas.getContext("2d", { willReadFrequently: true }),
};

function setStatus(message, isError = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.toggle("error", isError);
}

function resizeCanvas(canvas, width, height) {
  canvas.width = width;
  canvas.height = height;
}

function clearCanvas(canvas, ctx) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function updateStats(mismatchPixels = 0, totalPixels = 0) {
  elements.mismatchCount.textContent = mismatchPixels.toLocaleString("uk-UA");
  elements.mismatchPercent.textContent =
    totalPixels > 0 ? `${((mismatchPixels / totalPixels) * 100).toFixed(2)}%` : "0.00%";
  elements.imageSize.textContent =
    state.width > 0 && state.height > 0 ? `${state.width} x ${state.height}` : "—";
}

function setDefaultStats() {
  updateStats(0, 0);
}

function setViewMode(mode) {
  elements.overlayView.classList.toggle("hidden", mode !== "overlay");
  elements.sliderView.classList.toggle("hidden", mode !== "slider");
  elements.overlayOpacityInput.disabled = mode !== "overlay";
}

function applyOverlayOpacity() {
  elements.overlayTopCanvas.style.opacity = state.overlayOpacity.toFixed(2);
  elements.overlayValue.textContent = `${Math.round(state.overlayOpacity * 100)}%`;
}

function drawSingleImage(canvas, ctx, image) {
  resizeCanvas(canvas, image.width, image.height);
  clearCanvas(canvas, ctx);
  ctx.drawImage(image, 0, 0);
}

function drawSliderView() {
  if (!state.baseImage || !state.testImage || state.width === 0 || state.height === 0) {
    return;
  }

  const { slider } = contexts;
  const splitX = Math.round(state.width * state.sliderPosition);

  slider.clearRect(0, 0, state.width, state.height);
  slider.drawImage(state.baseImage, 0, 0, state.width, state.height);

  slider.save();
  slider.beginPath();
  slider.rect(0, 0, splitX, state.height);
  slider.clip();
  slider.drawImage(state.testImage, 0, 0, state.width, state.height);
  slider.restore();

  slider.strokeStyle = "#14b8a6";
  slider.lineWidth = 2;
  slider.beginPath();
  slider.moveTo(splitX, 0);
  slider.lineTo(splitX, state.height);
  slider.stroke();
}

function preparePixelBuffers() {
  scratchCtx.clearRect(0, 0, state.width, state.height);
  scratchCtx.drawImage(state.baseImage, 0, 0, state.width, state.height);
  state.basePixels = scratchCtx.getImageData(0, 0, state.width, state.height).data;

  scratchCtx.clearRect(0, 0, state.width, state.height);
  scratchCtx.drawImage(state.testImage, 0, 0, state.width, state.height);
  state.testPixels = scratchCtx.getImageData(0, 0, state.width, state.height).data;
}

function runComparison() {
  if (!state.basePixels || !state.testPixels || state.width === 0 || state.height === 0) {
    return;
  }

  const totalPixels = state.width * state.height;
  const diffImage = contexts.diff.createImageData(state.width, state.height);
  const out = diffImage.data;
  const base = state.basePixels;
  const test = state.testPixels;
  let mismatched = 0;

  for (let i = 0; i < base.length; i += 4) {
    const dr = Math.abs(base[i] - test[i]);
    const dg = Math.abs(base[i + 1] - test[i + 1]);
    const db = Math.abs(base[i + 2] - test[i + 2]);
    const da = Math.abs(base[i + 3] - test[i + 3]);
    const difference = Math.max(dr, dg, db, da);

    if (difference > state.threshold) {
      mismatched += 1;
      out[i] = 255;
      out[i + 1] = 0;
      out[i + 2] = 145;
      out[i + 3] = 255;
    } else {
      const gray = Math.round((base[i] + base[i + 1] + base[i + 2]) / 3);
      out[i] = gray;
      out[i + 1] = gray;
      out[i + 2] = gray;
      out[i + 3] = 120;
    }
  }

  contexts.diff.putImageData(diffImage, 0, 0);
  updateStats(mismatched, totalPixels);
}

function drawAllViews() {
  drawSingleImage(elements.baseCanvas, contexts.base, state.baseImage);
  drawSingleImage(elements.testCanvas, contexts.test, state.testImage);
  drawSingleImage(elements.overlayBaseCanvas, contexts.overlayBase, state.baseImage);
  drawSingleImage(elements.overlayTopCanvas, contexts.overlayTop, state.testImage);
  drawSliderView();
}

function resetComparisonCanvases() {
  const targetCanvases = [
    [elements.overlayBaseCanvas, contexts.overlayBase],
    [elements.overlayTopCanvas, contexts.overlayTop],
    [elements.sliderCanvas, contexts.slider],
    [elements.diffCanvas, contexts.diff],
  ];

  targetCanvases.forEach(([canvas, ctx]) => {
    resizeCanvas(canvas, 1, 1);
    clearCanvas(canvas, ctx);
  });
}

function compareIfReady() {
  if (!state.baseImage || !state.testImage) {
    setStatus("Виберіть обидва зображення для запуску порівняння.");
    return;
  }

  if (
    state.baseImage.width !== state.testImage.width ||
    state.baseImage.height !== state.testImage.height
  ) {
    drawSingleImage(elements.baseCanvas, contexts.base, state.baseImage);
    drawSingleImage(elements.testCanvas, contexts.test, state.testImage);
    resetComparisonCanvases();
    state.width = 0;
    state.height = 0;
    state.basePixels = null;
    state.testPixels = null;
    setDefaultStats();
    setStatus(
      "Розміри не збігаються. Для попіксельного порівняння завантажте зображення однакового розміру.",
      true
    );
    return;
  }

  state.width = state.baseImage.width;
  state.height = state.baseImage.height;
  scratchCanvas.width = state.width;
  scratchCanvas.height = state.height;

  const comparisonCanvases = [
    elements.baseCanvas,
    elements.testCanvas,
    elements.overlayBaseCanvas,
    elements.overlayTopCanvas,
    elements.sliderCanvas,
    elements.diffCanvas,
  ];
  comparisonCanvases.forEach((canvas) => resizeCanvas(canvas, state.width, state.height));

  drawAllViews();
  applyOverlayOpacity();
  preparePixelBuffers();
  runComparison();
  setStatus("Порівняння виконано. Змініть поріг або режим перегляду для додаткового аналізу.");
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не вдалося прочитати обраний файл як зображення."));
    };
    image.src = url;
  });
}

function updateSliderPositionFromPointer(event) {
  const rect = elements.sliderCanvas.getBoundingClientRect();
  if (rect.width === 0) {
    return;
  }
  const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
  state.sliderPosition = x / rect.width;
  drawSliderView();
}

async function handleFileSelection(kind, event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  setStatus(`Завантаження ${kind === "baseImage" ? "оригіналу" : "тестового"}...`);
  try {
    state[kind] = await fileToImage(file);
    compareIfReady();
  } catch (error) {
    setStatus(error.message, true);
  }
}

elements.baseInput.addEventListener("change", (event) => handleFileSelection("baseImage", event));
elements.testInput.addEventListener("change", (event) => handleFileSelection("testImage", event));

elements.thresholdInput.addEventListener("input", (event) => {
  state.threshold = Number(event.target.value);
  elements.thresholdValue.textContent = String(state.threshold);
  runComparison();
});

elements.modeSelect.addEventListener("change", (event) => {
  setViewMode(event.target.value);
});

elements.overlayOpacityInput.addEventListener("input", (event) => {
  state.overlayOpacity = Number(event.target.value) / 100;
  applyOverlayOpacity();
});

elements.sliderCanvas.addEventListener("pointerdown", (event) => {
  if (!state.baseImage || !state.testImage || state.width === 0 || state.height === 0) {
    return;
  }
  state.isDragging = true;
  elements.sliderCanvas.setPointerCapture(event.pointerId);
  updateSliderPositionFromPointer(event);
});

elements.sliderCanvas.addEventListener("pointermove", (event) => {
  if (!state.isDragging) {
    return;
  }
  updateSliderPositionFromPointer(event);
});

elements.sliderCanvas.addEventListener("pointerup", (event) => {
  state.isDragging = false;
  if (elements.sliderCanvas.hasPointerCapture(event.pointerId)) {
    elements.sliderCanvas.releasePointerCapture(event.pointerId);
  }
});

elements.sliderCanvas.addEventListener("pointercancel", (event) => {
  state.isDragging = false;
  if (elements.sliderCanvas.hasPointerCapture(event.pointerId)) {
    elements.sliderCanvas.releasePointerCapture(event.pointerId);
  }
});

applyOverlayOpacity();
setViewMode(elements.modeSelect.value);
setDefaultStats();

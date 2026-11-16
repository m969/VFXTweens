import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import "./style.css";
import { parseEffectCatalog } from "./vfx/catalog";
import { parseEffectDefinition } from "./vfx/definition";
import {
  getEasingPreviewPoint,
  getEasingPreviewSegments,
  sampleEaseCurve
} from "./vfx/easingPreview";
import { getParameterControlSpecs } from "./vfx/parameterControls";
import { VfxSystem } from "./vfx/system";
import type { EffectHandle } from "./vfx/system";
import type { EffectDefinition } from "./vfx/types";

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required page element "${selector}" was not found.`);
  }
  return element;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load "${url}" (${response.status}).`);
  }
  return response.json();
}

function displayError(error: unknown, element: HTMLParagraphElement): void {
  const message =
    error instanceof Error ? error.message : "An unknown preview error occurred.";
  element.textContent = message;
  element.hidden = false;
  console.error(error);
}

async function startPreview(): Promise<void> {
  const app = requireElement<HTMLElement>("#app");
  const canvas = requireElement<HTMLCanvasElement>("#preview");
  const categoryTabs = requireElement<HTMLElement>("#category-tabs");
  const effectList = requireElement<HTMLElement>("#effect-list");
  const effectCount = requireElement<HTMLOutputElement>("#effect-count");
  const effectTitle = requireElement<HTMLHeadingElement>("#effect-title");
  const effectSidebar = requireElement<HTMLElement>("#effect-sidebar");
  const sidebarToggle = requireElement<HTMLButtonElement>("#sidebar-toggle");
  const sidebarBackdrop = requireElement<HTMLButtonElement>("#sidebar-backdrop");
  const playButton = requireElement<HTMLButtonElement>("#play-button");
  const timelineInput = requireElement<HTMLInputElement>("#timeline-input");
  const timelineValue = requireElement<HTMLOutputElement>("#timeline-value");
  const parameterControls = requireElement<HTMLDivElement>("#parameter-controls");
  const easingCurves = requireElement<HTMLDivElement>("#easing-curves");
  const errorMessage = requireElement<HTMLParagraphElement>("#error-message");
  const parameterInputs = new Map<string, HTMLInputElement>();
  const easingMarkers: Array<{
    segment: ReturnType<typeof getEasingPreviewSegments>[number];
    marker: SVGCircleElement;
    minimum: number;
    scale: number;
  }> = [];

  const catalog = parseEffectCatalog(
    await fetchJson("/effects/catalog.json")
  );
  const templateButtons = new Map<string, HTMLButtonElement>();
  const categoryButtons = new Map<string, HTMLButtonElement>();
  const entriesByCategory = new Map<
    string,
    Array<(typeof catalog)[number]>
  >();
  effectCount.value = String(catalog.length).padStart(2, "0");
  for (const [index, entry] of catalog.entries()) {
    let categoryEntries = entriesByCategory.get(entry.category);
    if (!categoryEntries) {
      categoryEntries = [];
      entriesByCategory.set(entry.category, categoryEntries);

      const categoryButton = document.createElement("button");
      categoryButton.className = "category-tab";
      categoryButton.type = "button";
      categoryButton.id = `category-tab-${categoryButtons.size}`;
      categoryButton.setAttribute("role", "tab");
      categoryButton.setAttribute("aria-controls", "effect-list");
      categoryButton.setAttribute("aria-selected", "false");
      categoryButton.tabIndex = -1;
      categoryButton.textContent = entry.category;
      categoryTabs.append(categoryButton);
      categoryButtons.set(entry.category, categoryButton);
    }
    categoryEntries.push(entry);

    const button = document.createElement("button");
    button.className = "effect-list-item";
    button.type = "button";
    button.setAttribute("aria-current", "false");

    const number = document.createElement("span");
    number.className = "effect-list-index";
    number.textContent = String(index + 1).padStart(2, "0");

    const copy = document.createElement("span");
    copy.className = "effect-list-copy";
    const name = document.createElement("strong");
    name.textContent = entry.name;
    const id = document.createElement("small");
    id.textContent = entry.id;
    copy.append(name, id);
    button.append(number, copy);
    templateButtons.set(entry.id, button);
  }

  const requestedId = new URLSearchParams(window.location.search).get("effect");
  const initialEntry =
    catalog.find((entry) => entry.id === requestedId) ??
    catalog.find((entry) => entry.id === "impact.layered") ??
    catalog[0];

  const selectCategory = (category: string): void => {
    const categoryEntries = entriesByCategory.get(category);
    const activeTab = categoryButtons.get(category);
    if (!categoryEntries || !activeTab) {
      throw new Error(`Effect category "${category}" is not registered.`);
    }

    for (const [tabCategory, tab] of categoryButtons) {
      const isSelected = tabCategory === category;
      tab.setAttribute("aria-selected", String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
    }

    effectList.setAttribute("aria-labelledby", activeTab.id);
    effectList.replaceChildren(
      ...categoryEntries.map((entry) => {
        const button = templateButtons.get(entry.id);
        if (!button) {
          throw new Error(`Effect "${entry.id}" has no template button.`);
        }
        return button;
      })
    );
  };

  const categoryOrder = Array.from(categoryButtons.keys());
  for (const [index, [category, button]] of Array.from(
    categoryButtons.entries()
  ).entries()) {
    button.addEventListener("click", () => selectCategory(category));
    button.addEventListener("keydown", (event) => {
      let nextIndex = index;
      if (event.key === "ArrowRight") {
        nextIndex = (index + 1) % categoryOrder.length;
      } else if (event.key === "ArrowLeft") {
        nextIndex = (index - 1 + categoryOrder.length) % categoryOrder.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = categoryOrder.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      const nextCategory = categoryOrder[nextIndex];
      const nextButton = categoryButtons.get(nextCategory);
      if (!nextButton) {
        throw new Error(`Effect category "${nextCategory}" has no tab.`);
      }
      nextButton.focus();
      selectCategory(nextCategory);
    });
  }
  selectCategory(initialEntry.category);

  const mobileLayout = window.matchMedia("(max-width: 760px)");
  const setSidebarOpen = (open: boolean): void => {
    const isOpen = mobileLayout.matches ? open : true;
    app.classList.toggle("sidebar-open", isOpen);
    effectSidebar.inert = !isOpen;
    effectSidebar.setAttribute("aria-hidden", String(!isOpen));
    sidebarToggle.setAttribute("aria-expanded", String(isOpen));
  };
  setSidebarOpen(!mobileLayout.matches);
  mobileLayout.addEventListener("change", (event) => {
    setSidebarOpen(!event.matches);
  });
  sidebarToggle.addEventListener("click", () => {
    setSidebarOpen(!app.classList.contains("sidebar-open"));
  });
  sidebarBackdrop.addEventListener("click", () => setSidebarOpen(false));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#090d14");

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(6, 6, 8);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;

  const grid = new THREE.GridHelper(20, 40, 0x40556c, 0x202d3b);
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  scene.add(grid);
  scene.add(new THREE.AxesHelper(1.5));

  let vfx: VfxSystem | undefined;
  let activeDefinition: EffectDefinition | undefined;
  let activeCategory: string | undefined;
  let previewHandle: EffectHandle | undefined;

  const updateEasingMarkers = (timeSeconds: number): void => {
    for (const { segment, marker, minimum, scale } of easingMarkers) {
      const point = getEasingPreviewPoint(segment, timeSeconds);
      marker.setAttribute("cx", String(8 + point.x * 104));
      marker.setAttribute("cy", String(62 - (point.y - minimum) * scale));
    }
  };

  const renderEasingCurves = (definition: EffectDefinition): void => {
    easingMarkers.length = 0;
    easingCurves.replaceChildren();
    const segments = getEasingPreviewSegments(definition);
    if (segments.length === 0) {
      const empty = document.createElement("p");
      empty.className = "easing-empty";
      empty.textContent = "This template has no easing transitions.";
      easingCurves.append(empty);
      return;
    }

    const svgNamespace = "http://www.w3.org/2000/svg";
    for (const segment of segments) {
      const row = document.createElement("div");
      row.className = "easing-curve";
      const title = document.createElement("span");
      title.className = "easing-curve-title";
      title.textContent = `${segment.layerId} · ${segment.property} · ${Math.round(segment.from * 100)}–${Math.round(segment.to * 100)}%`;
      const name = document.createElement("span");
      name.className = "easing-curve-name";
      name.textContent =
        typeof segment.ease === "string" ? segment.ease : "Sampled";

      const svg = document.createElementNS(svgNamespace, "svg");
      svg.classList.add("easing-curve-graph");
      svg.setAttribute("viewBox", "0 0 120 70");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", `${title.textContent}: ${name.textContent}`);
      const titleElement = document.createElementNS(svgNamespace, "title");
      titleElement.textContent = `${title.textContent}: ${name.textContent}`;
      svg.append(titleElement);

      const samples = sampleEaseCurve(segment.ease);
      const minValue = Math.min(0, ...samples.map((point) => point.y));
      const maxValue = Math.max(1, ...samples.map((point) => point.y));
      const valueRange = maxValue - minValue || 1;
      const padding = valueRange * 0.08;
      const minimum = minValue - padding;
      const scale = 54 / (valueRange + padding * 2);
      const mapY = (value: number): number => 8 + (maxValue + padding - value) * scale;
      const baseline = document.createElementNS(svgNamespace, "line");
      baseline.classList.add("easing-curve-axis");
      baseline.setAttribute("x1", "8");
      baseline.setAttribute("x2", "112");
      baseline.setAttribute("y1", String(mapY(0)));
      baseline.setAttribute("y2", String(mapY(0)));
      svg.append(baseline);

      const linear = document.createElementNS(svgNamespace, "line");
      linear.classList.add("easing-curve-linear");
      linear.setAttribute("x1", "8");
      linear.setAttribute("y1", String(mapY(0)));
      linear.setAttribute("x2", "112");
      linear.setAttribute("y2", String(mapY(1)));
      svg.append(linear);

      const path = document.createElementNS(svgNamespace, "path");
      path.classList.add("easing-curve-path");
      path.setAttribute(
        "d",
        samples
          .map((point, index) => {
            const command = index === 0 ? "M" : "L";
            return `${command}${8 + point.x * 104} ${mapY(point.y)}`;
          })
          .join(" ")
      );
      svg.append(path);

      const marker = document.createElementNS(svgNamespace, "circle");
      marker.classList.add("easing-curve-marker");
      marker.setAttribute("r", "3");
      marker.setAttribute("cx", "8");
      marker.setAttribute("cy", String(mapY(0)));
      svg.append(marker);
      easingMarkers.push({ segment, marker, minimum, scale });

      row.append(title, name, svg);
      easingCurves.append(row);
    }
    updateEasingMarkers(previewHandle?.currentTime ?? 0);
  };

  const renderParameterControls = (definition: EffectDefinition): void => {
    parameterInputs.clear();
    parameterControls.replaceChildren();

    for (const [index, spec] of getParameterControlSpecs(definition.params).entries()) {
      const label = document.createElement("label");
      label.className = "parameter-control";
      const caption = document.createElement("span");
      caption.textContent = spec.name;

      const input = document.createElement("input");
      input.id = `effect-parameter-${index}`;
      input.type = spec.type;
      input.value = String(spec.defaultValue);
      input.setAttribute("aria-label", spec.name);
      if (spec.type === "number") {
        input.step = "any";
        if (spec.min !== undefined) {
          input.min = String(spec.min);
        }
        if (spec.max !== undefined) {
          input.max = String(spec.max);
        }
      }

      label.htmlFor = input.id;
      label.append(caption, input);
      parameterControls.append(label);
      parameterInputs.set(spec.name, input);
      input.addEventListener("input", () => {
        if (
          spec.type === "number" &&
          (input.value === "" || !input.validity.valid)
        ) {
          return;
        }
        replayPreview();
      });
    }
  };

  const play = (): void => {
    if (!vfx || !activeDefinition) {
      return;
    }

    const params: Record<string, number | string> = {};
    for (const [name, parameter] of Object.entries(activeDefinition.params)) {
      const input = parameterInputs.get(name);
      if (!input) {
        throw new Error(`Missing preview control for parameter "${name}".`);
      }
      if (parameter.type === "number") {
        if (input.value === "" || !input.validity.valid) {
          input.reportValidity();
          return;
        }
        params[name] = input.valueAsNumber;
      } else {
        params[name] = input.value;
      }
    }

    previewHandle?.stop();
    const isCharacterHit = activeCategory === "角色受击";
    previewHandle = vfx.play(activeDefinition.id, {
      position: new THREE.Vector3(0, isCharacterHit ? 1.45 : 0, 0),
      normal: new THREE.Vector3(0, isCharacterHit ? 0 : 1, isCharacterHit ? 1 : 0),
      params
    });
    timelineInput.disabled = false;
    timelineInput.min = "0";
    timelineInput.max = String(activeDefinition.duration);
    timelineInput.value = "0";
    isPlaying = true;
    updatePlaybackControls();
  };

  let isPlaying = false;

  const updatePlaybackControls = (): void => {
    playButton.textContent = isPlaying
      ? "Pause"
      : previewHandle?.finished
        ? "Play"
        : "Resume";
    if (activeDefinition) {
      timelineValue.value = `${(previewHandle?.currentTime ?? 0).toFixed(2)} / ${activeDefinition.duration.toFixed(2)} s`;
    }
    updateEasingMarkers(previewHandle?.currentTime ?? 0);
  };

  const seekPreview = (timeSeconds: number): void => {
    if (!previewHandle) {
      return;
    }
    try {
      previewHandle.seek(timeSeconds);
      timelineInput.value = String(previewHandle.currentTime);
      updatePlaybackControls();
    } catch (error) {
      displayError(error, errorMessage);
    }
  };

  const replayPreview = (): void => {
    try {
      errorMessage.hidden = true;
      play();
    } catch (error) {
      displayError(error, errorMessage);
    }
  };

  const selectTemplate = async (
    selectedEntry: (typeof catalog)[number]
  ): Promise<void> => {
    for (const button of templateButtons.values()) {
      button.disabled = true;
    }
    playButton.disabled = true;
    errorMessage.hidden = true;

    try {
      const definition = parseEffectDefinition(
        await fetchJson(`/effects/${encodeURIComponent(selectedEntry.file)}`)
      );
      if (definition.id !== selectedEntry.id) {
        throw new Error(
          `Catalog entry "${selectedEntry.id}" resolved to effect "${definition.id}".`
        );
      }

      const nextVfx = new VfxSystem(scene);
      nextVfx.register(definition);
      vfx?.dispose();
      previewHandle = undefined;
      vfx = nextVfx;
      activeDefinition = definition;
      activeCategory = selectedEntry.category;
      effectTitle.textContent = selectedEntry.name;
      document.title = `VFXTweens - ${selectedEntry.name}`;
      const url = new URL(window.location.href);
      url.searchParams.set("effect", selectedEntry.id);
      window.history.replaceState(null, "", url);
      for (const [id, button] of templateButtons) {
        button.setAttribute(
          "aria-current",
          String(id === selectedEntry.id)
        );
      }

      renderParameterControls(definition);
      renderEasingCurves(definition);

      playButton.disabled = false;
      timelineInput.disabled = false;
      play();
      if (mobileLayout.matches) {
        setSidebarOpen(false);
      }
    } catch (error) {
      displayError(error, errorMessage);
      playButton.disabled = !activeDefinition;
      timelineInput.disabled = !activeDefinition;
    } finally {
      for (const button of templateButtons.values()) {
        button.disabled = false;
      }
    }
  };

  for (const [id, button] of templateButtons) {
    const entry = catalog.find((catalogEntry) => catalogEntry.id === id);
    if (!entry) {
      throw new Error(`Catalog entry "${id}" disappeared during initialization.`);
    }
    button.addEventListener("click", () => {
      void selectTemplate(entry);
    });
  }

  playButton.addEventListener("click", () => {
    if (isPlaying) {
      isPlaying = false;
      updatePlaybackControls();
      return;
    }
    if (!previewHandle || previewHandle.finished) {
      replayPreview();
      return;
    }
    isPlaying = true;
    updatePlaybackControls();
  });
  timelineInput.addEventListener("input", () => {
    isPlaying = false;
    seekPreview(Number(timelineInput.value));
  });

  const resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  };
  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();
  let frameId = 0;
  const render = (): void => {
    frameId = window.requestAnimationFrame(render);
    controls.update();
    const deltaSeconds = clock.getDelta();
    if (isPlaying) {
      vfx?.update(deltaSeconds);
      if (previewHandle?.finished) {
        isPlaying = false;
      }
      if (previewHandle) {
        timelineInput.value = String(previewHandle.currentTime);
      }
      updatePlaybackControls();
    }
    renderer.render(scene, camera);
  };

  await selectTemplate(initialEntry);
  render();

  window.addEventListener(
    "pagehide",
    () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      controls.dispose();
      vfx?.dispose();
      renderer.dispose();
    },
    { once: true }
  );
}

const errorMessage = document.querySelector<HTMLParagraphElement>("#error-message");
void startPreview().catch((error: unknown) => {
  if (errorMessage) {
    displayError(error, errorMessage);
  } else {
    console.error(error);
  }
});

import { describe, expect, it } from "vitest";
import effectCatalog from "../public/effects/catalog.json";
import chargedImpact from "../public/effects/skill-charged-impact.vfx.json";
import characterEnergyHit from "../public/effects/character-energy-hit.vfx.json";
import characterHitSparks from "../public/effects/character-hit-sparks.vfx.json";
import characterSlashHit from "../public/effects/character-slash-hit.vfx.json";
import doublePointedSlash from "../public/effects/skill-slash-double-pointed.vfx.json";
import doublePointedLeftToRightSlash from "../public/effects/skill-slash-double-pointed-left-to-right.vfx.json";
import energyHit from "../public/effects/impact-energy-hit.vfx.json";
import heavyHit from "../public/effects/impact-heavy-hit.vfx.json";
import hitSparks from "../public/effects/impact-hit-sparks.vfx.json";
import impactRing from "../public/effects/impact-ring.vfx.json";
import layeredImpact from "../public/effects/impact-layered.vfx.json";
import arcaneBolt from "../public/effects/projectile-arcane-bolt.vfx.json";
import fireball from "../public/effects/projectile-fireball.vfx.json";
import grenade from "../public/effects/projectile-grenade.vfx.json";
import multiProjectileThree from "../public/effects/projectile-three-lane.vfx.json";
import multiProjectileSix from "../public/effects/projectile-six-lane.vfx.json";
import stoneShatter from "../public/effects/impact-stone-shatter.vfx.json";
import crystalShatter from "../public/effects/skill-crystal-shatter.vfx.json";
import glassShatter from "../public/effects/skill-glass-shatter.vfx.json";
import lightArcSlash from "../public/effects/skill-light-arc-slash.vfx.json";
import slashArc from "../public/effects/skill-slash-arc.vfx.json";
import leftToRightSlash from "../public/effects/skill-slash-sweep-left-to-right.vfx.json";
import wavePulse from "../public/effects/skill-wave-pulse.vfx.json";
import {
  applyEase,
  SAMPLED_EASE_SAMPLE_COUNT
} from "../src/vfx/easing";
import { parseEffectCatalog } from "../src/vfx/catalog";
import { parseEffectDefinition } from "../src/vfx/definition";
import {
  getEasingPreviewPoint,
  getEasingPreviewSegments,
  sampleEaseCurve
} from "../src/vfx/easingPreview";
import { getParameterControlSpecs } from "../src/vfx/parameterControls";
import { EffectInstance } from "../src/vfx/instance";
import { evaluateTrack } from "../src/vfx/timeline";
import { VfxSystem } from "../src/vfx/system";
import * as THREE from "three";

describe("VFX effect definitions", () => {
  it("parses the impact ring fixture", () => {
    const definition = parseEffectDefinition(impactRing);

    expect(definition.id).toBe("impact.ring");
    expect(definition.layers.map((layer) => layer.type)).toEqual(["ring"]);
  });

  it("parses the layered impact fixture", () => {
    const definition = parseEffectDefinition(layeredImpact);

    expect(definition.id).toBe("impact.layered");
    expect(definition.layers.map((layer) => layer.type)).toEqual([
      "ring",
      "wave",
      "slashArc"
    ]);
  });

  it("parses standalone wave pulse and slash arc fixtures", () => {
    const wave = parseEffectDefinition(wavePulse);
    const arc = parseEffectDefinition(slashArc);

    expect(wave.id).toBe("skill.wave-pulse");
    expect(wave.layers.map((layer) => layer.type)).toEqual(["wave"]);
    expect(arc.id).toBe("skill.slash-arc");
    expect(arc.layers.map((layer) => layer.type)).toEqual(["slashArc"]);
  });

  it("parses the light arc slash with its glow, core, and spark layers", () => {
    const definition = parseEffectDefinition(lightArcSlash);

    expect(definition.id).toBe("skill.light-arc-slash");
    expect(definition.layers.map((layer) => layer.type)).toEqual([
      "slashArc",
      "slashArc",
      "shards"
    ]);
  });

  it("parses the left-to-right slash sweep with a continuous angle track", () => {
    const definition = parseEffectDefinition(leftToRightSlash);

    expect(definition.id).toBe("skill.slash-sweep-left-to-right");
    expect(definition.layers).toHaveLength(1);
    const layer = definition.layers[0];
    if (!layer || layer.type !== "slashArc") {
      throw new Error("Expected one slash arc layer.");
    }
    const sweepTrack = layer.tracks.find(
      (track) => track.property === "sweepAngle"
    );
    if (!sweepTrack) {
      throw new Error("Expected a sweep angle track.");
    }
    expect(sweepTrack.keys.map((key) => key.value)).toEqual([0, 152, 152]);
  });

  it("renders a slash arc tapered to points at both ends", () => {
    const definition = parseEffectDefinition(doublePointedSlash);
    const layer = definition.layers[0];
    if (!layer || layer.type !== "slashArc") {
      throw new Error("Expected a slash arc layer.");
    }
    expect(layer.geometry.tipRatio).toBe(0.12);

    const instance = new EffectInstance(definition, {
      position: new THREE.Vector3()
    });
    const mesh = instance.root.children[0];
    if (
      !(mesh instanceof THREE.Mesh) ||
      !(mesh.material instanceof THREE.ShaderMaterial)
    ) {
      throw new Error("Expected a shader-backed slash arc mesh.");
    }
    expect(mesh.material.uniforms.uArcTipRatio.value).toBe(0.12);
    instance.dispose(new THREE.Scene());
  });

  it("reveals the double-pointed slash left-to-right without radial expansion", () => {
    const definition = parseEffectDefinition(doublePointedLeftToRightSlash);
    const layer = definition.layers[0];
    if (!layer || layer.type !== "slashArc") {
      throw new Error("Expected a slash arc layer.");
    }
    expect(layer.geometry.tipRatio).toBe(0.12);
    expect(
      layer.tracks
        .find((track) => track.property === "radius")
        ?.keys.map((key) => key.value)
    ).toEqual([{ param: "radius" }, { param: "radius" }]);

    const instance = new EffectInstance(definition, {
      position: new THREE.Vector3()
    });
    const mesh = instance.root.children[0];
    if (
      !(mesh instanceof THREE.Mesh) ||
      !(mesh.material instanceof THREE.ShaderMaterial)
    ) {
      throw new Error("Expected a shader-backed slash arc mesh.");
    }
    const uniforms = mesh.material.uniforms;
    instance.seek(layer.duration * 0.36);
    expect(uniforms.uArcSweepAngle.value).toBeCloseTo(
      THREE.MathUtils.degToRad(75)
    );
    expect(uniforms.uRadius.value).toBeCloseTo(2.4);
    instance.seek(layer.duration * 0.72);
    expect(uniforms.uArcSweepAngle.value).toBeCloseTo(
      THREE.MathUtils.degToRad(150)
    );
    instance.dispose(new THREE.Scene());
  });

  it("parses stone, crystal, and glass shard particle presets", () => {
    const stone = parseEffectDefinition(stoneShatter);
    const crystal = parseEffectDefinition(crystalShatter);
    const glass = parseEffectDefinition(glassShatter);

    expect(stone.id).toBe("impact.stone-shatter");
    expect(stone.layers.map((layer) => layer.type)).toEqual(["shards"]);
    expect(crystal.layers.map((layer) => layer.type)).toEqual([
      "shards",
      "shards"
    ]);
    expect(glass.id).toBe("skill.glass-shatter");
    const glassLayer = glass.layers[0];
    if (!glassLayer || glassLayer.type !== "shards") {
      throw new Error("Expected a glass shard layer.");
    }
    expect(glassLayer.geometry.count).toBe(48);
  });

  it("parses the charged ground burst with a delayed release sequence", () => {
    const definition = parseEffectDefinition(chargedImpact);

    expect(definition.id).toBe("skill.charged-impact");
    expect(definition.duration).toBe(1.1);
    expect(definition.layers.map((layer) => layer.type)).toEqual([
      "ring",
      "ring",
      "slashArc",
      "wave"
    ]);
    expect(definition.layers.map((layer) => layer.startAt)).toEqual([
      0,
      0.34,
      0.38,
      0.44
    ]);
    const lastLayer = definition.layers.at(-1);
    if (!lastLayer) {
      throw new Error("Expected a ground-wave layer.");
    }
    expect(lastLayer.startAt + lastLayer.duration).toBe(definition.duration);
  });

  it("parses three hit particle presets", () => {
    const sparks = parseEffectDefinition(hitSparks);
    const energy = parseEffectDefinition(energyHit);
    const heavy = parseEffectDefinition(heavyHit);

    expect(sparks.id).toBe("impact.hit-sparks");
    expect(sparks.layers.map((layer) => layer.type)).toEqual(["shards"]);
    expect(energy.id).toBe("impact.energy-hit");
    expect(energy.layers.map((layer) => layer.type)).toEqual(["ring", "shards"]);
    expect(heavy.id).toBe("impact.heavy-hit");
    expect(heavy.layers.map((layer) => layer.type)).toEqual(["shards", "wave"]);
  });

  it("parses character-facing hit presets without ground waves", () => {
    const sparks = parseEffectDefinition(characterHitSparks);
    const slash = parseEffectDefinition(characterSlashHit);
    const energy = parseEffectDefinition(characterEnergyHit);

    expect(sparks.layers.map((layer) => layer.type)).toEqual(["shards"]);
    expect(slash.layers.map((layer) => layer.type)).toEqual([
      "slashArc",
      "shards"
    ]);
    expect(energy.layers.map((layer) => layer.type)).toEqual([
      "ring",
      "shards",
      "shards"
    ]);
    for (const definition of [sparks, slash, energy]) {
      expect(definition.layers.some((layer) => layer.type === "wave")).toBe(
        false
      );
    }
  });

  it("parses fireball, arcane bolt, and grenade projectile presets", () => {
    const fireballDefinition = parseEffectDefinition(fireball);
    const arcaneBoltDefinition = parseEffectDefinition(arcaneBolt);
    const grenadeDefinition = parseEffectDefinition(grenade);
    const threeLaneDefinition = parseEffectDefinition(multiProjectileThree);
    const sixLaneDefinition = parseEffectDefinition(multiProjectileSix);
    const fireballLayer = fireballDefinition.layers[0];
    const arcaneBoltLayer = arcaneBoltDefinition.layers[0];
    const grenadeLayer = grenadeDefinition.layers[0];

    if (
      !fireballLayer ||
      fireballLayer.type !== "projectile" ||
      !arcaneBoltLayer ||
      arcaneBoltLayer.type !== "projectile" ||
      !grenadeLayer ||
      grenadeLayer.type !== "projectile"
    ) {
      throw new Error("Expected projectile layers in all projectile presets.");
    }

    expect(fireballLayer.geometry.shape).toBe("orb");
    expect(arcaneBoltLayer.geometry.shape).toBe("dart");
    expect(grenadeLayer.geometry.shape).toBe("bomb");
    expect(threeLaneDefinition.layers).toHaveLength(3);
    expect(sixLaneDefinition.layers).toHaveLength(6);
    expect(
      threeLaneDefinition.layers.every((layer) => layer.type === "projectile")
    ).toBe(true);
    expect(
      sixLaneDefinition.layers.every((layer) => layer.type === "projectile")
    ).toBe(true);
  });

  it("loads a catalog of uniquely identified effect templates", () => {
    const entries = parseEffectCatalog(effectCatalog);
    const definitions = [
      layeredImpact,
      impactRing,
      chargedImpact,
      hitSparks,
      energyHit,
      heavyHit,
      characterHitSparks,
      characterSlashHit,
      characterEnergyHit,
      wavePulse,
      slashArc,
      lightArcSlash,
      leftToRightSlash,
      doublePointedSlash,
      doublePointedLeftToRightSlash,
      stoneShatter,
      crystalShatter,
      glassShatter,
      fireball,
      arcaneBolt,
      grenade,
      multiProjectileThree,
      multiProjectileSix
    ].map(parseEffectDefinition);

    expect(entries.map((entry) => entry.id)).toEqual(
      definitions.map((definition) => definition.id)
    );
    expect(entries.map((entry) => entry.category)).toEqual([
      "冲击",
      "冲击",
      "冲击",
      "冲击",
      "冲击",
      "冲击",
      "角色受击",
      "角色受击",
      "角色受击",
      "波纹",
      "斩击",
      "斩击",
      "斩击",
      "斩击",
      "斩击",
      "碎裂",
      "碎裂",
      "碎裂",
      "飞弹与投掷物",
      "飞弹与投掷物",
      "飞弹与投掷物",
      "飞弹与投掷物",
      "飞弹与投掷物"
    ]);
    expect(entries.map((entry) => entry.name)).toEqual([
      "叠层地面冲击",
      "冲击环",
      "蓄力地面爆发",
      "命中火花",
      "能量命中",
      "重击火花",
      "角色受击火花",
      "角色斩击反馈",
      "角色能量命中",
      "波纹脉冲",
      "弧形斩击",
      "光弧粒子斩击",
      "横向光弧斩击",
      "双尖光弧斩击",
      "双尖横向斩击",
      "石块碎裂",
      "奥术晶体爆发",
      "玻璃碎裂",
      "飞火弹",
      "奥术飞弹",
      "手雷投掷",
      "三弹道齐射",
      "六弹道齐射"
    ]);
    for (const entry of entries) {
      expect(definitions.some((definition) => definition.id === entry.id)).toBe(
        true
      );
    }
  });

  it("rejects duplicate IDs in an effect catalog", () => {
    const duplicate = structuredClone(effectCatalog);
    duplicate.effects.push(duplicate.effects[0]);

    expect(() => parseEffectCatalog(duplicate)).toThrow(
      "duplicate IDs or files"
    );
  });

  it("rejects wave softness and slash arc angles outside their ranges", () => {
    const invalidSoftness = structuredClone(layeredImpact);
    const wave = invalidSoftness.layers.find((layer) => layer.type === "wave");
    if (!wave) {
      throw new Error("Expected a wave layer in the layered sample.");
    }
    wave.geometry.softness = 1.1;
    expect(() => parseEffectDefinition(invalidSoftness)).toThrow(
      "Invalid VFX effect definition"
    );

    const invalidAngle = structuredClone(layeredImpact);
    const slashArc = invalidAngle.layers.find(
      (layer) => layer.type === "slashArc"
    );
    if (!slashArc) {
      throw new Error("Expected a slash arc layer in the layered sample.");
    }
    slashArc.geometry.sweepAngle = 0;
    expect(() => parseEffectDefinition(invalidAngle)).toThrow(
      "Invalid VFX effect definition"
    );

    const invalidTipRatio = structuredClone(doublePointedSlash);
    invalidTipRatio.layers[0].geometry.tipRatio = 0.51;
    expect(() => parseEffectDefinition(invalidTipRatio)).toThrow(
      "Invalid VFX effect definition"
    );
  });

  it("updates the slash arc clipping angle continuously when seeking", () => {
    const definition = parseEffectDefinition(leftToRightSlash);
    const layer = definition.layers[0];
    if (!layer || layer.type !== "slashArc") {
      throw new Error("Expected a slash arc layer.");
    }

    const instance = new EffectInstance(definition, {
      position: new THREE.Vector3()
    });
    const mesh = instance.root.children[0];
    if (
      !(mesh instanceof THREE.Mesh) ||
      !(mesh.material instanceof THREE.ShaderMaterial)
    ) {
      throw new Error("Expected a shader-backed slash arc mesh.");
    }

    const sweepAngle = mesh.material.uniforms.uArcSweepAngle;
    expect(mesh.material.uniforms.uArcTipRatio.value).toBe(0);
    instance.seek(layer.duration * 0.36);
    expect(sweepAngle.value).toBeCloseTo(THREE.MathUtils.degToRad(76));
    instance.seek(layer.duration * 0.72);
    expect(sweepAngle.value).toBeCloseTo(THREE.MathUtils.degToRad(152));
    instance.dispose(new THREE.Scene());
  });

  it("rejects sweep angle tracks outside the slash arc geometry range", () => {
    const invalid = structuredClone(leftToRightSlash);
    const track = invalid.layers[0].tracks.find(
      (candidate) => candidate.property === "sweepAngle"
    );
    if (!track) {
      throw new Error("Expected a sweep angle track.");
    }
    track.keys[1].value = 360;

    expect(() => parseEffectDefinition(invalid)).toThrow("must be at most 152");
  });

  it("rejects sweep angle tracks on non-slash layers", () => {
    const invalid = structuredClone(impactRing);
    invalid.layers[0].tracks.push({
      property: "sweepAngle",
      keys: [
        { t: 0, value: 0 },
        { t: 1, value: 90 }
      ]
    });

    expect(() => parseEffectDefinition(invalid)).toThrow(
      "only slashArc layers support it"
    );
  });

  it("rejects references to undeclared parameters", () => {
    const invalid = structuredClone(parseEffectDefinition(impactRing));
    invalid.layers[0].tracks[0].keys[1] = {
      t: 1,
      value: { param: "missing" },
      ease: "outCubic"
    };

    expect(() => parseEffectDefinition(invalid)).toThrow(
      'references missing parameter "missing"'
    );
  });

  it("reports unsupported parameter types explicitly", () => {
    const unsupported = JSON.parse(
      JSON.stringify(impactRing)
    ) as Record<string, unknown>;
    const params = unsupported.params as Record<string, unknown>;
    params.radius = { type: "vector", default: [0, 0, 0] };

    expect(() => parseEffectDefinition(unsupported)).toThrow(
      'Unsupported parameter type "vector" for parameter "radius"'
    );
  });
});

describe("template-driven parameter controls", () => {
  it("generates controls for arbitrary parameter names with their defaults and bounds", () => {
    const specs = getParameterControlSpecs({
      intensity: { type: "number", default: 0.65, min: 0.1, max: 0.9 },
      tint: { type: "color", default: "#ff8040" }
    });

    expect(specs).toEqual([
      {
        name: "intensity",
        type: "number",
        defaultValue: 0.65,
        min: 0.1,
        max: 0.9
      },
      {
        name: "tint",
        type: "color",
        defaultValue: "#ff8040"
      }
    ]);
  });

  it("returns the selected template's defaults instead of retaining prior values", () => {
    const first = getParameterControlSpecs({
      scale: { type: "number", default: 1, min: 0.5, max: 2 }
    });
    const next = getParameterControlSpecs({
      scale: { type: "number", default: 3, min: 2, max: 4 }
    });

    expect(first[0].defaultValue).toBe(1);
    expect(next[0].defaultValue).toBe(3);
  });
});

describe("easing and tracks", () => {
  it("builds per-transition curve previews with playback-time markers", () => {
    const definition = parseEffectDefinition(impactRing);
    const segments = getEasingPreviewSegments(definition);
    const radiusSegment = segments.find(
      (segment) => segment.property === "radius"
    );

    expect(segments).toHaveLength(2);
    if (!radiusSegment) {
      throw new Error("Expected a radius easing segment.");
    }
    expect(typeof radiusSegment.ease).not.toBe("string");
    expect(radiusSegment.startTime).toBe(0);
    expect(radiusSegment.endTime).toBe(definition.layers[0].duration);
    expect(getEasingPreviewPoint(radiusSegment, 0).y).toBeCloseTo(0);
    expect(
      getEasingPreviewPoint(
        radiusSegment,
        definition.layers[0].duration / 2
      )
    ).toEqual({ x: 0.5, y: applyEase(radiusSegment.ease, 0.5) });
    expect(
      getEasingPreviewPoint(radiusSegment, definition.duration + 1)
    ).toEqual({ x: 1, y: 1 });
  });

  it("samples built-in and custom curves for graph rendering", () => {
    const samples = Array.from(
      { length: SAMPLED_EASE_SAMPLE_COUNT },
      (_, index) => (index / (SAMPLED_EASE_SAMPLE_COUNT - 1)) ** 2
    );
    const points = sampleEaseCurve({ samples });

    expect(points).toHaveLength(SAMPLED_EASE_SAMPLE_COUNT + 1);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points.at(-1)).toEqual({ x: 1, y: 1 });
    expect(points[32].y).toBeCloseTo(0.25, 3);
  });

  it("evaluates built-in easing functions", () => {
    expect(applyEase("inQuad", 0.5)).toBeCloseTo(0.25);
    expect(applyEase("outCubic", 0.5)).toBeCloseTo(0.875);
    expect(applyEase("inOutSine", 0)).toBeCloseTo(0);
    expect(applyEase("inOutSine", 1)).toBeCloseTo(1);
  });

  it("evaluates sampled easing curves with clamped normalized progress", () => {
    const ease = {
      samples: Array.from(
        { length: SAMPLED_EASE_SAMPLE_COUNT },
        (_, index) => (index / (SAMPLED_EASE_SAMPLE_COUNT - 1)) ** 2
      )
    };

    expect(applyEase(ease, 0.5)).toBeCloseTo(0.25, 3);
    expect(applyEase(ease, -1)).toBeCloseTo(0);
    expect(applyEase(ease, 2)).toBeCloseTo(1);
  });

  it("parses sampled curves and rejects curves with invalid endpoints", () => {
    const definition = structuredClone(parseEffectDefinition(impactRing));
    const radiusEase = {
      samples: Array.from(
        { length: SAMPLED_EASE_SAMPLE_COUNT },
        (_, index) => index / (SAMPLED_EASE_SAMPLE_COUNT - 1)
      )
    };
    definition.layers[0].tracks[0].keys[1].ease = radiusEase;
    expect(parseEffectDefinition(definition).id).toBe("impact.ring");

    const invalid = structuredClone(definition);
    const invalidEase = invalid.layers[0].tracks[0].keys[1].ease;
    if (typeof invalidEase === "string" || invalidEase === undefined) {
      throw new Error("Expected a sampled easing curve.");
    }
    invalidEase.samples[0] = 0.1;
    expect(() => parseEffectDefinition(invalid)).toThrow(
      "easing samples must start at 0 and end at 1"
    );
  });

  it("evaluates a parameterized numeric track at absolute progress", () => {
    const definition = parseEffectDefinition(impactRing);
    const radiusTrack = definition.layers[0].tracks[0];

    expect(
      evaluateTrack(radiusTrack, 0.5, {
        radius: 2.4,
        color: "#67e8ff"
      })
    ).toBeCloseTo(2.11);
  });

  it("clamps progress to the track endpoints", () => {
    const definition = parseEffectDefinition(impactRing);
    const opacityTrack = definition.layers[0].tracks[1];
    const params = { radius: 2.4, color: "#67e8ff" };

    expect(evaluateTrack(opacityTrack, -1, params)).toBeCloseTo(0.9);
    expect(evaluateTrack(opacityTrack, 2, params)).toBeCloseTo(0);
  });

  it("plays an effect and removes its resources when it finishes", () => {
    const definition = parseEffectDefinition(layeredImpact);
    const scene = new THREE.Scene();
    const system = new VfxSystem(scene);
    system.register(definition);

    const handle = system.play(definition.id, {
      position: new THREE.Vector3()
    });
    expect(scene.children).toHaveLength(1);
    expect(scene.children[0].children).toHaveLength(definition.layers.length);

    system.update(definition.duration);

    expect(handle.finished).toBe(true);
    expect(scene.children).toHaveLength(0);
    system.dispose();
  });

  it("updates deterministic shard instance transforms when seeking", () => {
    const definition = parseEffectDefinition(stoneShatter);
    const scene = new THREE.Scene();
    const system = new VfxSystem(scene);
    system.register(definition);

    const handle = system.play(definition.id, {
      position: new THREE.Vector3()
    });
    const mesh = scene.children[0].children[0] as THREE.InstancedMesh;
    const firstTransform = new THREE.Matrix4();
    const laterTransform = new THREE.Matrix4();
    handle.seek(0.2);
    mesh.getMatrixAt(0, firstTransform);
    handle.seek(0.6);
    mesh.getMatrixAt(0, laterTransform);

    expect(mesh.count).toBe(34);
    expect(laterTransform.elements).not.toEqual(firstTransform.elements);
    if (Array.isArray(mesh.material)) {
      throw new Error("Expected a single shard material.");
    }
    expect(mesh.material.opacity).toBeLessThan(1);
    system.dispose();
  });

  it("launches a projectile from the origin along an arcing path when seeking", () => {
    const definition = parseEffectDefinition(grenade);
    const scene = new THREE.Scene();
    const system = new VfxSystem(scene);
    system.register(definition);

    const handle = system.play(definition.id, {
      position: new THREE.Vector3()
    });
    const projectile = scene.children[0].children[0] as THREE.Group;
    expect(projectile.position.x).toBeCloseTo(0);
    expect(projectile.position.z).toBeCloseTo(0);

    handle.seek(definition.duration / 2);
    expect(projectile.position.x).toBeCloseTo(1.95);
    expect(projectile.position.z).toBeCloseTo(1.35);

    handle.seek(0);
    expect(projectile.position.x).toBeCloseTo(0);
    system.dispose();
  });

  it("fans three projectiles out from a shared launch point", () => {
    const definition = parseEffectDefinition(multiProjectileThree);
    const scene = new THREE.Scene();
    const system = new VfxSystem(scene);
    system.register(definition);

    const handle = system.play(definition.id, {
      position: new THREE.Vector3()
    });
    const root = scene.children[0];
    handle.seek(definition.duration / 2);

    const leftProjectile = root.children[0] as THREE.Group;
    const centerProjectile = root.children[1] as THREE.Group;
    const rightProjectile = root.children[2] as THREE.Group;
    expect(leftProjectile.position.x).toBeGreaterThan(0);
    expect(leftProjectile.position.y).toBeLessThan(0);
    expect(centerProjectile.position.y).toBeCloseTo(0);
    expect(rightProjectile.position.y).toBeGreaterThan(0);
    expect(rightProjectile.position.x).toBeCloseTo(leftProjectile.position.x);
    system.dispose();
  });

  it("seeks to absolute time, clamps endpoints, and can resume after completion", () => {
    const definition = parseEffectDefinition(impactRing);
    const scene = new THREE.Scene();
    const system = new VfxSystem(scene);
    system.register(definition);

    const handle = system.play(definition.id, {
      position: new THREE.Vector3()
    });
    handle.seek(0.2);
    expect(handle.currentTime).toBeCloseTo(0.2);
    expect(handle.finished).toBe(false);
    const mesh = scene.children[0].children[0] as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.ShaderMaterial
    >;
    expect(mesh.material.uniforms.uRadius.value).toBeCloseTo(
      evaluateTrack(
        definition.layers[0].tracks[0],
        0.2 / definition.layers[0].duration,
        { radius: 2.4, color: "#67e8ff" }
      )
    );

    handle.seek(definition.duration);
    expect(handle.currentTime).toBe(definition.duration);
    expect(handle.finished).toBe(true);
    expect(scene.children).toHaveLength(0);

    handle.seek(-1);
    expect(handle.currentTime).toBe(0);
    expect(handle.finished).toBe(false);
    expect(scene.children).toHaveLength(1);

    handle.seek(definition.duration + 1);
    expect(handle.currentTime).toBe(definition.duration);
    expect(handle.finished).toBe(true);
    expect(scene.children).toHaveLength(0);
    system.dispose();
  });

  it("rejects non-finite seek times and seeks on explicitly stopped effects", () => {
    const definition = parseEffectDefinition(impactRing);
    const scene = new THREE.Scene();
    const system = new VfxSystem(scene);
    system.register(definition);

    const handle = system.play(definition.id, {
      position: new THREE.Vector3()
    });
    expect(() => handle.seek(Number.NaN)).toThrow(
      "Effect time must be a finite number."
    );
    handle.stop();
    expect(() => handle.seek(0.1)).toThrow("Cannot seek a stopped effect.");
    system.dispose();
  });

  it("rejects invalid surface normals before creating scene objects", () => {
    const definition = parseEffectDefinition(impactRing);
    const scene = new THREE.Scene();
    const system = new VfxSystem(scene);
    system.register(definition);

    expect(() =>
      system.play(definition.id, {
        position: new THREE.Vector3(),
        normal: new THREE.Vector3()
      })
    ).toThrow("Effect surface normal must contain finite, non-zero coordinates.");
    expect(scene.children).toHaveLength(0);
    system.dispose();
  });
});

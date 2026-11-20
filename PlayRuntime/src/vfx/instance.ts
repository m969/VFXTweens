import * as THREE from "three";
import { evaluateTrack } from "./timeline";
import { resolveColorValue, resolveParameters } from "./parameters";
import type {
  EffectDefinition,
  EffectLayerDefinition,
  ProjectileLayerDefinition,
  ResolvedParameters,
  SlashRibbonLayerDefinition,
  ShardLayerDefinition,
  TrackDefinition
} from "./types";

export interface EffectPlayOptions {
  position: THREE.Vector3;
  normal?: THREE.Vector3;
  params?: Record<string, unknown>;
}

interface SurfaceLayerInstance {
  kind: "surface";
  definition: Extract<
    EffectLayerDefinition,
    { type: "ring" | "wave" | "slashArc" }
  >;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  radiusTrack: TrackDefinition;
  opacityTrack: TrackDefinition;
  sweepAngleTrack?: TrackDefinition;
}

interface SlashRibbonLayerInstance {
  kind: "slashRibbon";
  definition: SlashRibbonLayerDefinition;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  radiusTrack: TrackDefinition;
  opacityTrack: TrackDefinition;
  revealTrack: TrackDefinition;
}

interface ShardSeed {
  angle: number;
  radialScale: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  rotationSpeedX: number;
  rotationSpeedY: number;
  rotationSpeedZ: number;
}

interface ShardLayerInstance {
  kind: "shards";
  definition: ShardLayerDefinition;
  mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  radiusTrack: TrackDefinition;
  opacityTrack: TrackDefinition;
  seeds: ShardSeed[];
  position: THREE.Vector3;
  scale: THREE.Vector3;
  rotation: THREE.Euler;
  quaternion: THREE.Quaternion;
  matrix: THREE.Matrix4;
}

interface ProjectileLayerInstance {
  kind: "projectile";
  definition: ProjectileLayerDefinition;
  mesh: THREE.Group;
  radiusTrack: TrackDefinition;
  opacityTrack: TrackDefinition;
  parts: Array<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>;
  baseOpacities: number[];
  direction: THREE.Vector3;
  forward: THREE.Vector3;
}

type EffectLayerInstance =
  | SurfaceLayerInstance
  | SlashRibbonLayerInstance
  | ShardLayerInstance
  | ProjectileLayerInstance;

const ringVertexShader = `
  varying vec2 vPosition;

  void main() {
    vPosition = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ringFragmentShader = `
  uniform float uRadius;
  uniform float uThickness;
  uniform float uOpacity;
  uniform vec3 uColor;
  uniform int uLayerType;
  uniform float uSoftness;
  uniform float uArcStartAngle;
  uniform float uArcSweepAngle;
  uniform float uArcTipRatio;
  varying vec2 vPosition;

  void main() {
    float distanceFromCenter = length(vPosition);
    float bandDistance = abs(distanceFromCenter - uRadius);
    float halfThickness = uThickness * 0.5;

    if (uLayerType == 2) {
      if (uArcSweepAngle <= 0.001) {
        discard;
      }
      float angle = atan(vPosition.y, vPosition.x);
      float angleFromStart = mod(
        angle - uArcStartAngle + 6.28318530718,
        6.28318530718
      );
      if (angleFromStart > uArcSweepAngle) {
        discard;
      }
      if (uArcTipRatio > 0.0) {
        float arcProgress = angleFromStart / uArcSweepAngle;
        float tipProgress = min(arcProgress, 1.0 - arcProgress);
        halfThickness *= smoothstep(0.0, uArcTipRatio, tipProgress);
      }
    }

    float alpha;

    if (uLayerType == 1) {
      float edgeSoftness = max(halfThickness * uSoftness, 0.001);
      float innerEdge = max(halfThickness - edgeSoftness, 0.0);
      float outerEdge = halfThickness + edgeSoftness;
      alpha = (1.0 - smoothstep(innerEdge, outerEdge, bandDistance)) * uOpacity;
    } else {
      float edgeSoftness = max(
        uLayerType == 2 && uArcTipRatio > 0.0
          ? halfThickness * 0.12
          : uThickness * 0.12,
        0.001
      );
      float outerEdge = 1.0 - smoothstep(
        halfThickness - edgeSoftness,
        halfThickness + edgeSoftness,
        bandDistance
      );
      alpha = outerEdge * uOpacity;
    }

    if (alpha <= 0.001) {
      discard;
    }

    gl_FragColor = vec4(uColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const slashRibbonVertexShader = `
  attribute float aProgress;
  attribute float aAcross;
  varying float vProgress;
  varying float vAcross;

  void main() {
    vProgress = aProgress;
    vAcross = aAcross;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const slashRibbonFragmentShader = `
  uniform float uOpacity;
  uniform float uReveal;
  uniform vec3 uColor;
  varying float vProgress;
  varying float vAcross;

  void main() {
    if (uReveal <= 0.0 || vProgress > uReveal) {
      discard;
    }

    float edgeAlpha = 1.0 - smoothstep(0.72, 1.0, abs(vAcross));
    float headAlpha = 1.0 - smoothstep(
      max(uReveal - 0.045, 0.0),
      uReveal,
      vProgress
    );
    float alpha = edgeAlpha * headAlpha * uOpacity;
    if (alpha <= 0.001) {
      discard;
    }

    gl_FragColor = vec4(uColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function getNumberValue(
  value: number | { param: string },
  params: ResolvedParameters
): number {
  if (typeof value === "number") {
    return value;
  }

  const resolved = params[value.param];
  if (typeof resolved !== "number") {
    throw new Error(`Parameter "${value.param}" must resolve to a number.`);
  }
  return resolved;
}

function getRequiredTrack(
  layer: EffectLayerDefinition,
  property: TrackDefinition["property"]
): TrackDefinition {
  const track = layer.tracks.find((candidate) => candidate.property === property);
  if (!track) {
    throw new Error(`Layer "${layer.id}" is missing its ${property} track.`);
  }
  return track;
}

/** 用图层 ID 派生稳定随机序列，保证反复预览和时间轴跳转结果一致。 */
function createSeededRandom(seedText: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    state = Math.imul(state ^ seedText.charCodeAt(index), 16777619);
  }

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createSurfaceLayer(
  layer: SurfaceLayerInstance["definition"],
  params: ResolvedParameters
): SurfaceLayerInstance {
  const radiusTrack = getRequiredTrack(layer, "radius");
  const opacityTrack = getRequiredTrack(layer, "opacity");
  const maximumRadius = Math.max(
    ...radiusTrack.keys.map((key) => getNumberValue(key.value, params))
  );
  const extent = Math.max(maximumRadius, layer.geometry.thickness) +
    layer.geometry.thickness;
  const geometry = new THREE.PlaneGeometry(extent * 2, extent * 2);
  const uniforms = {
    uRadius: { value: 0 },
    uThickness: { value: layer.geometry.thickness },
    uOpacity: { value: 0 },
    uColor: {
      value: new THREE.Color(resolveColorValue(layer.material.color, params))
    },
    uLayerType: {
      value: layer.type === "ring" ? 0 : layer.type === "wave" ? 1 : 2
    },
    uSoftness: {
      value: layer.type === "wave" ? layer.geometry.softness : 0
    },
    uArcStartAngle: {
      value:
        layer.type === "slashArc"
          ? THREE.MathUtils.degToRad(layer.geometry.startAngle)
          : 0
    },
    uArcSweepAngle: {
      value:
        layer.type === "slashArc"
          ? THREE.MathUtils.degToRad(layer.geometry.sweepAngle)
          : Math.PI * 2
    },
    uArcTipRatio: {
      value:
        layer.type === "slashArc"
          ? layer.geometry.tipRatio ?? 0
          : 0
    }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: ringVertexShader,
    fragmentShader: ringFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending:
      layer.material.blend === "additive"
        ? THREE.AdditiveBlending
        : THREE.NormalBlending
  });

  return {
    kind: "surface",
    definition: layer,
    mesh: new THREE.Mesh(geometry, material),
    radiusTrack,
    opacityTrack,
    sweepAngleTrack:
      layer.type === "slashArc"
        ? layer.tracks.find((track) => track.property === "sweepAngle")
        : undefined
  };
}

function evaluateSlashRibbonPoint(
  path: SlashRibbonLayerDefinition["geometry"]["path"],
  progress: number
): THREE.Vector2 {
  const inverse = 1 - progress;
  const startWeight = inverse * inverse * inverse;
  const control1Weight = 3 * inverse * inverse * progress;
  const control2Weight = 3 * inverse * progress * progress;
  const endWeight = progress * progress * progress;
  return new THREE.Vector2(
    startWeight * path.start.x +
      control1Weight * path.control1.x +
      control2Weight * path.control2.x +
      endWeight * path.end.x,
    startWeight * path.start.y +
      control1Weight * path.control1.y +
      control2Weight * path.control2.y +
      endWeight * path.end.y
  );
}

function createSlashRibbonLayer(
  layer: SlashRibbonLayerDefinition,
  params: ResolvedParameters
): SlashRibbonLayerInstance {
  const radiusTrack = getRequiredTrack(layer, "radius");
  const opacityTrack = getRequiredTrack(layer, "opacity");
  const revealTrack = getRequiredTrack(layer, "reveal");
  const segmentCount = 96;
  const sampledPoints = Array.from({ length: segmentCount + 1 }, (_, index) =>
    evaluateSlashRibbonPoint(
      layer.geometry.path,
      index / segmentCount
    )
  );
  const positions = new Float32Array((segmentCount + 1) * 2 * 3);
  const progresses = new Float32Array((segmentCount + 1) * 2);
  const acrossValues = new Float32Array((segmentCount + 1) * 2);
  const indices: number[] = [];

  for (let index = 0; index <= segmentCount; index += 1) {
    const previous = sampledPoints[Math.max(index - 1, 0)];
    const next = sampledPoints[Math.min(index + 1, segmentCount)];
    const center = sampledPoints[index];
    if (!previous || !next || !center) {
      throw new Error(`Slash ribbon layer "${layer.id}" has incomplete path samples.`);
    }

    const tangent = next.clone().sub(previous);
    if (tangent.lengthSq() <= 1e-12) {
      throw new Error(
        `Slash ribbon layer "${layer.id}" has a path with no usable tangent.`
      );
    }
    tangent.normalize();
    const perpendicularX = -tangent.y;
    const perpendicularY = tangent.x;
    const progress = index / segmentCount;
    const distanceToTip = Math.min(progress, 1 - progress);
    const taperProgress =
      layer.geometry.tipRatio === 0
        ? 1
        : THREE.MathUtils.clamp(
            distanceToTip / layer.geometry.tipRatio,
            0,
            1
          );
    const taper = taperProgress * taperProgress * (3 - 2 * taperProgress);
    const halfWidth = layer.geometry.width * taper * 0.5;
    const vertexOffset = index * 6;
    const attributeOffset = index * 2;

    positions[vertexOffset] = center.x + perpendicularX * halfWidth;
    positions[vertexOffset + 1] = center.y + perpendicularY * halfWidth;
    positions[vertexOffset + 2] = 0;
    positions[vertexOffset + 3] = center.x - perpendicularX * halfWidth;
    positions[vertexOffset + 4] = center.y - perpendicularY * halfWidth;
    positions[vertexOffset + 5] = 0;
    progresses[attributeOffset] = progress;
    progresses[attributeOffset + 1] = progress;
    acrossValues[attributeOffset] = 1;
    acrossValues[attributeOffset + 1] = -1;

    if (index < segmentCount) {
      const currentVertex = index * 2;
      indices.push(
        currentVertex,
        currentVertex + 1,
        currentVertex + 2,
        currentVertex + 1,
        currentVertex + 3,
        currentVertex + 2
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aProgress", new THREE.Float32BufferAttribute(progresses, 1));
  geometry.setAttribute("aAcross", new THREE.Float32BufferAttribute(acrossValues, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uReveal: { value: 0 },
      uColor: {
        value: new THREE.Color(resolveColorValue(layer.material.color, params))
      }
    },
    vertexShader: slashRibbonVertexShader,
    fragmentShader: slashRibbonFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending:
      layer.material.blend === "additive"
        ? THREE.AdditiveBlending
        : THREE.NormalBlending
  });
  const mesh = new THREE.Mesh(geometry, material);

  return {
    kind: "slashRibbon",
    definition: layer,
    mesh,
    radiusTrack,
    opacityTrack,
    revealTrack
  };
}

/** 创建实例化四面体碎片；半径轨道控制水平散射，局部 Z 轴表示表面法线。 */
function createShardLayer(
  layer: ShardLayerDefinition,
  params: ResolvedParameters
): ShardLayerInstance {
  const radiusTrack = getRequiredTrack(layer, "radius");
  const opacityTrack = getRequiredTrack(layer, "opacity");
  const random = createSeededRandom(`${layer.id}:${layer.geometry.count}`);
  const seeds = Array.from({ length: layer.geometry.count }, () => ({
    angle: random() * Math.PI * 2,
    radialScale: 1 + (random() - 0.5) * layer.geometry.spread,
    scaleX: 0.55 + random() * 0.65,
    scaleY: 0.55 + random() * 0.65,
    scaleZ: 0.25 + random() * 0.5,
    rotationX: random() * Math.PI * 2,
    rotationY: random() * Math.PI * 2,
    rotationZ: random() * Math.PI * 2,
    rotationSpeedX: (random() - 0.5) * 12,
    rotationSpeedY: (random() - 0.5) * 12,
    rotationSpeedZ: (random() - 0.5) * 12
  }));
  const geometry = new THREE.TetrahedronGeometry(1, 0);
  const vertexCount = geometry.getAttribute("position").count;
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(
      new Float32Array(vertexCount * 3).fill(1),
      3
    )
  );
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending:
      layer.material.blend === "additive"
        ? THREE.AdditiveBlending
        : THREE.NormalBlending
  });
  const mesh = new THREE.InstancedMesh(geometry, material, seeds.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;

  const baseColor = new THREE.Color(resolveColorValue(layer.material.color, params));
  const shardColor = new THREE.Color();
  for (let index = 0; index < seeds.length; index += 1) {
    shardColor.copy(baseColor).multiplyScalar(0.72 + random() * 0.42);
    mesh.setColorAt(index, shardColor);
  }
  const instanceColor = mesh.instanceColor;
  if (!instanceColor) {
    throw new Error(`Shard layer "${layer.id}" did not create instance colors.`);
  }
  instanceColor.needsUpdate = true;

  return {
    kind: "shards",
    definition: layer,
    mesh,
    radiusTrack,
    opacityTrack,
    seeds,
    position: new THREE.Vector3(),
    scale: new THREE.Vector3(),
    rotation: new THREE.Euler(),
    quaternion: new THREE.Quaternion(),
    matrix: new THREE.Matrix4()
  };
}

/** 创建由弹体和锥形尾迹组成的飞行图层；局部 +Y 轴沿飞行方向。 */
function createProjectileLayer(
  layer: ProjectileLayerDefinition,
  params: ResolvedParameters
): ProjectileLayerInstance {
  const radiusTrack = getRequiredTrack(layer, "radius");
  const opacityTrack = getRequiredTrack(layer, "opacity");
  const mesh = new THREE.Group();
  const parts: ProjectileLayerInstance["parts"] = [];
  const baseOpacities: number[] = [];
  const color = resolveColorValue(layer.material.color, params);
  const blending =
    layer.material.blend === "additive"
      ? THREE.AdditiveBlending
      : THREE.NormalBlending;

  const addPart = (
    geometry: THREE.BufferGeometry,
    partColor: THREE.ColorRepresentation,
    opacity: number
  ): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> => {
    const material = new THREE.MeshBasicMaterial({
      color: partColor,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending
    });
    const part = new THREE.Mesh(geometry, material);
    part.renderOrder = parts.length;
    mesh.add(part);
    parts.push(part);
    baseOpacities.push(opacity);
    return part;
  };

  const { size, trailLength, shape } = layer.geometry;
  const tail = addPart(
    new THREE.ConeGeometry(size * 0.48, trailLength, 8, 1, true),
    color,
    0.42
  );
  tail.position.y = -trailLength * 0.5 - size * 0.45;

  if (shape === "orb") {
    addPart(new THREE.SphereGeometry(size * 1.35, 12, 8), color, 0.28);
    addPart(new THREE.SphereGeometry(size * 0.78, 12, 8), color, 0.95);
    addPart(
      new THREE.SphereGeometry(size * 0.34, 10, 8),
      new THREE.Color(0xffffff),
      0.9
    );
  } else if (shape === "dart") {
    addPart(
      new THREE.ConeGeometry(size * 0.52, size * 1.8, 8),
      color,
      0.95
    );
    addPart(
      new THREE.SphereGeometry(size * 0.28, 8, 6),
      new THREE.Color(0xffffff),
      0.9
    );
  } else {
    addPart(new THREE.SphereGeometry(size, 10, 8), color, 0.95);
    const belt = addPart(
      new THREE.TorusGeometry(size * 0.92, size * 0.12, 6, 12),
      new THREE.Color(0xffe7b0),
      0.9
    );
    belt.rotation.x = Math.PI / 2;
  }

  return {
    kind: "projectile",
    definition: layer,
    mesh,
    radiusTrack,
    opacityTrack,
    parts,
    baseOpacities,
    direction: new THREE.Vector3(),
    forward: new THREE.Vector3(0, 1, 0)
  };
}

function createLayer(
  layer: EffectLayerDefinition,
  params: ResolvedParameters
): EffectLayerInstance {
  if (layer.type === "slashRibbon") {
    return createSlashRibbonLayer(layer, params);
  }
  if (layer.type === "shards") {
    return createShardLayer(layer, params);
  }
  if (layer.type === "projectile") {
    return createProjectileLayer(layer, params);
  }
  return createSurfaceLayer(layer, params);
}

export class EffectInstance {
  readonly root = new THREE.Group();
  readonly params: ResolvedParameters;
  finished = false;

  #elapsed = 0;
  #disposed = false;
  #layers: EffectLayerInstance[];

  get elapsedSeconds(): number {
    return this.#elapsed;
  }

  constructor(
    readonly definition: EffectDefinition,
    options: EffectPlayOptions
  ) {
    const normal = options.normal?.clone() ?? new THREE.Vector3(0, 1, 0);
    if (
      !Number.isFinite(normal.x) ||
      !Number.isFinite(normal.y) ||
      !Number.isFinite(normal.z) ||
      normal.lengthSq() === 0
    ) {
      throw new Error("Effect surface normal must contain finite, non-zero coordinates.");
    }
    normal.normalize();
    if (
      !Number.isFinite(options.position.x) ||
      !Number.isFinite(options.position.y) ||
      !Number.isFinite(options.position.z)
    ) {
      throw new Error("Effect position must contain finite coordinates.");
    }

    this.params = resolveParameters(definition, options.params);
    this.#layers = definition.layers.map((layer) => createLayer(layer, this.params));

    this.root.position.copy(options.position).addScaledVector(normal, 0.004);
    this.root.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal
    );
    for (const layer of this.#layers) {
      this.root.add(layer.mesh);
    }

    this.update(0);
  }

  update(deltaSeconds: number): boolean {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new Error("Effect delta time must be a finite, non-negative number.");
    }

    return this.seek(this.#elapsed + deltaSeconds);
  }

  seek(timeSeconds: number): boolean {
    if (!Number.isFinite(timeSeconds)) {
      throw new Error("Effect time must be a finite number.");
    }

    this.#elapsed = THREE.MathUtils.clamp(
      timeSeconds,
      0,
      this.definition.duration
    );
    for (const layer of this.#layers) {
      const layerTime = this.#elapsed - layer.definition.startAt;
      if (layerTime < 0 || layerTime > layer.definition.duration) {
        layer.mesh.visible = false;
        continue;
      }

      layer.mesh.visible = true;
      const progress = layerTime / layer.definition.duration;
      const radius = evaluateTrack(
        layer.radiusTrack,
        progress,
        this.params
      );
      const opacity = evaluateTrack(
        layer.opacityTrack,
        progress,
        this.params
      );
      if (layer.kind === "slashRibbon") {
        layer.mesh.scale.setScalar(radius);
        layer.mesh.material.uniforms.uOpacity.value = opacity;
        layer.mesh.material.uniforms.uReveal.value = evaluateTrack(
          layer.revealTrack,
          progress,
          this.params
        );
      } else if (layer.kind === "shards") {
        for (let index = 0; index < layer.seeds.length; index += 1) {
          const seed = layer.seeds[index];
          const angle = seed.angle;
          layer.position.set(
            Math.cos(angle) * radius * seed.radialScale,
            Math.sin(angle) * radius * seed.radialScale,
            layer.definition.geometry.lift * layerTime -
              0.5 * layer.definition.geometry.gravity * layerTime * layerTime
          );
          layer.scale.set(
            layer.definition.geometry.size * seed.scaleX,
            layer.definition.geometry.size * seed.scaleY,
            layer.definition.geometry.size * seed.scaleZ
          );
          layer.rotation.set(
            seed.rotationX + seed.rotationSpeedX * layerTime,
            seed.rotationY + seed.rotationSpeedY * layerTime,
            seed.rotationZ + seed.rotationSpeedZ * layerTime
          );
          layer.quaternion.setFromEuler(layer.rotation);
          layer.matrix.compose(layer.position, layer.quaternion, layer.scale);
          layer.mesh.setMatrixAt(index, layer.matrix);
        }
        layer.mesh.instanceMatrix.needsUpdate = true;
        layer.mesh.material.opacity = opacity;
      } else if (layer.kind === "projectile") {
        const { travel, arcHeight, directionAngle } =
          layer.definition.geometry;
        const directionRadians = THREE.MathUtils.degToRad(directionAngle);
        const directionX = Math.cos(directionRadians);
        const directionY = Math.sin(directionRadians);
        layer.mesh.position.set(
          travel * progress * directionX,
          travel * progress * directionY,
          4 * arcHeight * progress * (1 - progress)
        );
        layer.direction.set(
          travel * directionX,
          travel * directionY,
          4 * arcHeight * (1 - 2 * progress)
        ).normalize();
        layer.mesh.quaternion.setFromUnitVectors(
          layer.forward,
          layer.direction
        );
        layer.mesh.scale.setScalar(radius);
        for (let index = 0; index < layer.parts.length; index += 1) {
          layer.parts[index].material.opacity =
            opacity * layer.baseOpacities[index];
        }
      } else {
        layer.mesh.material.uniforms.uRadius.value = radius;
        layer.mesh.material.uniforms.uOpacity.value = opacity;
        if (layer.definition.type === "slashArc" && layer.sweepAngleTrack) {
          // 角度轨道以度保存，shader uniform 使用弧度。
          layer.mesh.material.uniforms.uArcSweepAngle.value =
            THREE.MathUtils.degToRad(
              evaluateTrack(layer.sweepAngleTrack, progress, this.params)
            );
        }
      }
    }

    this.finished = this.#elapsed >= this.definition.duration;
    return this.finished;
  }

  dispose(scene: THREE.Scene): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    scene.remove(this.root);
    for (const layer of this.#layers) {
      if (layer.kind === "projectile") {
        for (const part of layer.parts) {
          part.geometry.dispose();
          part.material.dispose();
        }
        continue;
      }
      layer.mesh.geometry.dispose();
      layer.mesh.material.dispose();
    }
  }
}

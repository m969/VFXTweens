import * as THREE from "three";
import { EffectInstance } from "./instance";
import type { EffectPlayOptions } from "./instance";
import type { EffectDefinition } from "./types";

export class EffectHandle {
  constructor(
    private readonly stopEffect: () => void,
    private readonly isEffectFinished: () => boolean,
    private readonly getEffectTime: () => number,
    private readonly seekEffect: (timeSeconds: number) => void
  ) {}

  get finished(): boolean {
    return this.isEffectFinished();
  }

  get currentTime(): number {
    return this.getEffectTime();
  }

  seek(timeSeconds: number): void {
    this.seekEffect(timeSeconds);
  }

  stop(): void {
    this.stopEffect();
  }
}

export class VfxSystem {
  #definitions = new Map<string, EffectDefinition>();
  #active = new Set<EffectInstance>();

  constructor(private readonly scene: THREE.Scene) {}

  register(definition: EffectDefinition): void {
    if (this.#definitions.has(definition.id)) {
      throw new Error(`Effect "${definition.id}" is already registered.`);
    }
    this.#definitions.set(definition.id, definition);
  }

  play(id: string, options: EffectPlayOptions): EffectHandle {
    const definition = this.#definitions.get(id);
    if (!definition) {
      throw new Error(`Effect "${id}" is not registered.`);
    }

    const createInstance = (): EffectInstance => {
      const instance = new EffectInstance(definition, {
        ...options,
        position: options.position.clone(),
        normal: options.normal?.clone(),
        params: options.params ? { ...options.params } : undefined
      });
      this.scene.add(instance.root);
      this.#active.add(instance);
      return instance;
    };

    let instance = createInstance();
    let explicitlyStopped = false;

    return new EffectHandle(
      () => {
        explicitlyStopped = true;
        this.#stop(instance);
      },
      () => instance.finished,
      () => instance.elapsedSeconds,
      (timeSeconds) => {
        if (!Number.isFinite(timeSeconds)) {
          throw new Error("Effect time must be a finite number.");
        }
        if (explicitlyStopped) {
          throw new Error("Cannot seek a stopped effect.");
        }
        if (this.#definitions.get(id) !== definition) {
          throw new Error(`Effect "${id}" is no longer registered.`);
        }
        if (!this.#active.has(instance)) {
          instance = createInstance();
        }
        if (instance.seek(timeSeconds)) {
          this.#stop(instance);
        }
      }
    );
  }

  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new Error("VFX delta time must be a finite, non-negative number.");
    }

    for (const instance of this.#active) {
      if (instance.update(deltaSeconds)) {
        this.#stop(instance);
      }
    }
  }

  dispose(): void {
    for (const instance of this.#active) {
      this.#stop(instance);
    }
    this.#definitions.clear();
  }

  #stop(instance: EffectInstance): void {
    if (!this.#active.delete(instance)) {
      return;
    }
    instance.finished = true;
    instance.dispose(this.scene);
  }
}

# VFXTweens

用代码和缓动函数组合游戏特效样式的模板库。V0 以世界空间程序化几何特效为主，目标运行时为 Three.js。

## 已确认的方向

- **编辑器：** Unity Editor，用于编辑模板参数和导出模板数据。
- **运行时：** Three.js / 浏览器，使用 TypeScript 实现缓动、时间轨道和几何特效。
- **数据交换：** 带版本号的 JSON；不把 Unity Prefab、材质或 `AnimationCurve` 当作运行时格式。
- **预览：** Three.js 预览页读取和游戏相同的 JSON，并复用同一套 runtime。Unity 内的预览可用于编辑，但 Three.js 预览是最终效果的准绳。
- **初始特效范围：** 冲击环、地面波纹、弧形斩击。
- **初始空间方式：** 世界空间表面特效，按位置和表面法线进行放置、定向。
- **Puerts：** V0 不需要。它不会把 Three.js 渲染带入 Unity。

## 当前实现

- V1 JSON Schema：[`PlayRuntime/schema/vfx-effect-v1.schema.json`](./PlayRuntime/schema/vfx-effect-v1.schema.json)
- 效果模板目录：[`PlayRuntime/public/effects/catalog.json`](./PlayRuntime/public/effects/catalog.json)
- 预览目录中的模板名称使用中文，稳定的英文 ID 保持不变。
- 预览侧栏将分类标签和动画模板列表放在左右并排的两个独立面板中；选择 `冲击`、`角色受击`、`波纹`、`斩击`、`碎裂` 或 `飞弹与投掷物` 标签即可切换动画列表，分类随模板目录数据维护。
- 冲击环样例：[`PlayRuntime/public/effects/impact-ring.vfx.json`](./PlayRuntime/public/effects/impact-ring.vfx.json)
- 组合冲击样例：[`PlayRuntime/public/effects/impact-layered.vfx.json`](./PlayRuntime/public/effects/impact-layered.vfx.json)
- 蓄力后释放的地面冲击：[`PlayRuntime/public/effects/skill-charged-impact.vfx.json`](./PlayRuntime/public/effects/skill-charged-impact.vfx.json)
- 命中粒子样例：`impact-hit-sparks.vfx.json`、`impact-energy-hit.vfx.json`、`impact-heavy-hit.vfx.json`
- 角色受击样例：`character-hit-sparks.vfx.json`、`character-slash-hit.vfx.json`、`character-energy-hit.vfx.json`；预览时在胸口高度沿角色表面法线展示，不包含人形模型。
- 碎片粒子样例：`impact-stone-shatter.vfx.json`、`skill-crystal-shatter.vfx.json`、`skill-glass-shatter.vfx.json`
- 飞弹与投掷物样例：`projectile-fireball.vfx.json`、`projectile-arcane-bolt.vfx.json`、`projectile-grenade.vfx.json`、`projectile-three-lane.vfx.json`、`projectile-six-lane.vfx.json`
- 独立波纹与斩击样例：`skill-wave-pulse.vfx.json`、`skill-slash-arc.vfx.json`、`skill-light-arc-slash.vfx.json`、`skill-slash-rising-crescent.vfx.json`、`skill-slash-sweep-left-to-right.vfx.json`、`skill-slash-double-pointed.vfx.json`、`skill-slash-double-pointed-left-to-right.vfx.json`；上挑弯月样例用多条错位的三次贝塞尔光带叠出辉光、核心和细光痕，横向光弧使用单条弧线的角度遮罩连续展开，双尖光弧可分别调整两个端头的收尖比例；双尖横向样例固定半径，仅从左向右显现
- Three.js runtime 和 npm 依赖均位于 `PlayRuntime/`。
- 预览页：从左侧栏选择效果模板，调整半径与颜色，支持重播、轨道旋转和缩放；窄屏下列表收纳为可展开抽屉。
- JSON 格式和 Three.js runtime 支持 `ring`、`wave`、`slashArc`、`slashRibbon`、`shards`、`projectile` 六种可组合图层；Unity 导出器目前支持除 `slashRibbon` 外的五种图层。`slashRibbon` 沿三次贝塞尔路径生成可收尖光带；`shards` 使用实例化四面体表现碎片，按表面法线抛起并受重力影响；`projectile` 可沿表面切线按抛物线路径飞行，并带有弹体与尾迹。

根目录已初始化为 Unity 工程，版本为 Unity 2022.3.62f2，使用 URP 14.0.12。Three.js runtime 独立放在 `PlayRuntime/`。

## 本地运行

需要 Node.js 22.12 或更新版本。

```sh
cd PlayRuntime
npm install
npm run dev
```

打开 Vite 输出的本地地址即可查看预览。验证命令：

```sh
npm test
npm run build
```

如果从 Unity 工程根目录调用，可使用 `npm --prefix PlayRuntime run dev`、`npm --prefix PlayRuntime test` 和 `npm --prefix PlayRuntime run build`。

## 桌面预览

安装 Node.js 依赖后，在 Windows 上运行仓库根目录的 `start-tauri.cmd`，即可通过 Tauri 桌面窗口启动预览。该脚本会在 Tauri CLI 尚未安装时先安装 `PlayRuntime/` 的 npm 依赖。

也可以在 `PlayRuntime/` 目录执行 `npm run tauri:dev` 启动开发版；执行 `npm run tauri:build` 可构建桌面安装包。构建 Tauri 应用还需要 Rust 工具链及 Windows WebView2 Runtime。

## 工作流

```text
VFXTweens/（Unity 工程根目录）
  ├─ Assets/VFXTweens/
  │   ├─ ImpactRing.asset
  │   ├─ LayeredImpact.asset
  │   ├─ WavePulse.asset
  │   ├─ SlashArc.asset
  │   ├─ ChargedGroundBurst.asset
  │   ├─ VfxEffectDefinition.cs
  │   └─ Editor/
  │       ├─ ImpactRingEffectEditor.cs
  │       └─ VfxEffectDefinitionEditor.cs
  ├─ Packages/、ProjectSettings/、UserSettings/
  └─ PlayRuntime/
      ├─ Three.js runtime
      ├─ JSON Schema、模板目录与特效样例
      └─ Web 预览页

Unity Editor（Assets/VFXTweens/Editor）
  └─ 编辑模板、参数、图层和缓动
      └─ 导出 versioned JSON
          └─ PlayRuntime 载入并播放 / 预览
```

Unity 工具负责生产符合格式的模板数据；特效几何、材质和播放行为由 Three.js runtime 实现。预览页应直接调用 runtime，避免维护一套与游戏表现不一致的预览实现。

## V0 模块

1. **模板定义**：模板 ID、默认参数、图层、持续时间和表面空间设置。
2. **缓动函数**：内置 easing 函数，以及自定义曲线的导出格式。
3. **时间轨道**：按绝对播放时间求值，支持每层延迟、时长和关键帧。
4. **几何图层**：支持 `ring` 冲击环、`wave` 柔边扩张环、`slashArc` 固定圆弧、`slashRibbon` 曲线路径光带、`shards` 碎片粒子和 `projectile` 飞弹轨迹；飞弹可从同一发射点按不同方向角组成齐射。
5. **运行时管理**：播放、停止和更新活动特效。
6. **预览页**：加载导出的 JSON，在 Three.js 中播放并调整实例参数。

缓动进度由时间轨道计算，不通过每帧累加属性值。这样可以降低帧率对结果的影响，并支持暂停、回放和预览跳转。缓动函数的输入进度限制在 `[0, 1]`；函数输出不应统一截断，以保留 `back` 等曲线的过冲效果。

## 模板格式草案

以下 JSON 展示 V0 的数据形状；实现时应为格式增加校验，并遵守 `schemaVersion`。

```json
{
  "schemaVersion": 1,
  "id": "impact.ring",
  "duration": 0.42,
  "space": "surface",
  "params": {
    "radius": {
      "type": "number",
      "default": 2.4,
      "min": 0.2,
      "max": 6
    },
    "color": {
      "type": "color",
      "default": "#67e8ff"
    }
  },
  "layers": [
    {
      "id": "main-ring",
      "type": "ring",
      "startAt": 0,
      "duration": 0.38,
      "geometry": {
        "thickness": 0.08
      },
      "material": {
        "color": { "param": "color" },
        "blend": "additive"
      },
      "tracks": [
        {
          "property": "radius",
          "keys": [
            { "t": 0, "value": 0.08 },
            {
              "t": 1,
              "value": { "param": "radius" },
              "ease": "outCubic"
            }
          ]
        },
        {
          "property": "opacity",
          "keys": [
            { "t": 0, "value": 0.9 },
            { "t": 1, "value": 0, "ease": "inQuad" }
          ]
        }
      ]
    }
  ]
}
```

### 几何图层

`ring` 使用 `geometry.thickness` 定义环带宽度。`wave` 额外使用归一化 `softness`（`0..1`）：值越大，环带内外边缘越柔。`slashArc` 使用角度（单位为度）裁切圆环；`startAngle` 的 `0°` 位于图层局部 `+X` 方向，角度逆时针增加，`sweepAngle` 范围为 `(0, 360]`。可选的 `tipRatio`（`0..0.5`）控制弧线两端的收尖长度，未设置或为 `0` 时保持等宽。以下仅展示各图层的类型与几何字段，其他必需字段仍按完整图层定义提供。

```json
{
  "type": "wave",
  "geometry": { "thickness": 0.55, "softness": 0.8 }
}
```

```json
{
  "type": "slashArc",
  "geometry": { "thickness": 0.14, "startAngle": 205, "sweepAngle": 130, "tipRatio": 0.12 }
}
```

`slashRibbon` 沿 `path` 的三次贝塞尔曲线生成带状网格。路径坐标和 `width` 相对于图层半径缩放；`tipRatio`（`0..0.5`）控制光带首尾的收尖长度。

```json
{
  "type": "slashRibbon",
  "geometry": {
    "path": {
      "start": { "x": -0.95, "y": -0.48 },
      "control1": { "x": -0.1, "y": -0.65 },
      "control2": { "x": 1.03, "y": -0.15 },
      "end": { "x": 0.72, "y": 0.92 }
    },
    "width": 0.22,
    "tipRatio": 0.18
  }
}
```

### 格式约定

- `duration` 和 `startAt` 使用秒；关键帧 `t` 是该轨道局部的归一化时间，范围为 `0` 到 `1`。
- 某关键帧上的 `ease` 描述从前一个关键帧到当前关键帧的插值曲线。
- `{ "param": "radius" }` 表示引用实例参数，不在 JSON 中执行任意代码。
- `property` 必须由对应图层类型声明支持，避免依赖脆弱的任意对象属性路径。
- `slashArc` 图层可用 `sweepAngle` 轨道按角度（度）连续揭示弧线，取值范围为 `0..geometry.sweepAngle`；未提供该轨道时使用完整几何弧线。
- `slashRibbon` 图层必须提供 `reveal` 轨道，取值范围为 `0..1`，用于沿贝塞尔路径逐步显现光带。
- 缓动可使用稳定的内置 ID，也可使用 64 个均匀采样值表示自定义曲线。采样覆盖归一化时间 `[0, 1]`，首尾值必须为 `0` 和 `1`；runtime 在线性插值采样值。Unity 导出器按此格式序列化 `AnimationCurve`。
- `space: "surface"` 的实例由调用方提供位置和表面法线；坐标单位使用 Three.js 世界单位。

## 运行时 API 草案

```ts
const handle = vfx.play("impact.ring", {
  position,
  normal,
  params: {
    radius: 2.4,
    color: "#67e8ff"
  }
});

// 在渲染循环中更新
vfx.update(deltaTime);

handle.stop();
```

API 仅为讨论草案。模板定义与特效实例应分开：定义描述可复用样式，实例提供位置、法线和参数覆盖。

## MVP 验收范围

- 冲击环模板可从 JSON 加载并在 Three.js 预览页播放。
- 每个模板可通过参数覆盖颜色、尺寸等常用属性。
- 缓动曲线按轨道独立配置；同一模板的不同图层可以有不同延迟和时长。
- 特效生命周期可由运行时控制，且停止后能释放或复用相关资源。
- Unity 导出数据由格式校验；无法识别的 `schemaVersion` 或字段应明确报错。

当前实现覆盖 JSON 校验、内置与采样缓动求值、六种 Three.js 效果图层、重播和资源释放。预览页从 `catalog.json` 读取模板列表，选中的模板单独播放；Unity 导出器按效果 ID 分别写入 JSON，并更新目录文件。

## 参数面板、时间轴与缓动曲线

预览页根据所选模板的 `params` 定义生成控件，目前支持 `number` 和 `color`。数值控件使用定义中的默认值、最小值和最大值；修改任一参数会立即以最新参数重播当前效果。切换模板会重新生成控件并加载该模板的默认值。遇到尚不支持的参数类型时，加载错误会明确指出参数名称与类型。

播放控件支持暂停与继续；时间轴允许按秒定位到特效的绝对播放时间，拖动时暂停自动播放，跳到末尾后可以重新定位或从头播放。运行时对定位时间进行有限值校验并限制在效果时长范围内，已完成的实例可在向前定位时重新创建。

缓动曲线面板按图层、轨道和关键帧过渡展示实际使用的内置或采样缓动曲线；播放与时间轴定位时，曲线上的进度标记同步更新。曲线面板当前为只读，不修改模板数据。

下一阶段计划扩充技能特效模板库。

### Unity 编辑与导出

使用 Unity 2022.3.62f2 打开工程后：

- `Assets/VFXTweens/ImpactRing.asset` 保留为旧版单环资产；可用它继续编辑和导出单图层环。
- `Assets/VFXTweens/LayeredImpact.asset` 是组合示例。在 Inspector 的 `Layers` 列表中可添加/删除图层、选择 `Ring`、`Wave` 或 `Slash Arc`，并分别编辑延迟、时长、曲线和几何参数；`Slash Arc` 可启用 `Animate Sweep Angle` 配置逐步显现。
- Unity 编辑器当前尚不支持 `slashRibbon` 图层；上挑弯月斩击样例直接由 `PlayRuntime` 中的 JSON 定义。
- `Assets/VFXTweens/ChargedGroundBurst.asset` 展示蓄力光环收缩后，冲击环、弧形斩击与地面波纹依次释放。
- 可运行 `Tools > VFXTweens > Create and Export Wave Pulse Example` 与 `Tools > VFXTweens > Create and Export Slash Arc Example`，创建独立波纹和弧形斩击模板。
- 可运行 `Tools > VFXTweens > Create and Export Charged Ground Burst Example`，创建并导出蓄力地面冲击模板。
- 在资产 Inspector 点击 `Export to Three.js preview`，或选择菜单 `Tools > VFXTweens > Export Selected Effect Definition`，将所选资产导出为独立 JSON 并加入模板目录。
- 如果示例资产不存在，运行 `Tools > VFXTweens > Create and Export Layered Impact Example` 创建并导出组合示例；旧版环形示例仍可通过 `Tools > VFXTweens > Create and Export Impact Ring Example` 创建。

导出会写入 `PlayRuntime/public/effects/<effect-id>.vfx.json`（ID 中的点号转为连字符），并更新 `PlayRuntime/public/effects/catalog.json`。Vite 开发服务器监视目录和定义文件，导出后自动刷新预览；当前选中的模板会通过 URL 参数保留。选择模板后只播放该模板，不会自动同时播放目录中的其他模板。

## 暂不纳入 V0

- 完整粒子系统、纹理特效和复杂拖尾。
- Unity 原生运行时特效或将 Unity Prefab 转换为 Three.js 场景。
- 通用 tween 框架、任意 JavaScript 回调序列化。
- 独立的 Unity 与 Three.js 两套效果定义。

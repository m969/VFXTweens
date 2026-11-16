using System;
using System.Collections.Generic;
using UnityEngine;

namespace VFXTweens
{
    public enum VfxLayerType
    {
        Ring,
        Wave,
        SlashArc,
        Shards,
        Projectile
    }

    public enum VfxProjectileShape
    {
        Orb,
        Dart,
        Bomb
    }

    /// <summary>预览目录中的特效分类，用于侧栏分组和导出元数据。</summary>
    public enum VfxEffectCategory
    {
        Impact,
        Wave,
        Slash,
        Shatter,
        CharacterHit,
        Projectile
    }

    public enum VfxBlendMode
    {
        Normal,
        Additive
    }

    [Serializable]
    public sealed class VfxEffectLayerAuthoring
    {
        [Tooltip("Unique layer identifier within this effect.")]
        public string id = "main-ring";
        public VfxLayerType type;
        [Min(0f)] public float startAt;
        [Min(0.01f)] public float duration = 0.4f;
        [Min(0.01f)] public float thickness = 0.08f;
        [Range(0f, 1f)] public float softness = 0.7f;
        [Range(0f, 360f)] public float startAngle;
        [Range(0.01f, 360f)] public float sweepAngle = 120f;
        [Tooltip("弧线两个端头的收尖比例；0 表示不收尖，最大 0.5。")]
        [Range(0f, 0.5f)] public float tipRatio;
        [Tooltip("启用后按曲线从起始角开始逐步显现弧线。")]
        public bool animateSweepAngle;
        [Tooltip("曲线输入和输出为 0..1，控制扫过几何弧线的比例。")]
        public AnimationCurve sweepAngleCurve = CreateOutCubicCurve();
        [Tooltip("碎片图层导出到 JSON 的实例数量。")]
        [Range(1, 128)] public int shardCount = 24;
        [Tooltip("单个碎片的基础尺寸，单位为 Three.js 世界单位。")]
        [Min(0.01f)] public float shardSize = 0.2f;
        [Tooltip("碎片向外散射距离的随机变化比例。")]
        [Range(0f, 1f)] public float shardSpread = 0.6f;
        [Tooltip("碎片沿表面法线方向的初始抛射速度。")]
        [Min(0f)] public float shardLift = 2.5f;
        [Tooltip("碎片沿表面法线方向的重力加速度。")]
        [Min(0f)] public float shardGravity = 5f;
        [Tooltip("飞弹弹体的外形。")]
        public VfxProjectileShape projectileShape;
        [Tooltip("相对局部 X 轴绕表面法线旋转的飞行方向角，单位为度。")]
        [Range(-180f, 180f)] public float projectileDirectionAngle;
        [Tooltip("飞弹弹体尺寸，单位为 Three.js 世界单位。")]
        [Min(0.01f)] public float projectileSize = 0.2f;
        [Tooltip("飞弹沿表面切线方向的飞行距离。")]
        [Min(0.01f)] public float projectileTravel = 4f;
        [Tooltip("飞行轨迹相对表面的最大弧高。")]
        [Min(0f)] public float projectileArcHeight = 0.5f;
        [Tooltip("弹体后方尾迹的长度。")]
        [Min(0.01f)] public float projectileTrailLength = 1f;
        [Min(0f)] public float startRadius = 0.08f;
        [Range(0f, 1f)] public float startOpacity = 0.9f;
        [Range(0f, 1f)] public float endOpacity;
        public AnimationCurve radiusCurve = CreateOutCubicCurve();
        public AnimationCurve opacityCurve = CreateInQuadCurve();

        private static AnimationCurve CreateOutCubicCurve()
        {
            var curve = new AnimationCurve(
                new Keyframe(0f, 0f, 3f, 3f),
                new Keyframe(1f, 1f, 0f, 0f));
            curve.preWrapMode = WrapMode.ClampForever;
            curve.postWrapMode = WrapMode.ClampForever;
            return curve;
        }

        private static AnimationCurve CreateInQuadCurve()
        {
            var curve = new AnimationCurve(
                new Keyframe(0f, 0f, 0f, 0f),
                new Keyframe(1f, 1f, 2f, 2f));
            curve.preWrapMode = WrapMode.ClampForever;
            curve.postWrapMode = WrapMode.ClampForever;
            return curve;
        }
    }

    [CreateAssetMenu(
        fileName = "VfxEffectDefinition",
        menuName = "VFXTweens/Effect Definition")]
    public sealed class VfxEffectDefinition : ScriptableObject
    {
        [SerializeField] private string effectId = "impact.layered";
        [SerializeField] private string displayName = "叠层地面冲击";
        [SerializeField, Tooltip("决定特效在预览器侧栏中的分组。")]
        private VfxEffectCategory category = VfxEffectCategory.Impact;
        [SerializeField, Min(0.01f)] private float duration = 0.58f;
        [SerializeField, Min(0f)] private float defaultRadius = 1f;
        [SerializeField, Min(0f)] private float minRadius = 0.2f;
        [SerializeField, Min(0f)] private float maxRadius = 3f;
        [SerializeField] private Color color = new Color32(103, 255, 113, 255);
        [SerializeField] private VfxBlendMode blend = VfxBlendMode.Additive;
        [SerializeField] private List<VfxEffectLayerAuthoring> layers = CreateDefaultLayers();

        public string EffectId => effectId;
        public string DisplayName => displayName;
        public VfxEffectCategory Category => category;
        public float Duration => duration;
        public float DefaultRadius => defaultRadius;
        public float MinRadius => minRadius;
        public float MaxRadius => maxRadius;
        public Color Color => color;
        public VfxBlendMode Blend => blend;
        public IReadOnlyList<VfxEffectLayerAuthoring> Layers => layers;

        private static List<VfxEffectLayerAuthoring> CreateDefaultLayers()
        {
            return new List<VfxEffectLayerAuthoring>
            {
                new VfxEffectLayerAuthoring
                {
                    id = "main-ring",
                    type = VfxLayerType.Ring,
                    duration = 0.42f,
                    thickness = 0.08f,
                    startRadius = 0.08f,
                    startOpacity = 0.9f
                },
                new VfxEffectLayerAuthoring
                {
                    id = "ground-wave",
                    type = VfxLayerType.Wave,
                    startAt = 0.04f,
                    duration = 0.5f,
                    thickness = 0.55f,
                    softness = 0.8f,
                    startRadius = 0.12f,
                    startOpacity = 0.55f
                },
                new VfxEffectLayerAuthoring
                {
                    id = "slash-arc",
                    type = VfxLayerType.SlashArc,
                    startAt = 0.03f,
                    duration = 0.34f,
                    thickness = 0.14f,
                    startAngle = 205f,
                    sweepAngle = 130f,
                    startRadius = 0.35f,
                    startOpacity = 0.9f
                }
            };
        }
    }
}

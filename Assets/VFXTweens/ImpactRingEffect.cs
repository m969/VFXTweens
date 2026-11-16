using UnityEngine;

namespace VFXTweens
{
    [CreateAssetMenu(
        fileName = "ImpactRingEffect",
        menuName = "VFXTweens/Impact Ring Effect")]
    public sealed class ImpactRingEffect : ScriptableObject
    {
        [SerializeField] private string effectId = "impact.ring";
        [SerializeField, Min(0.01f)] private float effectDuration = 0.42f;
        [SerializeField] private string layerId = "main-ring";
        [SerializeField, Min(0f)] private float layerStartAt;
        [SerializeField, Min(0.01f)] private float layerDuration = 0.38f;
        [SerializeField, Min(0.01f)] private float thickness = 0.08f;
        [SerializeField, Min(0f)] private float startRadius = 0.08f;
        [SerializeField, Min(0f)] private float defaultRadius = 2.4f;
        [SerializeField, Min(0f)] private float minRadius = 0.2f;
        [SerializeField, Min(0f)] private float maxRadius = 5f;
        [SerializeField] private Color color = new Color32(103, 232, 255, 255);
        [SerializeField, Range(0f, 1f)] private float startOpacity = 0.9f;
        [SerializeField, Range(0f, 1f)] private float endOpacity;
        [SerializeField] private AnimationCurve radiusCurve = CreateOutCubicCurve();
        [SerializeField] private AnimationCurve opacityCurve = CreateInQuadCurve();

        public string EffectId => effectId;
        public float EffectDuration => effectDuration;
        public string LayerId => layerId;
        public float LayerStartAt => layerStartAt;
        public float LayerDuration => layerDuration;
        public float Thickness => thickness;
        public float StartRadius => startRadius;
        public float DefaultRadius => defaultRadius;
        public float MinRadius => minRadius;
        public float MaxRadius => maxRadius;
        public Color Color => color;
        public float StartOpacity => startOpacity;
        public float EndOpacity => endOpacity;
        public AnimationCurve RadiusCurve => radiusCurve;
        public AnimationCurve OpacityCurve => opacityCurve;

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
}

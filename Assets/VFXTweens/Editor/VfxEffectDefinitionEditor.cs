using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEngine;

namespace VFXTweens
{
    [Serializable]
    public sealed class VfxEffectCatalogFile
    {
        public int schemaVersion = 1;
        public List<VfxEffectCatalogEntry> effects = new List<VfxEffectCatalogEntry>();
    }

    [Serializable]
    public sealed class VfxEffectCatalogEntry
    {
        public string id;
        public string name;
        public string category;
        public string file;
    }

    internal static class VfxEffectCatalogWriter
    {
        public static string GetDefinitionFileName(string effectId)
        {
            return effectId.Replace('.', '-') + ".vfx.json";
        }

        public static void Upsert(
            string outputDirectory,
            string effectId,
            string displayName,
            string category,
            string fileName)
        {
            if (string.IsNullOrWhiteSpace(effectId) ||
                string.IsNullOrWhiteSpace(displayName) ||
                string.IsNullOrWhiteSpace(category) ||
                fileName != GetDefinitionFileName(effectId))
            {
                throw new InvalidOperationException(
                    "Catalog entries require a valid effect ID, display name, and matching filename.");
            }

            var catalogPath = Path.Combine(outputDirectory, "catalog.json");
            VfxEffectCatalogFile catalog;
            if (File.Exists(catalogPath))
            {
                try
                {
                    catalog = JsonUtility.FromJson<VfxEffectCatalogFile>(
                        File.ReadAllText(catalogPath));
                }
                catch (ArgumentException exception)
                {
                    throw new InvalidOperationException(
                        "The effects catalog contains invalid JSON.",
                        exception);
                }

                if (catalog == null || catalog.schemaVersion != 1 || catalog.effects == null)
                {
                    throw new InvalidOperationException(
                        "The effects catalog must use schema version 1 and contain an effects list.");
                }
            }
            else
            {
                catalog = new VfxEffectCatalogFile();
            }

            var ids = new HashSet<string>(StringComparer.Ordinal);
            var files = new HashSet<string>(StringComparer.Ordinal);
            var found = false;
            foreach (var entry in catalog.effects)
            {
                if (entry == null ||
                    string.IsNullOrWhiteSpace(entry.id) ||
                    string.IsNullOrWhiteSpace(entry.name) ||
                    string.IsNullOrWhiteSpace(entry.category) ||
                    string.IsNullOrWhiteSpace(entry.file))
                {
                    throw new InvalidOperationException(
                        "Every effects catalog entry must define an id, name, category, and file.");
                }
                if (!ids.Add(entry.id) || !files.Add(entry.file))
                {
                    throw new InvalidOperationException(
                        "The effects catalog contains duplicate IDs or files.");
                }
                if (entry.file != GetDefinitionFileName(entry.id))
                {
                    throw new InvalidOperationException(
                        "Catalog filenames must be derived from their effect IDs.");
                }

                if (entry.id == effectId)
                {
                    if (entry.file != fileName)
                    {
                        throw new InvalidOperationException(
                            "An effect ID is already registered with a different file.");
                    }
                    entry.name = displayName;
                    entry.category = category;
                    found = true;
                }
                else if (entry.file == fileName)
                {
                    throw new InvalidOperationException(
                        "The effect filename is already registered to a different ID.");
                }
            }

            if (!found)
            {
                catalog.effects.Add(new VfxEffectCatalogEntry
                {
                    id = effectId,
                    name = displayName,
                    category = category,
                    file = fileName
                });
            }

            File.WriteAllText(
                catalogPath,
                JsonUtility.ToJson(catalog, true),
                new UTF8Encoding(false));
        }
    }

    internal static class VfxEffectDefinitionJsonExporter
    {
        private static readonly Regex EffectIdPattern =
            new Regex("^[a-z0-9]+([.-][a-z0-9]+)*$", RegexOptions.CultureInvariant);

        public static string Serialize(VfxEffectDefinition effect)
        {
            if (effect == null)
            {
                throw new InvalidOperationException(
                    "Select a VFX Effect Definition asset to export.");
            }

            Validate(effect);
            var color = "#" + ColorUtility.ToHtmlStringRGB(effect.Color);
            var json = new StringBuilder(8192);

            json.AppendLine("{");
            json.AppendLine("  \"schemaVersion\": 1,");
            json.Append("  \"id\": ");
            ImpactRingEffectJsonExporter.AppendJsonString(json, effect.EffectId);
            json.AppendLine(",");
            json.Append("  \"duration\": ")
                .Append(ImpactRingEffectJsonExporter.Number(effect.Duration))
                .AppendLine(",");
            json.AppendLine("  \"space\": \"surface\",");
            json.AppendLine("  \"params\": {");
            json.AppendLine("    \"radius\": {");
            json.AppendLine("      \"type\": \"number\",");
            json.Append("      \"default\": ")
                .Append(ImpactRingEffectJsonExporter.Number(effect.DefaultRadius))
                .AppendLine(",");
            json.Append("      \"min\": ")
                .Append(ImpactRingEffectJsonExporter.Number(effect.MinRadius))
                .AppendLine(",");
            json.Append("      \"max\": ")
                .Append(ImpactRingEffectJsonExporter.Number(effect.MaxRadius))
                .AppendLine();
            json.AppendLine("    },");
            json.AppendLine("    \"color\": {");
            json.AppendLine("      \"type\": \"color\",");
            json.Append("      \"default\": \"").Append(color).AppendLine("\"");
            json.AppendLine("    }");
            json.AppendLine("  },");
            json.AppendLine("  \"layers\": [");

            for (var index = 0; index < effect.Layers.Count; index++)
            {
                AppendLayer(json, effect.Layers[index], effect.Blend);
                if (index < effect.Layers.Count - 1)
                {
                    json.AppendLine(",");
                }
                else
                {
                    json.AppendLine();
                }
            }

            json.AppendLine("  ]");
            json.AppendLine("}");
            return json.ToString();
        }

        public static string ExportToPreview(VfxEffectDefinition effect)
        {
            var json = Serialize(effect);
            var projectRoot = Directory.GetParent(Application.dataPath);
            if (projectRoot == null)
            {
                throw new DirectoryNotFoundException(
                    "Could not locate the Unity project root.");
            }

            var outputDirectory = Path.Combine(
                projectRoot.FullName,
                "PlayRuntime",
                "public",
                "effects");
            if (!Directory.Exists(outputDirectory))
            {
                throw new DirectoryNotFoundException(
                    "Three.js effects directory does not exist: " + outputDirectory);
            }

            var fileName = VfxEffectCatalogWriter.GetDefinitionFileName(effect.EffectId);
            var outputPath = Path.Combine(outputDirectory, fileName);
            File.WriteAllText(outputPath, json, new UTF8Encoding(false));
            VfxEffectCatalogWriter.Upsert(
                outputDirectory,
                effect.EffectId,
                effect.DisplayName,
                GetCategoryName(effect.Category),
                fileName);
            return outputPath;
        }

        private static void AppendLayer(
            StringBuilder json,
            VfxEffectLayerAuthoring layer,
            VfxBlendMode blend)
        {
            var radiusSamples = ImpactRingEffectJsonExporter.SampleCurve(
                layer.radiusCurve,
                "Radius");
            var opacitySamples = ImpactRingEffectJsonExporter.SampleCurve(
                layer.opacityCurve,
                "Opacity");
            var sweepAngleSamples = layer.animateSweepAngle
                ? ImpactRingEffectJsonExporter.SampleCurve(
                    layer.sweepAngleCurve,
                    "Sweep angle")
                : null;
            var type = GetLayerTypeName(layer.type);

            json.AppendLine("    {");
            json.Append("      \"id\": ");
            ImpactRingEffectJsonExporter.AppendJsonString(json, layer.id);
            json.AppendLine(",");
            json.Append("      \"type\": \"").Append(type).AppendLine("\",");
            json.Append("      \"startAt\": ")
                .Append(ImpactRingEffectJsonExporter.Number(layer.startAt))
                .AppendLine(",");
            json.Append("      \"duration\": ")
                .Append(ImpactRingEffectJsonExporter.Number(layer.duration))
                .AppendLine(",");
            json.AppendLine("      \"geometry\": {");

            if (layer.type == VfxLayerType.Shards)
            {
                json.Append("        \"count\": ")
                    .Append(layer.shardCount.ToString(CultureInfo.InvariantCulture))
                    .AppendLine(",");
                json.Append("        \"size\": ")
                    .Append(ImpactRingEffectJsonExporter.Number(layer.shardSize))
                    .AppendLine(",");
                json.Append("        \"spread\": ")
                    .Append(ImpactRingEffectJsonExporter.Number(layer.shardSpread))
                    .AppendLine(",");
                json.Append("        \"lift\": ")
                    .Append(ImpactRingEffectJsonExporter.Number(layer.shardLift))
                    .AppendLine(",");
                json.Append("        \"gravity\": ")
                    .Append(ImpactRingEffectJsonExporter.Number(layer.shardGravity))
                    .AppendLine();
            }
            else if (layer.type == VfxLayerType.Projectile)
            {
                json.Append("        \"shape\": \"")
                    .Append(GetProjectileShapeName(layer.projectileShape))
                    .AppendLine("\",");
                json.Append("        \"directionAngle\": ")
                    .Append(ImpactRingEffectJsonExporter.Number(
                        layer.projectileDirectionAngle))
                    .AppendLine(",");
                json.Append("        \"size\": ")
                    .Append(ImpactRingEffectJsonExporter.Number(layer.projectileSize))
                    .AppendLine(",");
                json.Append("        \"travel\": ")
                    .Append(ImpactRingEffectJsonExporter.Number(layer.projectileTravel))
                    .AppendLine(",");
                json.Append("        \"arcHeight\": ")
                    .Append(ImpactRingEffectJsonExporter.Number(layer.projectileArcHeight))
                    .AppendLine(",");
                json.Append("        \"trailLength\": ")
                    .Append(ImpactRingEffectJsonExporter.Number(layer.projectileTrailLength))
                    .AppendLine();
            }
            else
            {
                json.Append("        \"thickness\": ")
                    .Append(ImpactRingEffectJsonExporter.Number(layer.thickness));

                if (layer.type == VfxLayerType.Wave)
                {
                    json.AppendLine(",");
                    json.Append("        \"softness\": ")
                        .Append(ImpactRingEffectJsonExporter.Number(layer.softness))
                        .AppendLine();
                }
                else if (layer.type == VfxLayerType.SlashArc)
                {
                    json.AppendLine(",");
                    json.Append("        \"startAngle\": ")
                        .Append(ImpactRingEffectJsonExporter.Number(layer.startAngle))
                        .AppendLine(",");
                    json.Append("        \"sweepAngle\": ")
                        .Append(ImpactRingEffectJsonExporter.Number(layer.sweepAngle))
                        .AppendLine(",");
                    json.Append("        \"tipRatio\": ")
                        .Append(ImpactRingEffectJsonExporter.Number(layer.tipRatio))
                        .AppendLine();
                }
                else
                {
                    json.AppendLine();
                }
            }

            json.AppendLine("      },");
            json.AppendLine("      \"material\": {");
            json.AppendLine("        \"color\": { \"param\": \"color\" },");
            json.Append("        \"blend\": \"")
                .Append(blend == VfxBlendMode.Additive ? "additive" : "normal")
                .AppendLine("\"");
            json.AppendLine("      },");
            json.AppendLine("      \"tracks\": [");
            ImpactRingEffectJsonExporter.AppendRadiusTrack(
                json,
                layer.startRadius,
                radiusSamples);
            json.AppendLine(",");
            if (sweepAngleSamples != null)
            {
                ImpactRingEffectJsonExporter.AppendSweepAngleTrack(
                    json,
                    layer.sweepAngle,
                    sweepAngleSamples);
                json.AppendLine(",");
            }
            ImpactRingEffectJsonExporter.AppendOpacityTrack(
                json,
                layer.startOpacity,
                layer.endOpacity,
                opacitySamples);
            json.AppendLine();
            json.AppendLine("      ]");
            json.Append("    }");
        }

        private static void Validate(VfxEffectDefinition effect)
        {
            if (string.IsNullOrWhiteSpace(effect.EffectId) ||
                !EffectIdPattern.IsMatch(effect.EffectId))
            {
                throw new InvalidOperationException(
                    "Effect ID must use lowercase letters, numbers, dots, or hyphens.");
            }
            if (string.IsNullOrWhiteSpace(effect.DisplayName))
            {
                throw new InvalidOperationException("Effect display name cannot be empty.");
            }

            RequirePositive("Effect duration", effect.Duration);
            RequireFinite("Default radius", effect.DefaultRadius);
            RequireFinite("Minimum radius", effect.MinRadius);
            RequireFinite("Maximum radius", effect.MaxRadius);
            if (effect.MinRadius < 0f || effect.MinRadius > effect.MaxRadius)
            {
                throw new InvalidOperationException(
                    "Radius bounds must be non-negative and minimum cannot exceed maximum.");
            }
            if (effect.DefaultRadius < effect.MinRadius ||
                effect.DefaultRadius > effect.MaxRadius)
            {
                throw new InvalidOperationException(
                    "Default radius must be within the configured radius range.");
            }

            RequireFinite("Color red", effect.Color.r);
            RequireFinite("Color green", effect.Color.g);
            RequireFinite("Color blue", effect.Color.b);
            RequireFinite("Color alpha", effect.Color.a);
            if (!Enum.IsDefined(typeof(VfxBlendMode), effect.Blend))
            {
                throw new InvalidOperationException("The selected blend mode is not supported.");
            }
            if (effect.Layers == null || effect.Layers.Count == 0)
            {
                throw new InvalidOperationException(
                    "An effect must contain at least one layer.");
            }

            var layerIds = new HashSet<string>(StringComparer.Ordinal);
            foreach (var layer in effect.Layers)
            {
                ValidateLayer(layer, effect.Duration, layerIds);
            }
        }

        private static void ValidateLayer(
            VfxEffectLayerAuthoring layer,
            float effectDuration,
            HashSet<string> layerIds)
        {
            if (layer == null)
            {
                throw new InvalidOperationException("Effect layers cannot be empty.");
            }
            if (string.IsNullOrWhiteSpace(layer.id))
            {
                throw new InvalidOperationException("Layer ID cannot be empty.");
            }
            if (!layerIds.Add(layer.id))
            {
                throw new InvalidOperationException(
                    "Layer IDs must be unique. Duplicate ID: " + layer.id);
            }
            if (!Enum.IsDefined(typeof(VfxLayerType), layer.type))
            {
                throw new InvalidOperationException("The selected layer type is not supported.");
            }

            RequireFinite("Layer start time", layer.startAt);
            RequirePositive("Layer duration", layer.duration);
            if (layer.type != VfxLayerType.Shards &&
                layer.type != VfxLayerType.Projectile)
            {
                RequirePositive("Layer thickness", layer.thickness);
            }
            RequireFinite("Start radius", layer.startRadius);
            RequireFinite("Start opacity", layer.startOpacity);
            RequireFinite("End opacity", layer.endOpacity);
            if (layer.startAt < 0f ||
                layer.startAt + layer.duration > effectDuration)
            {
                throw new InvalidOperationException(
                    "Layer \"" + layer.id +
                    "\" must start at or after zero and finish within the effect duration.");
            }
            if (layer.startRadius < 0f)
            {
                throw new InvalidOperationException(
                    "Layer \"" + layer.id + "\" start radius cannot be negative.");
            }
            if (layer.startOpacity < 0f || layer.startOpacity > 1f ||
                layer.endOpacity < 0f || layer.endOpacity > 1f)
            {
                throw new InvalidOperationException(
                    "Layer \"" + layer.id + "\" opacity must be between zero and one.");
            }

            if (layer.type == VfxLayerType.Wave)
            {
                RequireFinite("Wave softness", layer.softness);
                if (layer.softness < 0f || layer.softness > 1f)
                {
                    throw new InvalidOperationException(
                        "Wave softness must be between zero and one.");
                }
            }
            else if (layer.type == VfxLayerType.SlashArc)
            {
                RequireFinite("Slash arc start angle", layer.startAngle);
                RequireFinite("Slash arc sweep angle", layer.sweepAngle);
                RequireFinite("Slash arc tip ratio", layer.tipRatio);
                if (layer.startAngle < 0f || layer.startAngle > 360f ||
                    layer.sweepAngle <= 0f || layer.sweepAngle > 360f ||
                    layer.tipRatio < 0f || layer.tipRatio > 0.5f)
                {
                    throw new InvalidOperationException(
                        "Slash arc start angle must be 0..360, sweep angle must be (0..360], and tip ratio must be 0..0.5.");
                }
            }
            else if (layer.type == VfxLayerType.Shards)
            {
                if (layer.shardCount < 1 || layer.shardCount > 128)
                {
                    throw new InvalidOperationException(
                        "Shard count must be between one and 128.");
                }
                RequirePositive("Shard size", layer.shardSize);
                RequireFinite("Shard spread", layer.shardSpread);
                RequireFinite("Shard lift", layer.shardLift);
                RequireFinite("Shard gravity", layer.shardGravity);
                if (layer.shardSpread < 0f || layer.shardSpread > 1f ||
                    layer.shardLift < 0f || layer.shardGravity < 0f)
                {
                    throw new InvalidOperationException(
                        "Shard spread must be 0..1 and lift and gravity cannot be negative.");
                }
            }
            else if (layer.type == VfxLayerType.Projectile)
            {
                if (!Enum.IsDefined(typeof(VfxProjectileShape), layer.projectileShape))
                {
                    throw new InvalidOperationException(
                        "The selected projectile shape is not supported.");
                }
                RequireFinite(
                    "Projectile direction angle",
                    layer.projectileDirectionAngle);
                RequirePositive("Projectile size", layer.projectileSize);
                RequirePositive("Projectile travel", layer.projectileTravel);
                RequireFinite("Projectile arc height", layer.projectileArcHeight);
                RequirePositive("Projectile trail length", layer.projectileTrailLength);
                if (layer.projectileDirectionAngle < -180f ||
                    layer.projectileDirectionAngle > 180f ||
                    layer.projectileArcHeight < 0f)
                {
                    throw new InvalidOperationException(
                        "Projectile direction angle must be -180..180 and arc height cannot be negative.");
                }
            }

            if (layer.animateSweepAngle)
            {
                if (layer.type != VfxLayerType.SlashArc)
                {
                    throw new InvalidOperationException(
                        "Only slash arc layers can animate the sweep angle.");
                }

                var sweepAngleSamples =
                    ImpactRingEffectJsonExporter.SampleCurve(
                        layer.sweepAngleCurve,
                        "Sweep angle");
                for (var index = 0; index < sweepAngleSamples.Length; index++)
                {
                    if (sweepAngleSamples[index] < 0f ||
                        sweepAngleSamples[index] > 1f)
                    {
                        throw new InvalidOperationException(
                            "Sweep angle curve samples must stay between zero and one.");
                    }
                }
            }

            ImpactRingEffectJsonExporter.SampleCurve(layer.radiusCurve, "Radius");
            ImpactRingEffectJsonExporter.SampleCurve(layer.opacityCurve, "Opacity");
        }

        private static string GetLayerTypeName(VfxLayerType type)
        {
            switch (type)
            {
                case VfxLayerType.Ring:
                    return "ring";
                case VfxLayerType.Wave:
                    return "wave";
                case VfxLayerType.SlashArc:
                    return "slashArc";
                case VfxLayerType.Shards:
                    return "shards";
                case VfxLayerType.Projectile:
                    return "projectile";
                default:
                    throw new InvalidOperationException(
                        "The selected layer type is not supported.");
            }
        }

        private static string GetProjectileShapeName(VfxProjectileShape shape)
        {
            switch (shape)
            {
                case VfxProjectileShape.Orb:
                    return "orb";
                case VfxProjectileShape.Dart:
                    return "dart";
                case VfxProjectileShape.Bomb:
                    return "bomb";
                default:
                    throw new InvalidOperationException(
                        "The selected projectile shape is not supported.");
            }
        }

        private static string GetCategoryName(VfxEffectCategory category)
        {
            switch (category)
            {
                case VfxEffectCategory.Impact:
                    return "冲击";
                case VfxEffectCategory.Wave:
                    return "波纹";
                case VfxEffectCategory.Slash:
                    return "斩击";
                case VfxEffectCategory.Shatter:
                    return "碎裂";
                case VfxEffectCategory.CharacterHit:
                    return "角色受击";
                case VfxEffectCategory.Projectile:
                    return "飞弹与投掷物";
                default:
                    throw new InvalidOperationException(
                        "The selected effect category is not supported.");
            }
        }

        private static void RequirePositive(string label, float value)
        {
            RequireFinite(label, value);
            if (value <= 0f)
            {
                throw new InvalidOperationException(
                    label + " must be greater than zero.");
            }
        }

        private static void RequireFinite(string label, float value)
        {
            if (float.IsNaN(value) || float.IsInfinity(value))
            {
                throw new InvalidOperationException(label + " must be finite.");
            }
        }
    }

    [CustomEditor(typeof(VfxEffectDefinition))]
    internal sealed class VfxEffectDefinitionEditor : Editor
    {
        public override void OnInspectorGUI()
        {
            DrawDefaultInspector();
            EditorGUILayout.Space();
            if (GUILayout.Button("Export to Three.js preview"))
            {
                Export((VfxEffectDefinition)target);
            }
        }

        [MenuItem("Tools/VFXTweens/Export Selected Effect Definition")]
        private static void ExportSelected()
        {
            var effect = Selection.activeObject as VfxEffectDefinition;
            if (effect != null)
            {
                Export(effect);
            }
        }

        [MenuItem("Tools/VFXTweens/Export Selected Effect Definition", true)]
        private static bool ValidateExportSelected()
        {
            return Selection.activeObject is VfxEffectDefinition;
        }

        internal static void Export(VfxEffectDefinition effect)
        {
            try
            {
                var outputPath = VfxEffectDefinitionJsonExporter.ExportToPreview(effect);
                Debug.Log("Exported VFX effect to " + outputPath, effect);
                if (!Application.isBatchMode)
                {
                    EditorUtility.DisplayDialog(
                        "VFXTweens export complete",
                        "Exported to:\n" + outputPath,
                        "OK");
                }
            }
            catch (InvalidOperationException exception)
            {
                ShowExportError(effect, exception);
            }
            catch (IOException exception)
            {
                ShowExportError(effect, exception);
            }
            catch (UnauthorizedAccessException exception)
            {
                ShowExportError(effect, exception);
            }
        }

        private static void ShowExportError(
            VfxEffectDefinition effect,
            Exception exception)
        {
            Debug.LogError("VFXTweens export failed: " + exception.Message, effect);
            if (!Application.isBatchMode)
            {
                EditorUtility.DisplayDialog(
                    "VFXTweens export failed",
                    exception.Message,
                    "OK");
            }
        }
    }

    public static class VfxEffectDefinitionSample
    {
        [MenuItem("Tools/VFXTweens/Create and Export Layered Impact Example")]
        public static void CreateAndExportExample()
        {
            const string assetPath = "Assets/VFXTweens/LayeredImpact.asset";
            var effect = AssetDatabase.LoadAssetAtPath<VfxEffectDefinition>(assetPath);
            if (effect == null)
            {
                effect = ScriptableObject.CreateInstance<VfxEffectDefinition>();
                AssetDatabase.CreateAsset(effect, assetPath);
            }

            AssetDatabase.SaveAssets();
            Selection.activeObject = effect;
            EditorGUIUtility.PingObject(effect);
            VfxEffectDefinitionEditor.Export(effect);
        }

        [MenuItem("Tools/VFXTweens/Create and Export Wave Pulse Example")]
        public static void CreateAndExportWavePulseExample()
        {
            var effect = CreateSingleLayerExample(
                "Assets/VFXTweens/WavePulse.asset",
                "skill.wave-pulse",
                "波纹脉冲",
                0.62f,
                VfxLayerType.Wave,
                VfxEffectCategory.Wave,
                "expanding-wave",
                0f,
                0.62f,
                0.36f,
                0.9f,
                0f,
                120f,
                0.1f,
                0.72f,
                new Color32(73, 204, 255, 255));
            SelectAndExport(effect);
        }

        [MenuItem("Tools/VFXTweens/Create and Export Slash Arc Example")]
        public static void CreateAndExportSlashArcExample()
        {
            var effect = CreateSingleLayerExample(
                "Assets/VFXTweens/SlashArc.asset",
                "skill.slash-arc",
                "弧形斩击",
                0.48f,
                VfxLayerType.SlashArc,
                VfxEffectCategory.Slash,
                "slash-arc",
                0.02f,
                0.42f,
                0.13f,
                0.7f,
                220f,
                135f,
                0.25f,
                0.95f,
                new Color32(255, 169, 79, 255));
            SelectAndExport(effect);
        }

        [MenuItem("Tools/VFXTweens/Create and Export Charged Ground Burst Example")]
        public static void CreateAndExportChargedGroundBurstExample()
        {
            const string assetPath = "Assets/VFXTweens/ChargedGroundBurst.asset";
            var effect = AssetDatabase.LoadAssetAtPath<VfxEffectDefinition>(assetPath);
            if (effect == null)
            {
                effect = ScriptableObject.CreateInstance<VfxEffectDefinition>();
                var serializedEffect = new SerializedObject(effect);
                SetString(serializedEffect, "effectId", "skill.charged-impact");
                SetString(serializedEffect, "displayName", "蓄力地面爆发");
                SetFloat(serializedEffect, "duration", 1.1f);
                SetFloat(serializedEffect, "defaultRadius", 3.2f);
                SetFloat(serializedEffect, "minRadius", 0.8f);
                SetFloat(serializedEffect, "maxRadius", 4.2f);
                FindRequiredProperty(serializedEffect, "color").colorValue =
                    new Color32(255, 203, 107, 255);
                FindRequiredProperty(serializedEffect, "blend").enumValueIndex =
                    (int)VfxBlendMode.Additive;

                var layers = FindRequiredProperty(serializedEffect, "layers");
                layers.arraySize = 4;
                ConfigureLayer(
                    layers.GetArrayElementAtIndex(0),
                    "charge-halo",
                    VfxLayerType.Ring,
                    0f,
                    0.38f,
                    0.07f,
                    0.7f,
                    0f,
                    120f,
                    4.5f,
                    0.2f,
                    0.72f,
                    CreateInQuadCurve(),
                    CreateOutCubicCurve());
                ConfigureLayer(
                    layers.GetArrayElementAtIndex(1),
                    "release-ring",
                    VfxLayerType.Ring,
                    0.34f,
                    0.52f,
                    0.12f,
                    0.7f,
                    0f,
                    120f,
                    0.12f,
                    0.95f,
                    0f,
                    CreateOutCubicCurve(),
                    CreateInQuadCurve());
                ConfigureLayer(
                    layers.GetArrayElementAtIndex(2),
                    "release-arc",
                    VfxLayerType.SlashArc,
                    0.38f,
                    0.46f,
                    0.17f,
                    0.7f,
                    205f,
                    245f,
                    0.35f,
                    0.85f,
                    0f,
                    CreateOutCubicCurve(),
                    CreateInQuadCurve());
                ConfigureLayer(
                    layers.GetArrayElementAtIndex(3),
                    "ground-wave",
                    VfxLayerType.Wave,
                    0.44f,
                    0.66f,
                    0.48f,
                    0.92f,
                    0f,
                    120f,
                    0.08f,
                    0.72f,
                    0f,
                    CreateOutCubicCurve(),
                    CreateInQuadCurve());
                serializedEffect.ApplyModifiedPropertiesWithoutUndo();

                AssetDatabase.CreateAsset(effect, assetPath);
                EditorUtility.SetDirty(effect);
                AssetDatabase.SaveAssets();
            }

            SelectAndExport(effect);
        }

        private static void ConfigureLayer(
            SerializedProperty layer,
            string id,
            VfxLayerType type,
            float startAt,
            float duration,
            float thickness,
            float softness,
            float startAngle,
            float sweepAngle,
            float startRadius,
            float startOpacity,
            float endOpacity,
            AnimationCurve radiusCurve,
            AnimationCurve opacityCurve)
        {
            SetString(layer, "id", id);
            FindRequiredProperty(layer, "type").enumValueIndex = (int)type;
            SetFloat(layer, "startAt", startAt);
            SetFloat(layer, "duration", duration);
            SetFloat(layer, "thickness", thickness);
            SetFloat(layer, "softness", softness);
            SetFloat(layer, "startAngle", startAngle);
            SetFloat(layer, "sweepAngle", sweepAngle);
            SetFloat(layer, "startRadius", startRadius);
            SetFloat(layer, "startOpacity", startOpacity);
            SetFloat(layer, "endOpacity", endOpacity);
            FindRequiredProperty(layer, "radiusCurve").animationCurveValue = radiusCurve;
            FindRequiredProperty(layer, "opacityCurve").animationCurveValue = opacityCurve;
        }

        private static AnimationCurve CreateOutCubicCurve()
        {
            return new AnimationCurve(
                new Keyframe(0f, 0f, 3f, 3f),
                new Keyframe(1f, 1f, 0f, 0f));
        }

        private static AnimationCurve CreateInQuadCurve()
        {
            return new AnimationCurve(
                new Keyframe(0f, 0f, 0f, 0f),
                new Keyframe(1f, 1f, 2f, 2f));
        }

        private static VfxEffectDefinition CreateSingleLayerExample(
            string assetPath,
            string effectId,
            string displayName,
            float effectDuration,
            VfxLayerType layerType,
            VfxEffectCategory category,
            string layerId,
            float layerStartAt,
            float layerDuration,
            float thickness,
            float softness,
            float startAngle,
            float sweepAngle,
            float startRadius,
            float startOpacity,
            Color color)
        {
            var effect = AssetDatabase.LoadAssetAtPath<VfxEffectDefinition>(assetPath);
            if (effect != null)
            {
                return effect;
            }

            effect = ScriptableObject.CreateInstance<VfxEffectDefinition>();
            var serializedEffect = new SerializedObject(effect);
            SetString(serializedEffect, "effectId", effectId);
            SetString(serializedEffect, "displayName", displayName);
            FindRequiredProperty(serializedEffect, "category").enumValueIndex =
                (int)category;
            SetFloat(serializedEffect, "duration", effectDuration);
            SetFloat(serializedEffect, "defaultRadius", 2.4f);
            SetFloat(serializedEffect, "minRadius", 0.2f);
            SetFloat(serializedEffect, "maxRadius", 3f);
            FindRequiredProperty(serializedEffect, "color").colorValue = color;
            FindRequiredProperty(serializedEffect, "blend").enumValueIndex =
                (int)VfxBlendMode.Additive;

            var layers = FindRequiredProperty(serializedEffect, "layers");
            layers.arraySize = 1;
            var layer = layers.GetArrayElementAtIndex(0);
            SetString(layer, "id", layerId);
            FindRequiredProperty(layer, "type").enumValueIndex = (int)layerType;
            SetFloat(layer, "startAt", layerStartAt);
            SetFloat(layer, "duration", layerDuration);
            SetFloat(layer, "thickness", thickness);
            SetFloat(layer, "softness", softness);
            SetFloat(layer, "startAngle", startAngle);
            SetFloat(layer, "sweepAngle", sweepAngle);
            SetFloat(layer, "startRadius", startRadius);
            SetFloat(layer, "startOpacity", startOpacity);
            SetFloat(layer, "endOpacity", 0f);
            serializedEffect.ApplyModifiedPropertiesWithoutUndo();

            AssetDatabase.CreateAsset(effect, assetPath);
            EditorUtility.SetDirty(effect);
            AssetDatabase.SaveAssets();
            return effect;
        }

        private static void SelectAndExport(VfxEffectDefinition effect)
        {
            Selection.activeObject = effect;
            EditorGUIUtility.PingObject(effect);
            VfxEffectDefinitionEditor.Export(effect);
        }

        private static void SetString(SerializedObject serializedObject, string name, string value)
        {
            FindRequiredProperty(serializedObject, name).stringValue = value;
        }

        private static void SetString(SerializedProperty serializedProperty, string name, string value)
        {
            FindRequiredProperty(serializedProperty, name).stringValue = value;
        }

        private static void SetFloat(SerializedObject serializedObject, string name, float value)
        {
            FindRequiredProperty(serializedObject, name).floatValue = value;
        }

        private static void SetFloat(SerializedProperty serializedProperty, string name, float value)
        {
            FindRequiredProperty(serializedProperty, name).floatValue = value;
        }

        private static SerializedProperty FindRequiredProperty(
            SerializedObject serializedObject,
            string name)
        {
            var property = serializedObject.FindProperty(name);
            if (property == null)
            {
                throw new InvalidOperationException(
                    "Could not find serialized effect field \"" + name + "\".");
            }
            return property;
        }

        private static SerializedProperty FindRequiredProperty(
            SerializedProperty serializedProperty,
            string name)
        {
            var property = serializedProperty.FindPropertyRelative(name);
            if (property == null)
            {
                throw new InvalidOperationException(
                    "Could not find serialized layer field \"" + name + "\".");
            }
            return property;
        }
    }
}

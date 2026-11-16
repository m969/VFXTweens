using System;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEngine;

namespace VFXTweens
{
    internal static class ImpactRingEffectJsonExporter
    {
        public const int CurveSampleCount = 64;

        private static readonly Regex EffectIdPattern =
            new Regex("^[a-z0-9]+([.-][a-z0-9]+)*$", RegexOptions.CultureInvariant);

        public static string Serialize(ImpactRingEffect effect)
        {
            if (effect == null)
            {
                throw new InvalidOperationException("Select an Impact Ring Effect asset to export.");
            }

            Validate(effect);
            var radiusSamples = SampleCurve(effect.RadiusCurve, "Radius");
            var opacitySamples = SampleCurve(effect.OpacityCurve, "Opacity");
            var color = "#" + ColorUtility.ToHtmlStringRGB(effect.Color);
            var json = new StringBuilder(4096);

            json.AppendLine("{");
            json.AppendLine("  \"schemaVersion\": 1,");
            json.Append("  \"id\": ");
            AppendJsonString(json, effect.EffectId);
            json.AppendLine(",");
            json.Append("  \"duration\": ").Append(Number(effect.EffectDuration)).AppendLine(",");
            json.AppendLine("  \"space\": \"surface\",");
            json.AppendLine("  \"params\": {");
            json.AppendLine("    \"radius\": {");
            json.AppendLine("      \"type\": \"number\",");
            json.Append("      \"default\": ").Append(Number(effect.DefaultRadius)).AppendLine(",");
            json.Append("      \"min\": ").Append(Number(effect.MinRadius)).AppendLine(",");
            json.Append("      \"max\": ").Append(Number(effect.MaxRadius)).AppendLine();
            json.AppendLine("    },");
            json.AppendLine("    \"color\": {");
            json.AppendLine("      \"type\": \"color\",");
            json.Append("      \"default\": \"").Append(color).AppendLine("\"");
            json.AppendLine("    }");
            json.AppendLine("  },");
            json.AppendLine("  \"layers\": [");
            json.AppendLine("    {");
            json.Append("      \"id\": ");
            AppendJsonString(json, effect.LayerId);
            json.AppendLine(",");
            json.AppendLine("      \"type\": \"ring\",");
            json.Append("      \"startAt\": ").Append(Number(effect.LayerStartAt)).AppendLine(",");
            json.Append("      \"duration\": ").Append(Number(effect.LayerDuration)).AppendLine(",");
            json.AppendLine("      \"geometry\": {");
            json.Append("        \"thickness\": ").Append(Number(effect.Thickness)).AppendLine();
            json.AppendLine("      },");
            json.AppendLine("      \"material\": {");
            json.AppendLine("        \"color\": { \"param\": \"color\" },");
            json.AppendLine("        \"blend\": \"additive\"");
            json.AppendLine("      },");
            json.AppendLine("      \"tracks\": [");
            AppendRadiusTrack(json, effect.StartRadius, radiusSamples);
            json.AppendLine(",");
            AppendOpacityTrack(
                json,
                effect.StartOpacity,
                effect.EndOpacity,
                opacitySamples);
            json.AppendLine();
            json.AppendLine("      ]");
            json.AppendLine("    }");
            json.AppendLine("  ]");
            json.AppendLine("}");
            return json.ToString();
        }

        public static string ExportToPreview(ImpactRingEffect effect)
        {
            var json = Serialize(effect);
            var projectRoot = Directory.GetParent(Application.dataPath);
            if (projectRoot == null)
            {
                throw new DirectoryNotFoundException("Could not locate the Unity project root.");
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
                "冲击环",
                "冲击",
                fileName);
            return outputPath;
        }

        private static void Validate(ImpactRingEffect effect)
        {
            if (string.IsNullOrEmpty(effect.EffectId) ||
                !EffectIdPattern.IsMatch(effect.EffectId))
            {
                throw new InvalidOperationException(
                    "Effect ID must use lowercase letters, numbers, dots, or hyphens.");
            }
            if (string.IsNullOrEmpty(effect.LayerId))
            {
                throw new InvalidOperationException("Layer ID cannot be empty.");
            }

            RequirePositive("Effect duration", effect.EffectDuration);
            RequirePositive("Layer duration", effect.LayerDuration);
            RequirePositive("Ring thickness", effect.Thickness);
            RequireFinite("Layer start time", effect.LayerStartAt);
            RequireFinite("Start radius", effect.StartRadius);
            RequireFinite("Default radius", effect.DefaultRadius);
            RequireFinite("Minimum radius", effect.MinRadius);
            RequireFinite("Maximum radius", effect.MaxRadius);
            RequireFinite("Start opacity", effect.StartOpacity);
            RequireFinite("End opacity", effect.EndOpacity);

            if (effect.LayerStartAt < 0f ||
                effect.LayerStartAt + effect.LayerDuration > effect.EffectDuration)
            {
                throw new InvalidOperationException(
                    "The ring layer must start at or after zero and finish within the effect duration.");
            }
            if (effect.StartRadius < 0f)
            {
                throw new InvalidOperationException("Start radius cannot be negative.");
            }
            if (effect.MinRadius > effect.MaxRadius)
            {
                throw new InvalidOperationException(
                    "Minimum radius cannot be greater than maximum radius.");
            }
            if (effect.DefaultRadius < effect.MinRadius ||
                effect.DefaultRadius > effect.MaxRadius)
            {
                throw new InvalidOperationException(
                    "Default radius must be within the configured radius range.");
            }
            if (effect.StartOpacity < 0f || effect.StartOpacity > 1f ||
                effect.EndOpacity < 0f || effect.EndOpacity > 1f)
            {
                throw new InvalidOperationException("Opacity values must be between zero and one.");
            }
        }

        internal static float[] SampleCurve(AnimationCurve curve, string label)
        {
            if (curve == null)
            {
                throw new InvalidOperationException(label + " curve is missing.");
            }

            var samples = new float[CurveSampleCount];
            for (var index = 0; index < samples.Length; index++)
            {
                var time = (float)index / (samples.Length - 1);
                samples[index] = curve.Evaluate(time);
                RequireFinite(label + " curve sample", samples[index]);
            }

            if (Mathf.Abs(samples[0]) > 1e-4f ||
                Mathf.Abs(samples[samples.Length - 1] - 1f) > 1e-4f)
            {
                throw new InvalidOperationException(
                    label + " curve must evaluate to zero at time 0 and one at time 1.");
            }

            return samples;
        }

        private static void RequirePositive(string label, float value)
        {
            RequireFinite(label, value);
            if (value <= 0f)
            {
                throw new InvalidOperationException(label + " must be greater than zero.");
            }
        }

        private static void RequireFinite(string label, float value)
        {
            if (float.IsNaN(value) || float.IsInfinity(value))
            {
                throw new InvalidOperationException(label + " must be finite.");
            }
        }

        internal static string Number(float value)
        {
            return value.ToString("R", CultureInfo.InvariantCulture);
        }

        internal static void AppendJsonString(StringBuilder output, string value)
        {
            output.Append('"');
            foreach (var character in value)
            {
                switch (character)
                {
                    case '"':
                        output.Append("\\\"");
                        break;
                    case '\\':
                        output.Append("\\\\");
                        break;
                    case '\b':
                        output.Append("\\b");
                        break;
                    case '\f':
                        output.Append("\\f");
                        break;
                    case '\n':
                        output.Append("\\n");
                        break;
                    case '\r':
                        output.Append("\\r");
                        break;
                    case '\t':
                        output.Append("\\t");
                        break;
                    default:
                        if (character < ' ')
                        {
                            output.Append("\\u")
                                .Append(((int)character).ToString("x4", CultureInfo.InvariantCulture));
                        }
                        else
                        {
                            output.Append(character);
                        }
                        break;
                }
            }
            output.Append('"');
        }

        internal static void AppendRadiusTrack(
            StringBuilder json,
            float startRadius,
            float[] samples)
        {
            json.AppendLine("        {");
            json.AppendLine("          \"property\": \"radius\",");
            json.AppendLine("          \"keys\": [");
            json.Append("            { \"t\": 0, \"value\": ")
                .Append(Number(startRadius))
                .AppendLine(" },");
            json.AppendLine("            {");
            json.AppendLine("              \"t\": 1,");
            json.AppendLine("              \"value\": { \"param\": \"radius\" },");
            json.AppendLine("              \"ease\": {");
            AppendSamples(json, samples, "                ");
            json.AppendLine();
            json.AppendLine("              }");
            json.AppendLine("            }");
            json.AppendLine("          ]");
            json.Append("        }");
        }

        internal static void AppendSweepAngleTrack(
            StringBuilder json,
            float sweepAngle,
            float[] samples)
        {
            json.AppendLine("        {");
            json.AppendLine("          \"property\": \"sweepAngle\",");
            json.AppendLine("          \"keys\": [");
            json.AppendLine("            { \"t\": 0, \"value\": 0 },");
            json.AppendLine("            {");
            json.AppendLine("              \"t\": 1,");
            json.Append("              \"value\": ")
                .Append(Number(sweepAngle))
                .AppendLine(",");
            json.AppendLine("              \"ease\": {");
            AppendSamples(json, samples, "                ");
            json.AppendLine();
            json.AppendLine("              }");
            json.AppendLine("            }");
            json.AppendLine("          ]");
            json.Append("        }");
        }

        internal static void AppendOpacityTrack(
            StringBuilder json,
            float startOpacity,
            float endOpacity,
            float[] samples)
        {
            json.AppendLine("        {");
            json.AppendLine("          \"property\": \"opacity\",");
            json.AppendLine("          \"keys\": [");
            json.Append("            { \"t\": 0, \"value\": ")
                .Append(Number(startOpacity))
                .AppendLine(" },");
            json.AppendLine("            {");
            json.AppendLine("              \"t\": 1,");
            json.Append("              \"value\": ")
                .Append(Number(endOpacity))
                .AppendLine(",");
            json.AppendLine("              \"ease\": {");
            AppendSamples(json, samples, "                ");
            json.AppendLine();
            json.AppendLine("              }");
            json.AppendLine("            }");
            json.AppendLine("          ]");
            json.Append("        }");
        }

        internal static void AppendSamples(
            StringBuilder json,
            float[] samples,
            string indent)
        {
            json.Append(indent).AppendLine("\"samples\": [");
            for (var index = 0; index < samples.Length; index++)
            {
                if (index % 8 == 0)
                {
                    json.Append(indent).Append("  ");
                }
                json.Append(Number(samples[index]));
                if (index < samples.Length - 1)
                {
                    json.Append(", ");
                }
                if (index % 8 == 7 || index == samples.Length - 1)
                {
                    json.AppendLine();
                }
            }
            json.Append(indent).Append(']');
        }
    }

    [CustomEditor(typeof(ImpactRingEffect))]
    internal sealed class ImpactRingEffectEditor : Editor
    {
        public override void OnInspectorGUI()
        {
            DrawDefaultInspector();
            EditorGUILayout.Space();
            if (GUILayout.Button("Export to Three.js preview"))
            {
                Export((ImpactRingEffect)target);
            }
        }

        [MenuItem("Tools/VFXTweens/Export Selected Impact Ring")]
        private static void ExportSelected()
        {
            var effect = Selection.activeObject as ImpactRingEffect;
            if (effect != null)
            {
                Export(effect);
            }
        }

        [MenuItem("Tools/VFXTweens/Export Selected Impact Ring", true)]
        private static bool ValidateExportSelected()
        {
            return Selection.activeObject is ImpactRingEffect;
        }

        private static void Export(ImpactRingEffect effect)
        {
            try
            {
                var outputPath = ImpactRingEffectJsonExporter.ExportToPreview(effect);
                Debug.Log("Exported VFX effect to " + outputPath, effect);
                EditorUtility.DisplayDialog(
                    "VFXTweens export complete",
                    "Exported to:\n" + outputPath,
                    "OK");
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
            ImpactRingEffect effect,
            Exception exception)
        {
            Debug.LogError("VFXTweens export failed: " + exception.Message, effect);
            EditorUtility.DisplayDialog(
                "VFXTweens export failed",
                exception.Message,
                "OK");
        }
    }

    public static class ImpactRingEffectSample
    {
        [MenuItem("Tools/VFXTweens/Create and Export Impact Ring Example")]
        public static void CreateAndExport()
        {
            const string assetPath = "Assets/VFXTweens/ImpactRing.asset";
            var effect = AssetDatabase.LoadAssetAtPath<ImpactRingEffect>(assetPath);
            if (effect == null)
            {
                effect = ScriptableObject.CreateInstance<ImpactRingEffect>();
                AssetDatabase.CreateAsset(effect, assetPath);
            }

            AssetDatabase.SaveAssets();
            Selection.activeObject = effect;
            EditorGUIUtility.PingObject(effect);

            var outputPath = ImpactRingEffectJsonExporter.ExportToPreview(effect);
            Debug.Log("Exported VFX effect to " + outputPath, effect);
            if (!Application.isBatchMode)
            {
                EditorUtility.DisplayDialog(
                    "VFXTweens export complete",
                    "Created or selected the sample asset and exported to:\n" + outputPath,
                    "OK");
            }
        }
    }
}

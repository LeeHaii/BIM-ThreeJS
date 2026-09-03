import { z } from "zod";
import {
  assetVersionIdSchema,
  buildingIdSchema,
  modelIdSchema,
  modelVersionIdSchema,
  sceneVersionIdSchema,
  unitBindingSetIdSchema,
} from "../domain/ids.js";
import { cameraPoseSchema } from "./contracts.js";
import { bimIndexDescriptorSchema } from "./bim-index.js";

const nonEmpty = z.string().trim().min(1);
const sha256 = z
  .string()
  .regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hex digest");
const matrix4 = z.array(z.number()).length(16);
const vector3 = z.tuple([z.number(), z.number(), z.number()]);

export const viewerModeSchema = z.enum(["overview", "bim", "units"]);
export type ViewerMode = z.infer<typeof viewerModeSchema>;

export const localizedTextSchema = z
  .record(nonEmpty, nonEmpty)
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one locale is required",
  );

export const sceneLayerManifestSchema = z.object({
  id: nonEmpty,
  assetVersionId: assetVersionIdSchema,
  type: z.enum(["fragments", "gltf"]),
  purpose: nonEmpty,
  name: nonEmpty,
  assetUrl: nonEmpty,
  contentHash: sha256,
  byteSize: z.number().int().nonnegative(),
  transform: matrix4,
  defaultVisible: z.boolean(),
  selectable: z.boolean(),
  castShadow: z.boolean(),
  receiveShadow: z.boolean(),
  bounds: z.object({ min: vector3, max: vector3 }).optional(),
  bim: z
    .object({
      modelId: modelIdSchema,
      modelVersionId: modelVersionIdSchema,
      propertyProfileId: nonEmpty.optional(),
    })
    .optional(),
});

export const sceneManifestV2Schema = z.object({
  schemaVersion: z.literal("2.0"),
  buildingId: buildingIdSchema,
  sceneVersionId: sceneVersionIdSchema,
  label: nonEmpty,
  runtimeCompatibility: z.object({
    components: z.literal("3.4.8"),
    componentsFront: z.literal("3.4.4"),
    fragments: z.literal("3.4.7"),
    three: z.literal("0.184.0"),
    webIfc: z.literal("0.0.77"),
    workerUrl: nonEmpty,
    wasmUrl: nonEmpty,
  }),
  settings: z.object({
    background: z.object({ color: z.string().regex(/^#[0-9a-f]{6}$/i) }),
    lighting: z.object({
      ambientColor: z.string().regex(/^#[0-9a-f]{6}$/i),
      ambientIntensity: z.number().nonnegative(),
      directionalColor: z.string().regex(/^#[0-9a-f]{6}$/i),
      directionalIntensity: z.number().nonnegative(),
      directionalPosition: vector3,
    }),
    origin: z.object({ policy: z.enum(["source", "coordinate-to-origin"]) }),
    defaultCamera: cameraPoseSchema,
    namedViews: z.array(
      z.object({ id: nonEmpty, label: nonEmpty, camera: cameraPoseSchema }),
    ),
    navigation: z.object({
      minimumDistance: z.number().positive(),
      maximumDistance: z.number().positive(),
      verticalMinimum: z.number(),
      verticalMaximum: z.number(),
    }),
  }),
  layers: z.array(sceneLayerManifestSchema).min(1),
  bimProfiles: z.array(
    z.object({
      id: nonEmpty,
      ignoredKeys: z.array(nonEmpty),
      aliases: z.record(nonEmpty, nonEmpty),
      groups: z.array(nonEmpty),
    }),
  ),
  unitBindingSetId: unitBindingSetIdSchema.optional(),
  bimIndex: bimIndexDescriptorSchema.optional(),
  viewerUi: z.object({
    layout: z.literal("left-upper-viewport"),
    enabledModes: z.array(viewerModeSchema).min(1),
    defaultMode: viewerModeSchema,
    collapsedLeftWidth: z.number().min(32).max(80),
    upperPanelHeight: z.number().min(30).max(80),
    modePanels: z.array(
      z.object({
        mode: viewerModeSchema,
        width: z.number().min(160).max(720),
        buttonLabel: localizedTextSchema,
        panelKind: z.enum(["bim-properties", "households", "extension"]),
      }),
    ),
    upperToolbar: z.array(
      z.object({
        id: z.enum(["reset", "bim", "households", "touch-navigation"]),
        label: localizedTextSchema,
      }),
    ),
    touchNavigation: z.object({
      enabled: z.boolean(),
      defaultMode: z.enum(["orbit", "vertical"]),
    }),
    labels: z.record(nonEmpty, localizedTextSchema),
  }),
});

export type SceneLayerManifest = z.infer<typeof sceneLayerManifestSchema>;
export type SceneManifestV2 = z.infer<typeof sceneManifestV2Schema>;

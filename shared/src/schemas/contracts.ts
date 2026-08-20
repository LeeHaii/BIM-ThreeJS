import { z } from "zod";
import {
  buildingIdSchema,
  modelIdSchema,
  modelVersionIdSchema,
  unitIdSchema,
} from "../domain/ids.js";

const currentSchemaVersion = z.literal("1.0");
const nonEmptyString = z.string().trim().min(1);
const sha256Schema = z
  .string()
  .regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hex digest");
const vector3Schema = z.tuple([z.number(), z.number(), z.number()]);

export const cameraPoseSchema = z.object({
  position: vector3Schema,
  target: vector3Schema,
  up: vector3Schema.optional(),
  fov: z.number().positive().max(180).optional(),
});

export const elementRefSchema = z
  .object({
    modelVersionId: modelVersionIdSchema,
    modelLocalId: z.number().int().nonnegative().optional(),
    globalId: z.string().trim().min(8).optional(),
  })
  .refine(
    (value) => value.modelLocalId !== undefined || value.globalId !== undefined,
    {
      message: "An element reference requires a model-local ID or IFC GlobalId",
    },
  );

export const buildingSummarySchema = z.object({
  id: buildingIdSchema,
  code: nonEmptyString,
  name: nonEmptyString,
  timezone: nonEmptyString,
  locale: nonEmptyString,
});

export const buildingDetailSchema = buildingSummarySchema.extend({
  features: z.record(z.string(), z.boolean()),
  activeModelVersionId: modelVersionIdSchema.optional(),
});

export const unitSummarySchema = z.object({
  id: unitIdSchema,
  buildingId: buildingIdSchema,
  code: nonEmptyString,
  displayName: nonEmptyString,
  unitType: nonEmptyString,
  storeyCode: nonEmptyString,
  status: z.enum(["active", "inactive"]),
});

export const occupancyViewSchema = z.object({
  relationshipType: nonEmptyString,
  displayName: nonEmptyString.optional(),
  email: z.email().optional(),
  phone: nonEmptyString.optional(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().optional(),
});

const assetReferenceSchema = z.object({
  assetId: nonEmptyString,
  url: nonEmptyString,
  contentHash: sha256Schema,
  byteSize: z.number().int().nonnegative(),
});

const transformSchema = z.array(z.number()).length(16);

export const modelManifestSchema = z.object({
  schemaVersion: currentSchemaVersion,
  buildingId: buildingIdSchema,
  modelId: modelIdSchema,
  modelVersionId: modelVersionIdSchema,
  label: nonEmptyString,
  sourceHash: sha256Schema,
  defaultCamera: cameraPoseSchema,
  namedViews: z.array(
    z.object({
      id: nonEmptyString,
      label: nonEmptyString,
      camera: cameraPoseSchema,
    }),
  ),
  fragmentLayers: z.array(
    z.object({
      id: nonEmptyString,
      name: nonEmptyString,
      purpose: nonEmptyString,
      asset: assetReferenceSchema,
      transform: transformSchema,
      defaultVisible: z.boolean(),
    }),
  ),
  capabilities: z.array(nonEmptyString),
  compatibility: z.object({
    components: nonEmptyString,
    fragments: nonEmptyString,
    webIfc: nonEmptyString,
  }),
});

export const onboardingPackageSchema = z.object({
  schemaVersion: currentSchemaVersion,
  building: z.object({
    id: buildingIdSchema,
    code: nonEmptyString,
    name: nonEmptyString,
    timezone: nonEmptyString,
    locale: nonEmptyString,
  }),
  model: z.object({
    id: modelIdSchema,
    versionId: modelVersionIdSchema,
    versionLabel: nonEmptyString,
    source: z.object({ path: nonEmptyString, sha256: sha256Schema }),
  }),
  propertyProfile: z.object({
    id: nonEmptyString,
    includedIfcClasses: z.array(nonEmptyString).min(1),
    requiredProperties: z.array(nonEmptyString),
  }),
  bindingRules: z.array(
    z.object({
      priority: z.number().int().nonnegative(),
      sourceField: nonEmptyString,
      unitField: nonEmptyString,
    }),
  ),
  validation: z.object({
    minimumBindingCoverage: z.number().min(0).max(1),
    allowAmbiguousBindings: z.literal(false),
  }),
  defaultCamera: cameraPoseSchema,
});

export const pageSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  });

export const apiErrorSchema = z.object({
  code: nonEmptyString,
  message: nonEmptyString,
  correlationId: nonEmptyString,
});

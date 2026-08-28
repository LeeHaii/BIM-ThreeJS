import { z } from "zod";
import {
  buildingIdSchema,
  modelIdSchema,
  modelVersionIdSchema,
  unitBindingSetIdSchema,
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
  permissions: z
    .object({
      manageUnits: z.boolean(),
      manageOccupancies: z.boolean(),
    })
    .optional(),
});

export const createBuildingInputSchema = z.object({
  code: nonEmptyString.max(60),
  name: nonEmptyString.max(200),
  timezone: nonEmptyString.default("UTC"),
  locale: nonEmptyString.default("en"),
});
export type CreateBuildingInput = z.infer<typeof createBuildingInputSchema>;

export const unitSummarySchema = z.object({
  id: unitIdSchema,
  buildingId: buildingIdSchema,
  code: nonEmptyString,
  displayName: nonEmptyString,
  unitType: nonEmptyString,
  storeyCode: nonEmptyString,
  status: z.enum(["active", "inactive"]),
  address: nonEmptyString.nullish().transform((v) => v ?? undefined),
  area: z
    .number()
    .nonnegative()
    .nullish()
    .transform((v) => v ?? undefined),
  owner: nonEmptyString.nullish().transform((v) => v ?? undefined),
  certificateNumber: nonEmptyString
    .nullish()
    .transform((v) => v ?? undefined),
  ownershipTerm: nonEmptyString.nullish().transform((v) => v ?? undefined),
});

export const householdUnitSummarySchema = unitSummarySchema.extend({
  layerId: nonEmptyString.optional(),
  modelLocalIds: z.array(z.number().int().nonnegative()),
  globalIds: z.array(nonEmptyString),
});

export const householdStoreySchema = z.object({
  code: nonEmptyString,
  label: nonEmptyString,
  unitCount: z.number().int().nonnegative(),
  boundUnitCount: z.number().int().nonnegative(),
  units: z.array(householdUnitSummarySchema),
});

export const householdIndexSchema = z.object({
  buildingId: buildingIdSchema,
  modelVersionId: modelVersionIdSchema.optional(),
  bindingSetId: unitBindingSetIdSchema.optional(),
  coverage: z.number().min(0).max(1),
  storeys: z.array(householdStoreySchema),
});

export const createUnitInputSchema = z.object({
  code: nonEmptyString.max(60),
  displayName: nonEmptyString.max(200),
  unitType: nonEmptyString.default("apartment"),
  storeyCode: nonEmptyString.default("L01"),
  status: z.enum(["active", "inactive"]).default("active"),
  address: z.string().optional(),
  area: z.number().nonnegative().optional(),
  owner: z.string().optional(),
  certificateNumber: z.string().optional(),
  ownershipTerm: z.string().optional(),
});
export type CreateUnitInput = z.infer<typeof createUnitInputSchema>;

export const updateUnitInputSchema = z.object({
  code: nonEmptyString.max(60).optional(),
  displayName: nonEmptyString.max(200).optional(),
  unitType: nonEmptyString.optional(),
  storeyCode: nonEmptyString.optional(),
  status: z.enum(["active", "inactive"]).optional(),
  address: z.string().nullable().optional(),
  area: z.number().nonnegative().nullable().optional(),
  owner: z.string().nullable().optional(),
  certificateNumber: z.string().nullable().optional(),
  ownershipTerm: z.string().nullable().optional(),
});
export type UpdateUnitInput = z.infer<typeof updateUnitInputSchema>;

export const occupancyViewSchema = z.object({
  relationshipType: nonEmptyString,
  displayName: nonEmptyString.nullish().transform((v) => v ?? undefined),
  email: z.string().nullish().transform((v) => v ?? undefined),
  phone: nonEmptyString.nullish().transform((v) => v ?? undefined),
  citizenId: nonEmptyString.nullish().transform((v) => v ?? undefined),
  dateOfBirth: z.string().nullish().transform((v) => v ?? undefined),
  gender: nonEmptyString.nullish().transform((v) => v ?? undefined),
  residenceType: nonEmptyString.nullish().transform((v) => v ?? undefined),
  status: nonEmptyString.nullish().transform((v) => v ?? undefined),
  startsAt: z.string(),
  endsAt: z.string().nullish().transform((v) => v ?? undefined),
});

export const adminOccupancySchema = z.object({
  id: nonEmptyString,
  unitId: unitIdSchema,
  personId: nonEmptyString,
  relationshipType: nonEmptyString,
  displayName: nonEmptyString.nullish().transform((v) => v ?? undefined),
  email: z.string().nullish().transform((v) => v ?? undefined),
  phone: z.string().nullish().transform((v) => v ?? undefined),
  citizenId: z.string().nullish().transform((v) => v ?? undefined),
  dateOfBirth: z.string().nullish().transform((v) => v ?? undefined),
  gender: z.string().nullish().transform((v) => v ?? undefined),
  residenceType: z.string().nullish().transform((v) => v ?? undefined),
  status: z.string().default("active"),
  startsAt: z.string(),
  endsAt: z.string().nullish().transform((v) => v ?? undefined),
});
export type AdminOccupancy = z.infer<typeof adminOccupancySchema>;

export const createOccupancyInputSchema = z.object({
  displayName: nonEmptyString,
  email: z.email().optional(),
  phone: z.string().optional(),
  citizenId: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  relationshipType: nonEmptyString.default("owner"),
  residenceType: z.string().default("permanent"),
  status: z.string().default("active"),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});
export type CreateOccupancyInput = z.infer<typeof createOccupancyInputSchema>;

export const updateOccupancyInputSchema = z.object({
  displayName: nonEmptyString.optional(),
  email: z.email().nullable().optional(),
  phone: z.string().nullable().optional(),
  citizenId: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  relationshipType: nonEmptyString.optional(),
  residenceType: z.string().nullable().optional(),
  status: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().nullable().optional(),
});
export type UpdateOccupancyInput = z.infer<typeof updateOccupancyInputSchema>;

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

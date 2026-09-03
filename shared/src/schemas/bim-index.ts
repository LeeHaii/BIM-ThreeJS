import { z } from "zod";
import { modelVersionIdSchema } from "../domain/ids.js";
import { elementRefSchema } from "./contracts.js";

const nonEmpty = z.string().trim().min(1);
const sha256 = z
  .string()
  .regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hex digest");

export const aabbSchema = z.object({
  min: z.tuple([z.number(), z.number(), z.number()]),
  max: z.tuple([z.number(), z.number(), z.number()]),
});

export const bimCatalogElementSchema = z.object({
  layerId: nonEmpty,
  ref: elementRefSchema,
  title: nonEmpty,
  category: nonEmpty,
  box: aabbSchema.optional(),
});

export const bimCatalogSchema = z.object({
  schemaVersion: z.literal("1.0"),
  modelVersionId: modelVersionIdSchema,
  sourceHash: sha256,
  elements: z.array(bimCatalogElementSchema),
});

export const bimElementMetadataSchema = z.object({
  element: bimCatalogElementSchema,
  rawData: z.record(z.string(), z.unknown()),
});

export const bimIndexStatusSchema = z.object({
  status: z.enum(["missing", "building", "ready", "failed"]),
  schemaVersion: nonEmpty.optional(),
  extractorVersion: nonEmpty.optional(),
  sourceHash: sha256.optional(),
  elementCount: z.number().int().nonnegative(),
  generatedAt: z.string().optional(),
  error: z.string().optional(),
});

export const bimIndexDescriptorSchema = z.object({
  schemaVersion: z.literal("1.0"),
  modelVersionId: modelVersionIdSchema,
  sourceHash: sha256,
  elementCount: z.number().int().nonnegative(),
  catalogUrl: nonEmpty,
  elementUrlTemplate: nonEmpty,
});

export type Aabb = z.infer<typeof aabbSchema>;
export type BimCatalogElement = z.infer<typeof bimCatalogElementSchema>;
export type BimCatalog = z.infer<typeof bimCatalogSchema>;
export type BimElementMetadata = z.infer<typeof bimElementMetadataSchema>;
export type BimIndexStatus = z.infer<typeof bimIndexStatusSchema>;
export type BimIndexDescriptor = z.infer<typeof bimIndexDescriptorSchema>;

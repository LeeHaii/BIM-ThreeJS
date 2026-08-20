import { z } from "zod";

declare const brand: unique symbol;
export type Brand<Value, Name extends string> = Value & {
  readonly [brand]: Name;
};

export type OrganizationId = Brand<string, "OrganizationId">;
export type SiteId = Brand<string, "SiteId">;
export type BuildingId = Brand<string, "BuildingId">;
export type ModelId = Brand<string, "ModelId">;
export type ModelVersionId = Brand<string, "ModelVersionId">;
export type UnitId = Brand<string, "UnitId">;
export type PersonId = Brand<string, "PersonId">;

const brandedUuid = <Name extends string>() =>
  z.uuid().transform((value) => value as Brand<string, Name>);

export const organizationIdSchema = brandedUuid<"OrganizationId">();
export const siteIdSchema = brandedUuid<"SiteId">();
export const buildingIdSchema = brandedUuid<"BuildingId">();
export const modelIdSchema = brandedUuid<"ModelId">();
export const modelVersionIdSchema = brandedUuid<"ModelVersionId">();
export const unitIdSchema = brandedUuid<"UnitId">();
export const personIdSchema = brandedUuid<"PersonId">();

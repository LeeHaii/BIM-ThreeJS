import { onboardingPackageSchema } from "@bim/shared";
import type { z } from "zod";

export type OnboardingPackage = z.infer<typeof onboardingPackageSchema>;

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type OnboardingValidationResult =
  | {
      readonly ready: true;
      readonly value: OnboardingPackage;
      readonly warnings: readonly string[];
    }
  | { readonly ready: false; readonly errors: readonly ValidationIssue[] };

export function validateOnboardingPackage(
  input: unknown,
): OnboardingValidationResult {
  const result = onboardingPackageSchema.safeParse(input);
  if (!result.success) {
    return {
      ready: false,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.length === 0 ? "$" : `$.${issue.path.join(".")}`,
        message: issue.message,
      })),
    };
  }

  const warnings: string[] = [];
  if (result.data.bindingRules.length === 0) {
    warnings.push("No automatic unit binding rules are configured.");
  }

  return { ready: true, value: result.data, warnings };
}

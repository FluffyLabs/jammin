import * as p from "@clack/prompts";
import { type core, ZodError } from "zod";
import { ConfigError } from "../types/errors";

/** Centralized error handling with @clack/prompts formatting */

/** Helper to format field paths in a human-readable way */
function formatFieldPath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return "config";
  }

  return path
    .map((segment, index) => {
      if (typeof segment === "number") {
        return `[${segment}]`;
      }
      if (typeof segment === "symbol") {
        return `[${String(segment)}]`;
      }
      if (index === 0) {
        return segment;
      }
      return `.${segment}`;
    })
    .join("");
}

/** Helper to get meaningful hints for common validation errors */
function getErrorHint(issue: core.$ZodIssue): string | null {
  const path = issue.path.join(".");

  if (path.includes("name") && issue.message.includes("letters")) {
    return "Service names can only contain letters, numbers, hyphens (-), and underscores (_)";
  }

  if (path.includes("path") && issue.message.includes("file")) {
    return "Path must point to a file with an extension (e.g., service.ts, not service/)";
  }

  if (issue.code === "too_small" && "minimum" in issue && issue.minimum === 1) {
    return "This field is required and cannot be empty";
  }

  return null;
}

export function handleError(error: unknown): never {
  if (error instanceof ConfigError) {
    if (error.cause instanceof ZodError) {
      p.log.error("Configuration validation failed:\n");
      if (error.filePath) {
        p.log.error(`File: ${error.filePath}\n`);
      }

      const errorsCount = error.cause.issues.length;
      error.cause.issues.forEach((issue, index) => {
        const fieldPath = formatFieldPath(issue.path);
        p.log.error(`  ${index + 1}. ${fieldPath}`);
        p.log.error(`     ${issue.message}`);

        const hint = getErrorHint(issue);
        if (hint) {
          p.log.error(`     Hint: ${hint}`);
        }
        if (index < errorsCount - 1) {
          p.log.error("");
        }
      });

      p.log.error(`\nFound ${errorsCount} validation error${errorsCount > 1 ? "s" : ""}`);
      p.log.error("Please fix the errors above and try again.");
    } else {
      // Regular ConfigError (YAML parse, file not found, etc.)
      p.log.error(`Configuration Error: ${error.message}`);
      if (error.filePath) {
        p.log.error(`File: ${error.filePath}`);
      }
      if (error.cause) {
        p.log.error(`Details: ${error.cause.message}`);
      }
    }
  } else if (error instanceof ZodError) {
    p.log.error("Configuration Validation Failed:");
    for (const issue of error.issues) {
      p.log.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
  } else if (error instanceof Error) {
    p.log.error(`Error: ${error.message}`);
  } else {
    p.log.error(`Unknown error: ${String(error)}`);
  }

  process.exit(1);
}

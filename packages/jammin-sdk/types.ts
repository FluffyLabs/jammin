/**
 * Type extractions from @typeberry/lib
 *
 * These types are extracted from classes with private constructors,
 * so we use ReturnType of their static create methods.
 */

import type { block } from "@typeberry/lib";

// Helper type to extract return type from create method
// biome-ignore lint/suspicious/noExplicitAny: Required for generic type constraint - we only extract return type, parameters are not used
type CreateReturn<T extends { create: (...args: any[]) => any }> = ReturnType<T["create"]>;

// Work Report Types
export type WorkReport = CreateReturn<typeof block.workReport.WorkReport>;
export type WorkPackageSpec = CreateReturn<typeof block.workReport.WorkPackageSpec>;
export type RefineContext = CreateReturn<typeof block.refineContext.RefineContext>;
export type WorkPackageInfo = CreateReturn<typeof block.refineContext.WorkPackageInfo>;

// Work Result Types
export type WorkResult = CreateReturn<typeof block.workResult.WorkResult>;
export type WorkRefineLoad = CreateReturn<typeof block.workResult.WorkRefineLoad>;
export type WorkExecResult = InstanceType<typeof block.workResult.WorkExecResult>;

// Work Package Type
export type WorkPackage = CreateReturn<typeof block.workPackage.WorkPackage>;

// Work Item Type
export type WorkItem = CreateReturn<typeof block.workItem.WorkItem>;
export type ImportSpec = CreateReturn<typeof block.workItem.ImportSpec>;

// Block Types
export type Block = CreateReturn<typeof block.Block>;
export type Header = CreateReturn<typeof block.Header>;
export type Extrinsic = CreateReturn<typeof block.Extrinsic>;

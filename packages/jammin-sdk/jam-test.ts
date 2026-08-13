import {
  type CoreIndex,
  WorkReport as JamWorkReport,
  type ServiceGas,
  type ServiceId,
  type TimeSlot,
} from "@typeberry/lib/block";
import { BytesBlob } from "@typeberry/lib/bytes";
import type { Blake2bHash } from "@typeberry/lib/hash";
import { Blake2b } from "@typeberry/lib/hash";
import type { ServiceAccountInfo } from "@typeberry/lib/state";
import type { AccumulateResult } from "@typeberry/lib/transition";
import { loadBuildConfig } from "./config/config-loader.js";
import type { ServiceAccountInfoConfig } from "./config/types/config.js";
import type { SimulatorOptions } from "./simulator.js";
import { TestJam } from "./simulator.js";
import { CoreId, Gas, Slot, ServiceId as toServiceId } from "./types.js";
import { createServiceOutput, loadServices, type ServiceBuildOutput } from "./utils/generate-service-output.js";
import {
  createWorkReport,
  type WorkReport,
  type WorkReportConfig,
  type WorkResultConfig,
  type WorkResultStatus,
} from "./work-report.js";

/** Default gas allocated to a high-level work result. */
export const DEFAULT_ACCUMULATION_GAS = 10_000_000n;

const NAMED_REPORT_DOMAIN = BytesBlob.blobFromString("jammin_report");

/** Byte-like values accepted by the high-level testing API. Strings are encoded as UTF-8. */
export type JamBytes = BytesBlob | Uint8Array | readonly number[] | string;

/** A `.jam` file path or an already loaded JAM service binary. */
export type JamServiceSource = string | BytesBlob | Uint8Array;

/** Genesis configuration for one named service. */
export interface JamServiceOptions {
  /** Explicit service ID. Omit it to allocate the lowest unused ID. */
  id?: number;
  /** UTF-8 genesis storage entries. */
  storage?: Record<string, string>;
  /** Service account overrides. */
  info?: ServiceAccountInfoConfig;
  /** Preimage hash to hex-encoded blob mappings. */
  preimageBlobs?: Record<string, string>;
  /** Preimage hash to lookup-history slot mappings. */
  preimageRequests?: Record<string, number[]>;
}

/** A service declaration created with {@link service}. */
export interface JamServiceDefinition {
  readonly source: JamServiceSource;
  readonly options: Readonly<JamServiceOptions>;
}

/** Named services used to create a {@link JamTest}. */
export type NamedJamServices = Readonly<Record<string, JamServiceDefinition>>;

/**
 * Declare a service for a high-level JAM test.
 *
 * @example
 * ```typescript
 * const jam = await JamTest.fromServices({
 *   counter: service("./dist/counter.jam", { id: 700 }),
 * });
 * ```
 */
export function service(source: JamServiceSource, options: JamServiceOptions = {}): JamServiceDefinition {
  return { source, options };
}

/** Public metadata for a service registered in a {@link JamTest}. */
export interface JamServiceDescriptor {
  readonly name: string;
  readonly id: ServiceId;
  readonly code: BytesBlob;
  readonly codeHash: Blake2bHash;
}

/** A named service or a registered service ID. */
export type JamServiceReference<ServiceName extends string = string> = ServiceName | ServiceId | number;

/** High-level execution status for a work result. */
export type JamWorkResultStatus = { type: "ok"; output?: JamBytes } | Exclude<WorkResultStatus, { type: "ok" }>;

/** High-level work result. Service code hash and gas defaults are filled from the registry. */
export interface JamWorkResultConfig<ServiceName extends string = string> {
  service: JamServiceReference<ServiceName>;
  gas?: number | bigint | ServiceGas;
  payload?: JamBytes;
  output?: JamBytes;
  result?: JamWorkResultStatus;
  load?: WorkResultConfig["load"];
}

/** High-level work report configuration. */
export interface JamReportConfig<ServiceName extends string = string> {
  /** Stable label used to derive a work-package hash. Omit it to use a per-test sequence number. */
  id?: string;
  /** Shorthand for a report with one result. */
  service?: JamServiceReference<ServiceName>;
  gas?: number | bigint | ServiceGas;
  payload?: JamBytes;
  output?: JamBytes;
  result?: JamWorkResultStatus;
  /** Use this instead of `service` to put multiple work results in one report. */
  results?: readonly JamWorkResultConfig<ServiceName>[];
  coreIndex?: number | CoreIndex;
  context?: WorkReportConfig["context"];
  workPackageSpec?: WorkReportConfig["workPackageSpec"];
  authorizerHash?: WorkReportConfig["authorizerHash"];
  authorizationOutput?: JamBytes;
  segmentRootLookup?: WorkReportConfig["segmentRootLookup"];
  authorizationGasUsed?: number | bigint | ServiceGas;
}

/** One report accepted by {@link JamTest.accumulate}. */
export type JamReportInput<ServiceName extends string = string> = WorkReport | JamReportConfig<ServiceName>;

/** Atomic accumulation input for a high-level test. */
export interface JamAccumulateConfig<ServiceName extends string = string> extends Omit<SimulatorOptions, "slot"> {
  slot?: number | TimeSlot;
  reports: readonly JamReportInput<ServiceName>[];
}

/** A compact service entry in an accumulation trace. */
export interface JamExecutedService {
  readonly id: ServiceId;
  readonly name?: string;
  readonly workResults: number;
  readonly gasUsed: ServiceGas;
}

/** Summary derived from the accumulation result without enabling Typeberry logs. */
export interface JamAccumulationTrace {
  readonly slot: TimeSlot;
  readonly executedServices: readonly JamExecutedService[];
}

/** Assertion failure produced by the high-level jammin test API. */
export class JamTestAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JamTestAssertionError";
  }
}

/** State readers for one registered service. */
export class JamServiceStorage {
  constructor(
    private readonly raw: TestJam,
    private readonly descriptor: JamServiceDescriptor,
  ) {}

  /** Read raw bytes, or `null` when the key is absent. */
  bytes(key: JamBytes): BytesBlob | null {
    return this.raw.getServiceStorage(this.descriptor.id, toBlob(key)) ?? null;
  }

  /** Read a UTF-8 value, or `null` when the key is absent. */
  text(key: JamBytes): string | null {
    const value = this.bytes(key);
    return value === null ? null : new TextDecoder().decode(value.raw);
  }

  /** Read an exact four-byte little-endian unsigned integer. */
  u32(key: JamBytes): number | null {
    const value = this.bytes(key);
    if (value === null) {
      return null;
    }
    assertIntegerWidth(this.descriptor, key, value, 4, "u32");
    return new DataView(value.raw.buffer, value.raw.byteOffset, value.raw.byteLength).getUint32(0, true);
  }

  /** Read an exact eight-byte little-endian unsigned integer. */
  u64(key: JamBytes): bigint | null {
    const value = this.bytes(key);
    if (value === null) {
      return null;
    }
    assertIntegerWidth(this.descriptor, key, value, 8, "u64");
    return new DataView(value.raw.buffer, value.raw.byteOffset, value.raw.byteLength).getBigUint64(0, true);
  }
}

/** Handle for reading one service by its stable test name. */
export class JamServiceHandle {
  public readonly storage: JamServiceStorage;

  constructor(
    private readonly raw: TestJam,
    public readonly descriptor: JamServiceDescriptor,
  ) {
    this.storage = new JamServiceStorage(raw, descriptor);
  }

  get id(): ServiceId {
    return this.descriptor.id;
  }

  get name(): string {
    return this.descriptor.name;
  }

  /** Read the current service account info. */
  info(): ServiceAccountInfo {
    const info = this.raw.getServiceInfo(this.id);
    if (info === undefined) {
      throw new Error(`Service '${this.name}' (${this.id}) is not present in state`);
    }
    return info;
  }
}

/** Assertions over service storage. */
export class JamStorageExpectations<ServiceName extends string = string> {
  constructor(private readonly jam: JamTest<ServiceName>) {}

  /** Assert exact bytes at a storage key. */
  bytes(serviceRef: JamServiceReference<ServiceName>, key: JamBytes, expected: JamBytes): void {
    const serviceHandle = this.jam.service(serviceRef);
    const actual = serviceHandle.storage.bytes(key);
    if (actual === null || !bytesEqual(actual.raw, toBlob(expected).raw)) {
      throw new JamTestAssertionError(
        `Expected ${serviceLabel(serviceHandle.descriptor)} storage ${displayBytes(toBlob(key).raw)} to equal ` +
          `${displayBytes(toBlob(expected).raw)}, got ${actual === null ? "missing" : displayBytes(actual.raw)}`,
      );
    }
  }

  /** Assert a UTF-8 value at a storage key. */
  text(serviceRef: JamServiceReference<ServiceName>, key: JamBytes, expected: string): void {
    const serviceHandle = this.jam.service(serviceRef);
    const actual = serviceHandle.storage.text(key);
    if (actual !== expected) {
      throw new JamTestAssertionError(
        `Expected ${serviceLabel(serviceHandle.descriptor)} storage ${displayBytes(toBlob(key).raw)} to equal ` +
          `${JSON.stringify(expected)}, got ${actual === null ? "missing" : JSON.stringify(actual)}`,
      );
    }
  }

  /** Assert a little-endian u32 at a storage key. */
  u32(serviceRef: JamServiceReference<ServiceName>, key: JamBytes, expected: number): void {
    const serviceHandle = this.jam.service(serviceRef);
    const actual = serviceHandle.storage.u32(key);
    if (actual !== expected) {
      throw new JamTestAssertionError(
        `Expected ${serviceLabel(serviceHandle.descriptor)} storage ${displayBytes(toBlob(key).raw)} to equal ` +
          `u32 ${expected}, got ${actual === null ? "missing" : actual}`,
      );
    }
  }

  /** Assert a little-endian u64 at a storage key. */
  u64(serviceRef: JamServiceReference<ServiceName>, key: JamBytes, expected: bigint): void {
    const serviceHandle = this.jam.service(serviceRef);
    const actual = serviceHandle.storage.u64(key);
    if (actual !== expected) {
      throw new JamTestAssertionError(
        `Expected ${serviceLabel(serviceHandle.descriptor)} storage ${displayBytes(toBlob(key).raw)} to equal ` +
          `u64 ${expected}, got ${actual === null ? "missing" : actual}`,
      );
    }
  }

  /** Assert that a storage key is absent. */
  missing(serviceRef: JamServiceReference<ServiceName>, key: JamBytes): void {
    const serviceHandle = this.jam.service(serviceRef);
    const actual = serviceHandle.storage.bytes(key);
    if (actual !== null) {
      throw new JamTestAssertionError(
        `Expected ${serviceLabel(serviceHandle.descriptor)} storage ${displayBytes(toBlob(key).raw)} to be missing, ` +
          `got ${displayBytes(actual.raw)}`,
      );
    }
  }
}

/** Assertions over the current JAM state. */
export class JamStateExpectations<ServiceName extends string = string> {
  public readonly storage: JamStorageExpectations<ServiceName>;

  constructor(jam: JamTest<ServiceName>) {
    this.storage = new JamStorageExpectations(jam);
  }
}

/** Assertions over one atomic accumulation result. */
export class JamAccumulationExpectations<ServiceName extends string = string> {
  constructor(private readonly accumulation: JamAccumulation<ServiceName>) {}

  /** Assert that a service ran PVM code and consumed gas. */
  serviceExecuted(serviceRef: JamServiceReference<ServiceName>): void {
    const descriptor = this.accumulation.resolve(serviceRef);
    const statistics = this.accumulation.raw.accumulationStatistics.get(descriptor.id);
    if (statistics === undefined || statistics.gasUsed <= 0n) {
      throw new JamTestAssertionError(`Expected ${serviceLabel(descriptor)} to execute and consume PVM gas`);
    }
  }

  /** Assert that a service did not run PVM code. */
  serviceNotExecuted(serviceRef: JamServiceReference<ServiceName>): void {
    const descriptor = this.accumulation.resolve(serviceRef);
    const statistics = this.accumulation.raw.accumulationStatistics.get(descriptor.id);
    if (statistics !== undefined && statistics.gasUsed > 0n) {
      throw new JamTestAssertionError(
        `Expected ${serviceLabel(descriptor)} not to execute, but it consumed ${statistics.gasUsed} gas`,
      );
    }
  }

  /** Assert that a service exhausted all gas assigned by the submitted reports. */
  serviceOutOfGas(serviceRef: JamServiceReference<ServiceName>): void {
    const descriptor = this.accumulation.resolve(serviceRef);
    const statistics = this.accumulation.raw.accumulationStatistics.get(descriptor.id);
    const gasLimit = this.accumulation.reportGas.get(descriptor.id);
    if (statistics === undefined || gasLimit === undefined || statistics.gasUsed !== gasLimit) {
      throw new JamTestAssertionError(
        `Expected ${serviceLabel(descriptor)} to exhaust ${gasLimit ?? "an unknown amount of"} gas, ` +
          `got ${statistics?.gasUsed ?? 0n}`,
      );
    }
  }

  /** Assert that a service completed before exhausting report gas. */
  serviceCompleted(serviceRef: JamServiceReference<ServiceName>): void {
    const descriptor = this.accumulation.resolve(serviceRef);
    const statistics = this.accumulation.raw.accumulationStatistics.get(descriptor.id);
    const gasLimit = this.accumulation.reportGas.get(descriptor.id);
    if (
      statistics === undefined ||
      gasLimit === undefined ||
      statistics.gasUsed <= 0n ||
      statistics.gasUsed >= gasLimit
    ) {
      throw new JamTestAssertionError(
        `Expected ${serviceLabel(descriptor)} to complete below its ${gasLimit ?? "unknown"} gas limit, ` +
          `got ${statistics?.gasUsed ?? 0n}`,
      );
    }
  }
}

/** Result and assertions for one high-level accumulation call. */
export class JamAccumulation<ServiceName extends string = string> {
  public readonly expect: JamAccumulationExpectations<ServiceName>;
  public readonly trace: JamAccumulationTrace;

  constructor(
    public readonly raw: AccumulateResult,
    private readonly registryByName: ReadonlyMap<string, JamServiceDescriptor>,
    private readonly registryById: ReadonlyMap<ServiceId, JamServiceDescriptor>,
    public readonly reportGas: ReadonlyMap<ServiceId, ServiceGas>,
  ) {
    this.expect = new JamAccumulationExpectations(this);
    this.trace = {
      slot: raw.stateUpdate.timeslot,
      executedServices: [...raw.accumulationStatistics].map(([id, statistics]) => ({
        id,
        name: registryById.get(id)?.name,
        workResults: statistics.count,
        gasUsed: statistics.gasUsed,
      })),
    };
  }

  /** Get statistics for a named service. */
  statistics(serviceRef: JamServiceReference<ServiceName>) {
    return this.raw.accumulationStatistics.get(this.resolve(serviceRef).id);
  }

  resolve(serviceRef: JamServiceReference<ServiceName>): JamServiceDescriptor {
    return resolveDescriptor(serviceRef, this.registryByName, this.registryById);
  }
}

/**
 * High-level, stateful harness for writing JAM service tests.
 *
 * `JamTest` owns service discovery, genesis creation, work-report defaults,
 * accumulation and typed state readers. The low-level {@link TestJam} remains
 * available through {@link JamTest.raw} for protocol-specific tests.
 */
export class JamTest<ServiceName extends string = string> {
  public readonly expect: JamStateExpectations<ServiceName>;
  public readonly services: Readonly<Record<ServiceName, JamServiceDescriptor>>;
  private reportSequence = 0;

  private constructor(
    public readonly raw: TestJam,
    services: Record<ServiceName, JamServiceDescriptor>,
    private readonly blake2b: Blake2b,
  ) {
    this.services = Object.freeze(services);
    const descriptors = Object.values(services) as JamServiceDescriptor[];
    this.registryByName = new Map(descriptors.map((descriptor) => [descriptor.name, descriptor]));
    this.registryById = new Map(descriptors.map((descriptor) => [descriptor.id, descriptor]));
    this.expect = new JamStateExpectations(this);
  }

  private readonly registryByName: ReadonlyMap<string, JamServiceDescriptor>;
  private readonly registryById: ReadonlyMap<ServiceId, JamServiceDescriptor>;

  /** Load services from the current jammin project. */
  static async create(): Promise<JamTest<string>> {
    const config = await loadBuildConfig();
    const outputs = await loadServices(config);
    return await JamTest.fromServiceOutputs(outputs);
  }

  /** Create isolated state from named service declarations. */
  static async fromServices<const Definitions extends NamedJamServices>(
    definitions: Definitions,
  ): Promise<JamTest<Extract<keyof Definitions, string>>> {
    const outputs = await resolveServiceOutputs(definitions);
    return await JamTest.fromServiceOutputs<Extract<keyof Definitions, string>>(outputs);
  }

  private static async fromServiceOutputs<Name extends string>(outputs: ServiceBuildOutput[]): Promise<JamTest<Name>> {
    validateServiceOutputs(outputs);
    const blake2b = await Blake2b.createHasher();
    const descriptors = Object.fromEntries(
      outputs.map((output) => [
        output.name,
        {
          name: output.name,
          id: output.id,
          code: output.code,
          codeHash: blake2b.hashBytes(output.code),
        } satisfies JamServiceDescriptor,
      ]),
    ) as Record<Name, JamServiceDescriptor>;
    return new JamTest(TestJam.fromServiceOutputs(outputs), descriptors, blake2b);
  }

  /** Resolve a service and return typed state readers. */
  service(serviceRef: JamServiceReference<ServiceName>): JamServiceHandle {
    return new JamServiceHandle(this.raw, this.resolve(serviceRef));
  }

  /** Build a work report using registered service metadata and safe defaults. */
  report(config: JamReportConfig<ServiceName>): WorkReport {
    if (config.id !== undefined && config.id.length === 0) {
      throw new Error("A JamTest report ID must not be empty");
    }
    const itemConfigs = normalizeReportItems(config);
    const results = itemConfigs.map((item) => this.createResultConfig(item));
    const reportId = config.id ?? `report-${this.reportSequence++}`;
    const workPackageHash = this.blake2b.hashBlobs([NAMED_REPORT_DOMAIN, BytesBlob.blobFromString(reportId)]);

    return createWorkReport(this.blake2b, {
      results,
      coreIndex:
        config.coreIndex === undefined
          ? undefined
          : typeof config.coreIndex === "number"
            ? CoreId(config.coreIndex)
            : config.coreIndex,
      context: config.context,
      workPackageSpec: {
        ...config.workPackageSpec,
        hash: config.workPackageSpec?.hash ?? workPackageHash.asOpaque(),
      },
      authorizerHash: config.authorizerHash,
      authorizationOutput: config.authorizationOutput === undefined ? undefined : toBlob(config.authorizationOutput),
      segmentRootLookup: config.segmentRootLookup,
      authorizationGasUsed: config.authorizationGasUsed === undefined ? undefined : Gas(config.authorizationGasUsed),
    });
  }

  /** Create reports, execute accumulation and apply its state update as one operation. */
  async accumulate(config: JamAccumulateConfig<ServiceName>): Promise<JamAccumulation<ServiceName>> {
    const reports = config.reports.map((report) => (isWorkReport(report) ? report : this.report(report)));
    const reportGas = aggregateReportGas(reports);
    const { reports: _, slot, ...options } = config;
    const rawResult = await this.raw
      .withOptions({
        ...options,
        slot: slot === undefined ? undefined : Slot(slot),
        debug: options.debug ?? false,
      })
      .withWorkReports(reports)
      .accumulate();

    return new JamAccumulation(rawResult, this.registryByName, this.registryById, reportGas);
  }

  private createResultConfig(config: JamWorkResultConfig<ServiceName>): WorkResultConfig {
    const descriptor = this.resolve(config.service);
    const result = normalizeResult(config);
    return {
      serviceId: descriptor.id,
      codeHash: descriptor.codeHash,
      gas: Gas(config.gas ?? DEFAULT_ACCUMULATION_GAS),
      payload: config.payload === undefined ? undefined : toBlob(config.payload),
      result,
      load: config.load,
    };
  }

  private resolve(serviceRef: JamServiceReference<ServiceName>): JamServiceDescriptor {
    return resolveDescriptor(serviceRef, this.registryByName, this.registryById);
  }
}

async function resolveServiceOutputs(definitions: NamedJamServices): Promise<ServiceBuildOutput[]> {
  const entries = Object.entries(definitions);
  if (entries.length === 0) {
    throw new Error("JamTest.fromServices requires at least one named service");
  }

  const usedIds = new Set<number>();
  for (const [name, definition] of entries) {
    const id = definition.options.id;
    if (id === undefined) {
      continue;
    }
    toServiceId(id, `Service '${name}' id`);
    if (usedIds.has(id)) {
      throw new Error(`Duplicate service ID ${id} in JamTest.fromServices`);
    }
    usedIds.add(id);
  }

  let nextId = 0;
  const allocateId = (): number => {
    while (usedIds.has(nextId)) {
      nextId += 1;
    }
    const id = nextId;
    usedIds.add(id);
    nextId += 1;
    return id;
  };

  return await Promise.all(
    entries.map(async ([name, definition]) => {
      if (name.length === 0) {
        throw new Error("JamTest service names must not be empty");
      }
      const id = definition.options.id ?? allocateId();
      const code = await loadServiceCode(definition.source, name);
      return createServiceOutput(
        code,
        name,
        id,
        definition.options.storage,
        definition.options.info,
        definition.options.preimageBlobs,
        definition.options.preimageRequests,
      );
    }),
  );
}

function validateServiceOutputs(outputs: readonly ServiceBuildOutput[]): void {
  const names = new Set<string>();
  const ids = new Set<ServiceId>();
  for (const output of outputs) {
    if (names.has(output.name)) {
      throw new Error(`Duplicate service name '${output.name}' in JamTest registry`);
    }
    if (ids.has(output.id)) {
      throw new Error(`Duplicate service ID ${output.id} in JamTest registry`);
    }
    names.add(output.name);
    ids.add(output.id);
  }
}

async function loadServiceCode(source: JamServiceSource, name: string): Promise<BytesBlob> {
  if (source instanceof BytesBlob) {
    return source;
  }
  if (source instanceof Uint8Array) {
    return BytesBlob.blobFrom(source);
  }
  const file = Bun.file(source);
  if (!(await file.exists())) {
    throw new Error(`JAM binary for service '${name}' not found at ${source}`);
  }
  return BytesBlob.blobFrom(await file.bytes());
}

function normalizeReportItems<ServiceName extends string>(
  config: JamReportConfig<ServiceName>,
): JamWorkResultConfig<ServiceName>[] {
  if (config.results !== undefined && config.service !== undefined) {
    throw new Error("A JamTest report must use either 'service' or 'results', not both");
  }
  if (config.results !== undefined) {
    if (config.results.length === 0) {
      throw new Error("A JamTest report must contain at least one result");
    }
    return [...config.results];
  }
  if (config.service === undefined) {
    throw new Error("A JamTest report requires 'service' or 'results'");
  }
  return [
    {
      service: config.service,
      gas: config.gas,
      payload: config.payload,
      output: config.output,
      result: config.result,
    },
  ];
}

function normalizeResult<ServiceName extends string>(config: JamWorkResultConfig<ServiceName>): WorkResultStatus {
  if (config.output !== undefined && config.result !== undefined && config.result.type !== "ok") {
    throw new Error("A non-ok work result cannot also have an output");
  }
  if (config.result === undefined) {
    return { type: "ok", output: config.output === undefined ? undefined : toBlob(config.output) };
  }
  if (config.result.type === "ok") {
    const output = config.output ?? config.result.output;
    return { type: "ok", output: output === undefined ? undefined : toBlob(output) };
  }
  return config.result;
}

function aggregateReportGas(reports: readonly WorkReport[]): ReadonlyMap<ServiceId, ServiceGas> {
  const gas = new Map<ServiceId, ServiceGas>();
  for (const report of reports) {
    for (const result of report.results) {
      gas.set(result.serviceId, Gas((gas.get(result.serviceId) ?? 0n) + result.gas));
    }
  }
  return gas;
}

function resolveDescriptor(
  serviceRef: string | ServiceId | number,
  byName: ReadonlyMap<string, JamServiceDescriptor>,
  byId: ReadonlyMap<ServiceId, JamServiceDescriptor>,
): JamServiceDescriptor {
  const descriptor = typeof serviceRef === "string" ? byName.get(serviceRef) : byId.get(toServiceId(serviceRef));
  if (descriptor === undefined) {
    throw new Error(`Unknown JAM service ${typeof serviceRef === "string" ? `'${serviceRef}'` : serviceRef}`);
  }
  return descriptor;
}

function isWorkReport<ServiceName extends string>(report: JamReportInput<ServiceName>): report is WorkReport {
  return report instanceof JamWorkReport;
}

function toBlob(value: JamBytes): BytesBlob {
  if (value instanceof BytesBlob) {
    return value;
  }
  if (typeof value === "string") {
    return BytesBlob.blobFromString(value);
  }
  if (value instanceof Uint8Array) {
    return BytesBlob.blobFrom(value);
  }
  return BytesBlob.blobFromNumbers([...value]);
}

function assertIntegerWidth(
  service: JamServiceDescriptor,
  key: JamBytes,
  value: BytesBlob,
  expectedLength: number,
  type: string,
): void {
  if (value.length !== expectedLength) {
    throw new Error(
      `Cannot decode ${serviceLabel(service)} storage ${displayBytes(toBlob(key).raw)} as ${type}: ` +
        `expected ${expectedLength} bytes, got ${value.length}`,
    );
  }
}

function serviceLabel(service: JamServiceDescriptor): string {
  return `service '${service.name}' (${service.id})`;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((byte, index) => byte === right[index]);
}

function displayBytes(bytes: Uint8Array): string {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

import {
  type AssurancesExtrinsicView,
  AvailabilityAssurance,
  assurancesExtrinsicCodec,
  type CoreIndex,
  Credential,
  guaranteesExtrinsicCodec,
  type HeaderHash,
  ReportGuarantee,
  reencodeAsView,
  tryAsPerValidator,
  tryAsValidatorIndex,
  type WorkReport,
} from "@typeberry/lib/block";
import { BitVec, Bytes, BytesBlob } from "@typeberry/lib/bytes";
import { asKnownSize, HashDictionary, HashSet } from "@typeberry/lib/collections";
import { tinyChainSpec } from "@typeberry/lib/config";
import {
  BANDERSNATCH_KEY_BYTES,
  BLS_KEY_BYTES,
  ED25519_SIGNATURE_BYTES,
  type Ed25519Pair,
  ed25519,
  initWasm,
  keyDerivation,
} from "@typeberry/lib/crypto";
import { tryAsU32 } from "@typeberry/lib/numbers";
import { BlockState, RecentBlocks, tryAsPerCore, VALIDATOR_META_BYTES, ValidatorData } from "@typeberry/lib/state";
import { Assurances, AssurancesError, Reports, ReportsError } from "@typeberry/lib/transition";
import { asOpaqueType } from "@typeberry/lib/utils";
import type { JamAccumulateConfig, JamAccumulation, JamReportConfig, JamTest } from "./jam-test.js";
import { Slot } from "./types.js";

const GUARANTEE_DOMAIN = BytesBlob.blobFromString("jam_guarantee");
const AVAILABILITY_DOMAIN = BytesBlob.blobFromString("jam_available");

/** Configuration for a protocol pipeline sandbox. */
export interface JamPipelineOptions {
  /** Slot containing the guarantee. Defaults to 20. */
  guaranteeBlockSlot?: number;
  /** Slot at which guarantors produced the report. Defaults to the guarantee block slot. */
  guaranteeSlot?: number;
}

/** Assurance votes to submit for a pending report. */
export interface JamAssureOptions {
  /** Number of validators voting for availability. Defaults to the strict supermajority. */
  votes?: number;
  /** Slot containing the assurances. Defaults to one slot after the guarantee block. */
  slot?: number;
  /** Parent anchor signed by validators. Defaults to the pipeline parent. */
  parentHash?: HeaderHash;
}

/** Result of applying assurances to a pending report. */
export class JamAssuranceResult<ServiceName extends string = string> {
  /** Whether the report crossed the strict availability supermajority. */
  readonly status: "pending" | "available";

  constructor(
    private readonly jam: JamTest<ServiceName>,
    public readonly report: WorkReport,
    public readonly availableReports: readonly WorkReport[],
    public readonly votes: number,
  ) {
    this.status = availableReports.length === 0 ? "pending" : "available";
  }

  /** Accumulate the available report and apply its service-state changes. */
  async accumulate(
    options: Omit<JamAccumulateConfig<ServiceName>, "reports"> = {},
  ): Promise<JamAccumulation<ServiceName>> {
    if (this.availableReports.length === 0) {
      throw new Error("Cannot accumulate a report before it becomes available");
    }
    return await this.jam.accumulate({
      ...options,
      reports: this.availableReports,
    });
  }
}

/** A report accepted as a guarantee and waiting for availability assurances. */
export class JamPendingReport<ServiceName extends string = string> {
  public readonly status = "pending" as const;

  constructor(
    private readonly pipeline: JamPipeline<ServiceName>,
    public readonly report: WorkReport,
    public readonly guarantee: ReportGuarantee,
    /** Validator indices selected by the protocol as guarantors for this core. */
    public readonly guarantors: readonly number[],
  ) {}

  /** Submit signed availability assurances for this report. */
  async assure(options: JamAssureOptions = {}): Promise<JamAssuranceResult<ServiceName>> {
    return await this.pipeline.assure(this.report, options);
  }
}

/**
 * Stateful guarantee → assurance → accumulation harness backed by Typeberry transitions.
 *
 * The harness installs deterministic development validators and a recent anchor block,
 * then signs the same domain-separated payloads as real guarantors and assurers.
 */
export class JamPipeline<ServiceName extends string = string> {
  public readonly parentHash: HeaderHash;
  private readonly validatorKeys: readonly Ed25519Pair[];
  private readonly validators: ReturnType<typeof tryAsPerValidator<ValidatorData>>;
  private readonly blockSlot: number;
  private readonly reportSlot: number;
  private readonly anchorStateRoot;
  private readonly anchorBeefyRoot;
  private readonly authorizerHash;

  private constructor(
    private readonly jam: JamTest<ServiceName>,
    validatorKeys: readonly Ed25519Pair[],
    validators: ReturnType<typeof tryAsPerValidator<ValidatorData>>,
    options: JamPipelineOptions,
  ) {
    this.validatorKeys = validatorKeys;
    this.validators = validators;
    this.blockSlot = options.guaranteeBlockSlot ?? 20;
    this.reportSlot = options.guaranteeSlot ?? this.blockSlot;
    this.parentHash = jam.hash("jammin-pipeline-parent").asOpaque();
    this.anchorStateRoot = jam.hash("jammin-pipeline-state").asOpaque();
    this.anchorBeefyRoot = jam.hash("jammin-pipeline-beefy").asOpaque();
    this.authorizerHash = jam.hash("jammin-pipeline-authorizer").asOpaque();
  }

  /** Create and initialize a deterministic protocol pipeline. */
  static async create<ServiceName extends string>(
    jam: JamTest<ServiceName>,
    options: JamPipelineOptions = {},
  ): Promise<JamPipeline<ServiceName>> {
    await initWasm();
    const validatorKeys = await createValidatorKeys(jam);
    const validators = tryAsPerValidator(
      validatorKeys.map((pair, index) =>
        ValidatorData.create({
          bandersnatch: Bytes.fill(BANDERSNATCH_KEY_BYTES, index + 1).asOpaque(),
          ed25519: pair.pubKey,
          bls: Bytes.zero(BLS_KEY_BYTES).asOpaque(),
          metadata: Bytes.zero(VALIDATOR_META_BYTES),
        }),
      ),
      tinyChainSpec,
    );
    const pipeline = new JamPipeline(jam, validatorKeys, validators, options);
    await pipeline.initializeState();
    return pipeline;
  }

  /** Build a report with protocol-valid anchor and authorizer defaults. */
  report(config: JamReportConfig<ServiceName>): WorkReport {
    return this.jam.report({
      ...config,
      authorizerHash: config.authorizerHash ?? this.authorizerHash,
      context: {
        anchor: this.parentHash,
        stateRoot: this.anchorStateRoot,
        beefyRoot: this.anchorBeefyRoot,
        lookupAnchor: this.parentHash,
        lookupAnchorSlot: Slot(this.blockSlot),
        ...config.context,
      },
    });
  }

  /** Validate a signed guarantee and place the report into the pending core. */
  async guarantee(report: WorkReport): Promise<JamPendingReport<ServiceName>> {
    const reports = this.reportsTransition();
    const assignment = reports.getGuarantorAssignment(
      Slot(this.blockSlot),
      Slot(this.reportSlot),
      this.jam.raw.state.entropy,
      this.validators,
      this.validators,
    );
    if (assignment.isError) {
      throw new Error(`Unable to assign guarantors: ${ReportsError[assignment.error]} (${assignment.details()})`);
    }
    const guarantors = assignment.ok
      .map((entry, validatorIndex) => ({ entry, validatorIndex }))
      .filter(({ entry }) => entry.core === report.coreIndex)
      .slice(0, 2)
      .map(({ validatorIndex }) => validatorIndex);
    if (guarantors.length < 2) {
      throw new Error(`Core ${report.coreIndex} has fewer than two assigned guarantors`);
    }

    const draft = ReportGuarantee.create({
      report,
      slot: Slot(this.reportSlot),
      credentials: asOpaqueType(
        guarantors.map((validatorIndex) =>
          Credential.create({
            validatorIndex: tryAsValidatorIndex(validatorIndex),
            signature: Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque(),
          }),
        ),
      ),
    });
    const reportHash = reports.workReportHashes(guaranteesAsView([draft]), this.jam.blake2b)[0];
    if (reportHash === undefined) {
      throw new Error("Typeberry did not produce a work-report hash");
    }
    const message = BytesBlob.blobFromParts(GUARANTEE_DOMAIN.raw, reportHash.raw);
    const credentials = await Promise.all(
      guarantors.map(async (validatorIndex) =>
        Credential.create({
          validatorIndex: tryAsValidatorIndex(validatorIndex),
          signature: await ed25519.sign(this.validatorKey(validatorIndex), message),
        }),
      ),
    );
    const guarantee = ReportGuarantee.create({
      report,
      slot: Slot(this.reportSlot),
      credentials: asOpaqueType(credentials),
    });
    const result = await reports.transition({
      guarantees: guaranteesAsView([guarantee]),
      slot: Slot(this.blockSlot),
      newEntropy: this.jam.raw.state.entropy,
      recentBlocksPartialUpdate: this.jam.raw.state.recentBlocks,
      assurancesAvailAssignment: this.jam.raw.state.availabilityAssignment,
      offenders: HashSet.new(),
      currentValidatorData: this.validators,
      previousValidatorData: this.validators,
    });
    if (result.isError) {
      throw new Error(`Guarantee rejected: ${ReportsError[result.error]} (${result.details()})`);
    }
    await this.jam.raw.applyStateUpdate(result.ok.stateUpdate);
    return new JamPendingReport(this, report, guarantee, guarantors);
  }

  async assure(report: WorkReport, options: JamAssureOptions): Promise<JamAssuranceResult<ServiceName>> {
    const votes = options.votes ?? tinyChainSpec.validatorsSuperMajority;
    if (!Number.isInteger(votes) || votes < 0 || votes > tinyChainSpec.validatorsCount) {
      throw new Error(`Assurance votes must be between 0 and ${tinyChainSpec.validatorsCount}`);
    }
    const anchor = options.parentHash ?? this.parentHash;
    const bitfield = coreBitfield(report.coreIndex);
    const assurances = await Promise.all(
      Array.from({ length: votes }, async (_, validatorIndex) => {
        const digest = this.jam.blake2b.hashBytes(BytesBlob.blobFromParts(anchor.raw, bitfield.raw));
        const message = BytesBlob.blobFromParts(AVAILABILITY_DOMAIN.raw, digest.raw);
        return AvailabilityAssurance.create({
          anchor,
          bitfield,
          validatorIndex: tryAsValidatorIndex(validatorIndex),
          signature: await ed25519.sign(this.validatorKey(validatorIndex), message),
        });
      }),
    );
    const result = await new Assurances(
      tinyChainSpec,
      {
        availabilityAssignment: this.jam.raw.state.availabilityAssignment,
        currentValidatorData: this.validators,
      },
      this.jam.blake2b,
    ).transition({
      assurances: assurancesAsView(assurances),
      slot: Slot(options.slot ?? this.blockSlot + 1),
      parentHash: this.parentHash,
      disputesAvailAssignment: this.jam.raw.state.availabilityAssignment,
    });
    if (result.isError) {
      throw new Error(`Assurances rejected: ${AssurancesError[result.error]} (${result.details()})`);
    }
    await this.jam.raw.applyStateUpdate(result.ok.stateUpdate);
    return new JamAssuranceResult(this.jam, report, result.ok.availableReports, votes);
  }

  private async initializeState(): Promise<void> {
    const recentBlocks = RecentBlocks.create({
      blocks: asKnownSize([
        BlockState.create({
          headerHash: this.parentHash,
          accumulationResult: this.anchorBeefyRoot,
          postStateRoot: this.anchorStateRoot,
          reported: HashDictionary.new(),
        }),
      ]),
      accumulationLog: { peaks: [] },
    });
    const authPools = tryAsPerCore(
      Array.from({ length: tinyChainSpec.coresCount }, () => asKnownSize([this.authorizerHash])),
      tinyChainSpec,
    );
    await this.jam.raw.applyStateUpdate({
      authPools,
      recentBlocks,
      currentValidatorData: this.validators,
      previousValidatorData: this.validators,
      designatedValidatorData: this.validators,
    });
  }

  private reportsTransition(): Reports {
    return new Reports(tinyChainSpec, this.jam.blake2b, this.jam.raw.state, {
      isAncestor: () => false,
    });
  }

  private validatorKey(index: number): Ed25519Pair {
    const key = this.validatorKeys[index];
    if (key === undefined) {
      throw new Error(`No development validator key at index ${index}`);
    }
    return key;
  }
}

function guaranteesAsView(guarantees: readonly ReportGuarantee[]) {
  return reencodeAsView(guaranteesExtrinsicCodec, asOpaqueType(guarantees), tinyChainSpec);
}

function assurancesAsView(assurances: readonly AvailabilityAssurance[]): AssurancesExtrinsicView {
  return reencodeAsView(assurancesExtrinsicCodec, asOpaqueType(assurances), tinyChainSpec);
}

function coreBitfield(coreIndex: CoreIndex): BitVec {
  const bytes = new Array(Math.ceil(tinyChainSpec.coresCount / 8)).fill(0);
  const byteIndex = Math.floor(coreIndex / 8);
  bytes[byteIndex] = (bytes[byteIndex] ?? 0) | (1 << (coreIndex % 8));
  return BitVec.fromBytes(Bytes.fromNumbers(bytes, bytes.length), tinyChainSpec.coresCount);
}

async function createValidatorKeys<ServiceName extends string>(jam: JamTest<ServiceName>): Promise<Ed25519Pair[]> {
  return await Promise.all(
    Array.from({ length: tinyChainSpec.validatorsCount }, async (_, index) => {
      const seed = keyDerivation.trivialSeed(tryAsU32(index));
      const secret = keyDerivation.deriveEd25519SecretKey(seed, jam.blake2b);
      return await ed25519.privateKey(secret);
    }),
  );
}

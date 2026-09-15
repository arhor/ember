import { mkdir, readFile, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import type { EpistemicRole, MeaningId, MeaningKind } from "../core/model.ts";
import type { MaterializedMeaning, StateMaterialization } from "../core/state-materialization.ts";

import { PartialPublication, ValidationError } from "../core/errors.ts";
import { replaceFileAtomically } from "./file-replacement.ts";

const VIEW_TITLES: Record<keyof StateMaterialization["views"], string> = {
    "SELF.md": "Self understanding",
    "USER.md": "User understanding",
    "RELATIONSHIP.md": "Relationship",
    "MEMORY.md": "Durable memory overview",
};

export interface MarkdownEditInspection {
    edit_version: 1;
    source_view: "USER.md";
    base_revision: number;
    affected_meaning_ids: string[];
    edits: Array<{
        meaning_id: MeaningId;
        kind: MeaningKind;
        owner: string;
        slot: string;
        scope: string;
        content: string;
        epistemic_role: EpistemicRole;
        uncertainty: string | null;
    }>;
}

export function renderMarkdownStateViews(materialization: StateMaterialization) {
    return Object.fromEntries(
        Object.entries(materialization.views).map(([name, meanings]) => [
            name,
            renderView(name as keyof StateMaterialization["views"], meanings, materialization),
        ]),
    ) as Record<keyof StateMaterialization["views"], string>;
}

export async function publishMarkdownStateViews(
    outputDirectory: string,
    canonicalStatePath: string,
    materialization: StateMaterialization,
    { replace = replaceFileAtomically }: { replace?: typeof replaceFileAtomically } = {},
) {
    const rendered = renderMarkdownStateViews(materialization);
    const names = Object.keys(rendered).sort() as Array<keyof typeof rendered>;
    const canonicalPath = await resolvePhysicalPath(canonicalStatePath);
    const targets = await Promise.all(
        names.map(async (name) => ({
            name,
            path: join(outputDirectory, name),
            physical: await resolvePhysicalPath(join(outputDirectory, name)),
        })),
    );
    if (targets.some((target) => target.physical === canonicalPath))
        throw new ValidationError("materialized view target aliases the canonical state path");

    await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
    const published: string[] = [];
    for (const target of targets) {
        try {
            await replace(target.path, rendered[target.name], { mode: 0o600 });
            published.push(target.path);
        } catch (error) {
            throw new PartialPublication(
                `materialized view publication failed at ${target.path}; published before failure: ${JSON.stringify(published)}`,
                { cause: error, publishedArtifacts: published, failedArtifact: target.path },
            );
        }
    }
    return targets.map((target) => target.path);
}

export async function readMarkdownStateViews(directory: string) {
    const names = Object.keys(VIEW_TITLES) as Array<keyof StateMaterialization["views"]>;
    return Object.fromEntries(
        await Promise.all(names.map(async (name) => [name, await readFile(join(directory, name), "utf8")] as const)),
    ) as Record<keyof StateMaterialization["views"], string>;
}

/** Parses the deliberately narrow Markdown v1 edit surface into semantic proposals. */
export function inspectMarkdownStateEdits(
    materialization: StateMaterialization,
    edited: Record<keyof StateMaterialization["views"], string>,
): MarkdownEditInspection {
    const expected = renderMarkdownStateViews(materialization);
    for (const name of ["SELF.md", "RELATIONSHIP.md", "MEMORY.md"] as const) {
        if (edited[name] !== expected[name]) throw new ValidationError(`${name} is generated-only and contains drift`);
    }
    const actualMetadata = metadataBlock(edited["USER.md"]);
    const expectedMetadata = metadataBlock(expected["USER.md"]);
    if (actualMetadata !== expectedMetadata)
        throw new ValidationError("USER.md materialization metadata is stale or changed");
    if (entryPrefix(edited["USER.md"]) !== entryPrefix(expected["USER.md"]))
        throw new ValidationError("USER.md generated structure contains drift");

    const meanings = new Map(materialization.views["USER.md"].map((meaning) => [meaning.meaningId, meaning]));
    const expectedEntries = parseEntries(expected["USER.md"]);
    const editedEntries = parseEntries(edited["USER.md"]);
    if (editedEntries.size !== expectedEntries.size)
        throw new ValidationError("USER.md meanings cannot be added or removed");

    const edits: MarkdownEditInspection["edits"] = [];
    for (const [id, expectedEntry] of expectedEntries) {
        const editedEntry = editedEntries.get(id);
        if (!editedEntry) throw new ValidationError(`USER.md meaning identity changed or is missing: ${id}`);
        if (editedEntry.suffix !== expectedEntry.suffix)
            throw new ValidationError(`USER.md metadata or provenance changed for meaning: ${id}`);
        if (editedEntry.content === expectedEntry.content) continue;
        const meaning = meanings.get(id as MeaningId)!;
        if (
            meaning.currentness !== "current" ||
            !["fact", "preference"].includes(meaning.kind) ||
            meaning.epistemicRole !== "user_testimony"
        )
            throw new ValidationError(`meaning is generated-only and cannot be edited: ${id}`);
        const content = decodeCanonicalString(editedEntry.content).trim();
        if (!content) throw new ValidationError(`edited meaning content must be non-empty: ${id}`);
        edits.push({
            meaning_id: meaning.meaningId,
            kind: meaning.kind,
            owner: meaning.owner,
            slot: meaning.slot,
            scope: meaning.scope,
            content,
            epistemic_role: meaning.epistemicRole,
            uncertainty: meaning.uncertainty,
        });
    }
    if (!edits.length) throw new ValidationError("no supported USER.md content edits were found");
    return {
        edit_version: 1,
        source_view: "USER.md",
        base_revision: materialization.sourceRevision,
        affected_meaning_ids: edits.map((edit) => edit.meaning_id),
        edits,
    };
}

function metadataBlock(markdown: string) {
    const end = markdown.indexOf("-->\n");
    if (!markdown.startsWith("<!-- ember-state-materialization\n") || end < 0)
        throw new ValidationError("materialized view metadata is missing or malformed");
    return markdown.slice(0, end + 4);
}

function parseEntries(markdown: string) {
    const entries = new Map<string, { content: string; suffix: string }>();
    const pattern = /\n## Meaning <code>([^<\n]+)<\/code>\n\n([\s\S]*?)\n\n(- Kind: [\s\S]*?)(?=\n## Meaning |$)/gu;
    let consumed = entryPrefix(markdown).length;
    for (const match of markdown.matchAll(pattern)) {
        if (match.index !== consumed) throw new ValidationError("USER.md contains malformed or unknown structure");
        const id = decodeCanonicalString(match[1]!);
        if (entries.has(id)) throw new ValidationError(`duplicate materialized meaning ID: ${id}`);
        entries.set(id, { content: match[2]!, suffix: match[3]! });
        consumed = match.index + match[0].length;
    }
    if (consumed !== markdown.length) throw new ValidationError("USER.md contains malformed or unknown structure");
    return entries;
}

function entryPrefix(markdown: string) {
    const first = markdown.indexOf("\n## Meaning ");
    return first < 0 ? markdown : markdown.slice(0, first);
}

function decodeCanonicalString(value: string) {
    return value.replace(/&#(\d+);/gu, (_match, point: string) => String.fromCodePoint(Number(point)));
}

async function resolvePhysicalPath(path: string): Promise<string> {
    const absolute = resolve(path);
    try {
        return await realpath(absolute);
    } catch (error) {
        if (!isMissingPath(error)) throw error;
        const parent = dirname(absolute);
        if (parent === absolute) return absolute;
        return join(await resolvePhysicalPath(parent), absolute.slice(parent.length + 1));
    }
}

function isMissingPath(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function renderView(
    name: keyof StateMaterialization["views"],
    meanings: MaterializedMeaning[],
    source: StateMaterialization,
) {
    const title = VIEW_TITLES[name];
    const metadata = [
        "<!-- ember-state-materialization",
        `representation-version: ${source.materializationVersion}`,
        `source-schema-version: ${source.sourceSchemaVersion}`,
        `source-revision: ${source.sourceRevision}`,
        `lineage-id: ${renderCanonicalString(source.lineageId, "metadata")}`,
        `purpose: ${source.purpose}`,
        `principal: ${renderCanonicalString(source.disclosurePolicy.principal, "metadata")}`,
        `scope: ${renderCanonicalString(source.disclosurePolicy.scope, "metadata")}`,
        `evidence-payloads: ${source.disclosurePolicy.evidencePayloads}`,
        `interaction-mode: ${source.interactionModes[name]}`,
        "-->",
    ].join("\n");
    let markdown = `${metadata}\n\n# ${title}\n\n`;
    markdown +=
        title === VIEW_TITLES["USER.md"]
            ? "Proposal-authoring view. Only content of current user facts and preferences is editable; apply edits explicitly.\n"
            : "Generated-only inspection view. Editing this file does not change canonical Ember state.\n";
    if (!meanings.length) return `${markdown}\nNo meanings are visible under this disclosure policy.\n`;
    for (const meaning of meanings) markdown += renderMeaning(meaning);
    return markdown;
}

function renderMeaning(meaning: MaterializedMeaning) {
    const relation = [
        meaning.supersedes && `supersedes ${renderCode(meaning.supersedes)}`,
        meaning.supersededBy && `superseded by ${renderCode(meaning.supersededBy)}`,
    ].filter(Boolean);
    let text = `\n## Meaning ${renderCode(meaning.meaningId)}\n\n`;
    text += `${renderCanonicalString(meaning.content, "block")}\n\n`;
    text += `- Kind: ${renderCode(meaning.kind)}\n- Owner: ${renderCode(meaning.owner)}\n- Slot: ${renderCode(meaning.slot)}\n`;
    text += `- Scope: ${renderCode(meaning.scope)}\n- Currentness: ${renderCode(meaning.currentness)}\n`;
    text += `- Lifecycle: ${renderCode(meaning.prospectiveLifecycle)}\n- Epistemic role: ${renderCode(meaning.epistemicRole)}\n`;
    text += `- Learned at: ${renderCode(meaning.learnedAt)}\n- Applicable: ${renderCode(meaning.applicableFrom)} to ${renderCode(meaning.applicableUntil ?? "open")}\n`;
    text += `- Uncertainty: ${meaning.uncertainty === null ? "none recorded" : renderCanonicalString(meaning.uncertainty, "inline")}\n`;
    text += `- Lineage: ${relation.length ? relation.join("; ") : "none"}\n- Source evidence:\n`;
    for (const evidence of meaning.sourceEvidence) {
        text += `  - ${renderCode(evidence.evidenceId)}: role ${renderCode(evidence.sourceRole)}, actor ${renderCode(evidence.sourceActor)}, occurred ${renderCode(evidence.occurredAt)}, observed ${renderCode(evidence.observedAt)}`;
        if (evidence.derivedFromEvidenceIds.length)
            text += `, derived from ${evidence.derivedFromEvidenceIds.map(renderCode).join(", ")}`;
        text += "\n";
    }
    return text;
}

function renderCode(value: string) {
    return `<code>${renderCanonicalString(value, "inline")}</code>`;
}

/** The only boundary through which canonical strings enter a Markdown artifact. */
function renderCanonicalString(value: string, context: "metadata" | "inline" | "block") {
    const escaped = value.replace(/[&<>`*_{}[\]()#+!|\\\r\n]/gu, (character) => `&#${character.codePointAt(0)};`);
    if (context !== "block") return escaped;
    return escaped
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n");
}

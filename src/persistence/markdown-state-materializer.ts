import { mkdir, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import type { MaterializedMeaning, StateMaterialization } from "../core/state-materialization.ts";

import { ValidationError } from "../core/errors.ts";
import { replaceFileAtomically } from "./file-replacement.ts";

const VIEW_TITLES: Record<keyof StateMaterialization["views"], string> = {
    "SELF.md": "Self understanding",
    "USER.md": "User understanding",
    "RELATIONSHIP.md": "Relationship",
    "MEMORY.md": "Durable memory overview",
};

export function renderMarkdownStateViews(materialization: StateMaterialization) {
    return Object.fromEntries(
        Object.entries(materialization.views).map(([name, meanings]) => [
            name,
            renderView(VIEW_TITLES[name as keyof StateMaterialization["views"]], meanings, materialization),
        ]),
    ) as Record<keyof StateMaterialization["views"], string>;
}

export async function publishMarkdownStateViews(
    outputDirectory: string,
    canonicalStatePath: string,
    materialization: StateMaterialization,
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
    for (const target of targets) {
        await replaceFileAtomically(target.path, rendered[target.name], { mode: 0o600 });
    }
    return targets.map((target) => target.path);
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

function renderView(title: string, meanings: MaterializedMeaning[], source: StateMaterialization) {
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
        `interaction-mode: ${source.interactionMode}`,
        "-->",
    ].join("\n");
    let markdown = `${metadata}\n\n# ${title}\n\n`;
    markdown += "Generated-only inspection view. Editing this file does not change canonical Ember state.\n";
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

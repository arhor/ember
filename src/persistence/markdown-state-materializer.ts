import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import type { MaterializedMeaning, StateMaterialization } from "../core/state-materialization.ts";

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

export async function publishMarkdownStateViews(outputDirectory: string, materialization: StateMaterialization) {
    await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
    const rendered = renderMarkdownStateViews(materialization);
    for (const name of Object.keys(rendered).sort() as Array<keyof typeof rendered>) {
        await replaceFileAtomically(join(outputDirectory, name), rendered[name], { mode: 0o600 });
    }
    return Object.keys(rendered)
        .sort()
        .map((name) => join(outputDirectory, name));
}

function renderView(title: string, meanings: MaterializedMeaning[], source: StateMaterialization) {
    const metadata = [
        "<!-- ember-state-materialization",
        `representation-version: ${source.materializationVersion}`,
        `source-schema-version: ${source.sourceSchemaVersion}`,
        `source-revision: ${source.sourceRevision}`,
        `lineage-id: ${source.lineageId}`,
        `purpose: ${source.purpose}`,
        `principal: ${source.disclosurePolicy.principal}`,
        `scope: ${source.disclosurePolicy.scope}`,
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
        meaning.supersedes && `supersedes \`${meaning.supersedes}\``,
        meaning.supersededBy && `superseded by \`${meaning.supersededBy}\``,
    ].filter(Boolean);
    let text = `\n## Meaning \`${meaning.meaningId}\`\n\n`;
    text += `${indent(meaning.content)}\n\n`;
    text += `- Kind: \`${meaning.kind}\`\n- Owner: \`${meaning.owner}\`\n- Slot: \`${meaning.slot}\`\n`;
    text += `- Scope: \`${meaning.scope}\`\n- Currentness: \`${meaning.currentness}\`\n`;
    text += `- Lifecycle: \`${meaning.prospectiveLifecycle}\`\n- Epistemic role: \`${meaning.epistemicRole}\`\n`;
    text += `- Learned at: \`${meaning.learnedAt}\`\n- Applicable: \`${meaning.applicableFrom}\` to \`${meaning.applicableUntil ?? "open"}\`\n`;
    text += `- Uncertainty: ${meaning.uncertainty === null ? "none recorded" : indentInline(meaning.uncertainty)}\n`;
    text += `- Lineage: ${relation.length ? relation.join("; ") : "none"}\n- Source evidence:\n`;
    for (const evidence of meaning.sourceEvidence) {
        text += `  - \`${evidence.evidenceId}\`: role \`${evidence.sourceRole}\`, actor \`${evidence.sourceActor}\`, occurred \`${evidence.occurredAt}\`, observed \`${evidence.observedAt}\``;
        if (evidence.derivedFromEvidenceIds.length)
            text += `, derived from ${evidence.derivedFromEvidenceIds.map((id) => `\`${id}\``).join(", ")}`;
        text += "\n";
    }
    return text;
}

function indent(value: string) {
    return value
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n");
}

function indentInline(value: string) {
    return value.replaceAll("\n", " ");
}

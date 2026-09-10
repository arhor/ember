import assert from "node:assert/strict";
import test from "node:test";

import { validateConversationContextDocument } from "../src/core/conversation-context.ts";

test("conversation sidecar rejects an active trajectory whose id belongs to another owner", () => {
    assert.throws(
        () =>
            validateConversationContextDocument({
                conversation_context_version: 2,
                active_trajectories: [
                    {
                        conversation_id: "conversation-owner-conflict",
                        principal: "max",
                        scope: "scope-a",
                        started_at: "2026-09-09T12:02:00Z",
                    },
                ],
                exchanges: [
                    {
                        conversation_id: "conversation-owner-conflict",
                        cognition_id: "cognition-owner-conflict",
                        principal: "max",
                        scope: "scope-b",
                        surface: "local_cli",
                        input_evidence_id: "evidence-owner-conflict",
                        started_at: "2026-09-09T12:02:00Z",
                        expression_evidence_id: null,
                        expression_occurred_at: null,
                        expression_content: null,
                        expression_content_truncated: null,
                    },
                ],
            }),
        /active trajectory conversation-owner-conflict crosses principal or scope boundary/,
    );
});

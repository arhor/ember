import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { command, PRINCIPAL, PROVIDER, RELATIONSHIP_SCOPE, SCOPE, tempDir } from "../../tests/support.ts";

test("minimal continuity slice should preserve truthful meaning when complete process restarts",async()=>{
  // Given
  const directory=await tempDir();
  const statePath=join(directory,"ember.json");
  const capturePath=join(directory,"last-request.json");
  const counterPath=join(directory,"provider-count.txt");
  const init=await command([
    "init","--state",statePath,"--name","Ember","--principal",PRINCIPAL,
  ],{now:"2026-08-29T08:00:00Z"});
  const providerArgs=[
    "--provider-command",process.execPath,
    "--provider-arg",PROVIDER,
    "--provider-arg","--capture",
    "--provider-arg",capturePath,
    "--provider-arg","--counter",
    "--provider-arg",counterPath,
    "--provider-timeout-seconds","2",
  ];
  const runArgs=[
    "run","--state",statePath,"--principal",PRINCIPAL,"--scope",SCOPE,...providerArgs,
  ];
  const first=await command(runArgs,{
    stdin:[
      `:remember relationship relationship:${PRINCIPAL} ${RELATIONSHIP_SCOPE} Ember and user-1 are continuing collaborators`,
      `:remember fact user:${PRINCIPAL} home-server ${RELATIONSHIP_SCOPE} The home server is a Raspberry Pi 5`,
      `:prefer user:${PRINCIPAL} docs-rationale-detail ${SCOPE} Prefer concise architectural rationale`,
      `:undertake restart-provenance-check ${SCOPE} Check whether restart reconstruction preserves provenance without transcript replay`,
      `:remember episode first-continuity-experiment relationship:${PRINCIPAL} ${RELATIONSHIP_SCOPE} The first continuity experiment received a nickname`,
      "Initial provider expression before the complete stop",
      ":quit",
      "",
    ].join("\n"),
    now:"2026-08-29T09:00:00Z",
  });
  const firstView=JSON.parse((await command([
    "inspect","--state",statePath,"--principal",PRINCIPAL,"--json",
  ])).stdout);
  const lineageId=firstView.lineage.lineage_id;
  const factId=firstView.current_meanings.find(m=>m.kind==="fact"&&m.slot==="home-server").meaning_id;
  const preferenceA=firstView.current_meanings.find(m=>m.kind==="preference"&&m.slot==="docs-rationale-detail").meaning_id;
  const episodeId=firstView.current_meanings.find(m=>m.kind==="episode_meta").meaning_id;
  const attach=await command(runArgs,{
    stdin:`:attach-detail ${episodeId} Cinder\n:quit\n`,
    now:"2026-08-29T10:00:00Z",
  });
  const afterAttach=JSON.parse(await readFile(statePath,"utf8"));
  const detailId=afterAttach.evidence.find(
    evidence=>evidence.related_meaning_id===episodeId&&evidence.source_role==="user_command",
  ).evidence_id;
  const replace=await command(runArgs,{
    stdin:`:supersede ${preferenceA} Prefer detailed architectural rationale\n:quit\n`,
    now:"2026-08-29T11:00:00Z",
  });
  const withhold=await command(runArgs,{
    stdin:`:fixture-withhold ${detailId}\n:quit\n`,
    now:"2026-08-29T12:00:00Z",
    fixtureFaults:true,
  });
  // When
  const restarted=await command(runArgs,{
    stdin:`:ask --explain ${factId},${preferenceA},${episodeId} Continue from durable state and explain the unavailable nickname\n:quit\n`,
    now:"2026-08-30T12:00:00Z",
  });
  const finalView=JSON.parse((await command([
    "inspect","--state",statePath,"--principal",PRINCIPAL,"--json",
  ])).stdout);
  const canonicalText=await readFile(statePath,"utf8");
  const request=JSON.parse(await readFile(capturePath,"utf8"));
  const current=Object.fromEntries(finalView.current_meanings.map(meaning=>[meaning.slot,meaning]));
  const historical=Object.fromEntries(finalView.historical_meanings.map(meaning=>[meaning.meaning_id,meaning]));
  const projected=Object.fromEntries(request.projection.meanings.map(meaning=>[meaning.meaning_id,meaning]));
  const relationship=request.projection.meanings.find(meaning=>meaning.kind==="relationship");
  const commitment=request.projection.meanings.find(meaning=>meaning.kind==="commitment");
  const fact=projected[factId];
  const finalRuntime=finalView.runtime_episodes.at(-1);
  const finalCognition=finalView.cognition_episodes.at(-1);
  // Then
  assert.deepEqual([
    [init.code,first.code,attach.code,replace.code,withhold.code,restarted.code],
    await readFile(counterPath,"utf8"),
    current["docs-rationale-detail"].content,
    historical[preferenceA].currentness,
    fact.epistemic_role,
    current["restart-provenance-check"].prospective_lifecycle,
    finalRuntime.recovery_account.gap_kind,
    finalRuntime.recovery_account.ember_cognition_during_interval,
    request.projection.gaps[0].gap_kind,
    request.projection.selection.raw_transcript_included,
    projected[preferenceA].currentness,
    projected[current["docs-rationale-detail"].meaning_id].currentness,
    finalCognition.delivery_status,
    lineageId===finalView.lineage.lineage_id&&lineageId===request.projection.lineage.lineage_id,
    request.projection.lineage.constitutive_boundaries.length,
    relationship.owner,
    fact.owner,
    fact.scope,
    fact.source_evidence[0].source_actor,
    commitment.applicability,
    new Set(commitment.source_evidence.map(evidence=>evidence.source_role)),
    canonicalText.includes("Cinder"),
    canonicalText.includes("CONTINUITY_RESPONSE"),
    [
      "CONTINUITY_RESPONSE",
      `lineage:${lineageId}`,
      "relationship:Ember and user-1 are continuing collaborators",
      "fact:The home server is a Raspberry Pi 5",
      "fact_epistemic_role:user_testimony",
      "fact_source_actor:user:user-1",
      "preference:Prefer detailed architectural rationale",
      "commitment:Check whether restart reconstruction preserves provenance without transcript replay",
      "commitment_applicability:last_known_live_needs_currentness_check",
      "gap:unavailable_detail",
      "nickname:unavailable",
      "downtime:none_in_supported_runtime",
    ].every(fragment=>restarted.stdout.includes(fragment))&&
      !restarted.stdout.includes("Prefer concise architectural rationale")&&
      !restarted.stdout.includes("Cinder"),
  ],[
    [0,0,0,0,0,0],
    "2",
    "Prefer detailed architectural rationale",
    "superseded",
    "user_testimony",
    "live",
    "known_clean_stop_interval",
    "none_in_supported_runtime",
    "unavailable_detail",
    false,
    "superseded",
    "current",
    "displayed",
    true,
    1,
    "relationship:user-1",
    "user:user-1",
    "relationship:user-1",
    "user:user-1",
    "last_known_live_needs_currentness_check",
    new Set(["ember_adoption","user_command"]),
    false,
    false,
    true,
  ]);
});

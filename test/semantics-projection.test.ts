import test from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "../src/ember/errors.ts";
import { cloneState, newId, validateState } from "../src/ember/model.ts";
import { buildProjection, inspectionView } from "../src/ember/projection.ts";
import { startRuntime, stopRuntime } from "../src/ember/runtime.ts";
import { findMeaning, supersede, userEvidence, withholdDetail } from "../src/ember/semantics.ts";
import { captureError, populatedState, PRINCIPAL, SCOPE } from "./support.ts";

test("commitment should preserve user request and Ember adoption when created",()=>{
  // Given
  const {state,ids}=populatedState(),commitment=findMeaning(state,ids.commitment);
  // When
  const adoption=state.evidence.find(e=>commitment.source_evidence_ids.includes(e.evidence_id)),request=state.evidence.find(e=>e.evidence_id===adoption.derived_from_evidence_ids[0]);
  // Then
  assert.deepEqual([adoption.source_role,request.source_role,commitment.owner],["ember_adoption","user_command","ember"]);
});
test("supersession should keep A historical and make B current when slot matches exactly",()=>{
  // Given
  const {state,ids}=populatedState(),original=cloneState(findMeaning(state,ids.preference));
  // When
  const nextId=supersede(state,PRINCIPAL,ids.preference,"Prefer detailed architectural rationale"),next=findMeaning(state,nextId),changed=findMeaning(state,ids.preference);
  // Then
  assert.deepEqual([changed.currentness,changed.superseded_by,next.currentness,changed.content,changed.source_evidence_ids,changed.applicable_until],["superseded",nextId,"current",original.content,original.source_evidence_ids,original.applicable_until]);
});
test("supersession should refuse change when meaning kind is not correctable",async()=>{
  // Given
  const {state,ids}=populatedState();
  // When
  const error=await captureError(()=>supersede(state,PRINCIPAL,ids.relationship,"Different relationship"));
  // Then
  assert.ok(error instanceof ValidationError);
});
test("optional detail should leave typed gap when payload is withheld",()=>{
  // Given
  const {state,ids}=populatedState(),before=JSON.stringify(state);
  // When
  withholdDetail(state,PRINCIPAL,ids.detail);const after=JSON.stringify(state),view=inspectionView(state);
  // Then
  assert.deepEqual([(before.match(/Cinder/g)??[]).length,(after.match(/Cinder/g)??[]).length,view.gaps[0].meaning_id],[1,0,ids.episode]);
});
test("optional detail should reject deletion label when fault reason claims deletion",async()=>{
  // Given
  const {state,ids}=populatedState();
  // When
  const error=await captureError(()=>withholdDetail(state,PRINCIPAL,ids.detail,{reason:"privacy deletion"}));
  // Then
  assert.match(error.message,/unsupported/);
});
test("recovery should report clean interval when prior runtime stopped explicitly",()=>{
  // Given
  const {state}=populatedState(),first=startRuntime(state,PRINCIPAL,SCOPE,{timestamp:"2026-08-29T10:00:00Z"}),stopped=stopRuntime(first.state,first.runtimeId,{reason:"explicit_cli_exit",timestamp:"2026-08-29T11:00:00Z"});
  // When
  const restarted=startRuntime(stopped,PRINCIPAL,SCOPE,{timestamp:"2026-08-30T11:00:00Z"}),recovery=restarted.state.operations.runtime_episodes.at(-1).recovery_account;
  // Then
  assert.deepEqual([recovery.gap_kind,recovery.ember_cognition_during_interval,recovery.external_changes_during_interval],["known_clean_stop_interval","none_in_supported_runtime","unknown"]);
});
test("recovery should preserve uncertainty when prior runtime has no clean stop",()=>{
  // Given
  const {state}=populatedState(),open=startRuntime(state,PRINCIPAL,SCOPE,{timestamp:"2026-08-29T10:00:00Z"});
  // When
  const restarted=startRuntime(open.state,PRINCIPAL,SCOPE,{timestamp:"2026-08-30T11:00:00Z"}),recovery=restarted.state.operations.runtime_episodes.at(-1).recovery_account;
  // Then
  assert.deepEqual([recovery.gap_kind,recovery.ember_cognition_during_interval],["uncertain_interruption_boundary","unknown_after_last_durable_observation"]);
});
test("recovery should follow explicit runtime links when storage list is reordered",()=>{
  // Given
  const {state}=populatedState(),first=startRuntime(state,PRINCIPAL,SCOPE,{timestamp:"2026-08-29T10:00:00Z"}),stopped=stopRuntime(first.state,first.runtimeId,{reason:"explicit_cli_exit",timestamp:"2026-08-29T11:00:00Z"}),second=startRuntime(stopped,PRINCIPAL,SCOPE,{timestamp:"2026-08-30T11:00:00Z"});second.state.operations.runtime_episodes.reverse();
  // When
  const third=startRuntime(second.state,PRINCIPAL,SCOPE,{timestamp:"2026-08-31T11:00:00Z"}),recovery=third.state.operations.runtime_episodes.find(r=>r.runtime_id===third.runtimeId).recovery_account;
  // Then
  assert.deepEqual([recovery.previous_runtime,recovery.gap_kind],[second.runtimeId,"uncertain_interruption_boundary"]);
});
test("state validator should reject recovery when clean gap claims continuous cognition",async()=>{
  // Given
  const {state}=populatedState(),first=startRuntime(state,PRINCIPAL,SCOPE,{timestamp:"2026-08-29T10:00:00Z"}),stopped=stopRuntime(first.state,first.runtimeId,{reason:"explicit_cli_exit",timestamp:"2026-08-29T11:00:00Z"}),restarted=startRuntime(stopped,PRINCIPAL,SCOPE,{timestamp:"2026-08-30T11:00:00Z"});restarted.state.operations.runtime_episodes.at(-1).recovery_account.ember_cognition_during_interval="continuous";
  // When
  const error=await captureError(()=>validateState(restarted.state));
  // Then
  assert.match(error.message,/overstates or contradicts/);
});
test("recovery should mark started cognition unknown when prior runtime ended abruptly",()=>{
  // Given
  const {state}=populatedState(),open=startRuntime(state,PRINCIPAL,SCOPE,{timestamp:"2026-08-29T10:00:00Z"}),input=userEvidence(open.state,PRINCIPAL,SCOPE,"input",{timestamp:"2026-08-29T10:01:00Z"}),cognitionId=newId("cognition");open.state.operations.runtime_episodes[0].last_durable_observation_at="2026-08-29T10:01:00Z";open.state.operations.cognition_episodes.push({cognition_id:cognitionId,runtime_id:open.runtimeId,principal:PRINCIPAL,active_scope:SCOPE,provider_label:"provider",purpose:"ordinary",started_at:"2026-08-29T10:01:00Z",last_durable_observation_at:"2026-08-29T10:01:00Z",status:"started",selected_meaning_ids:[],selected_evidence_ids:[],used_meaning_ids:[],input_evidence_id:input.evidence_id,expression_evidence_id:null,delivery_status:"not_attempted"});validateState(open.state);
  // When
  const recovered=startRuntime(open.state,PRINCIPAL,SCOPE,{timestamp:"2026-08-30T11:00:00Z"}),cognition=recovered.state.operations.cognition_episodes.find(c=>c.cognition_id===cognitionId);
  // Then
  assert.deepEqual([cognition.status,recovered.state.operations.runtime_episodes.at(-1).recovery_account.gap_kind],["outcome_unknown","uncertain_interruption_boundary"]);
});
test("state validator should reject clean gap when restart clock precedes stop",async()=>{
  // Given
  const {state}=populatedState(),first=startRuntime(state,PRINCIPAL,SCOPE,{timestamp:"2026-08-29T12:00:00Z"}),stopped=stopRuntime(first.state,first.runtimeId,{reason:"explicit_cli_exit",timestamp:"2026-08-29T13:00:00Z"});
  // When
  const error=await captureError(()=>startRuntime(stopped,PRINCIPAL,SCOPE,{timestamp:"2026-08-29T11:00:00Z"}));
  // Then
  assert.match(error.message,/restart precedes/);
});
test("ordinary projection should include current B and exclude historical A when scope matches",()=>{
  // Given
  const {state,ids}=populatedState(),replacement=supersede(state,PRINCIPAL,ids.preference,"Prefer detailed architectural rationale"),started=startRuntime(state,PRINCIPAL,SCOPE,{timestamp:"2026-08-30T11:00:00Z"});
  // When
  const projection=buildProjection(started.state,{principal:PRINCIPAL,scope:SCOPE,currentInput:"Continue",currentTime:"2026-08-30T11:00:01Z",runtimeId:started.runtimeId}),selected=projection.selection.meaning_ids;
  // Then
  assert.deepEqual([selected.includes(replacement),selected.includes(ids.preference),selected.includes(ids.fact)],[true,false,false]);
});
test("explain projection should label history provenance commitment and gap when IDs are requested",()=>{
  // Given
  const {state,ids}=populatedState(),replacement=supersede(state,PRINCIPAL,ids.preference,"Prefer detailed architectural rationale");withholdDetail(state,PRINCIPAL,ids.detail);const first=startRuntime(state,PRINCIPAL,SCOPE,{timestamp:"2026-08-29T10:00:00Z"}),stopped=stopRuntime(first.state,first.runtimeId,{reason:"explicit_cli_exit",timestamp:"2026-08-29T11:00:00Z"}),restarted=startRuntime(stopped,PRINCIPAL,SCOPE,{timestamp:"2026-08-30T11:00:00Z"});
  // When
  const projection=buildProjection(restarted.state,{principal:PRINCIPAL,scope:SCOPE,currentInput:"Explain",currentTime:"2026-08-30T11:00:01Z",runtimeId:restarted.runtimeId,purpose:"explain",explainIds:[ids.fact,ids.preference,ids.episode]}),byId=Object.fromEntries(projection.meanings.map(m=>[m.meaning_id,m]));
  // Then
  assert.deepEqual([byId[ids.fact].epistemic_role,byId[ids.preference].currentness,byId[replacement].currentness,byId[ids.commitment].applicability,projection.gaps[0].gap_kind,projection.selection.raw_transcript_included],["user_testimony","superseded","current","last_known_live_needs_currentness_check","unavailable_detail",false]);
});

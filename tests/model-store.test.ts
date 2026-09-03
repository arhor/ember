import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ConcurrentWriter, DurabilityUncertain, StaleRevision, StoreExists, StoreUnavailable, ValidationError } from "../src/core/errors.ts";
import { cloneState, initialState, newId, validateState } from "../src/core/model.ts";
import { startRuntime } from "../src/runtime/runtime.ts";
import { userEvidence } from "../src/core/semantics.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { captureError, populatedState, PRINCIPAL, SCOPE, tempDir } from "./support.ts";

test("state validator should accept state when schema and invariants are complete",()=>{
  // Given
  const {state}=populatedState();
  // When
  validateState(state);
  // Then
  assert.equal(state.schema_version,1);
});
test("state validator should reject state when two current meanings share exact slot",async()=>{
  // Given
  const {state,ids}=populatedState(),duplicate=cloneState(state.meanings.find(m=>m.meaning_id===ids.preference));duplicate.meaning_id+="-duplicate";state.meanings.push(duplicate);
  // When
  const error=await captureError(()=>validateState(state));
  // Then
  assert.match(error.message,/duplicate current meaning/);
});
test("state validator should reject state when evidence reference is absent",async()=>{
  // Given
  const {state,ids}=populatedState();state.meanings.find(m=>m.meaning_id===ids.fact).source_evidence_ids=["evidence-absent"];
  // When
  const error=await captureError(()=>validateState(state));
  // Then
  assert.match(error.message,/cites absent evidence/);
});
test("state validator should reject state when unavailable evidence leaks payload",async()=>{
  // Given
  const {state,ids}=populatedState(),e=state.evidence.find(e=>e.evidence_id===ids.detail);e.availability="unavailable";e.unavailable_reason="fixture detail payload unavailable";
  // When
  const error=await captureError(()=>validateState(state));
  // Then
  assert.match(error.message,/leaks unavailable payload/);
});
test("state validator should reject state when governing fact evidence becomes unavailable",async()=>{
  // Given
  const {state,ids}=populatedState(),m=state.meanings.find(m=>m.meaning_id===ids.fact),e=state.evidence.find(e=>e.evidence_id===m.source_evidence_ids[0]);e.availability="unavailable";e.unavailable_reason="source unavailable";delete e.payload;delete e.content_digest;
  // When
  const error=await captureError(()=>validateState(state));
  // Then
  assert.match(error.message,/governing evidence cannot degrade locally/);
});
test("state validator should reject state when unattached evidence claims unavailability",async()=>{
  // Given
  const {state}=populatedState(),e=state.evidence.find(e=>e.source_role==="user_command");e.availability="unavailable";e.unavailable_reason="source unavailable";delete e.payload;delete e.content_digest;
  // When
  const error=await captureError(()=>validateState(state));
  // Then
  assert.match(error.message,/must relate to episode_meta/);
});
test("state validator should reject state when supersession crosses scope",async()=>{
  // Given
  const {state,ids}=populatedState(),old=state.meanings.find(m=>m.meaning_id===ids.preference),later=cloneState(old);later.meaning_id+="-later";later.scope="project:other";later.supersedes=old.meaning_id;old.currentness="superseded";old.superseded_by=later.meaning_id;state.meanings.push(later);
  // When
  const error=await captureError(()=>validateState(state));
  // Then
  assert.match(error.message,/crosses kind, owner, slot, or scope/);
});
test("state validator should reject state when principal binding is changed",async()=>{
  // Given
  const {state}=populatedState();state.runtime_contract.local_principal="intruder";
  // When
  const error=await captureError(()=>validateState(state));
  // Then
  assert.match(error.message,/principal/);
});
test("state validator should reject state when constitutive boundary becomes meaning",async()=>{
  // Given
  const {state,ids}=populatedState();state.meanings.find(m=>m.meaning_id===ids.fact).kind="constitutive";
  // When
  const error=await captureError(()=>validateState(state));
  // Then
  assert.match(error.message,/kind is unsupported/);
});
test("state validator should reject state when boolean impersonates integer version",async()=>{
  // Given
  const {state}=populatedState();state.schema_version=true;state.revision=true;
  // When
  const error=await captureError(()=>validateState(state));
  // Then
  assert.match(error.message,/unsupported schema_version/);
});
test("state validator should reject state when unsafe integer impersonates revision",async()=>{
  // Given
  const {state}=populatedState();state.revision=Number.MAX_SAFE_INTEGER+1;
  // When
  const error=await captureError(()=>validateState(state));
  // Then
  assert.match(error.message,/safe integer/);
});
test("state validator should reject state when adoption retains payload",async()=>{
  // Given
  const {state}=populatedState(),e=state.evidence.find(e=>e.source_role==="ember_adoption");Object.assign(e,{payload_mode:"retained_optional",availability:"available",payload:"duplicated",content_digest:"sha256:wrong"});
  // When
  const error=await captureError(()=>validateState(state));
  // Then
  assert.match(error.message,/adoption must be descriptor-only/);
});
test("state validator should reject state when current meaning has past applicability end",async()=>{
  // Given
  const {state,ids}=populatedState();state.meanings.find(m=>m.meaning_id===ids.fact).applicable_until="2026-08-28T10:00:00Z";
  // When
  const error=await captureError(()=>validateState(state));
  // Then
  assert.match(error.message,/applicability interval cannot be rewritten/);
});
test("state validator should reject timestamp when calendar date does not exist",async()=>{
  // Given
  const {state}=populatedState();state.lineage.established_at="2026-02-31T10:00:00Z";
  // When
  const error=await captureError(()=>validateState(state));
  // Then
  assert.match(error.message,/RFC 3339 UTC/);
});
test("state validator should reject state when commitment claims discharge without occurrence",async()=>{
  // Given
  const {state,ids}=populatedState(),m=state.meanings.find(m=>m.meaning_id===ids.commitment);m.currentness="historical";m.prospective_lifecycle="fulfilled";
  // When
  const error=await captureError(()=>validateState(state));
  // Then
  assert.match(error.message,/discharged commitment needs/);
});
test("state validator should return typed failure when nested JSON shapes are malformed",async()=>{
  // Given
  const {state,ids}=populatedState(),variants=[];for(const value of [null,[["nested"]]]){const c=cloneState(state);c.meanings.find(m=>m.meaning_id===ids.fact).source_evidence_ids=value;variants.push(c);}const derived=cloneState(state);derived.evidence[0].derived_from_evidence_ids=null;variants.push(derived);for(const value of ["not-an-object",7,[],{}]){const c=cloneState(state);if(value==="not-an-object")c.operations.runtime_episodes=[value];else if(value===7)c.operations.cognition_episodes=[value];else if(Array.isArray(value))c.meanings[0].currentness=value;else c.evidence[0].payload_mode=value;variants.push(c);}
  // When
  const errors=await Promise.all(variants.map(v=>captureError(()=>validateState(v))));
  // Then
  assert.ok(errors.every(error=>error instanceof ValidationError));
});
test("state store should round trip complete document when commit succeeds",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json"),store=new StateStore(path),state=initialState("Ember",PRINCIPAL,"2026-08-29T10:00:00Z");await store.create(state);const lease=await store.acquireWriteLease();
  // When
  const committed=await store.commit(0,cloneState(state));await store.releaseWriteLease(lease);const loaded=await store.load();
  // Then
  assert.deepEqual([loaded.revision,loaded],[1,committed]);
});
test("state store should reject stale candidate when revision changed",async()=>{
  // Given
  const directory=await tempDir(),store=new StateStore(join(directory,"ember.json")),state=initialState("Ember",PRINCIPAL,"2026-08-29T10:00:00Z");await store.create(state);const lease=await store.acquireWriteLease();await store.commit(0,cloneState(state));
  // When
  const error=await captureError(()=>store.commit(0,cloneState(state)));await store.releaseWriteLease(lease);
  // Then
  assert.ok(error instanceof StaleRevision);
});
test("state store should refuse overwrite when lineage already exists",async()=>{
  // Given
  const directory=await tempDir(),store=new StateStore(join(directory,"ember.json")),state=initialState("Ember",PRINCIPAL,"2026-08-29T10:00:00Z");await store.create(state);
  // When
  const error=await captureError(()=>store.create(state));
  // Then
  assert.ok(error instanceof StoreExists);
});
test("state store should ignore orphan temporary file when canonical document is complete",async()=>{
  // Given
  const directory=await tempDir(),store=new StateStore(join(directory,"ember.json")),state=initialState("Ember",PRINCIPAL,"2026-08-29T10:00:00Z");await store.create(state);await writeFile(join(directory,".ember.json.interrupted.tmp"),"{");
  // When
  const loaded=await store.load();
  // Then
  assert.deepEqual(loaded,state);
});
test("state store should report uncertain durability when directory sync fails after replace",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json"),state=initialState("Ember",PRINCIPAL,"2026-08-29T10:00:00Z"),store=new StateStore(path);await store.create(state);store.directorySync=async()=>{throw new Error("sync");};const lease=await store.acquireWriteLease();
  // When
  const error=await captureError(()=>store.commit(0,cloneState(state)));const exposed=await store.load();await store.releaseWriteLease(lease);
  // Then
  assert.deepEqual([error.constructor,exposed.revision],[DurabilityUncertain,1]);
});
test("state store should fail closed when canonical JSON is partial",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(path,'{"schema_version":1');
  // When
  const error=await captureError(()=>new StateStore(path).load());
  // Then
  assert.ok(error instanceof StoreUnavailable);
});
test("state store should report unavailable when canonical file is invalid UTF-8",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(path,Buffer.from([0xff,0xfe]));
  // When
  const error=await captureError(()=>new StateStore(path).load());
  // Then
  assert.match(error.message,/not valid UTF-8/);
});
test("write lease should refuse second writer when live PID owns lock",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json"),first=new StateStore(path),second=new StateStore(path);const lease=await first.acquireWriteLease();
  // When
  const error=await captureError(()=>second.acquireWriteLease());await first.releaseWriteLease(lease);
  // Then
  assert.equal(error.diagnosis.status,"live");
});
test("write lease should fail closed without probing when lock PID is unsafe",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json"),calls=[];await writeFile(`${path}.lock`,JSON.stringify({lock_version:1,owner_token:"t",pid:0,hostname:"h",acquired_at:"2026-08-29T10:00:00Z"}));const store=new StateStore(path,{hostname:"h",kill:(...args)=>calls.push(args)});
  // When
  const status=await store.lockStatus();
  // Then
  assert.deepEqual([status.status,calls.length],["malformed",0]);
});
test("write lease should classify metadata malformed when acquired timestamp is calendar-invalid",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(`${path}.lock`,JSON.stringify({lock_version:1,owner_token:"t",pid:123,hostname:"h",acquired_at:"2026-02-31T10:00:00Z"}));const store=new StateStore(path,{hostname:"h"});
  // When
  const status=await store.lockStatus();
  // Then
  assert.equal(status.status,"malformed");
});
test("write lease should diagnose absent PID when same-host process no longer exists",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(`${path}.lock`,JSON.stringify({lock_version:1,owner_token:"t",pid:123,hostname:"h",acquired_at:"2026-08-29T10:00:00Z"}));const store=new StateStore(path,{hostname:"h",kill:()=>{const e=new Error();e.code="ESRCH";throw e;}});
  // When
  const status=await store.lockStatus();
  // Then
  assert.equal(status.status,"apparently_stale");
});
test("write lease should keep lock indeterminate when PID probe lacks permission",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(`${path}.lock`,JSON.stringify({lock_version:1,owner_token:"t",pid:123,hostname:"h",acquired_at:"2026-08-29T10:00:00Z"}));const store=new StateStore(path,{hostname:"h",kill:()=>{const e=new Error();e.code="EPERM";throw e;}});
  // When
  const status=await store.lockStatus();
  // Then
  assert.equal(status.status,"permission_denied");
});
test("write lease should keep foreign-host lock indeterminate when hostname differs",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(`${path}.lock`,JSON.stringify({lock_version:1,owner_token:"t",pid:123,hostname:"elsewhere",acquired_at:"2026-08-29T10:00:00Z"}));const store=new StateStore(path,{hostname:"here",kill:()=>{throw new Error("must not probe");}});
  // When
  const status=await store.lockStatus();
  // Then
  assert.equal(status.status,"foreign_host");
});
test("write lease should preserve lock when owner token changes before release",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json"),store=new StateStore(path),lease=await store.acquireWriteLease();await writeFile(`${path}.lock`,JSON.stringify({...lease.metadata,owner_token:"different"}));
  // When
  const error=await captureError(()=>store.releaseWriteLease(lease));
  // Then
  assert.ok(error instanceof ConcurrentWriter);
});
test("stale lock quarantine should rename artifact when token and quiescence are confirmed",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json"),metadata={lock_version:1,owner_token:"expected",pid:123,hostname:"h",acquired_at:"2026-08-29T10:00:00Z"};await writeFile(`${path}.lock`,JSON.stringify(metadata));const store=new StateStore(path,{hostname:"h",kill:()=>{const e=new Error();e.code="ESRCH";throw e;}});
  // When
  const quarantined=await store.quarantineStaleLock({ownerToken:"expected",confirmQuiescent:true});
  // Then
  await assert.doesNotReject(()=>access(quarantined));
});
test("stale lock quarantine should refuse mutation when quiescence is not confirmed",async()=>{
  // Given
  const directory=await tempDir(),store=new StateStore(join(directory,"ember.json"));
  // When
  const error=await captureError(()=>store.quarantineStaleLock({ownerToken:"expected",confirmQuiescent:false}));
  // Then
  assert.ok(error instanceof ConcurrentWriter);
});
test("stale lock quarantine should preserve availability failure when PID is reused",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(`${path}.lock`,JSON.stringify({lock_version:1,owner_token:"expected",pid:123,hostname:"h",acquired_at:"2026-08-29T10:00:00Z"}));const store=new StateStore(path,{hostname:"h",kill:()=>{}});
  // When
  const error=await captureError(()=>store.quarantineStaleLock({ownerToken:"expected",confirmQuiescent:true}));
  // Then
  assert.equal(error.diagnosis.status,"live");
});
test("write lease should fail closed when lock metadata is malformed",async()=>{
  // Given
  const directory=await tempDir(),path=join(directory,"ember.json");await writeFile(`${path}.lock`,"{");const store=new StateStore(path);
  // When
  const error=await captureError(()=>store.acquireWriteLease());
  // Then
  assert.equal(error.diagnosis.status,"malformed");
});
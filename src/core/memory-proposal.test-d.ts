import { expectAssignable, expectNotAssignable } from "tsd";

import type { AdoptedMemoryProposal, ProposedMemoryProposal, RejectedMemoryProposal } from "./memory-proposal.ts";

declare const proposed: ProposedMemoryProposal;
declare const adopted: AdoptedMemoryProposal;
declare const rejected: RejectedMemoryProposal;

expectAssignable<ProposedMemoryProposal>(proposed);
expectNotAssignable<ProposedMemoryProposal>(adopted);
expectNotAssignable<ProposedMemoryProposal>(rejected);

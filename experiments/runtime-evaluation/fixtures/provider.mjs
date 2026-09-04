import { stdin, stdout } from "node:process";

let wire = "";
stdin.setEncoding("utf8");
for await (const chunk of stdin) wire += chunk;
const request = JSON.parse(wire);
if (request.input.text === "hang") {
    setInterval(() => {}, 1_000);
} else {
    stdout.write(
        JSON.stringify({
            contract_version: 1,
            reply: `lineage=${request.projection.lineage.lineage_id}`,
            used_meaning_ids: request.projection.selection.meaning_ids.slice(0, 2),
        }),
    );
}

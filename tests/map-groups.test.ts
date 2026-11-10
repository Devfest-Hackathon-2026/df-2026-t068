import { test } from "node:test";
import assert from "node:assert/strict";
import { connectionGroups } from "../src/lib/map-groups.ts";
import type { MapAnalysis } from "../src/lib/analysis-data.ts";

function example(links: [string, string][]): MapAnalysis {
  return {
    configVersion: "test", factors: [{ id: "target", name: "ターゲット" }],
    values: ["a", "b", "c"].map(id => ({ id, ideaId: id, factorId: "target", label: "大学生", inferred: false })),
    pairs: links.map(([source, target]) => ({ source, target, factorId: "target", score: 0.9 })),
    labels: links.map(([source, target], i) => ({ id: `l${i}`, label: "大学生", factorId: "target", memberIds: [source, target] })),
  };
}
test("complete pair relationships are displayed by one common node", () => {
  const groups = connectionGroups(example([["a", "b"], ["b", "c"], ["a", "c"]]), "target");
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].memberIds, ["a", "b", "c"]);
});
test("an A-B-C similarity chain never implies an unverified A-C relation", () => {
  const groups = connectionGroups(example([["a", "b"], ["b", "c"]]), "target");
  assert.equal(groups.length, 2);
  assert.ok(groups.every(group => group.memberIds.length === 2));
  assert.deepEqual(groups.map(group => group.memberIds), [["a", "b"], ["b", "c"]]);
});
test("different labels and factors stay separate", () => {
  const data = example([["a", "b"], ["b", "c"], ["a", "c"]]);
  data.labels[0].label = "別の共通値";
  const groups = connectionGroups(data, "target");
  assert.equal(groups.length, 3);
  assert.equal(connectionGroups(data, "purpose").length, 0);
});
test("upper-concept cliques use a separate common node without altering direct similarity", () => {
  const data = example([["a", "b"]]);
  data.broaderPairs = [
    {source:"a",target:"b",factorId:"target",kind:"broader-concept",sharedConcept:"大学生",score:1,sourceConcept:"大学生",targetConcept:"大学生"},
    { source: "a", target: "c", factorId: "target", kind: "broader-concept", sharedConcept: "大学生", score: 0.95, sourceConcept: "大学生", targetConcept: "大学生" },
    { source: "b", target: "c", factorId: "target", kind: "broader-concept", sharedConcept: "大学生", score: 0.95, sourceConcept: "大学生", targetConcept: "大学生" },
  ];
  const groups = connectionGroups(data, "target");
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.find(group => group.kind === "broader-concept")?.memberIds, ["a", "b", "c"]);
  assert.equal(data.pairs.length, 1);
  assert.equal(new Set(groups.map(group => group.id)).size, groups.length);
});

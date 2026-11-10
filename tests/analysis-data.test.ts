import { test } from "node:test";
import assert from "node:assert/strict";
import { compactAnalysis, validateIdeas, normalizeAnalysis } from "../src/lib/analysis-data.ts";

test("analysis accepts 2–5 ideas, rejects duplicate/path IDs and invalid content", () => {
  const ideas = [{ id: "one", text: "  学習支援  " }, { id: "two", text: "旅行支援" }];
  assert.equal(validateIdeas(ideas)[0].text, "学習支援");
  assert.throws(() => validateIdeas([ideas[0]]));
  assert.throws(() => validateIdeas([ideas[0], ideas[0]]));
  assert.throws(() => validateIdeas([ideas[0], { id: "../other", text: "x" }]));
  assert.throws(() => validateIdeas([ideas[0], { id: "two", text: " " }]));
  assert.throws(() => validateIdeas([ideas[0], { id: "two", text: "x".repeat(6001) }]));
});

test("old maps do not invent abstractions or dictionary relations", () => {
  const result = normalizeAnalysis({configVersion:'old',factors:[{id:'target',name:'対象'}],values:[{id:'a',ideaId:'1',factorId:'target',label:'大学初学者',inferred:false}],pairs:[],labels:[]});
  assert.deepEqual(result.broaderPairs, []);
  assert.equal(result.values[0].broaderConcept, undefined);
});

test("persisted map strips vectors, prompts, evidence and candidate payloads", () => {
  const internal = {
    configVersion: "test", provider: { generationModel: "model" },
    values: [{ id: "n1", ideaId: "i1", factorId: "target", label: "学生", inferred: false, vector: [1, 2], evidence: "source", description: "private detail" }],
    pairs: [{ source: "n1", target: "n2", factorId: "target", score: 0.9 }],
    labels: [{ id: "l1", label: "学生", factorId: "target", memberIds: ["n1", "n2"], centroid: [1, 2], candidates: [{ vector: [3, 4] }] }],
  };
  const result = compactAnalysis(internal, [{ id: "target", name: "対象" }]);
  const json = JSON.stringify(result);
  assert.ok(!json.includes("vector"));
  assert.ok(!json.includes("centroid"));
  assert.ok(!json.includes("evidence"));
  assert.ok(!json.includes("provider"));
  assert.equal(result.values[0].label, "学生");
  assert.equal(result.pairs[0].score, 0.9);
});

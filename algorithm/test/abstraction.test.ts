import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyzeValues,validateExtraction} from '../src/core.ts';
import {MockProvider} from '../src/mock.ts';
import {replay} from '../src/replay.ts';
import type {Config} from '../src/types.ts';
const c:Config=JSON.parse(await readFile(new URL('../config/default.json',import.meta.url),'utf8'));
const input=[
  {id:'a',ideaId:'1',factorId:'mechanism',label:'売上履歴による仕入れ予測',broaderConcept:'需要予測',description:'',evidence:'',inferred:true},
  {id:'b',ideaId:'2',factorId:'mechanism',label:'予約状況による生産計画',broaderConcept:'将来需要の予測',description:'',evidence:'',inferred:true},
];
function provider(){
  const p=new MockProvider();
  const vectors:Record<string,number[]>={
    '売上履歴による仕入れ予測':[1,0,0], '予約状況による生産計画':[0,1,0],
    '需要予測':[0,0,1], '将来需要の予測':[0,0.1,0.99],
  };
  p.embed=async texts=>texts.map(t=>{if(!vectors[t])throw new Error('Unknown fixture');return vectors[t];});
  p.suggestLabels=async()=>({labels:[]});
  return p;
}
test('upper concepts compare by embeddings for non-target factors and unrelated domains',async()=>{
  const r=await analyzeValues(input,c,provider());
  assert.equal(r.pairs.length,0);
  assert.equal(r.broaderPairs?.length,1);
  assert.ok(r.broaderPairs![0].score>0.99);
  assert.equal(r.broaderPairs![0].factorId,'mechanism');
  assert.equal(r.values[0].label,input[0].label);
  assert.ok(r.values[0].broaderVector);
  assert.equal(r.labels[0].level,'broader');
  assert.deepEqual((await replay(r,c)).broaderPairs,r.broaderPairs);
});
test('upper comparison is same-factor only, has a separate threshold and respects dismissed pairs',async()=>{
  assert.equal((await analyzeValues(input,{...c,abstractionThreshold:1},provider())).broaderPairs?.length,0);
  assert.equal((await analyzeValues(input,c,provider(),undefined,[['b','a']])).broaderPairs?.length,0);
  const mixed=[input[0],{...input[1],factorId:'purpose'}];
  assert.equal((await analyzeValues(mixed,c,provider())).broaderComparisons?.length,0);
  await assert.rejects(analyzeValues(input,{...c,abstractionThreshold:NaN},provider()));
});
test('null upper concepts do not require embedding; invalid or overly generic abstractions are rejected',async()=>{
  const p=new MockProvider();
  const idea={id:'x',text:'個別最適化'};
  const raw=await p.extract(idea,c) as {factors:Record<string,string|null>;abstractions:Record<string,string|null>;details:unknown};
  raw.abstractions.mechanism='問題';
  assert.equal(validateExtraction(raw,idea,c)[0].broaderConcept,null);
  assert.throws(()=>validateExtraction({...raw,abstractions:{...raw.abstractions,target:'人'}},idea,c));
  assert.throws(()=>validateExtraction({...raw,abstractions:{...raw.abstractions,mechanism:['a','b']}},idea,c));
  const noUpper=input.map(v=>({...v,broaderConcept:null}));
  const result=await analyzeValues(noUpper,c,provider());
  assert.equal(result.broaderComparisons?.length,0);
});

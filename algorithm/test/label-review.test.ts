import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyzeValues, embeddingText} from '../src/core.ts';
import {replay} from '../src/replay.ts';
import type {Config, Provider, Value} from '../src/types.ts';
const config:Config=JSON.parse(await readFile(new URL('../config/default.json',import.meta.url),'utf8'));
const values:Value[]=[{id:'a',ideaId:'one',factorId:'mechanism',label:'混雑予測',description:'利用履歴と時間割で予測',evidence:'',inferred:false},{id:'b',ideaId:'two',factorId:'mechanism',label:'需要予測',description:'売上と天候で予測',evidence:'',inferred:false}];
function provider():Provider { return {metadata:{mode:'test',generationModel:'test',embeddingModel:'test'},extract:async()=>{throw Error('unused');},embed:async texts=>texts.map(()=>[1,0]),suggestLabels:async()=>({labels:['履歴と予定に基づく需要予測','データに基づく需要予測']})}; }
test('semantic review rejects one-sided qualifiers and selects an approved common label in one batch',async()=>{
 const p=provider(); let calls=0; p.reviewLabels=async requests=>{calls++;return {reviews:requests.map(request=>({id:request.id,accepted:['データに基づく需要予測']}))};};
 const result=await analyzeValues(values,config,p); assert.equal(calls,1); assert.equal(result.labels[0].label,'データに基づく需要予測'); assert.equal(result.labels[0].verification,'accepted'); assert.deepEqual(result.values.map(v=>v.label),values.map(v=>v.label));
 const cached=await replay(result,config); assert.equal(cached.labels[0].label,result.labels[0].label);
});
test('no approved candidate retains a neutral similarity connection without inventing a label',async()=>{
 const p=provider(); p.reviewLabels=async requests=>({reviews:requests.map(request=>({id:request.id,accepted:[]}))});
 const result=await analyzeValues(values,config,p); assert.equal(result.labels[0].verification,'no-common-label'); assert.equal(result.labels[0].label,'意味の近い値'); assert.equal(result.pairs.length,1);
});
test('review cannot introduce unknown candidates or duplicate IDs',async()=>{
 const p=provider(); p.reviewLabels=async requests=>({reviews:requests.map(request=>({id:request.id,accepted:['勝手に作った語']}))}); await assert.rejects(analyzeValues(values,config,p),/Unknown reviewed/);
});
test('meaning embeddings isolate factor context and do not copy the whole source',()=>{
 const value={...values[0],evidence:'別因数のターゲットや目的'}; const text=embeddingText(value,{...config,embeddingMode:'meaning'}); assert.ok(text.includes(value.description)); assert.ok(!text.includes(value.evidence)); assert.equal(embeddingText(value,config),value.label);
});
test('factor thresholds remain independent for a labeled positive and negative pair',async()=>{
 const result=await analyzeValues(values,{...config,factorThresholds:{mechanism:.95}},provider(),()=>.9); assert.equal(result.pairs.length,0);
 const other=await analyzeValues(values,{...config,factorThresholds:{target:.95}},provider(),()=>.9); assert.equal(other.pairs.length,1);
});

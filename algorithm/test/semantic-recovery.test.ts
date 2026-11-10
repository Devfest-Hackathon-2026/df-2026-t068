import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyzeValues} from '../src/core.ts';
import {replay} from '../src/replay.ts';
import type {Config,Provider,Value} from '../src/types.ts';
const config:Config=JSON.parse(await readFile(new URL('../config/default.json',import.meta.url),'utf8'));
const values:Value[]=[
 {id:'a',ideaId:'one',factorId:'mechanism',label:'利用履歴と時間割に基づく混雑予測と時間提案',broaderConcept:'データ分析に基づく混雑予測と時間提案',description:'履歴と時間割から混雑を予測し時間を提案',evidence:'',inferred:false},
 {id:'b',ideaId:'two',factorId:'mechanism',label:'売上と天候に基づく需要予測と仕入れ提案',broaderConcept:'環境要因に基づく需要予測',description:'売上と天候から需要を予測し仕入れを提案',evidence:'',inferred:false},
 {id:'c',ideaId:'three',factorId:'mechanism',label:'空席情報の地図集約',broaderConcept:'情報の地図集約',description:'現在の空席を表示し予測は行わない',evidence:'',inferred:false},
];
function provider():Provider {
 const vectors=new Map<string,number[]>([[values[0].label,[1,0,0]],[values[1].label,[.72,.694,0]],[values[2].label,[0,0,1]],[values[0].broaderConcept!,[1,0,0]],[values[1].broaderConcept!,[.621,0,.784]],[values[2].broaderConcept!,[0,1,0]],['データに基づく予測',[.93,.37,0]]]);
 return {metadata:{mode:'fixture',generationModel:'none',embeddingModel:'none'},extract:async()=>{throw Error('unused');},embed:async texts=>texts.map(text=>{assert.ok(vectors.has(text),text);return vectors.get(text)!;}),suggestLabels:async()=>({labels:[]}),findSharedConcepts:async requests=>({results:requests.map(request=>({id:request.id,concept:request.values.some(value=>value.id==='c')?null:'データに基づく予測',sourceSupported:!request.values.some(value=>value.id==='c'),targetSupported:!request.values.some(value=>value.id==='c')}))}),reviewLabels:async requests=>({reviews:requests.map(request=>({id:request.id,accepted:request.candidates.filter(label=>label==='データに基づく予測')}))})};
}
test('partial shared principles recover below-threshold pairs without linking a current-status map',async()=>{
 const result=await analyzeValues(values,config,provider());assert.equal(result.pairs.length,0);
 assert.equal(result.broaderPairs?.length,1);const pair=result.broaderPairs![0];assert.equal(pair.method,'semantic');assert.equal(pair.sharedConcept,'データに基づく予測');assert.ok(pair.score<config.abstractionThreshold!);assert.deepEqual([pair.source,pair.target].sort(),['a','b']);assert.deepEqual(result.values.map(value=>value.label),values.map(value=>value.label));
 assert.deepEqual((await replay(result,config)).broaderPairs,result.broaderPairs);
});
test('semantic recovery requires two-sided evidence and a separate accepted-label check',async()=>{
 const p=provider();p.reviewLabels=async requests=>({reviews:requests.map(request=>({id:request.id,accepted:[]}))});assert.equal((await analyzeValues(values,config,p)).broaderPairs?.length,0);
 p.findSharedConcepts=async requests=>({results:requests.map(request=>({id:request.id,concept:'データに基づく予測',sourceSupported:true,targetSupported:false}))});assert.equal((await analyzeValues(values,config,p)).broaderPairs?.length,0);
});
test('dismissed, cross-factor and capped pairs cannot be rescued; invalid IDs fail closed',async()=>{
 assert.equal((await analyzeValues(values,config,provider(),undefined,[['a','b'],['b','c']])).broaderPairs?.length,0);
 assert.equal((await analyzeValues(values,{...config,maxSemanticPairs:0},provider())).broaderPairs?.length,0);
 const mixed=values.slice(0,2).map((value,index)=>({...value,factorId:index?'purpose':'mechanism'}));assert.equal((await analyzeValues(mixed,config,provider())).broaderPairs?.length,0);
 const p=provider();p.findSharedConcepts=async requests=>({results:requests.map(()=>({id:'unknown',concept:null,sourceSupported:false,targetSupported:false}))});await assert.rejects(analyzeValues(values,config,p),/Invalid shared concept/);
 await assert.rejects(analyzeValues(values,{...config,semanticCandidateThreshold:NaN},provider()));
});

// Regression uses recorded real embedding geometry; only model judgments are replayed.
test('recorded live scores recover a valid short label while rejecting a one-sided compound label',async()=>{
 const fixture=JSON.parse(await readFile(new URL('./fixtures/semantic-live.json',import.meta.url),'utf8'));
 const p:Provider={metadata:fixture.provider,extract:async()=>{throw Error('offline only');},embed:async texts=>texts.map(text=>{assert.ok(fixture.vectors[text],text);return fixture.vectors[text];}),suggestLabels:async()=>({labels:[]}),findSharedConcepts:async requests=>({results:requests.map(request=>({...fixture.proposal,id:request.id}))}),reviewLabels:async requests=>({reviews:requests.map(request=>{assert.equal(request.scope,'shared-component');return {id:request.id,accepted:fixture.approved};})})};
 const result=await analyzeValues(fixture.values,config,p);assert.equal(result.pairs.length,0);assert.ok(result.comparisons[0].score<.82);assert.ok(result.broaderComparisons![0].score<.86);assert.equal(result.broaderPairs?.length,1);assert.equal(result.broaderPairs![0].sharedConcept,'予測に基づく提案');assert.deepEqual((await replay(result,config)).broaderPairs,result.broaderPairs);
});

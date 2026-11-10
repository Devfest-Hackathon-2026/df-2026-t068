import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ideaConnections} from '../src/lib/idea-connections.ts';
import type {MapAnalysis} from '../src/lib/analysis-data.ts';
function fixture():MapAnalysis {
  return {configVersion:'test',factors:[{id:'target',name:'ターゲット'},{id:'mechanism',name:'解決原理'}],values:[{id:'a',ideaId:'one',factorId:'target',label:'大学生',inferred:false},{id:'b',ideaId:'two',factorId:'target',label:'大学生',inferred:false},{id:'c',ideaId:'three',factorId:'target',label:'大学院生',inferred:false},{id:'d',ideaId:'one',factorId:'mechanism',label:'混雑予測',inferred:false},{id:'e',ideaId:'two',factorId:'mechanism',label:'需要予測',inferred:false}],pairs:[{source:'b',target:'a',factorId:'target',score:1}],labels:[{id:'label',factorId:'target',memberIds:['a','b'],label:'大学生'}],broaderPairs:[{source:'a',target:'b',factorId:'target',kind:'broader-concept',sourceConcept:'学生',targetConcept:'学生',sharedConcept:'学生',score:1},{source:'d',target:'e',factorId:'mechanism',kind:'broader-concept',sourceConcept:'需要予測',targetConcept:'需要予測',sharedConcept:'需要予測',score:1}]};
}
test('one idea edge aggregates factors without double counting upper/direct relations',()=>{
 const links=ideaConnections(fixture()); assert.equal(links.length,1); assert.equal(links[0].factors.length,2); assert.equal(links[0].factors[0].kind,'direct'); assert.equal(links[0].factors[1].kind,'broader'); assert.equal(links[0].source,'one'); assert.equal(links[0].factors[0].sourceValue,'大学生');
});
test('chain links do not create unverified edges and malformed pairs are ignored',()=>{
 const data=fixture(); data.pairs.push({source:'b',target:'c',factorId:'target',score:.9},{source:'a',target:'missing',factorId:'target',score:1},{source:'a',target:'d',factorId:'target',score:1});
 const links=ideaConnections(data); assert.equal(links.length,2); assert.ok(!links.some(link=>link.source==='one'&&link.target==='three'));
});

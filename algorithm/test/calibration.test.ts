import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calibrate} from '../src/calibration.ts';
import type {Analysis} from '../src/types.ts';
const analysis={comparisons:[{source:'a',target:'b',factorId:'target',score:.92},{source:'a',target:'c',factorId:'target',score:.7}]} as Analysis;
const judgments=[{source:'a',target:'b',factorId:'target',level:'direct' as const,expected:true},{source:'a',target:'c',factorId:'target',level:'direct' as const,expected:false}];
test('offline calibration separates positive and negative examples without mutating analysis',()=>{
 const result=calibrate(analysis,judgments);assert.equal(result[0].recommendation?.threshold,.92);assert.equal(result[0].recommendation?.f1,1);assert.equal(analysis.comparisons.length,2);
});
test('single class, missing scores and duplicate judgments cannot silently calibrate',()=>{
 assert.equal(calibrate(analysis,judgments.slice(0,1))[0].recommendation,null);
 assert.throws(()=>calibrate(analysis,[...judgments,judgments[0]]),/Duplicate/);
 assert.throws(()=>calibrate(analysis,[{...judgments[0],target:'missing'}]),/No saved/);
});

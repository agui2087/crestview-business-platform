import {test} from 'node:test';import assert from 'node:assert/strict';
import {preparationSchema,preparationSteps} from './buyer-preparation.ts';
test('preparing buyers need no financial proof and can change paths',()=>{for(const path of ['preparing','searching'])assert.equal(preparationSchema.safeParse({path,completed_steps:[]}).success,true);});
test('preparation accepts only known learning steps and deduplicates them',()=>{assert.deepEqual(preparationSchema.parse({path:'preparing',completed_steps:['budget','budget']}).completed_steps,['budget']);assert.equal(preparationSchema.safeParse({path:'preparing',completed_steps:['verified_funds']}).success,false);assert.equal(new Set(preparationSteps.map(s=>s.id)).size,8);});

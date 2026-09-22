import { test } from "node:test";
import assert from "node:assert/strict";
import { filterInquiryPipeline, normalizeInquiryFilter } from "./inquiry-pipeline.ts";
const items = [
 {id:"beginner",status:"submitted",subject:"Roofing question",requested_items:["Public listing question"]},
 {id:"nda",status:"nda_sent",subject:"Retail request"},
 {id:"closed",status:"closed",subject:"Roofing completed",financial_access_status:"requested"},
 {id:"docs",status:"document_review",subject:"Plumbing",financial_access_status:"approved"},
];
test("pipeline distinguishes public questions, pending NDA, document review and finished conversations",()=>{
 for(const [filter,id] of [["questions","beginner"],["needs_review","beginner"],["nda","nda"],["documents","docs"],["finished","closed"]] as const) assert.deepEqual(filterInquiryPipeline(items,filter,"").map(i=>i.id),[id]);
});
test("pipeline filters are bounded, searchable and never rank by wealth",()=>{
 assert.equal(normalizeInquiryFilter("richest"),"all");
 assert.deepEqual(filterInquiryPipeline(items,"all"," ROOFING ").map(i=>i.id),["beginner","closed"]);
 assert.deepEqual(filterInquiryPipeline(items,"all","").map(i=>i.id),items.map(i=>i.id));
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as progress from "./acquisition-progress.ts";
import * as tailoring from "./acquisition-tailoring.ts";

type Node = { type: string; props: Record<string, unknown> };
type Workspace = { stage: string; current_step: number; checklist_progress: Record<string, string>; step_notes: Record<string, string>; valuation_inputs: Record<string, string> };
const empty = (): Workspace => ({ stage: "screening", current_step: 0, checklist_progress: {}, step_notes: {}, valuation_inputs: {} });
function children(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(children);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...children(node.props.children)];
}
function label(value: unknown): string {
  if (Array.isArray(value)) return value.map(label).join("");
  if (value && typeof value === "object" && "props" in value) return label((value as Node).props.children);
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

// Exercise the real client handlers with a controlled save boundary. Browser
// rendering/accessibility and hosted persistence are separate verification layers.
async function harness(initialWorkspace = empty(), locale = "en") {
  const source = await readFile(new URL("../components/acquisition-planner.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const state: unknown[] = [];
  let cursor = 0;
  let tree: unknown;
  let saveOK = true;
  let saved = initialWorkspace;
  const pending: Promise<unknown>[] = [];
  function useState(initial: unknown) {
    const key = cursor++;
    if (!(key in state)) state[key] = typeof initial === "function" ? initial() : initial;
    return [state[key], (next: unknown) => { state[key] = typeof next === "function" ? next(state[key]) : next; }];
  }
  const exports: { AcquisitionPlanner?: (props: unknown) => unknown } = {};
  runInNewContext(code, { exports, FormData, Date, JSON, Number, String, require: (name: string) => {
    if (name === "react") return {
      useState, useMemo: (fn: () => unknown) => fn(), useEffect: () => {},
      useRef: (initial: unknown) => useState({ current: initial })[0],
      useTransition: () => [false, (fn: () => Promise<unknown>) => { pending.push(fn()); }],
    };
    if (name === "react/jsx-runtime") return { jsx: (type: string, props: Node["props"]) => ({ type, props }), jsxs: (type: string, props: Node["props"]) => ({ type, props }) };
    if (name === "@/components/user-provider") return { useCrestviewUser: () => ({ displayName: "Synthetic buyer" }) };
    if (name === "@/lib/financing-resources") return { financingResourcesFor: () => [] };
    if (name === "@/lib/acquisition-progress") return progress;
    if (name === "@/lib/acquisition-tailoring") return tailoring;
    if (name === "@/components/acquisition-plan-settings") return { AcquisitionPlanSettings: "plan-settings" };
    if (name === "@/components/acquisition-task-details") return { AcquisitionTaskDetails: "task-details" };
    if (name === "@/app/[locale]/dashboard/opportunities/actions") return { saveAcquisitionWorkspace: async (form: FormData) => {
      if (saveOK) saved = { ...saved, current_step: Number(form.get("current_step")), checklist_progress: JSON.parse(String(form.get("checklist_progress"))), step_notes: JSON.parse(String(form.get("step_notes"))), valuation_inputs: JSON.parse(String(form.get("valuation_inputs"))) };
      return { ok: saveOK };
    } };
    throw new Error(name);
  } });
  function render() {
    cursor = 0;
    tree = exports.AcquisitionPlanner!({ locale, initialWorkspace, opportunity: { id: "synthetic", title: "Synthetic business", location: "Test", missing: [], sourceUrl: "/test" } });
  }
  function nodes() { return children(tree); }
  function button(text: string) {
    const match = nodes().find(node => node.type === "button" && label(node.props.children) === text);
    assert.ok(match, `Missing button: ${text}`);
    return match;
  }
  async function invoke(node: Node, event = "onClick") {
    assert.notEqual(node.props.disabled, true);
    (node.props[event] as () => void)();
    while (pending.length) await Promise.all(pending.splice(0));
    await Promise.resolve();
    render();
  }
  render();
  return {
    nodes, button, invoke,
    rerender: render,
    percent: () => nodes().find(node => node.type === "progress")!.props.value,
    step: () => nodes().find(node => node.type === "h2" && node.props.tabIndex === -1)!.props.children,
    checkAll: async () => {
      for (;;) {
        const item = nodes().find(node => node.type === "input" && node.props.type === "checkbox" && node.props.checked === false && !node.props.disabled);
        if (!item) break;
        await invoke(item, "onChange");
      }
    },
    saved: () => saved,
    failSaves: (fail: boolean) => { saveOK = !fail; },
  };
}

test('saved applicability and assignment survive reload without checking the task', async()=>{
  const h=await harness();
  const detail=h.nodes().find(node=>node.type==='task-details')!;
  assert.equal(await (detail.props.onSave as (d: tailoring.TaskDetails, na:boolean)=>Promise<boolean>)({...tailoring.defaultTaskDetails,owner:'advisor',assignee:'Synthetic advisor',due:'2026-09-01',waiting:'broker',reason:'Does not apply to this synthetic purchase.'},true),true);
  h.rerender();
  assert.equal(h.saved().checklist_progress['item:0:0'],'not_applicable');
  const resumed=await harness(h.saved());
  const checkbox=resumed.nodes().find(node=>node.type==='input'&&node.props.type==='checkbox')!;
  assert.equal(checkbox.props.checked,false);
  assert.equal(checkbox.props.disabled,true);
  assert.ok(Number(resumed.percent())>0);
});

test('purchase settings apply only after a successful save',async()=>{
  const h=await harness();
  const settings=h.nodes().find(node=>node.type==='plan-settings')!;
  const save=settings.props.onSave as (plan:tailoring.DealPlan)=>Promise<boolean>;
  h.failSaves(true);
  assert.equal(await save({...tailoring.defaultDealPlan,financing:'cash'}),false);
  assert.equal(h.saved().checklist_progress['plan:profile'],undefined);
  h.failSaves(false);
  assert.equal(await save({...tailoring.defaultDealPlan,financing:'cash'}),true);
  assert.equal(tailoring.readDealPlan(h.saved().checklist_progress['plan:profile'])?.financing,'cash');
});

for (const locale of ["en", "es"]) {
  test(`all eight saved reviews advance sequentially and resume without data loss (${locale})`, async () => {
    const initial = { ...empty(), step_notes: { "2": "Existing private research" }, valuation_inputs: { price: "500000", sde: "123000" } };
    const h = await harness(initial, locale);
    for (let step = 0; step < 8; step++) {
      const next = step === 7 ? (locale === "es" ? "Finalizar revisión de la lista" : "Finish checklist review") : (locale === "es" ? "Guardar y continuar" : "Save and continue");
      assert.equal(h.button(next).props.disabled, true);
      await h.checkAll();
      await h.invoke(h.button(step === 7 ? (locale === "es" ? "Revisión terminada" : "Review finished") : (locale === "es" ? "Listo para continuar" : "Ready for next step")));
      assert.equal(h.button(next).props.disabled, false);
      assert.ok(Number(h.percent()) < 100);
      await h.invoke(h.button(next));
      assert.equal(h.saved().checklist_progress[String(step)], "complete");
      assert.equal(h.saved().current_step, Math.min(7, step + 1));
    }
    assert.equal(h.percent(), 100);
    assert.equal(h.saved().step_notes["2"], "Existing private research");
    assert.equal(h.saved().valuation_inputs.price, "500000");
    const resumed = await harness(h.saved(), locale);
    assert.equal(resumed.percent(), 100);
    assert.equal(resumed.button(locale === "es" ? "Lista revisada" : "Checklist reviewed").props.disabled, true);
  });
}

test("failed saves neither advance nor inflate progress; retry resumes correctly", async () => {
  const h = await harness();
  h.failSaves(true);
  await h.checkAll();
  await h.invoke(h.button("Ready for next step"));
  await h.invoke(h.button("Save and continue"));
  assert.equal(h.percent(), 0);
  assert.equal(h.step(), "Quick fit check");
  assert.equal(h.saved().checklist_progress["0"], undefined);
  assert.ok(h.nodes().some(node => label(node.props.children) === "Progress was not saved. Retry before leaving this page."));
  h.failSaves(false);
  await h.invoke(h.button("Save and continue"));
  assert.equal(h.step(), "NDA and records");
  assert.ok(Number(h.percent()) > 0);
  const resumed = await harness(h.saved());
  assert.equal(resumed.step(), "NDA and records");
});

test("deferred steps remain outstanding on reload, despite saved later navigation", async () => {
  const h = await harness();
  await h.invoke(h.button("Do this later"));
  await h.invoke(h.button("Skip and continue"));
  assert.equal(h.step(), "NDA and records");
  assert.equal(h.percent(), 0);
  await h.checkAll();
  await h.invoke(h.button("Ready for next step"));
  assert.equal(h.button("Save and continue").props.disabled, true);
  const resumed = await harness(h.saved());
  assert.equal(resumed.step(), "Quick fit check");
  assert.equal(resumed.saved().checklist_progress["item:1:0"], "complete");
});

test("reopening an earlier task removes overall completion without deleting later work", async () => {
  const workspace = empty();
  [5, 6, 7, 5, 7, 7, 7, 6].forEach((count, step) => {
    for (let item = 0; item < count; item++) workspace.checklist_progress[`item:${step}:${item}`] = "complete";
    workspace.checklist_progress[String(step)] = "complete";
    workspace.checklist_progress[`decision:${step}`] = "continue";
  });
  const h = await harness(workspace);
  assert.equal(h.percent(), 100);
  await h.invoke(h.button("1Quick fit checkReviewed"));
  const firstItem = h.nodes().find(node => node.type === "input" && node.props.type === "checkbox")!;
  await h.invoke(firstItem, "onChange");
  assert.ok(Number(h.percent()) < 100);
  await h.invoke(h.button("8First 90 daysReviewed"));
  assert.equal(h.button("Finish checklist review").props.disabled, true);
  assert.equal(h.saved().checklist_progress["7"], "complete");
  assert.equal((await harness(h.saved())).step(), "Quick fit check");
});

import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { getFirebaseFirestore } from "./firebase";
import type { IdeaInput, MapAnalysis, MapPositions } from "./analysis-data";
import { normalizeAnalysis } from "./analysis-data";
export type Workspace = { ideas: IdeaInput[]; analyzedIdeas: IdeaInput[]; revision: string; analysisRevision: string; analysis: MapAnalysis | null; positions: MapPositions };
export const emptyWorkspace: Workspace = { ideas: [{ id: "idea-1", text: "" }, { id: "idea-2", text: "" }], analyzedIdeas: [], revision: "", analysisRevision: "", analysis: null, positions: {} };
function ref(uid: string, projectId: string) {
  return doc(getFirebaseFirestore(), "users", uid, "projects", projectId, "workspace", "current");
}
function parse<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}
export function subscribeWorkspace(uid: string, projectId: string, receive: (workspace: Workspace) => void, error: () => void) {
  return onSnapshot(ref(uid, projectId), snapshot => {
    const data = snapshot.data() ?? {};
    const savedAnalysis = parse<MapAnalysis | null>(data.analysisJson, null);
    receive({ ideas: parse(data.ideasJson, emptyWorkspace.ideas), analyzedIdeas: parse(data.analyzedIdeasJson, []), revision: data.revision ?? "", analysisRevision: data.analysisRevision ?? "", analysis: savedAnalysis ? normalizeAnalysis(savedAnalysis) : null, positions: parse(data.positionsJson, {}) });
  }, error);
}
export async function saveIdeas(uid: string, projectId: string, ideas: IdeaInput[], expected: string) {
  const revision = crypto.randomUUID();
  await runTransaction(getFirebaseFirestore(), async transaction => {
    const target = ref(uid, projectId);
    const current = await transaction.get(target);
    if ((current.data()?.revision ?? "") !== expected) throw new Error("別の画面で更新されています。入力をコピーしてからページを再読み込みしてください。");
    transaction.set(target, { ideasJson: JSON.stringify(ideas), revision, updatedAt: serverTimestamp() }, { merge: true });
    transaction.update(doc(getFirebaseFirestore(), "users", uid, "projects", projectId), { updatedAt: serverTimestamp() });
  });
  return revision;
}
export async function saveAnalysis(uid: string, projectId: string, revision: string, analysis: MapAnalysis) {
  await runTransaction(getFirebaseFirestore(), async transaction => {
    const target = ref(uid, projectId);
    const current = await transaction.get(target);
    if (current.data()?.revision !== revision) throw new Error("分析中に入力が変更されたため、結果を保存しませんでした。もう一度分析してください。");
    transaction.set(target, { analysisJson: JSON.stringify(analysis), analyzedIdeasJson: current.data()?.ideasJson ?? "[]", analysisRevision: revision, positionsJson: "{}", updatedAt: serverTimestamp() }, { merge: true });
    transaction.update(doc(getFirebaseFirestore(), "users", uid, "projects", projectId), { status: "ready", updatedAt: serverTimestamp() });
  });
}
export async function savePositions(uid: string, projectId: string, analysisRevision: string, positions: MapPositions) {
  await runTransaction(getFirebaseFirestore(), async transaction => {
    const target = ref(uid, projectId);
    const current = await transaction.get(target);
    if (current.data()?.analysisRevision !== analysisRevision) return;
    transaction.set(target, { positionsJson: JSON.stringify(positions) }, { merge: true });
  });
}

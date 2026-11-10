import { NextRequest, NextResponse } from "next/server";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { analyze, VertexProvider, type Config } from "ideaweave-algorithm";
import configData from "../../../../algorithm/config/default.json";
import { compactAnalysis, validateIdeas } from "@/lib/analysis-data";

export const runtime = "nodejs";
export const maxDuration = 300;
const active = new Set<string>();
const recent = new Map<string, number>();
function response(error: string, status: number) { return NextResponse.json({ error }, { status }); }

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return response("ログインしてから分析してください。", 401);
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return response("リクエストが大きすぎます。", 413);
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!project) return response("Firebaseのサーバー設定が不足しています。", 503);
  let uid: string;
  try {
    const app = getApps().find(a => a.name === "analysis-auth") ?? initializeApp({ projectId: project }, "analysis-auth");
    uid = (await getAuth(app).verifyIdToken(token)).uid;
  } catch { return response("ログインの有効期限が切れました。再ログインしてください。", 401); }
  let projectId: string; let revision: string;
  try {
    const body = await request.json();
    if (typeof body.projectId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(body.projectId) || typeof body.revision !== "string" || body.revision.length > 100 || !body.revision) throw new Error();
    projectId = body.projectId; revision = body.revision;
  } catch { return response("入力を保存してから分析してください。", 400); }
  if (active.has(uid)) return response("分析が進行中です。完了までお待ちください。", 429);
  if (Date.now() - (recent.get(uid) ?? 0) < 10000) return response("少し待ってから再度分析してください。", 429);
  active.add(uid); recent.set(uid, Date.now());
  if (recent.size > 1000) for (const [key, time] of recent) if (Date.now() - time > 60000) recent.delete(key);
  try {
    const root = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/users/${encodeURIComponent(uid)}/projects/${projectId}`;
    const headers = { Authorization: `Bearer ${token}` };
    // Forward the Firebase user token so existing Firestore ownership rules apply.
    const projectResponse = await fetch(root, { headers, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!projectResponse.ok) return response("プロジェクトが見つからないか、アクセス権がありません。", projectResponse.status === 404 ? 404 : 403);
    const saved = await fetch(`${root}/workspace/current`, { headers, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!saved.ok) return response("入力を保存できていません。保存状態を確認してください。", 409);
    const document = await saved.json();
    if (document.fields?.revision?.stringValue !== revision) return response("入力が更新されています。保存後に再度分析してください。", 409);
    let ideas;
    try { ideas = validateIdeas(JSON.parse(document.fields?.ideasJson?.stringValue ?? "null")); }
    catch (error) { return response(error instanceof Error ? error.message : "入力が不正です。", 400); }
    const generationModel = process.env.GEMINI_GENERATION_MODEL;
    const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL;
    const cloudProject = process.env.GOOGLE_CLOUD_PROJECT;
    if (!generationModel || !embeddingModel || !cloudProject) return response("分析用のGoogle Cloud設定が不足しています。", 503);
    const provider = new VertexProvider({ project: cloudProject, location: process.env.GOOGLE_CLOUD_LOCATION ?? "global", generationModel, embeddingModel });
    const config = configData as Config;
    const result = await analyze(ideas, config, provider);
    return NextResponse.json({ analysis: compactAnalysis(result, config.factors), revision });
  } catch (error) {
    console.error("Analysis failed:", error instanceof Error && error.name === "AbortError" ? "timeout" : "model-or-service-error");
    return response("分析に失敗しました。入力と前回の結果は保持されています。接続設定を確認し、時間を置いて再試行してください。", 502);
  } finally { active.delete(uid); }
}

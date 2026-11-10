import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";

export type ProjectStatus = "draft" | "analyzing" | "ready" | "error";

export type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: Date | null;
  updatedAt: Date | null;
};

function toDate(value: unknown) {
  return value instanceof Timestamp ? value.toDate() : null;
}

function toProject(
  id: string,
  data: DocumentData,
): Project {
  const status = ["draft", "analyzing", "ready", "error"].includes(data.status)
    ? (data.status as ProjectStatus)
    : "draft";

  return {
    id,
    name:
      typeof data.name === "string" && data.name.trim()
        ? data.name.trim()
        : "名称未設定のプロジェクト",
    status,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function projectFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>) {
  return toProject(snapshot.id, snapshot.data());
}

export function subscribeToProjects(
  userId: string,
  onProjects: (projects: Project[]) => void,
  onError: () => void,
) {
  const projectsQuery = query(
    collection(getFirebaseFirestore(), "users", userId, "projects"),
    orderBy("updatedAt", "desc"),
  );

  return onSnapshot(
    projectsQuery,
    (snapshot) => onProjects(snapshot.docs.map(projectFromSnapshot)),
    onError,
  );
}

export function subscribeToProject(
  userId: string,
  projectId: string,
  onProject: (project: Project | null) => void,
  onError: () => void,
) {
  const projectReference = doc(
    getFirebaseFirestore(),
    "users",
    userId,
    "projects",
    projectId,
  );

  return onSnapshot(
    projectReference,
    (snapshot) =>
      onProject(snapshot.exists() ? toProject(snapshot.id, snapshot.data()) : null),
    onError,
  );
}

export async function createProject(userId: string, name: string) {
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new Error("Project name is required");
  }

  const projectReference = await addDoc(
    collection(getFirebaseFirestore(), "users", userId, "projects"),
    {
      name: normalizedName,
      status: "draft",
      inputVersion: 0,
      graphVersion: 0,
      analysisTargetVersion: 0,
      finalError: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  );

  return projectReference.id;
}

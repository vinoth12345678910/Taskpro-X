import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { UploadTask } from "firebase/storage";
import { db, getStorageInstance } from "./firebase";
import { toDate } from "./firestore-utils";
import { logError } from "./logger";
import type { Profile, TeamResource } from "./types";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Keep in sync with storage.rules. SVG and HTML are deliberately excluded (script execution). */
export const ALLOWED_TYPES: RegExp[] = [
  /^image\/(png|jpeg|gif|webp)$/,
  /^application\/pdf$/,
  /^text\/(plain|csv)$/,
  /^application\/(json|zip|msword)$/,
  /^application\/vnd\.ms-(excel|powerpoint)$/,
  /^application\/vnd\.openxmlformats-officedocument\.[a-z.]+$/,
];

export function validateFile(file: { name: string; size: number; type: string }): string | null {
  if (!file.size) return "That file is empty.";
  if (file.size > MAX_FILE_BYTES) return `Files can be at most ${MAX_FILE_BYTES / 1024 / 1024} MB.`;
  if (!ALLOWED_TYPES.some((re) => re.test(file.type))) {
    return "This file type isn't supported. Use PDF, images, text/CSV, Office documents, JSON or ZIP.";
  }
  return null;
}

export function validateLink(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, error: "Links must start with http:// or https://" };
    if (u.href.length > 2000) return { ok: false, error: "That link is too long." };
    return { ok: true, url: u.href };
  } catch {
    return { ok: false, error: "Enter a valid link, for example https://example.com/doc." };
  }
}

export const safeFileName = (name: string) =>
  name.normalize("NFKD").replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "file";

export const formatBytes = (n = 0) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

function mapResource(id: string, d: Record<string, unknown>): TeamResource {
  return {
    id,
    teamId: d.teamId as string,
    kind: d.kind === "file" ? "file" : "link",
    name: d.name as string,
    description: (d.description as string) ?? "",
    url: d.url as string | undefined,
    storagePath: d.storagePath as string | undefined,
    size: d.size as number | undefined,
    contentType: d.contentType as string | undefined,
    uploadedBy: d.uploadedBy as string,
    uploadedByName: (d.uploadedByName as string) ?? "",
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

export function subscribeResources(teamId: string, cb: (r: TeamResource[]) => void, onError: (e: unknown) => void) {
  return onSnapshot(
    query(collection(db, "resources"), where("teamId", "==", teamId), orderBy("updatedAt", "desc"), limit(300)),
    (snap) => cb(snap.docs.map((d) => mapResource(d.id, d.data({ serverTimestamps: "estimate" })))),
    (e) => {
      logError("resources", "listener failed", e, { teamId });
      onError(e);
    },
  );
}

export const newResourceId = () => doc(collection(db, "resources")).id;

export async function addLink(user: Profile, teamId: string, v: { name: string; description: string; url: string }) {
  const id = newResourceId();
  await setDoc(doc(db, "resources", id), {
    teamId,
    kind: "link",
    name: v.name.trim(),
    description: v.description.trim(),
    url: v.url,
    uploadedBy: user.uid,
    uploadedByName: user.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export interface UploadHandle {
  promise: Promise<string>;
  cancel: () => void;
}

/**
 * Upload to Storage, then record metadata from what Storage reports (size / content type),
 * not from what the browser claimed. If the metadata write fails the blob is removed.
 */
export function uploadFile(
  user: Profile,
  teamId: string,
  file: File,
  description: string,
  onProgress: (fraction: number) => void,
): UploadHandle {
  const id = newResourceId();
  const fileName = safeFileName(file.name);
  const path = `teams/${teamId}/resources/${id}/${fileName}`;
  let task: UploadTask | null = null;

  const promise = (async () => {
    const problem = validateFile(file);
    if (problem) throw new Error(problem);
    const [{ ref, uploadBytesResumable, getMetadata, deleteObject }, storage] = await Promise.all([import("firebase/storage"), getStorageInstance()]);
    const fileRef = ref(storage, path);
    task = uploadBytesResumable(fileRef, file, { contentType: file.type, customMetadata: { uploadedBy: user.uid } });
    task.on("state_changed", (s) => onProgress(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0));
    await task;
    const meta = await getMetadata(fileRef);
    try {
      await setDoc(doc(db, "resources", id), {
        teamId,
        kind: "file",
        name: file.name.slice(0, 200),
        description: description.trim(),
        storagePath: path,
        size: meta.size,
        contentType: meta.contentType ?? file.type,
        uploadedBy: user.uid,
        uploadedByName: user.name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      await deleteObject(fileRef).catch(() => undefined);
      throw e;
    }
    return id;
  })();

  promise.catch((e) => {
    if ((e as { code?: string }).code !== "storage/canceled") logError("resources", "upload failed", e, { teamId });
  });
  return { promise, cancel: () => task?.cancel() };
}

/** Short-lived access is delegated to Storage rules: the tokenised URL is only obtainable by team members. */
export async function getDownloadLink(r: TeamResource): Promise<string> {
  if (r.kind === "link" && r.url) return r.url;
  if (!r.storagePath) throw new Error("This resource has no file.");
  const [{ getDownloadURL, ref }, storage] = await Promise.all([import("firebase/storage"), getStorageInstance()]);
  return getDownloadURL(ref(storage, r.storagePath));
}

export const updateResource = (id: string, v: { name: string; description: string }) =>
  updateDoc(doc(db, "resources", id), { name: v.name.trim(), description: v.description.trim(), updatedAt: serverTimestamp() });

export async function deleteResource(r: TeamResource) {
  if (r.kind === "file" && r.storagePath) {
    const [{ deleteObject, ref }, storage] = await Promise.all([import("firebase/storage"), getStorageInstance()]);
    await deleteObject(ref(storage, r.storagePath)).catch((e) => {
      if ((e as { code?: string }).code !== "storage/object-not-found") throw e;
    });
  }
  await deleteDoc(doc(db, "resources", r.id));
}

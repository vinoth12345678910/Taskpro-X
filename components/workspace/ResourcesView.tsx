"use client";
import { ExternalLink, FileText, Link2, Pencil, Plus, Search, Trash2, Upload, Download, FolderOpen } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useToast } from "@/components/providers/Toast";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/misc";
import { cn } from "@/components/ui/cn";
import { friendlyError } from "@/lib/firestore-utils";
import { addLink, deleteResource, formatBytes, getDownloadLink, MAX_FILE_BYTES, updateResource, uploadFile, validateFile, validateLink, type UploadHandle } from "@/lib/resources";
import type { TeamResource } from "@/lib/types";
import { useTeam } from "./TeamContext";

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function storageMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  if (code === "storage/canceled") return "Upload cancelled.";
  if (code === "storage/unauthorized") return "You don't have permission to upload to this team.";
  if (code === "storage/bucket-not-found" || code === "storage/project-not-found" || code === "storage/unknown" || code === "storage/retry-limit-exceeded") {
    return "File storage isn't reachable. It may not be enabled for this project yet — you can still share a link.";
  }
  if (e instanceof Error && !code) return e.message;
  return friendlyError(e, "The upload failed. Please try again.");
}

function UploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTeam();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handle = useRef<UploadHandle | null>(null);

  const reset = () => { setFile(null); setDescription(""); setProgress(null); setError(null); };
  const uploading = progress !== null;

  function choose(f: File | null) {
    setFile(f);
    setError(f ? validateFile(f) : null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file || uploading) return;
    const problem = validateFile(file);
    if (problem) return setError(problem);
    setError(null);
    setProgress(0);
    handle.current = uploadFile(t.me, t.teamId, file, description, setProgress);
    try {
      await handle.current.promise;
      toast({ tone: "success", title: "File shared", description: file.name });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(storageMessage(err));
      setProgress(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { handle.current?.cancel(); reset(); } onOpenChange(o); }} title="Upload a file" description={`Up to ${MAX_FILE_BYTES / 1024 / 1024} MB. Visible to members of ${t.teamName} only.`}>
      <form onSubmit={submit} className="space-y-4 p-5" noValidate>
        <Field label="File" required>
          {(p) => (
            <input
              {...p}
              type="file"
              disabled={uploading}
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
              className="block w-full cursor-pointer rounded-md border border-line-strong bg-surface text-body file:mr-3 file:cursor-pointer file:border-0 file:bg-surface-2 file:px-3 file:py-2.5 file:text-body file:font-medium"
            />
          )}
        </Field>
        <Field label="Description" hint="Optional">
          {(p) => <Textarea {...p} rows={2} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} disabled={uploading} />}
        </Field>
        {uploading && (
          <div>
            <div className="mb-1 flex justify-between text-caption text-ink-3">
              <span>Uploading…</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        )}
        {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={() => { handle.current?.cancel(); reset(); onOpenChange(false); }}>{uploading ? "Cancel upload" : "Close"}</Button>
          <Button type="submit" variant="primary" disabled={!file || !!validateFile(file) || uploading} loading={uploading}>
            <Upload size={16} aria-hidden="true" /> Upload
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function LinkDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing?: TeamResource | null }) {
  const t = useTeam();
  const { toast } = useToast();
  const [name, setName] = useState(editing?.name ?? "");
  const [url, setUrl] = useState(editing?.url ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [errors, setErrors] = useState<{ name?: string; url?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const isFile = editing?.kind === "file";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Give this resource a name.";
    let safeUrl = "";
    if (!editing) {
      const r = validateLink(url);
      if (!r.ok) next.url = r.error;
      else safeUrl = r.url;
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      if (editing) await updateResource(editing.id, { name, description });
      else await addLink(t.me, t.teamId, { name, description, url: safeUrl });
      toast({ tone: "success", title: editing ? "Resource updated" : "Link shared" });
      onOpenChange(false);
    } catch (err) {
      setErrors({ form: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={editing ? (isFile ? "Edit file details" : "Edit link") : "Add a link"} description={editing ? undefined : "Share a document, board or page with your team."}>
      <form onSubmit={submit} className="space-y-4 p-5" noValidate>
        <Field label="Name" required error={errors.name}>{(p) => <Input {...p} invalid={p.invalid} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
        {!editing && <Field label="Link" required error={errors.url}>{(p) => <Input {...p} invalid={p.invalid} type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />}</Field>}
        <Field label="Description" hint="Optional">{(p) => <Textarea {...p} rows={2} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
        {errors.form && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">{errors.form}</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}>{editing ? "Save" : "Add link"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ResourcesView() {
  const t = useTeam();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "file" | "link">("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [editing, setEditing] = useState<TeamResource | null>(null);
  const [deleting, setDeleting] = useState<TeamResource | null>(null);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return t.resources.filter(
      (r) => (kind === "all" || r.kind === kind) && (!n || `${r.name} ${r.description} ${r.uploadedByName}`.toLowerCase().includes(n)),
    );
  }, [t.resources, q, kind]);

  async function open(r: TeamResource) {
    try {
      const href = await getDownloadLink(r);
      window.open(href, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({ tone: "error", title: "Couldn't open this resource", description: storageMessage(e) });
    }
  }

  return (
    <div className="mx-auto h-full w-full max-w-4xl overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-heading font-semibold tracking-tight">Resources</h2>
          <p className="text-body text-ink-3">Files and links shared with {t.teamName}.</p>
        </div>
        <Menu
          trigger={<Button variant="primary"><Plus size={16} aria-hidden="true" /> Add</Button>}
        >
          <MenuItem onSelect={() => setUploadOpen(true)}><Upload size={15} aria-hidden="true" /> Upload a file</MenuItem>
          <MenuItem onSelect={() => { setEditing(null); setLinkOpen(true); }}><Link2 size={15} aria-hidden="true" /> Add a link</MenuItem>
        </Menu>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-3 text-ink-3" aria-hidden="true" />
          <label htmlFor="res-search" className="sr-only">Search resources</label>
          <Input id="res-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, description or person" className="pl-9" />
        </div>
        <div role="group" aria-label="Filter by type" className="inline-flex rounded-md bg-surface-2 p-1">
          {(["all", "file", "link"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cn("rounded px-3 py-1.5 text-body font-medium capitalize", kind === k ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink")}
            >
              {k === "all" ? "All" : k === "file" ? "Files" : "Links"}
            </button>
          ))}
        </div>
      </div>

      {t.resourcesState === "loading" && <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>}
      {t.resourcesState === "error" && <ErrorState title="Couldn't load resources" onRetry={t.retry}>Check your connection and try again.</ErrorState>}
      {t.resourcesState === "ready" && filtered.length === 0 && (
        <EmptyState icon={<FolderOpen size={22} />} title={t.resources.length ? "No matches" : "Nothing shared yet"}>
          {t.resources.length ? "Try a different search or filter." : "Upload a file or add a link so your team can find it later."}
        </EmptyState>
      )}
      {t.resourcesState === "ready" && filtered.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {filtered.map((r) => {
            const canManage = r.uploadedBy === t.me.uid || t.isLead;
            return (
              <li key={r.id} className="flex items-start gap-3 p-4">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface-2 text-ink-2" aria-hidden="true">
                  {r.kind === "file" ? <FileText size={18} /> : <Link2 size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium">{r.name}</p>
                  {r.description && <p className="line-clamp-2 text-body text-ink-2">{r.description}</p>}
                  <p className="mt-0.5 text-caption text-ink-3">
                    {r.kind === "file" ? `${formatBytes(r.size)} · ` : r.url ? `${new URL(r.url).hostname} · ` : ""}
                    {r.uploadedByName || "Former member"}
                    {r.updatedAt && ` · updated ${dateFmt.format(r.updatedAt)}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" onClick={() => void open(r)} aria-label={`${r.kind === "file" ? "Download" : "Open"} ${r.name}`}>
                    {r.kind === "file" ? <Download size={14} aria-hidden="true" /> : <ExternalLink size={14} aria-hidden="true" />}
                    <span className="max-sm:sr-only">{r.kind === "file" ? "Download" : "Open"}</span>
                  </Button>
                  {canManage && (
                    <>
                      <Button size="icon" variant="ghost" aria-label={`Edit ${r.name}`} onClick={() => { setEditing(r); setLinkOpen(true); }}><Pencil size={16} aria-hidden="true" /></Button>
                      <Button size="icon" variant="ghost" aria-label={`Delete ${r.name}`} onClick={() => setDeleting(r)}><Trash2 size={16} aria-hidden="true" /></Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      {linkOpen && <LinkDialog key={editing?.id ?? "new"} open={linkOpen} onOpenChange={(o) => { setLinkOpen(o); if (!o) setEditing(null); }} editing={editing} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ""}”?`}
        description={deleting?.kind === "file" ? "The file is permanently removed for everyone on the team." : "The link is removed for everyone on the team."}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteResource(deleting);
            toast({ tone: "success", title: "Resource deleted" });
          } catch (e) {
            toast({ tone: "error", title: "Couldn't delete it", description: storageMessage(e) });
          }
        }}
      />
    </div>
  );
}

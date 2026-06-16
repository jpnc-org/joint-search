import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderPlus, FileUp, Trash2, Folder as FolderIcon, FileText, ChevronRight, Plus } from 'lucide-react';
import api from '@/api/client';
import type { FileItem, Folder, Tag, KnowledgeBase } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function KnowledgeBasePage() {
  const { knowledgeBaseId, folderId } = useParams<{ knowledgeBaseId?: string; folderId?: string }>();
  const navigate = useNavigate();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [breadcrumbPath, setBreadcrumbPath] = useState<{ id: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKBName, setNewKBName] = useState('');
  const [newKBDesc, setNewKBDesc] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeKBId = knowledgeBaseId ?? null;
  const activeFolderId = folderId ?? null;

  const loadKBs = useCallback(async () => {
    const { data } = await api.get('/knowledge-bases');
    setKnowledgeBases(data);
    if (data.length > 0 && !activeKBId) {
      navigate(`/knowledge-base/${data[0].id}`, { replace: true });
    }
  }, [activeKBId, navigate]);

  useEffect(() => { loadKBs(); }, []);

  const loadKBContent = useCallback(async () => {
    if (!activeKBId) return;
    if (!activeFolderId) {
      const [fRes, tRes] = await Promise.all([
        api.get(`/knowledge-bases/${activeKBId}/folders`),
        api.get(`/knowledge-bases/${activeKBId}/tags`),
      ]);
      setFolders(fRes.data);
      setTags(tRes.data);
      setFiles([]);
      setBreadcrumbPath([]);
      return;
    }
    const [tRes, folderRes, childrenRes, filesRes] = await Promise.all([
      api.get(`/knowledge-bases/${activeKBId}/tags`),
      api.get(`/knowledge-bases/${activeKBId}/folders/${activeFolderId}`),
      api.get(`/knowledge-bases/${activeKBId}/folders/${activeFolderId}/children`),
      api.get(`/knowledge-bases/${activeKBId}/folders/${activeFolderId}/files`),
    ]);
    setTags(tRes.data);
    setBreadcrumbPath(folderRes.data.path);
    setFolders(childrenRes.data);
    setFiles(filesRes.data);
  }, [activeKBId, activeFolderId]);

  useEffect(() => { loadKBContent(); }, [loadKBContent]);

  const selectKB = (id: string) => {
    navigate(`/knowledge-base/${id}`);
  };

  const navigateToFolder = (targetFolderId: string | null) => {
    if (!activeKBId) return;
    if (targetFolderId === null) {
      navigate(`/knowledge-base/${activeKBId}`);
    } else {
      navigate(`/knowledge-base/${activeKBId}/folder/${targetFolderId}`);
    }
  };

  const createKB = async () => {
    if (!newKBName.trim()) return;
    const tempId = crypto.randomUUID();
    const optimisticKB: KnowledgeBase = { id: tempId, userId: '', name: newKBName, description: newKBDesc || null, createdAt: new Date().toISOString() };
    setKnowledgeBases((prev) => [optimisticKB, ...prev]);
    setShowCreateDialog(false);
    setNewKBName('');
    setNewKBDesc('');
    try {
      const { data } = await api.post('/knowledge-bases', { name: optimisticKB.name, description: optimisticKB.description });
      setKnowledgeBases((prev) => prev.map((kb) => (kb.id === tempId ? data : kb)));
      navigate(`/knowledge-base/${data.id}`, { replace: true });
    } catch {
      setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== tempId));
    }
  };

  const deleteKB = async (id: string) => {
    const prev = knowledgeBases;
    setKnowledgeBases((prev.filter((kb) => kb.id !== id)));
    if (activeKBId === id) {
      const remaining = prev.filter((kb) => kb.id !== id);
      if (remaining.length > 0) {
        navigate(`/knowledge-base/${remaining[0].id}`, { replace: true });
      } else {
        navigate('/knowledge-base', { replace: true });
      }
    }
    try {
      await api.delete(`/knowledge-bases/${id}`);
    } catch {
      setKnowledgeBases(prev);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim() || !activeKBId) return;
    const tempId = crypto.randomUUID();
    const optimistic: Folder = { id: tempId, userId: '', knowledgeBaseId: activeKBId, name: newFolderName, parentId: activeFolderId, createdAt: new Date().toISOString() };
    setFolders((prev) => [...prev, optimistic]);
    setNewFolderName('');
    try {
      const { data } = await api.post(`/knowledge-bases/${activeKBId}/folders`, { name: optimistic.name, parentId: activeFolderId });
      setFolders((prev) => prev.map((f) => (f.id === tempId ? data : f)));
    } catch {
      setFolders((prev) => prev.filter((f) => f.id !== tempId));
    }
  };

  const deleteFolder = async (id: string) => {
    const prev = folders;
    setFolders((prev.filter((f) => f.id !== id)));
    try {
      await api.delete(`/knowledge-bases/${activeKBId}/folders/${id}`);
    } catch {
      setFolders(prev);
    }
  };

  const createTag = async () => {
    if (!newTagName.trim() || !activeKBId) return;
    const tempId = crypto.randomUUID();
    const optimistic: Tag = { id: tempId, userId: '', knowledgeBaseId: activeKBId, name: newTagName, color: newTagColor, createdAt: new Date().toISOString() };
    setTags((prev) => [...prev, optimistic]);
    setNewTagName('');
    try {
      const { data } = await api.post(`/knowledge-bases/${activeKBId}/tags`, { name: optimistic.name, color: optimistic.color });
      setTags((prev) => prev.map((t) => (t.id === tempId ? data : t)));
    } catch {
      setTags((prev) => prev.filter((t) => t.id !== tempId));
    }
  };

  const deleteTag = async (id: string) => {
    const prev = tags;
    setTags((prev.filter((t) => t.id !== id)));
    try {
      await api.delete(`/knowledge-bases/${activeKBId}/tags/${id}`);
    } catch {
      setTags(prev);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeKBId) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const uploadUrl = activeFolderId
      ? `/knowledge-bases/${activeKBId}/folders/${activeFolderId}/files/upload`
      : `/knowledge-bases/${activeKBId}/files/upload`;
    await api.post(uploadUrl, fd);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (activeFolderId) {
      const { data } = await api.get(`/knowledge-bases/${activeKBId}/folders/${activeFolderId}/files`);
      setFiles(data);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !activeKBId) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const uploadUrl = activeFolderId
      ? `/knowledge-bases/${activeKBId}/folders/${activeFolderId}/files/upload`
      : `/knowledge-bases/${activeKBId}/files/upload`;
    await api.post(uploadUrl, fd);
    setUploading(false);
    if (activeFolderId) {
      const { data } = await api.get(`/knowledge-bases/${activeKBId}/folders/${activeFolderId}/files`);
      setFiles(data);
    }
  };

  const deleteFile = async (id: string) => {
    const prev = files;
    setFiles((prev.filter((f) => f.id !== id)));
    try {
      await api.delete(`/knowledge-bases/${activeKBId}/files/${id}`);
    } catch {
      setFiles(prev);
    }
  };

  const addTagToFile = async (fileId: string, tagId: string) => {
    try {
      await api.post(`/knowledge-bases/${activeKBId}/files/${fileId}/tags`, { tagId });
      if (activeFolderId) {
        const { data } = await api.get(`/knowledge-bases/${activeKBId}/folders/${activeFolderId}/files`);
        setFiles(data);
      }
    } catch {}
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar: Tags */}
      <div className="flex w-64 shrink-0 flex-col border-r border-border">
        {activeKBId && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <h2 className="px-1 text-xs font-medium text-muted-foreground">Tags</h2>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="size-7 cursor-pointer rounded-full border-0 bg-transparent"
              />
              <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tag name" className="h-7 text-xs" />
              <Button onClick={createTag} size="sm" className="h-7 px-2 cursor-pointer">Add</Button>
            </div>
            <div className="space-y-1">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between rounded-md bg-secondary px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className="text-xs">{tag.name}</span>
                  </div>
                  <button onClick={() => deleteTag(tag.id)} className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 cursor-pointer">
                    <Trash2 className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header bar with knowledge base switcher */}
        <div className="flex items-center gap-3 border-b px-4 py-2.5">
          <Button onClick={() => navigate('/chat')} variant="ghost" size="icon" className="size-8 shrink-0 cursor-pointer">
            <ArrowLeft className="size-4" />
          </Button>
          <Select
            value={activeKBId ?? ''}
            onValueChange={selectKB}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select a knowledge base" />
            </SelectTrigger>
            <SelectContent>
              {knowledgeBases.map((kb) => (
                <SelectItem key={kb.id} value={kb.id}>
                  <span>{kb.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowCreateDialog(true)} variant="outline" size="sm" className="cursor-pointer">
            <Plus className="size-3.5" /> New Knowledge Base
          </Button>
          {activeKBId && (
            <Button
              onClick={() => deleteKB(activeKBId)}
              variant="ghost"
              size="sm"
              className="ml-auto text-destructive cursor-pointer"
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          )}
        </div>

        {!activeKBId ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">Select or create a knowledge base.</p>
          </div>
        ) : (
          <>
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1 border-b px-4 py-2 text-sm">
              <button onClick={() => navigateToFolder(null)} className="text-primary hover:underline cursor-pointer">
                {knowledgeBases.find((kb) => kb.id === activeKBId)?.name}
              </button>
              {breadcrumbPath.map((seg) => (
                <span key={seg.id} className="flex items-center gap-1">
                  <ChevronRight className="size-3 text-muted-foreground" />
                  <button onClick={() => navigateToFolder(seg.id)} className="text-primary hover:underline cursor-pointer">
                    {seg.name}
                  </button>
                </span>
              ))}
            </div>

            {/* Folders + Files */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Folders</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="New folder" className="h-8 text-xs" />
                    <Button onClick={createFolder} size="sm" className="cursor-pointer"><FolderPlus className="size-3.5" /> Create</Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => navigateToFolder(folder.id)}
                        className="group flex items-center justify-between rounded-lg bg-secondary p-2.5 text-left text-sm transition-colors hover:bg-accent cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FolderIcon className="size-4 shrink-0 text-primary" />
                          <span className="truncate">{folder.name}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }}
                          className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </button>
                    ))}
                    {folders.length === 0 && (
                      <p className="col-span-3 text-xs text-muted-foreground">No folders yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Files</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div
                    className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:border-primary"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <input ref={fileInputRef} type="file" onChange={handleUpload} className="hidden" id="file-upload" />
                    <label htmlFor="file-upload" className="flex cursor-pointer flex-col items-center gap-2 text-sm text-muted-foreground">
                      <FileUp className="size-5" />
                      {uploading ? 'Uploading...' : 'Drop file here or click to upload'}
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    {files.map((file) => (
                      <div key={file.id} className="flex items-center justify-between rounded-lg bg-secondary p-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="size-4 shrink-0 text-primary" />
                          <span className="truncate text-sm">{file.originalName}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                          {file.tags.map((tag) => (
                            <span key={tag.id} className="inline-flex shrink-0 items-center gap-1.5 text-xs">
                              <span className="size-2 rounded-full border border-white" style={{ backgroundColor: tag.color }} />
                              {tag.name}
                            </span>
                          ))}
                        </div>
                        <div className="flex shrink-0 items-center gap-1 pl-2">
                          <Select onValueChange={(v) => addTagToFile(file.id, v)}>
                            <SelectTrigger className="h-7 w-[80px] text-xs"><span className="text-muted-foreground">+ Tag</span></SelectTrigger>
                            <SelectContent>
                              {tags.map((tag) => <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button onClick={() => deleteFile(file.id)} variant="ghost" size="icon" className="size-7 text-destructive cursor-pointer">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {files.length === 0 && (
                      <p className="text-xs text-muted-foreground">No files yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* Create Knowledge Base Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Knowledge Base</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="kb-name">Name</Label>
              <Input
                id="kb-name"
                value={newKBName}
                onChange={(e) => setNewKBName(e.target.value)}
                placeholder="e.g. Research Papers"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-desc">Description (optional)</Label>
              <Input
                id="kb-desc"
                value={newKBDesc}
                onChange={(e) => setNewKBDesc(e.target.value)}
                placeholder="What is this knowledge base for?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="cursor-pointer">Cancel</Button>
            <Button onClick={createKB} disabled={!newKBName.trim()} className="cursor-pointer">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

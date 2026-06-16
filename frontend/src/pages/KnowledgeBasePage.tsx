import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, FileUp, Trash2, Folder as FolderIcon, FileText } from 'lucide-react';
import api from '@/api/client';
import type { FileItem, Folder, Tag, KnowledgeBase } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

export default function KnowledgeBasePage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [newFolderName, setNewFolderName] = useState('');
  const [newKBName, setNewKBName] = useState('');
  const [newKBDesc, setNewKBDesc] = useState('');

  const loadAll = useCallback(async () => {
    const [fRes, foRes, tRes, kbRes] = await Promise.all([
      api.get('/files', { params: activeFolderId ? { folderId: activeFolderId } : {} }),
      api.get('/folders'),
      api.get('/tags'),
      api.get('/knowledge-bases'),
    ]);
    setFiles(fRes.data);
    setFolders(foRes.data);
    setTags(tRes.data);
    setKnowledgeBases(kbRes.data);
  }, [activeFolderId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    if (activeFolderId) fd.append('folderId', activeFolderId);
    await api.post('/files/upload', fd);
    setUploading(false);
    loadAll();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    if (activeFolderId) fd.append('folderId', activeFolderId);
    await api.post('/files/upload', fd);
    setUploading(false);
    loadAll();
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    await api.post('/folders', { name: newFolderName, parentId: activeFolderId });
    setNewFolderName('');
    loadAll();
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;
    await api.post('/tags', { name: newTagName, color: newTagColor });
    setNewTagName('');
    loadAll();
  };

  const createKB = async () => {
    if (!newKBName.trim()) return;
    await api.post('/knowledge-bases', { name: newKBName, description: newKBDesc });
    setNewKBName('');
    setNewKBDesc('');
    loadAll();
  };

  const folderTree = folders.filter((f) => f.parentId === activeFolderId);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Knowledge Base</h1>
          <Button onClick={() => navigate('/chat')} variant="secondary" size="sm">Back to Chat</Button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <button onClick={() => setActiveFolderId(null)} className="text-primary hover:underline">Root</button>
              {activeFolderId && (
                <>
                  <span>/</span>
                  <span>{folders.find((f) => f.id === activeFolderId)?.name}</span>
                </>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Folders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="New folder" />
                  <Button onClick={createFolder} size="sm"><FolderPlus className="size-4" /> Create</Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {folderTree.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => setActiveFolderId(folder.id)}
                      className="flex items-center gap-2 rounded-lg bg-secondary p-2.5 text-left text-sm transition-colors hover:bg-accent"
                    >
                      <FolderIcon className="size-4 shrink-0 text-primary" />
                      <span className="truncate">{folder.name}</span>
                    </button>
                  ))}
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
                  <input type="file" onChange={handleUpload} className="hidden" id="file-upload" />
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
                        <span className="shrink-0 text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)}KB</span>
                        {file.tags.map((tag) => (
                          <Badge key={tag.id} className="shrink-0 text-xs" style={{ backgroundColor: tag.color }}>{tag.name}</Badge>
                        ))}
                      </div>
                      <div className="flex shrink-0 items-center gap-1 pl-2">
                        <Select onValueChange={(v) => { api.post(`/files/${file.id}/tags`, { tagId: v }).then(loadAll); }}>
                          <SelectTrigger className="h-7 w-[90px] text-xs"><span className="text-muted-foreground">+Tag</span></SelectTrigger>
                          <SelectContent>
                            {tags.map((tag) => <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select onValueChange={(v) => { api.post(`/knowledge-bases/${v}/files`, { fileIds: [file.id] }).then(loadAll); }}>
                          <SelectTrigger className="h-7 w-[90px] text-xs"><span className="text-muted-foreground">+KB</span></SelectTrigger>
                          <SelectContent>
                            {knowledgeBases.map((kb) => <SelectItem key={kb.id} value={kb.id}>{kb.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button onClick={() => api.delete(`/files/${file.id}`).then(loadAll)} variant="ghost" size="icon" className="size-7 text-destructive">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tags</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="size-8 cursor-pointer rounded border-0 bg-transparent" />
                  <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tag name" />
                  <Button onClick={createTag} size="sm">Add</Button>
                </div>
                <Separator />
                <div className="space-y-1">
                  {tags.map((tag) => (
                    <div key={tag.id} className="flex items-center justify-between rounded-lg bg-secondary p-2">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                        <span className="text-sm">{tag.name}</span>
                      </div>
                      <Button onClick={() => api.delete(`/tags/${tag.id}`).then(loadAll)} variant="ghost" size="icon" className="size-6 text-destructive">
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Knowledge Bases</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Input value={newKBName} onChange={(e) => setNewKBName(e.target.value)} placeholder="KB name" />
                  <Input value={newKBDesc} onChange={(e) => setNewKBDesc(e.target.value)} placeholder="Description" />
                  <Button onClick={createKB} size="sm" className="w-full">Create</Button>
                </div>
                <Separator />
                <div className="space-y-1.5">
                  {knowledgeBases.map((kb) => (
                    <div key={kb.id} className="rounded-lg bg-secondary p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{kb.name}</span>
                        <Button onClick={() => api.delete(`/knowledge-bases/${kb.id}`).then(loadAll)} variant="ghost" size="icon" className="size-6 text-destructive">
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                      {kb.description && <p className="mt-1 text-xs text-muted-foreground">{kb.description}</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

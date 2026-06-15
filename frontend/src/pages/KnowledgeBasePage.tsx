import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import type { FileItem, Folder, Tag, KnowledgeBase } from '../types';

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

  const inputStyle = {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface-0)' }}>
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Knowledge Base</h1>
          <button onClick={() => navigate('/')} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)' }}>
            Back to Chat
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left */}
          <div className="lg:col-span-2 space-y-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <button onClick={() => setActiveFolderId(null)} className="hover:underline" style={{ color: 'var(--color-accent)' }}>Root</button>
              {activeFolderId && (
                <>
                  <span>/</span>
                  <span>{folders.find((f) => f.id === activeFolderId)?.name}</span>
                </>
              )}
            </div>

            {/* Folders */}
            <div className="rounded-xl p-4" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
              <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>Folders</h2>
              <div className="flex gap-2 mb-3">
                <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="New folder" className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none" style={inputStyle} />
                <button onClick={createFolder} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-accent)', color: '#fff' }}>Create</button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {folderTree.map((folder) => (
                  <button key={folder.id} onClick={() => setActiveFolderId(folder.id)} className="flex items-center gap-2 p-2.5 rounded-lg text-sm text-left transition-colors" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)' }}>
                    <span style={{ color: 'var(--color-accent)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                    </span>
                    <span className="truncate">{folder.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Files */}
            <div className="rounded-xl p-4" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
              <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>Files</h2>
              <div className="rounded-lg p-6 text-center mb-3 transition-colors cursor-pointer" style={{ border: '2px dashed var(--color-border)' }} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
                <input type="file" onChange={handleUpload} className="hidden" id="file-upload" />
                <label htmlFor="file-upload" className="cursor-pointer text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {uploading ? 'Uploading...' : 'Drop file here or click to upload'}
                </label>
              </div>
              <div className="space-y-1.5">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span style={{ color: 'var(--color-accent)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                      </span>
                      <span className="text-sm truncate" style={{ color: 'var(--color-text)' }}>{file.originalName}</span>
                      <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>{(file.size / 1024).toFixed(0)}KB</span>
                      {file.tags.map((tag) => (
                        <span key={tag.id} className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: tag.color, color: '#fff' }}>{tag.name}</span>
                      ))}
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <select onChange={(e) => { if (e.target.value) { api.post(`/files/${file.id}/tags`, { tagId: e.target.value }).then(loadAll); e.target.value = ''; } }} className="text-xs rounded px-1 outline-none" style={inputStyle} defaultValue="">
                        <option value="">+Tag</option>
                        {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                      </select>
                      <select onChange={(e) => { if (e.target.value) { api.post(`/knowledge-bases/${e.target.value}/files`, { fileIds: [file.id] }).then(loadAll); e.target.value = ''; } }} className="text-xs rounded px-1 outline-none" style={inputStyle} defaultValue="">
                        <option value="">+KB</option>
                        {knowledgeBases.map((kb) => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
                      </select>
                      <button onClick={() => api.delete(`/files/${file.id}`).then(loadAll)} className="text-xs px-1" style={{ color: 'var(--color-danger)' }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="space-y-4">
            {/* Tags */}
            <div className="rounded-xl p-4" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
              <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>Tags</h2>
              <div className="flex gap-2 mb-3">
                <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" style={{ background: 'transparent' }} />
                <input type="text" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tag name" className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none" style={inputStyle} />
                <button onClick={createTag} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-accent)', color: '#fff' }}>Add</button>
              </div>
              <div className="space-y-1">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: tag.color }} />
                      <span className="text-sm" style={{ color: 'var(--color-text)' }}>{tag.name}</span>
                    </div>
                    <button onClick={() => api.delete(`/tags/${tag.id}`).then(loadAll)} className="text-xs" style={{ color: 'var(--color-danger)' }}>×</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Knowledge Bases */}
            <div className="rounded-xl p-4" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
              <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>Knowledge Bases</h2>
              <div className="space-y-2 mb-3">
                <input type="text" value={newKBName} onChange={(e) => setNewKBName(e.target.value)} placeholder="KB name" className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={inputStyle} />
                <input type="text" value={newKBDesc} onChange={(e) => setNewKBDesc(e.target.value)} placeholder="Description" className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={inputStyle} />
                <button onClick={createKB} className="w-full py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-accent)', color: '#fff' }}>Create</button>
              </div>
              <div className="space-y-1.5">
                {knowledgeBases.map((kb) => (
                  <div key={kb.id} className="p-2.5 rounded-lg" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{kb.name}</span>
                      <button onClick={() => api.delete(`/knowledge-bases/${kb.id}`).then(loadAll)} className="text-xs" style={{ color: 'var(--color-danger)' }}>×</button>
                    </div>
                    {kb.description && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{kb.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

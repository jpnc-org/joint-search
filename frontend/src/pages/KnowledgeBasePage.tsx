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

  // New tag/KB form states
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

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    if (activeFolderId) formData.append('folderId', activeFolderId);
    await api.post('/files/upload', formData);
    setUploading(false);
    loadAll();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    if (activeFolderId) formData.append('folderId', activeFolderId);
    await api.post('/files/upload', formData);
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

  const deleteFile = async (id: string) => {
    await api.delete(`/files/${id}`);
    loadAll();
  };

  const deleteFolder = async (id: string) => {
    await api.delete(`/folders/${id}`);
    loadAll();
  };

  const deleteTag = async (id: string) => {
    await api.delete(`/tags/${id}`);
    loadAll();
  };

  const createKB = async () => {
    if (!newKBName.trim()) return;
    await api.post('/knowledge-bases', { name: newKBName, description: newKBDesc });
    setNewKBName('');
    setNewKBDesc('');
    loadAll();
  };

  const deleteKB = async (id: string) => {
    await api.delete(`/knowledge-bases/${id}`);
    loadAll();
  };

  const assignTagToFile = async (fileId: string, tagId: string) => {
    await api.post(`/files/${fileId}/tags`, { tagId });
    loadAll();
  };

  const addFileToKB = async (kbId: string, fileId: string) => {
    await api.post(`/knowledge-bases/${kbId}/files`, { fileIds: [fileId] });
    loadAll();
  };

  const folderTree = folders.filter((f) => f.parentId === activeFolderId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
          >
            Back to Chat
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Folders & Files */}
          <div className="lg:col-span-2 space-y-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <button
                onClick={() => setActiveFolderId(null)}
                className="hover:text-indigo-600"
              >
                Root
              </button>
              {activeFolderId && (
                <>
                  <span>/</span>
                  <span>{folders.find((f) => f.id === activeFolderId)?.name}</span>
                </>
              )}
            </div>

            {/* Folders */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h2 className="font-semibold mb-3">Folders</h2>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="New folder name"
                  className="flex-1 px-3 py-1 border rounded text-sm"
                />
                <button
                  onClick={createFolder}
                  className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                >
                  Create
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {folderTree.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 cursor-pointer"
                    onClick={() => setActiveFolderId(folder.id)}
                  >
                    <span className="text-sm truncate">📁 {folder.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFolder(folder.id);
                      }}
                      className="text-red-500 text-xs hover:text-red-700"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Files */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h2 className="font-semibold mb-3">Files</h2>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center mb-3 hover:border-indigo-400 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  onChange={handleUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer text-gray-600">
                  {uploading ? 'Uploading...' : 'Drop file here or click to upload'}
                </label>
              </div>
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2 border rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{file.originalName}</span>
                      <span className="text-xs text-gray-400">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                      {file.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="text-xs px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <select
                        onChange={(e) => {
                          if (e.target.value) assignTagToFile(file.id, e.target.value);
                          e.target.value = '';
                        }}
                        className="text-xs border rounded px-1"
                        defaultValue=""
                      >
                        <option value="">+ Tag</option>
                        {tags.map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.name}
                          </option>
                        ))}
                      </select>
                      <select
                        onChange={(e) => {
                          if (e.target.value) addFileToKB(e.target.value, file.id);
                          e.target.value = '';
                        }}
                        className="text-xs border rounded px-1"
                        defaultValue=""
                      >
                        <option value="">+ KB</option>
                        {knowledgeBases.map((kb) => (
                          <option key={kb.id} value={kb.id}>
                            {kb.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => deleteFile(file.id)}
                        className="text-red-500 text-xs hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Tags & Knowledge Bases */}
          <div className="space-y-4">
            {/* Tags */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h2 className="font-semibold mb-3">Tags</h2>
              <div className="flex gap-2 mb-3">
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-8 h-8 border rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name"
                  className="flex-1 px-3 py-1 border rounded text-sm"
                />
                <button
                  onClick={createTag}
                  className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                >
                  Add
                </button>
              </div>
              <div className="space-y-1">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between p-2 rounded">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm">{tag.name}</span>
                    </div>
                    <button
                      onClick={() => deleteTag(tag.id)}
                      className="text-red-500 text-xs hover:text-red-700"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Knowledge Bases */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h2 className="font-semibold mb-3">Knowledge Bases</h2>
              <div className="space-y-2 mb-3">
                <input
                  type="text"
                  value={newKBName}
                  onChange={(e) => setNewKBName(e.target.value)}
                  placeholder="KB name"
                  className="w-full px-3 py-1 border rounded text-sm"
                />
                <input
                  type="text"
                  value={newKBDesc}
                  onChange={(e) => setNewKBDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full px-3 py-1 border rounded text-sm"
                />
                <button
                  onClick={createKB}
                  className="w-full px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                >
                  Create Knowledge Base
                </button>
              </div>
              <div className="space-y-2">
                {knowledgeBases.map((kb) => (
                  <div key={kb.id} className="p-2 border rounded">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{kb.name}</span>
                      <button
                        onClick={() => deleteKB(kb.id)}
                        className="text-red-500 text-xs hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                    {kb.description && (
                      <p className="text-xs text-gray-500 mt-1">{kb.description}</p>
                    )}
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

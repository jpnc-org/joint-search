import { Router, Response } from 'express';
import { IsNull } from 'typeorm';
import { AppDataSource } from '../utils/database';
import { KnowledgeBase, Tag, File, Folder } from '../entities';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const kbRepo = () => AppDataSource.getRepository(KnowledgeBase);
const tagRepo = () => AppDataSource.getRepository(Tag);
const fileRepo = () => AppDataSource.getRepository(File);
const folderRepo = () => AppDataSource.getRepository(Folder);

interface MentionItem {
  id: string;
  type: 'knowledge-base' | 'tag' | 'file';
  name: string;
  path: string;
  kbId: string;
  kbName: string;
}

async function buildFolderPath(folderId: string): Promise<string> {
  const segments: string[] = [];
  let current: Folder | null = await folderRepo().findOne({ where: { id: folderId } });
  while (current) {
    segments.unshift(current.name);
    if (current.parentId) {
      current = await folderRepo().findOne({ where: { id: current.parentId } });
    } else {
      current = null;
    }
  }
  return segments.join('/');
}

async function resolveFolder(
  userId: string,
  kbId: string,
  parts: string[],
): Promise<{ folder: Folder; pathSegments: string[] } | null> {
  if (parts.length === 0) return null;

  const rootFolders = await folderRepo().find({
    where: { userId, knowledgeBaseId: kbId, parentId: IsNull() },
  });
  let current: Folder | null | undefined = rootFolders.find(
    (f) => f.name.toLowerCase() === parts[0].toLowerCase()
  );
  if (!current) return null;

  const pathSegments: string[] = [current.name];
  for (let i = 1; i < parts.length; i++) {
    const children = await folderRepo().find({
      where: { userId, knowledgeBaseId: kbId, parentId: current!.id },
    });
    const next = children.find((c) => c.name.toLowerCase() === parts[i].toLowerCase());
    if (!next) return null;
    current = next;
    pathSegments.push(next.name);
  }

  return { folder: current, pathSegments };
}

async function findFilesRecursively(
  userId: string,
  kbId: string,
  startFolderId: string | null,
  kbName: string,
  pathPrefix: string,
): Promise<MentionItem[]> {
  const results: MentionItem[] = [];

  if (startFolderId !== null) {
    const files = await fileRepo().find({
      where: { userId, knowledgeBaseId: kbId, folderId: startFolderId },
      order: { name: 'ASC' },
    });
    for (const file of files) {
      results.push({
        id: file.id,
        type: 'file' as const,
        name: file.name,
        path: pathPrefix ? `${kbName}/${pathPrefix}/${file.name}` : `${kbName}/${file.name}`,
        kbId,
        kbName,
      });
    }

    const subfolders = await folderRepo().find({
      where: { userId, knowledgeBaseId: kbId, parentId: startFolderId },
    });
    for (const sf of subfolders) {
      const subResults = await findFilesRecursively(
        userId, kbId, sf.id, kbName,
        pathPrefix ? `${pathPrefix}/${sf.name}` : sf.name,
      );
      results.push(...subResults);
    }
  } else {
    const rootFiles = await fileRepo().find({
      where: { userId, knowledgeBaseId: kbId, folderId: IsNull() },
      order: { name: 'ASC' },
    });
    for (const file of rootFiles) {
      results.push({
        id: file.id,
        type: 'file' as const,
        name: file.name,
        path: `${kbName}/${file.name}`,
        kbId,
        kbName,
      });
    }

    const rootFolders = await folderRepo().find({
      where: { userId, knowledgeBaseId: kbId, parentId: IsNull() },
    });
    for (const rf of rootFolders) {
      const subResults = await findFilesRecursively(
        userId, kbId, rf.id, kbName, rf.name,
      );
      results.push(...subResults);
    }
  }

  return results;
}

function dedupeByPath(items: MentionItem[]): MentionItem[] {
  const seen = new Set<string>();
  const out: MentionItem[] = [];
  for (const item of items) {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    const qLower = q.toLowerCase();
    const results: MentionItem[] = [];
    const userId = req.userId!;

    const kbs = await kbRepo().find({
      where: { userId },
      order: { name: 'ASC' },
    });

    const parts = q.split('/');
    const kbPart = parts[0] || '';
    const hasSlash = q.includes('/');

    if (!q) {
      for (const kb of kbs) {
        results.push({
          id: kb.id, type: 'knowledge-base', name: kb.name, path: kb.name,
          kbId: kb.id, kbName: kb.name,
        });
        const tags = await tagRepo().find({
          where: { userId, knowledgeBaseId: kb.id },
          order: { name: 'ASC' },
        });
        for (const tag of tags) {
          results.push({
            id: tag.id, type: 'tag', name: tag.name,
            path: `${kb.name}/${tag.name}`,
            kbId: kb.id, kbName: kb.name,
          });
        }
      }
    } else if (!hasSlash) {
      const matchedKBs = new Set<string>();
      for (const kb of kbs) {
        if (kb.name.toLowerCase().includes(qLower)) {
          matchedKBs.add(kb.id);
          results.push({
            id: kb.id, type: 'knowledge-base', name: kb.name, path: kb.name,
            kbId: kb.id, kbName: kb.name,
          });
          const tags = await tagRepo().find({
            where: { userId, knowledgeBaseId: kb.id },
            order: { name: 'ASC' },
          });
          for (const tag of tags) {
            results.push({
              id: tag.id, type: 'tag', name: tag.name,
              path: `${kb.name}/${tag.name}`,
              kbId: kb.id, kbName: kb.name,
            });
          }
        }
      }

      const seenTagIds = new Set(results.filter((r) => r.type === 'tag').map((r) => r.id));

      for (const kb of kbs) {
        const tags = await tagRepo().find({
          where: { userId, knowledgeBaseId: kb.id },
          order: { name: 'ASC' },
        });
        for (const tag of tags) {
          if (seenTagIds.has(tag.id)) continue;
          if (tag.name.toLowerCase().includes(qLower)) {
            seenTagIds.add(tag.id);
            results.push({
              id: tag.id, type: 'tag', name: tag.name,
              path: `${kb.name}/${tag.name}`,
              kbId: kb.id, kbName: kb.name,
            });
          }
        }

        const allKbFiles = await findFilesRecursively(userId, kb.id, null, kb.name, '');
        for (const fileItem of allKbFiles) {
          if (fileItem.name.toLowerCase().includes(qLower)) {
            results.push(fileItem);
          }
        }
      }
    } else {
      const matchingKB = kbs.find((kb) => kb.name.toLowerCase() === kbPart.toLowerCase());
      if (!matchingKB) {
        res.json([]);
        return;
      }
      const kb = matchingKB;

      if (parts.length === 1) {
        const tags = await tagRepo().find({
          where: { userId, knowledgeBaseId: kb.id },
          order: { name: 'ASC' },
        });
        for (const tag of tags) {
          results.push({
            id: tag.id, type: 'tag', name: tag.name,
            path: `${kb.name}/${tag.name}`,
            kbId: kb.id, kbName: kb.name,
          });
        }

        const rootFolders = await folderRepo().find({
          where: { userId, knowledgeBaseId: kb.id, parentId: IsNull() },
          order: { name: 'ASC' },
        });
        for (const folder of rootFolders) {
          results.push({
            id: folder.id, type: 'file', name: folder.name,
            path: `${kb.name}/${folder.name}`,
            kbId: kb.id, kbName: kb.name,
          });
        }

        const rootFiles = await fileRepo().find({
          where: { userId, knowledgeBaseId: kb.id, folderId: IsNull() },
          order: { name: 'ASC' },
        });
        for (const file of rootFiles) {
          results.push({
            id: file.id, type: 'file', name: file.name,
            path: `${kb.name}/${file.name}`,
            kbId: kb.id, kbName: kb.name,
          });
        }
      } else {
        const lastPart = parts[parts.length - 1];
        const hasTrailingSlash = q.endsWith('/');
        const isFilterMode = lastPart !== '' && !hasTrailingSlash;

        const folderParts = isFilterMode
          ? parts.slice(1, -1)
          : parts.slice(1).filter((p) => p !== '');

        const filter = isFilterMode ? lastPart.toLowerCase() : '';

        if (folderParts.length === 0) {
          const tags = await tagRepo().find({
            where: { userId, knowledgeBaseId: kb.id },
            order: { name: 'ASC' },
          });
          for (const tag of tags) {
            if (!filter || tag.name.toLowerCase().includes(filter)) {
              results.push({
                id: tag.id, type: 'tag', name: tag.name,
                path: `${kb.name}/${tag.name}`,
                kbId: kb.id, kbName: kb.name,
              });
            }
          }

          const rootFolders = await folderRepo().find({
            where: { userId, knowledgeBaseId: kb.id, parentId: IsNull() },
            order: { name: 'ASC' },
          });
          for (const folder of rootFolders) {
            if (!filter || folder.name.toLowerCase().includes(filter)) {
              results.push({
                id: folder.id, type: 'file', name: folder.name,
                path: `${kb.name}/${folder.name}`,
                kbId: kb.id, kbName: kb.name,
              });
            }
          }

          if (filter) {
            const allKbFiles = await findFilesRecursively(userId, kb.id, null, kb.name, '');
            for (const fileItem of allKbFiles) {
              if (fileItem.name.toLowerCase().includes(filter)) {
                results.push(fileItem);
              }
            }
          } else {
            const rootFiles = await fileRepo().find({
              where: { userId, knowledgeBaseId: kb.id, folderId: IsNull() },
              order: { name: 'ASC' },
            });
            for (const file of rootFiles) {
              results.push({
                id: file.id, type: 'file', name: file.name,
                path: `${kb.name}/${file.name}`,
                kbId: kb.id, kbName: kb.name,
              });
            }
          }
        } else {
          const resolved = await resolveFolder(userId, kb.id, folderParts);
          if (!resolved) {
            res.json([]);
            return;
          }
          const { folder, pathSegments } = resolved;
          const folderPathStr = pathSegments.join('/');

          const subfolders = await folderRepo().find({
            where: { userId, knowledgeBaseId: kb.id, parentId: folder.id },
            order: { name: 'ASC' },
          });
          for (const sf of subfolders) {
            if (!filter || sf.name.toLowerCase().includes(filter)) {
              results.push({
                id: sf.id, type: 'file', name: sf.name,
                path: `${kb.name}/${folderPathStr}/${sf.name}`,
                kbId: kb.id, kbName: kb.name,
              });
            }
          }

          if (filter) {
            const subtreeFiles = await findFilesRecursively(
              userId, kb.id, folder.id, kb.name, folderPathStr,
            );
            for (const fileItem of subtreeFiles) {
              if (fileItem.name.toLowerCase().includes(filter)) {
                results.push(fileItem);
              }
            }
          } else {
            const directFiles = await fileRepo().find({
              where: { userId, knowledgeBaseId: kb.id, folderId: folder.id },
              order: { name: 'ASC' },
            });
            for (const file of directFiles) {
              results.push({
                id: file.id, type: 'file', name: file.name,
                path: `${kb.name}/${folderPathStr}/${file.name}`,
                kbId: kb.id, kbName: kb.name,
              });
            }
          }
        }
      }
    }

    res.json(dedupeByPath(results).slice(0, 50));
  } catch (err) {
    console.error('Mentions search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, Response } from 'express';
import { AppDataSource } from '../utils/database';
import { qdrant, COLLECTION } from '../utils/qdrant';
import { embedQuery } from '../utils/embeddings';
import { AuthRequest } from '../middleware/auth';

const router = Router();

interface RagTarget {
  filter_type: 'knowledge_base' | 'file_mention' | 'tag';
  filter_value: Record<string, string>;
}

router.post('/search', async (req: AuthRequest, res: Response) => {
  try {
    const { query, ragTargets, limit } = req.body as {
      query: string;
      ragTargets: RagTarget[];
      limit?: number;
    };

    if (!query || !query.trim()) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    const userId = req.userId!;
    const vector = await embedQuery(query.trim());

    const should: any[] = [];

    for (const target of ragTargets || []) {
      if (target.filter_type === 'knowledge_base') {
        should.push({
          must: [
            { key: 'knowledge_base_id', match: { value: target.filter_value.knowledge_base_id } },
          ],
        });
      } else if (target.filter_type === 'file_mention') {
        should.push({
          must: [
            { key: 'file_id', match: { value: target.filter_value.file_mention } },
          ],
        });
      } else if (target.filter_type === 'tag') {
        const fileTagsRepo = AppDataSource.getRepository('file_tags');
        const rows = await fileTagsRepo
          .createQueryBuilder('ft')
          .select('ft.file_id', 'file_id')
          .where('ft.tag_id = :tagId', { tagId: target.filter_value.tag_id })
          .getRawMany();

        const fileIds = rows.map((r: any) => r.file_id);
        if (fileIds.length > 0) {
          should.push({
            must: [
              { key: 'file_id', match: { any: fileIds } },
            ],
          });
        }
      }
    }

    const filter: any = {
      must: [{ key: 'user_id', match: { value: userId } }],
    };

    if (should.length > 0) {
      filter.should = should;
      filter.min_should = 1;
    }

    const searchResults = await qdrant.search(COLLECTION, {
      vector,
      filter,
      limit: limit || 10,
      with_payload: true,
    });

    const results = searchResults.map((r: any) => ({
      file_id: r.payload.file_id,
      file_name: r.payload.file_name,
      knowledge_base_id: r.payload.knowledge_base_id,
      chunk_index: r.payload.chunk_index,
      content: r.payload.content,
      score: r.score,
    }));

    res.json(results);
  } catch (err) {
    console.error('RAG search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

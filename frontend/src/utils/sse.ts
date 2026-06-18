import { getAccessToken } from '@/api/client';
import type { RagTarget } from '@/types';

export async function streamChat(
  conversationId: string,
  content: string,
  ragTargets: RagTarget[],
  onReasoning: (token: string) => void,
  onToken: (token: string) => void,
  onDone: (messageId: string) => void,
  onError: (error: string) => void
) {
  const token = getAccessToken();

  const response = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ content, ragTargets }),
  });

  if (!response.ok) {
    onError(`HTTP ${response.status}`);
    return;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';

    for (const chunk of chunks) {
      const eventMatch = chunk.match(/event: (.+)/);
      const dataMatch = chunk.match(/data: (.+)/);
      if (!eventMatch || !dataMatch) continue;

      const eventType = eventMatch[1].trim();
      try {
        const data = JSON.parse(dataMatch[1]);
        if (eventType === 'reasoning') onReasoning(data.token);
        else if (eventType === 'token') onToken(data.token);
        else if (eventType === 'done') onDone(data.messageId);
        else if (eventType === 'error') onError(data.error);
      } catch {
        // skip malformed data
      }
    }
  }
}

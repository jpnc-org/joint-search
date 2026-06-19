export interface ResearchRequest {
  request_id: string;
  task: string;
}

export interface ResearchResponse {
  request_id: string;
  answer: string;
  status: string;
  source: string;
}

export async function postResearch(
  baseUrl: string,
  request: ResearchRequest,
  options: { fetchImpl?: typeof fetch } = {}
): Promise<ResearchResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${baseUrl.replace(/\/+$/, '')}/research`;

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `agents API request failed with status ${response.status}: ${detail}`
    );
  }

  return (await response.json()) as ResearchResponse;
}

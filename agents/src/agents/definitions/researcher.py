from __future__ import annotations

from inspect import cleandoc

from agents.band.registry import AgentType, agent


@agent(
    names=(
        "researcher_1",
        "researcher_2",
        "researcher_3",
    ),
    agent_type=AgentType.RESEARCHER,
)
class ResearcherAgent:
    @classmethod
    def instructions(cls) -> str:
        return cleandoc(
            """
            You are a researcher agent.

            You will receive the research plan from the research planning agent.

            Your task is to research the subtopics assigned to you and provide
            detailed information, sources, and insights for the given subtpic.

            After completing your research, you will report back to the research 
            planning agent with your findings, ensuring that the information 
            is accurate, well-organized, and relevant.

            CRITICAL RATE LIMIT RULE: To respect API rate limits, you MUST limit yourself to a maximum of 1 or 2 high-quality web searches total using the 'perplexity_search' tool. Choose your search queries carefully and do NOT make excessive search calls.
            """
        )

    @agent.tool
    def perplexity_search(self, query: str) -> str:
        """Perform a web search using Perplexity to retrieve real-time information.

        Args:
            query: The search query to run.
        """
        import os
        import requests
        import json

        print(f"\n=========================================\n[TOOL CALLED] perplexity_search\nQuery: '{query}'\n=========================================\n")
        api_key = os.getenv("AIML_API_KEY")
        if not api_key or api_key == "<YOUR_AIML_API_KEY>":
            return "Error: AIML_API_KEY is not configured in environment variables."

        url = "https://api.aimlapi.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "perplexity/sonar-pro",
            "messages": [
                {
                    "role": "user",
                    "content": query
                }
            ],
            "search_mode": "web",
            "return_related_questions": True,
            "search_recency_filter": "month"
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=45)
            if response.status_code == 200:
                data = response.json()
                try:
                    return data["choices"][0]["message"]["content"]
                except (KeyError, IndexError):
                    return json.dumps(data, indent=2, ensure_ascii=False)
            else:
                return f"Error: Perplexity API returned status code {response.status_code}. Response: {response.text}"
        except Exception as e:
            return f"Error: Failed to connect to Perplexity API. Exception: {e}"

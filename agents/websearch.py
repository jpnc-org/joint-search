import os
import json
import requests
from dotenv import load_dotenv

# Load your environment variables (optional)
load_dotenv()

def test_aiml_perplexity_search(api_key: str, query: str):
    url = "https://api.aimlapi.com/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # Payload targeting the Perplexity Sonar Pro model with web search parameters
    payload = {
        "model": "perplexity/sonar-pro",
        "messages": [
            {
                "role": "user",
                "content": query
            }
        ],
        # Optional search-specific configurations supported by the endpoint
        "search_mode": "web",
        "return_related_questions": True,
        "search_recency_filter": "month"
    }
    
    try:
        print(f"Sending query to Perplexity via AI/ML API: '{query}'...\n")
        response = requests.post(url, headers=headers, json=payload, timeout=45)
        
        if response.status_code == 200:
            data = response.json()
            print("--- Response Received ---")
            print(json.dumps(data, indent=2, ensure_ascii=False))
        else:
            print(f"Failed with Status Code: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    # Replace with your actual AI/ML API key or set it in your environment variables
    AIML_API_KEY = os.getenv("AIML_API_KEY", "<YOUR_AIML_API_KEY>")
    
    if AIML_API_KEY == "<YOUR_AIML_API_KEY>" or not AIML_API_KEY:
        print("Error: Please provide a valid AI/ML API key.")
    else:
        # Example query requiring real-time web search
        test_query = "What are the latest updates on space exploration missions launched in the last 30 days?"
        test_aiml_perplexity_search(AIML_API_KEY, test_query)
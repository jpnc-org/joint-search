import asyncio
import logging
import os
import sys
import argparse
import yaml
from dotenv import load_dotenv
from typing import Any

from band import Agent, SessionConfig
from band.adapters import LangGraphAdapter
from langchain_openai import ChatOpenAI
from band.config import load_agent_config
from band.client.rest import (
    AsyncRestClient,
    ChatMessageRequest,
    ChatMessageRequestMentionsItem,
)
from websearch import perplexity_search

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("research_discussion")

# Default LLM model configured for the project
MODEL_NAME = "zhipu/glm-5-2"

# Shared reply instructions
BAND_REPLY_INSTRUCTIONS = (
    "When you respond, you MUST call the band_send_message tool to post your message to the chat room. "
    "Do NOT use plain text responses because they will be discarded and will not be visible in the chat. "
    "Include relevant mentions (participant IDs) in the mentions array to engage other agents."
)

# Medior instructions template
MEDIOR_SYSTEM_PROMPT = """You are the Coordinator (Medior) in this multi-agent discussion room.
Your Agent ID is: {medior_id}

Here is the identity mapping for all agents in this chat room:
- Coordinator (Medior): ID = {medior_id}
{researchers_list}

MENTION FORMAT NOTE:
When any participant is mentioned, the platform renders the mention in the message text as @handle (e.g., @abdulazizgajnazarov/medior).
Do not complain about or mention the UUID format in your responses. It is the platform's standard formatting.

CRITICAL RULES:
1. You NEVER perform research or write explanations from your own knowledge. You MUST NOT answer questions directly from your own training data.
2. You coordinate the research by prompting the Research Agents to debate, and then synthesizing their outputs into a final answer.
3. You MUST NOT include your own handle (e.g. '@username/medior' or your ID) in the mentions array of `band_send_message`. The platform rejects messages that mention the sender itself.

How to find handles:
Look at the "[System]: ## Current Participants" message in the chat history. It lists all participants in the room and their handles.
Identify the handles corresponding to the Research Agent IDs listed above, and use those handles to mention them.

Workflow Stages (You are run by Python only when one of these stages is active):
1. DEBATE TRIGGER: When you run, you must analyze the initial search findings posted by all Research Agents. Identify key agreements, contradictions, or gaps in their research, and post a message asking them to compare findings and debate those specific points. Mention all active Research Agents' handles.
   - Action: Read the history, summarize the main points/differences in their findings, and direct the debate by asking specific questions.
   
2. FINAL SYNTHESIS: When you run after the researchers have debated, you must post a message synthesizing all findings and debate points into a single, comprehensive, and well-structured final answer. Address and mention the human user who asked the question.

{band_reply_instructions}"""

# Researcher instructions template
RESEARCHER_SYSTEM_PROMPT = """You are Research Agent {agent_num} (Agent ID: {agent_id}) in this multi-agent discussion room.
Your coordinator is the Medior Agent (ID: {medior_id}).

Here is the identity mapping for all agents in this chat room:
- Coordinator (Medior): ID = {medior_id}
{researchers_list}

Your role is to perform web searches and debate findings.
You have access to the `perplexity_search` tool.
You must communicate with the chat room using the `band_send_message` tool.

How to find handles:
Look at the "[System]: ## Current Participants" message in the chat history. It lists all participants in the room and their handles.
Identify the handle corresponding to the Medior Agent (ID: {medior_id}) and other Research Agents, and use those handles to mention them.

Workflow Stages (You are run by Python only when one of these stages is active):
1. INITIAL SEARCH: When you run because of a user's query, you MUST run a Perplexity web search using `perplexity_search` on the query.
   - Action: Summarize your search findings and post them using `band_send_message`, mentioning the Medior Agent's handle (e.g. '@username/medior').
   - Example: 'Here are my search findings: [summary]'
   - Do NOT comment on or debate other agents' findings in this stage.

2. DEBATE: When you run because Medior triggered the debate, you must read the other agents' findings in the chat history.
   - Action: Write a message comparing your findings with theirs, pointing out agreements, disagreements, gaps, or confirmations. Post it using `band_send_message` mentioning the Coordinator (Medior) Agent's handle and the other Research Agents' handles. Mentioning Medior is critical to wake him up for the final synthesis.
   - Do NOT act as a coordinator. Do NOT summarize or praise other agents' work. Focus purely on debating, identifying gaps, or pointing out discrepancies/agreements between your findings and theirs.

{band_reply_instructions}"""

DEFAULT_ID_TO_NAME = {
    "71726d0d-0ebb-4d33-ab26-454ffb5e8b16": "Medior",
    "6b87ef32-9d5e-4c3d-97d8-eb9871d32d70": "testagent",
    "0251c040-ee51-4a7b-a2e9-8c2c3adef2a8": "Agent2",
    "11ed0117-d350-420e-b51c-d58c072c2395": "Agent 3"
}

class LoggingAgentTools:
    """Wrapper to log when an agent calls its messaging tools."""
    def __init__(self, target, agent_name):
        self._target = target
        self._agent_name = agent_name

    def __getattr__(self, name):
        attr = getattr(self._target, name)
        if callable(attr):
            if name == "send_message":
                async def wrapper(content, mentions):
                    logger.info(
                        "\n<<< [MESSAGE SENT] Agent '%s' is sending message to the room:\nMentions: %s\nContent: %s\n",
                        self._agent_name,
                        mentions,
                        content,
                    )
                    return await attr(content, mentions)
                return wrapper
        return attr

class LoggingLangGraphAdapter(LangGraphAdapter):
    """Subclass of LangGraphAdapter to print custom reception logs and manage state gating."""
    
    def __init__(
        self,
        *args,
        role: str,
        agent_id: str,
        medior_id: str,
        researcher_ids: list[str],
        **kwargs
    ):
        super().__init__(*args, **kwargs)
        self.role = role
        self.agent_id = agent_id
        self.medior_id = medior_id
        self.researcher_ids = researcher_ids
        self.is_processing = False

    def _create_agent(self):
        logger.info(
            "\n*** [AGENT CREATED] Creating LangGraph agent for '%s' (%s) with system prompt:\n%s\n",
            self.agent_name,
            self.role,
            self.system_prompt,
        )
        return super()._create_agent()

    def extract_chat_messages(self, history, current_msg, current_agent_name) -> list[dict]:
        import json
        messages = []
        
        # 1. Parse history (LangChain message objects)
        for h_msg in history:
            msg_type = h_msg.__class__.__name__
            if msg_type in ("HumanMessage", "SystemMessage") and isinstance(getattr(h_msg, "content", None), str):
                text = h_msg.content
                if text.startswith("[") and "]: " in text:
                    idx = text.find("]: ")
                    sender = text[1:idx]
                    content = text[idx+3:]
                    messages.append({"sender": sender, "content": content})
            elif msg_type == "AIMessage":
                # Check tool calls
                tool_calls = getattr(h_msg, "tool_calls", [])
                if tool_calls:
                    for tc in tool_calls:
                        if tc.get("name") == "band_send_message":
                            args = tc.get("args", {})
                            content = args.get("content", "")
                            if content:
                                messages.append({"sender": current_agent_name, "content": content})
                                
        # 2. Append current message
        if current_msg:
            text = current_msg.format_for_llm()
            if text.startswith("[") and "]: " in text:
                idx = text.find("]: ")
                sender = text[1:idx]
                content = text[idx+3:]
                messages.append({"sender": sender, "content": content})
                
        return messages

    async def on_message(
        self,
        msg: Any,
        tools: Any,
        history: Any,
        participants_msg: str | None,
        contacts_msg: str | None,
        *,
        is_session_bootstrap: bool,
        room_id: str,
    ) -> None:
        try:
            if self.is_processing:
                logger.info("Gating (%s): SILENT. Already processing a message context. Skipping duplicate trigger.", self.agent_name)
                return

            participants_dicts = []
            # Resolve UUID mentions in the incoming message content and history for the LLM
            try:
                participants = await tools.get_participants()
                if isinstance(participants, list):
                    # Convert participants to dicts if they are Pydantic models
                    for p in participants:
                        if hasattr(p, "dict"):
                            participants_dicts.append(p.dict())
                        elif hasattr(p, "model_dump"):
                            participants_dicts.append(p.model_dump())
                        elif isinstance(p, dict):
                            participants_dicts.append(p)
                        else:
                            participants_dicts.append({
                                "id": getattr(p, "id", None),
                                "handle": getattr(p, "handle", None),
                                "name": getattr(p, "name", None),
                                "type": getattr(p, "type", None),
                            })
                    
                    from band.runtime.formatters import replace_uuid_mentions
                    import dataclasses
                    
                    # Resolve in current message content
                    content_resolved = replace_uuid_mentions(msg.content, participants_dicts)
                    msg = dataclasses.replace(msg, content=content_resolved)

                    # Resolve in history messages (LangChain messages)
                    for h_msg in history:
                        msg_type = h_msg.__class__.__name__
                        if msg_type in ("HumanMessage", "SystemMessage", "AIMessage") and isinstance(getattr(h_msg, "content", None), str):
                            resolved_part_content = replace_uuid_mentions(h_msg.content, participants_dicts)
                            try:
                                h_msg.content = resolved_part_content
                            except AttributeError:
                                # Fallback for frozen LangChain message models
                                object.__setattr__(h_msg, "content", resolved_part_content)
            except Exception as e:
                logger.warning("Failed to resolve UUID mentions in incoming message or history: %s", e)

            # Resolve display names and IDs using fallback mapping if necessary
            name_to_id = {p["name"]: p["id"] for p in participants_dicts}
            id_to_name = {p["id"]: p["name"] for p in participants_dicts}
            
            for uid, name in DEFAULT_ID_TO_NAME.items():
                if uid not in id_to_name:
                    id_to_name[uid] = name
                if name not in name_to_id:
                    name_to_id[name] = uid

            current_agent_name = id_to_name.get(self.agent_id, self.agent_name)
            medior_name = id_to_name.get(self.medior_id, "Medior")
            active_researcher_names = [id_to_name[rid] for rid in self.researcher_ids if rid in id_to_name]

            # Fetch fresh context directly from the platform API using tools
            try:
                res = await tools.fetch_room_context(room_id=room_id, page_size=100)
                raw_msgs = res.get("data", [])
            except Exception as e:
                logger.warning("Failed to fetch fresh room context: %s", e)
                raw_msgs = []

            # Extract parsed messages from raw context messages
            parsed_msgs = []
            for item in raw_msgs:
                msg_type = item.get("message_type")
                if msg_type == "text":
                    sender = item.get("sender_name")
                    content = item.get("content", "")
                    parsed_msgs.append({"sender": sender, "content": content})

            # Ensure current message is in the list (in case of latency in get_context)
            if msg and not any(m.get("content") == msg.content for m in parsed_msgs):
                sender = id_to_name.get(msg.sender_id, msg.sender_name or msg.sender_type)
                parsed_msgs.append({"sender": sender, "content": msg.content})
            
            # Define stage-specific instructions
            stage_instruction = ""
            if self.role == "medior":
                # Check if Medior has posted yet
                medior_msgs = [m for m in parsed_msgs if m["sender"] == medior_name]
                if not medior_msgs:
                    active_researcher_handles = ", ".join([f"@{p['handle']}" for p in participants_dicts if p["id"] in self.researcher_ids and p.get("handle")])
                    stage_instruction = (
                        "ACTIVE WORKFLOW STAGE: DEBATE TRIGGER\n\n"
                        "All Research Agents have posted their initial search findings. "
                        "Your task in this turn is to trigger the debate among them. "
                        "You MUST read their initial findings, identify the main agreements, contradictions, or gaps in their research, "
                        "and post a message asking the Research Agents to compare their findings and debate those specific points. "
                        f"You MUST mention all active Research Agents by their handles: {active_researcher_handles}.\n\n"
                        "CRITICAL: Do NOT write the final answer yourself yet. Focus on highlighting what they should compare and debate."
                    )
                else:
                    # Medior has posted. Find index of Medior's first message (the debate trigger)
                    try:
                        medior_trigger_idx = next(
                            i for i, m in enumerate(parsed_msgs) if m["sender"] == medior_name
                        )
                        debate_msgs = [
                            m for m in parsed_msgs[medior_trigger_idx+1:] 
                            if m["sender"] in active_researcher_names
                        ]
                        num_debate_msgs = len(debate_msgs)
                    except StopIteration:
                        num_debate_msgs = 0

                    required_debate_count = len(active_researcher_names)
                    if len(medior_msgs) == 1 and num_debate_msgs >= required_debate_count:
                        # Find the human user's handle to mention
                        human_handle = ""
                        for p in participants_dicts:
                            if p.get("type") == "User":
                                human_handle = f"@{p.get('handle')}"
                                break
                        if not human_handle:
                            human_handle = "@User"

                        stage_instruction = (
                            "ACTIVE WORKFLOW STAGE: FINAL SYNTHESIS\n\n"
                            "The debate phase is complete. "
                            "Your ONLY task in this turn is to synthesize all findings and debate points into a single, comprehensive, and well-structured final answer. "
                            f"Address and mention the human user ({human_handle}) who asked the question. "
                            "Do NOT ask the researchers to debate anymore. Summarize and synthesize the consensus and differences."
                        )

            elif self.role == "researcher":
                my_msgs = [m for m in parsed_msgs if m["sender"] == current_agent_name]
                if not my_msgs:
                    stage_instruction = (
                        "ACTIVE WORKFLOW STAGE: INITIAL SEARCH\n\n"
                        "You must perform a web search on the user's query using the `perplexity_search` tool. "
                        "Then summarize your findings and post them using the `band_send_message` tool, mentioning the Coordinator (Medior) agent. "
                        "Do NOT comment on or debate other agents' findings in this stage."
                    )
                else:
                    stage_instruction = (
                        "ACTIVE WORKFLOW STAGE: DEBATE\n\n"
                        "The coordinator has triggered the debate. "
                        "You must read the other agents' findings in the chat history, and post a message comparing your findings with theirs, pointing out agreements, disagreements, gaps, or confirmations. "
                        "You MUST mention both the Coordinator (Medior) and the other Research Agents by their handles in your message. Mentioning Medior is critical to wake him up for the final synthesis."
                    )

            # State machine gating check
            if self.role == "medior":
                # 1. Check if all active researchers have posted at least one message
                all_researchers_posted = True
                missing_researchers = []
                for r_name in active_researcher_names:
                    r_msgs = [m for m in parsed_msgs if m["sender"] == r_name]
                    if not r_msgs:
                        all_researchers_posted = False
                        missing_researchers.append(r_name)
                
                if not all_researchers_posted:
                    logger.info(
                        "Medior Gating: SILENT. Waiting for researchers %s to post initial search findings.",
                        missing_researchers
                    )
                    return
                
                # 2. Check if Medior has posted yet
                medior_msgs = [m for m in parsed_msgs if m["sender"] == medior_name]
                if not medior_msgs:
                    logger.info("Medior Gating: ACTIVE. Triggering debate.")
                else:
                    # Medior has posted. Find index of Medior's first message (the debate trigger)
                    medior_trigger_idx = next(
                        i for i, m in enumerate(parsed_msgs) if m["sender"] == medior_name
                    )
                    # Count researcher messages after this index
                    debate_msgs = [
                        m for m in parsed_msgs[medior_trigger_idx+1:] 
                        if m["sender"] in active_researcher_names
                    ]
                    num_debate_msgs = len(debate_msgs)
                    required_debate_count = len(active_researcher_names)
                    
                    if len(medior_msgs) == 1:
                        if num_debate_msgs < required_debate_count:
                            logger.info(
                                "Medior Gating: SILENT. Waiting for debate to progress. Debate messages count: %d/%d.",
                                num_debate_msgs,
                                required_debate_count
                            )
                            return
                        else:
                            logger.info(
                                "Medior Gating: ACTIVE. Ready to synthesize. Debate messages count: %d/%d.",
                                num_debate_msgs,
                                required_debate_count
                            )
                    else:
                        logger.info("Medior Gating: SILENT. Synthesis already posted.")
                        return
                        
            elif self.role == "researcher":
                my_msgs = [m for m in parsed_msgs if m["sender"] == current_agent_name]
                user_msgs = [
                    m for m in parsed_msgs 
                    if m["sender"] not in active_researcher_names 
                    and m["sender"] != medior_name 
                    and m["sender"] != "System"
                ]
                
                # 1. Initial search phase
                if not my_msgs:
                    if user_msgs:
                        logger.info("Researcher Gating (%s): ACTIVE. Running initial search.", current_agent_name)
                    else:
                        logger.info("Researcher Gating (%s): SILENT. No user message found.", current_agent_name)
                        return
                else:
                    # Already posted initial search.
                    # Has Medior triggered the debate?
                    medior_msgs = [m for m in parsed_msgs if m["sender"] == medior_name]
                    if medior_msgs:
                        # Find index of Medior's first message
                        medior_trigger_idx = next(
                            i for i, m in enumerate(parsed_msgs) if m["sender"] == medior_name
                        )
                        # Count my debate messages after Medior's trigger
                        my_debate_msgs = [
                            m for m in parsed_msgs[medior_trigger_idx+1:] 
                            if m["sender"] == current_agent_name
                        ]
                        
                        if not my_debate_msgs:
                            logger.info("Researcher Gating (%s): ACTIVE. Running debate contribution.", current_agent_name)
                        else:
                            logger.info("Researcher Gating (%s): SILENT. Already participated in debate.", current_agent_name)
                            return
                    else:
                        logger.info("Researcher Gating (%s): SILENT. Waiting for Medior debate trigger.", current_agent_name)
                        return

            logger.info(
                "\n>>> [MESSAGE RECEIVED] Agent '%s' is processing message in room '%s':\nSender: %s (%s)\nContent: %r\n",
                self.agent_name,
                room_id,
                msg.sender_name or msg.sender_id,
                msg.sender_type,
                msg.content,
            )
            # Wrap tools to log outgoing messages
            logging_tools = LoggingAgentTools(tools, self.agent_name)
            
            self.is_processing = True
            try:
                # Replicate LangGraphAdapter.on_message setup but invoke graph without streaming (ainvoke)
                # to avoid the zhipu/glm-5-2 stream hang timeout bug on AIML API.
                from band.integrations.langgraph.langchain_tools import (
                    agent_tools_to_langchain,
                )

                # Get LangChain tools
                langchain_tools = (
                    agent_tools_to_langchain(
                        logging_tools,
                        features=self.features,
                    )
                    + self.additional_tools
                )

                # Build or get graph
                if self.graph_factory:
                    graph = self.graph_factory(langchain_tools)
                else:
                    graph = self._static_graph

                if not graph:
                    raise RuntimeError("No graph available")

                checkpointer = getattr(graph, "checkpointer", None) or self._simple_checkpointer
                if checkpointer is not None:
                    self._room_checkpointers[room_id] = checkpointer

                # Build messages
                messages = []
                
                # 1. System prompt
                if self._inject_system_prompt and self._system_prompt:
                    messages.append(("system", self._system_prompt))
                
                # 2. Reconstruct room history from parsed_msgs EXCEPT the current message (if it's the last one)
                history_pms = parsed_msgs[:-1] if parsed_msgs and parsed_msgs[-1]["content"] == msg.content else parsed_msgs
                
                for pm in history_pms:
                    sender = pm["sender"]
                    content = pm["content"]
                    if sender == current_agent_name:
                        messages.append(("assistant", content))
                    else:
                        messages.append(("user", f"[{sender}]: {content}"))
                
                # 3. Metadata messages
                if participants_msg:
                    messages.append(("user", f"[System]: {participants_msg}"))

                if contacts_msg:
                    messages.append(("user", f"[System]: {contacts_msg}"))

                # 4. Stage instruction
                if stage_instruction:
                    messages.append(("system", stage_instruction))

                # 5. Current message trigger at the end
                messages.append(("user", msg.format_for_llm()))
                
                graph_input = {"messages": messages}

                # Run graph via non-streaming ainvoke with a unique thread ID
                import uuid
                run_thread_id = f"{room_id}_{uuid.uuid4()}"
                
                await graph.ainvoke(
                    graph_input,
                    config={
                        "configurable": {
                            "thread_id": run_thread_id,
                        },
                        "recursion_limit": self.recursion_limit,
                    },
                )

                if is_session_bootstrap and room_id not in self._bootstrapped_rooms:
                    self._bootstrapped_rooms[room_id] = None
                    if len(self._bootstrapped_rooms) > 1000:
                        oldest_room_id, _ = self._bootstrapped_rooms.popitem(last=False)
                        logger.warning(
                            "Bootstrap tracking reached 1000 rooms; evicting oldest room %s",
                            oldest_room_id,
                        )
            finally:
                self.is_processing = False
        except Exception as e:
            logger.error("!!! EXCEPTION IN LoggingLangGraphAdapter.on_message for agent '%s' !!!", self.agent_name, exc_info=True)
            raise

def print_instructions_checklist():
    """Prints a clear instructions checklist for registering and configuring agents."""
    checklist = """
======================================================================
                  AGENT CONFIGURATION CHECKLIST
======================================================================
To run the Medior-Coordinated Research Discussion Room, you need the Medior
agent and at least one Research agent configured.

Update 'agents/agent_config.yaml' with retrieved platform details:
   
   research_agent: # Medior Agent
     agent_id: "MEDIOR-AGENT-UUID"
     api_key: "MEDIOR-AGENT-API-KEY"

   research_agent_2: # Research Agent 1
     agent_id: "SECOND-AGENT-UUID"
     api_key: "SECOND-AGENT-API-KEY"

   research_agent_3: # Research Agent 2
     agent_id: "THIRD-AGENT-UUID"
     api_key: "THIRD-AGENT-API-KEY"

   research_agent_4: # Research Agent 3 (Optional)
     agent_id: "FOURTH-AGENT-UUID"
     api_key: "FOURTH-AGENT-API-KEY"

Please ensure the credentials are correct and re-run this script.
======================================================================
"""
    print(checklist, file=sys.stderr)

def load_all_configs():
    """Loads Medior and Research Agent configurations from yaml."""
    with open("agent_config.yaml", "r") as f:
        config = yaml.safe_load(f)
        
    medior_config = config.get("research_agent")
    
    placeholders = {
        "<your-agent-uuid>",
        "<your-api-key>",
        "<your-second-agent-uuid-here>",
        "<your-second-agent-api-key-here>",
        "<your-third-agent-uuid-here>",
        "<your-third-agent-api-key-here>",
        "<your-fourth-agent-uuid-here>",
        "<your-fourth-agent-api-key-here>",
        "",
        None
    }

    research_configs = {}
    for key, val in config.items():
        if key.startswith("research_agent_") and isinstance(val, dict):
            agent_id = val.get("agent_id")
            api_key = val.get("api_key")
            if agent_id not in placeholders and api_key not in placeholders:
                research_configs[key] = val
                
    return medior_config, research_configs

def validate_configs(medior_config, research_configs) -> bool:
    """Validates loaded configurations."""
    if not medior_config or not medior_config.get("agent_id") or not medior_config.get("api_key"):
        logger.error("Primary 'research_agent' (Medior) configuration is missing.")
        return False
        
    placeholders = {
        "<your-agent-uuid>",
        "<your-api-key>",
        "",
        None
    }
    if medior_config.get("agent_id") in placeholders or medior_config.get("api_key") in placeholders:
        logger.error("Primary 'research_agent' (Medior) contains placeholder values.")
        return False

    if not research_configs:
        logger.error("No valid Research Agents (research_agent_2, research_agent_3, etc.) are configured.")
        return False
        
    return True

async def main() -> None:
    # Set up command-line argument parsing
    parser = argparse.ArgumentParser(description="Medior-Coordinated Multi-Agent Deep Research")
    parser.add_argument(
        "--room-id",
        type=str,
        default=None,
        help="Optional Chat Room ID to send a trigger query to.",
    )
    parser.add_argument(
        "--query",
        type=str,
        default="How has AI framework orchestration evolved from Pydantic AI to LangGraph in 2026?",
        help="Optional research query/topic to send to the specified room-id.",
    )
    args = parser.parse_args()

    # Load environment variables
    load_dotenv(override=True)

    # Load and validate configs
    medior_config, research_configs = load_all_configs()
    if not validate_configs(medior_config, research_configs):
        print_instructions_checklist()
        sys.exit(1)

    rest_url = os.getenv("BAND_REST_URL")
    if not rest_url:
        logger.error("BAND_REST_URL env variable is not set. Please check your .env file.")
        sys.exit(1)

    medior_id = medior_config["agent_id"]
    medior_key = medior_config["api_key"]

    # Send trigger message if room-id is specified
    if args.room_id:
        logger.info("Connecting to Band REST API to send trigger message...")
        client = AsyncRestClient(base_url=rest_url, api_key=medior_key)
        try:
            initial_content = f"@{medior_id} {args.query}"
            mentions = [
                ChatMessageRequestMentionsItem(id=medior_id, name="Medior"),
            ]
            await client.agent_api_messages.create_agent_chat_message(
                chat_id=args.room_id,
                message=ChatMessageRequest(content=initial_content, mentions=mentions),
            )
            logger.info("Trigger query sent successfully to Room %s.", args.room_id)
        except Exception as e:
            logger.error("Failed to send trigger message to room: %s", e)
            sys.exit(1)
    else:
        logger.info("No --room-id provided. Agents will run and respond to any human mentions in their rooms.")

    # Initialize LoggingLangGraphAdapter and Agents
    ws_url = os.getenv("BAND_WS_URL")
    agents_to_run = []

    # 1. Medior Adapter and Agent
    research_agent_ids = [cfg["agent_id"] for cfg in research_configs.values()]
    research_agent_ids_str = ", ".join([f"@{rid}" for rid in research_agent_ids])
    
    researchers_list_str = "\n".join([
        f"- Research Agent {i+1} (ID: {cfg['agent_id']})"
        for i, (key, cfg) in enumerate(research_configs.items())
    ])
    
    # Build mapping block
    mapping_lines = [f"- Coordinator (Medior): ID = {medior_id}"]
    for i, (key, cfg) in enumerate(research_configs.items()):
        mapping_lines.append(f"- Research Agent {i+1}: ID = {cfg['agent_id']}")
    agent_mapping_str = "\n".join(mapping_lines)
    
    medior_prompt = MEDIOR_SYSTEM_PROMPT.format(
        medior_id=medior_id,
        agent_mapping=agent_mapping_str,
        researchers_list=researchers_list_str,
        research_agent_ids_str=research_agent_ids_str,
        band_reply_instructions=BAND_REPLY_INSTRUCTIONS
    )
    
    medior_adapter = LoggingLangGraphAdapter(
        llm=ChatOpenAI(model=MODEL_NAME),
        custom_section=medior_prompt,
        role="medior",
        agent_id=medior_id,
        medior_id=medior_id,
        researcher_ids=research_agent_ids,
    )
    session_config = SessionConfig(context_cache_ttl_seconds=0)
    
    medior_agent = Agent.create(
        adapter=medior_adapter,
        agent_id=medior_id,
        api_key=medior_key,
        ws_url=ws_url,
        rest_url=rest_url,
        session_config=session_config,
    )
    agents_to_run.append(medior_agent)

    # 2. Researchers Adapters and Agents
    for i, (key, cfg) in enumerate(research_configs.items()):
        agent_id = cfg["agent_id"]
        api_key = cfg["api_key"]
        
        researcher_prompt = RESEARCHER_SYSTEM_PROMPT.format(
            agent_num=i+1,
            agent_id=agent_id,
            medior_id=medior_id,
            agent_mapping=agent_mapping_str,
            researchers_list=researchers_list_str,
            band_reply_instructions=BAND_REPLY_INSTRUCTIONS
        )
        
        adapter = LoggingLangGraphAdapter(
            llm=ChatOpenAI(model=MODEL_NAME),
            custom_section=researcher_prompt,
            additional_tools=[perplexity_search],
            role="researcher",
            agent_id=agent_id,
            medior_id=medior_id,
            researcher_ids=research_agent_ids,
        )
        
        agent = Agent.create(
            adapter=adapter,
            agent_id=agent_id,
            api_key=api_key,
            ws_url=ws_url,
            rest_url=rest_url,
            session_config=session_config,
        )
        agents_to_run.append(agent)

    # Start all agents in parallel
    logger.info("Starting loops for %d agents (1 Medior + %d Researchers)...", len(agents_to_run), len(research_configs))
    try:
        await asyncio.gather(*[a.run() for a in agents_to_run])
    except (asyncio.CancelledError, KeyboardInterrupt):
        logger.info("Gracefully shutting down agents...")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Exiting...")

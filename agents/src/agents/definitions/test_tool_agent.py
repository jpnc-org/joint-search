# from __future__ import annotations

# from inspect import cleandoc

# from agents.band.registry import AgentType, agent


# @agent(names=("test_tool_agent",), agent_type=AgentType.GENERAL_PURPOSE)
# class TestToolAgent:
#     @agent.tool
#     def echo(self, message: str) -> str:
#         """Echo back the input message with some emojis.

#         Args:
#             message: The exact text to echo back.
#         """
#         return f"✅ Echo: {message} 🎉"

#     @classmethod
#     def instructions(cls) -> str:
#         return cleandoc(
#             """
#             You are a test agent. When asked to use the echo tool, call it
#             with the message and return the result.
#             """
#         )

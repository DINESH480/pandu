"""Route PANDU chat requests to local Ollama or an optional self-hosted endpoint."""

import json
import os
import re
from typing import Dict, List

import httpx

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/") + "/api/chat"
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
AI_MODE = os.getenv("AI_MODE", "local").strip().lower()
SELF_HOSTED_API_URL = os.getenv("SELF_HOSTED_API_URL", "").strip()
SELF_HOSTED_MODEL = os.getenv("SELF_HOSTED_MODEL", "").strip()
SELF_HOSTED_API_KEY = os.getenv("SELF_HOSTED_API_KEY", "").strip()


async def ask_ai(user_message: str, system_prompt: str, history: List[Dict]) -> str:
    """Use Ollama by default; optionally prefer a self-hosted endpoint."""
    if AI_MODE not in {"local", "remote"}:
        raise ValueError("AI_MODE must be either 'local' or 'remote'.")

    if AI_MODE == "remote" and SELF_HOSTED_API_URL:
        try:
            return await ask_self_hosted(user_message, system_prompt, history)
        except httpx.RequestError:
            pass
        except httpx.HTTPStatusError as error:
            if error.response.status_code < 500:
                raise

    return await ask_ollama(user_message, system_prompt, history)


async def ask_ollama(user_message: str, system_prompt: str, history: List[Dict]) -> str:
    """Call the local Ollama chat endpoint."""
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "messages": messages,
                "stream": False,
                "options": {"temperature": 0.7, "top_p": 0.9},
            },
        )
        response.raise_for_status()
        data = response.json()

    content = data.get("message", {}).get("content")
    if not isinstance(content, str):
        raise ValueError("Ollama returned an invalid chat response.")
    return content


async def ask_self_hosted(
    user_message: str, system_prompt: str, history: List[Dict]
) -> str:
    """Call a configured self-hosted chat-completions-compatible endpoint."""
    if not SELF_HOSTED_API_URL:
        raise ValueError("SELF_HOSTED_API_URL must be configured for remote mode.")

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    headers = {"Content-Type": "application/json"}
    if SELF_HOSTED_API_KEY:
        headers["Authorization"] = f"Bearer {SELF_HOSTED_API_KEY}"

    payload = {
        "model": SELF_HOSTED_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1024,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            SELF_HOSTED_API_URL,
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise ValueError("Self-hosted endpoint returned an invalid chat response.") from error
    if not isinstance(content, str):
        raise ValueError("Self-hosted endpoint returned an invalid chat response.")
    return content


def parse_ai_response(response_text: str) -> dict:
    """
    Try to extract a JSON action block from the AI's response.
    If no JSON found, treat the whole thing as a plain text answer.
    """
    json_pattern = r"\{[^{}]+\}"
    matches = re.findall(json_pattern, response_text, re.DOTALL)

    for match in matches:
        try:
            parsed = json.loads(match)
            if "action" in parsed:
                return parsed
        except json.JSONDecodeError:
            continue

    return {"action": "answer", "text": response_text.strip()}

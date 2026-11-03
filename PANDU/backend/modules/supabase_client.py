"""
Supabase Client — initialized once, reused everywhere.
All database operations go through this.
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.concurrency import run_in_threadpool

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()

PLACEHOLDER_KEYS = {
    "your-anon-key-here",
    "placeholder-anon-key",
    "example-anon-key",
    "your-project-id.supabase.co",
}


def is_valid_supabase_config() -> bool:
    return bool(SUPABASE_URL) and bool(SUPABASE_KEY) and (
        SUPABASE_URL.startswith("https://") and ".supabase.co" in SUPABASE_URL
    ) and SUPABASE_KEY.lower() not in PLACEHOLDER_KEYS and len(SUPABASE_KEY) > 20


supabase: Client | None = None
if is_valid_supabase_config():
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception:
        supabase = None

bearer_scheme = HTTPBearer(auto_error=False)


class AuthenticatedUser:
    def __init__(self, user_id: str, client: Client):
        self.user_id = user_id
        self.client = client


async def get_authenticated_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthenticatedUser:
    """Verify the caller's Supabase access token and create an RLS-scoped client."""
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase is not configured.")
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Sign in to use this endpoint.")

    token = credentials.credentials
    try:
        response = await run_in_threadpool(supabase.auth.get_user, token)
    except Exception as error:
        raise HTTPException(status_code=401, detail="Your session is invalid or expired.") from error

    user = response.user if response else None
    if user is None:
        raise HTTPException(status_code=401, detail="Your session is invalid or expired.")

    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    client.postgrest.auth(token)
    return AuthenticatedUser(user_id=str(user.id), client=client)

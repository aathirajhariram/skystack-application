"""Tiny in-memory limiter for the public subscribe form (use Azure Front Door / Redis if you run several instances)."""
import time
from collections import defaultdict, deque

_hits: dict = defaultdict(deque)


def allow(key: str, limit: int, window_seconds: int = 3600) -> bool:
    now = time.time()
    q = _hits[key]
    while q and q[0] < now - window_seconds:
        q.popleft()
    if len(q) >= limit:
        return False
    q.append(now)
    return True

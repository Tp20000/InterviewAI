import os
import uuid
from datetime import datetime


def generate_token(length=32):
    import secrets
    return secrets.token_urlsafe(length)


def safe_int(val, default=0):
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def safe_float(val, default=0.0):
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def clamp(val, min_val, max_val):
    return max(min_val, min(max_val, val))


def truncate(text, max_len=100):
    if not text:
        return ""
    return text[:max_len] + "..." if len(text) > max_len else text


def utcnow_iso():
    return datetime.utcnow().isoformat()
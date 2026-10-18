"""Vercel serverless entry point: serves the Django API under /api/*.

The React app is built and served by Vercel as static files; requests to
/api/* are rewritten to this function (see vercel.json).
"""

import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from django.core.wsgi import get_wsgi_application  # noqa: E402

app = get_wsgi_application()

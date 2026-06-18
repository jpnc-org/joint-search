"""Agent orchestration helpers."""

from __future__ import annotations

import sys
from pathlib import Path

_PACKAGE_DIR = Path(__file__).resolve().parent
_SRC_DIR = _PACKAGE_DIR.parent

for _path_entry in list(sys.path):
    if _path_entry and Path(_path_entry).resolve() == _PACKAGE_DIR:
        sys.path.remove(_path_entry)

if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

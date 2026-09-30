"""Every hand-written method calls a route the backend really has.

The spec (backend/openapi.json) is made from the backend's own code by
scripts/apigen.sh, so a method pointing at a route that was renamed or never
existed fails here. (client.api is generated from the same spec.)"""

from __future__ import annotations

import inspect
import json
import re
from pathlib import Path
from typing import Any, Iterator, List, Set, Tuple

import httpx
import pytest

from fulkruma import FulkrumaClient

SPEC = Path(__file__).resolve().parents[3] / "backend" / "openapi.json"


def _routes() -> Set[str]:
    paths = json.loads(SPEC.read_text())["paths"]
    return {
        f"{method.upper()} {re.sub(r'{[^}]+}', '{}', path)}"
        for path, ops in paths.items()
        for method in ops
    }


def _methods(obj: Any, prefix: str) -> Iterator[Tuple[str, Any]]:
    for name, fn in inspect.getmembers(type(obj), inspect.isfunction):
        if not name.startswith("_"):
            yield f"{prefix}{name}", getattr(obj, name)


def _placeholder_call(fn: Any) -> None:
    """A placeholder for every required parameter: "__0__", "__1__" stand for ids in the
    path, a dict parameter (a body) gets an empty one."""
    args: List[Any] = []
    kwargs = {}
    for i, p in enumerate(inspect.signature(fn).parameters.values()):
        if p.default is not inspect.Parameter.empty or p.kind in (p.VAR_KEYWORD, p.VAR_POSITIONAL):
            continue
        value: Any = {} if "Dict" in str(p.annotation) else f"__{i}__"
        if p.kind is p.KEYWORD_ONLY:
            kwargs[p.name] = value
        else:
            args.append(value)
    fn(*args, **kwargs)


@pytest.mark.skipif(not SPEC.exists(), reason="no backend/openapi.json beside this SDK (a public mirror)")
def test_every_hand_written_method_calls_a_route_in_the_spec() -> None:
    routes = _routes()
    seen: List[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(f"{request.method} {re.sub(r'__[0-9]__', '{}', request.url.path)}")
        return httpx.Response(200, json={"data": {}, "error": None, "meta": {"requestId": "r"}})

    client = FulkrumaClient(
        key_id="AKIAFULKTEST",
        secret="s",
        base_url="https://fulkruma.test",
        http=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    namespaces = {
        k: v for k, v in vars(client).items()
        if not k.startswith("_") and k != "api" and hasattr(v, "_c")
    }
    methods = [m for name, ns in namespaces.items() for m in _methods(ns, f"{name}.")]
    assert len(methods) > 50

    missing = []
    for name, fn in methods:
        seen.clear()
        _placeholder_call(fn)
        assert len(seen) == 1, name
        if seen[0] not in routes:
            missing.append(f"{name}: {seen[0]}")
    assert missing == []

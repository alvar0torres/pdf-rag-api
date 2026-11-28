from contextlib import closing
from unittest.mock import AsyncMock, Mock

import pytest
import httpx
from fastapi.testclient import TestClient
from openai import APIStatusError
from qdrant_client import QdrantClient, models

from app import main
from app import embeddings, reranker, vector_store
from app.reranker import RerankerProviderError
from evals.evaluate_retrieval import EvaluationDataset, EvaluationPreconditionError

client = TestClient(main.app)


@pytest.fixture
def dataset(monkeypatch):
    value = EvaluationDataset.model_validate({
        "title": "Test benchmark",
        "source_file": "test.pdf",
        "source_url": "https://example.test/test.pdf",
        "license": "test",
        "questions": [
            {"id": "q1", "question": "First?", "evidence": [{"page_number": 1, "text": "first"}]},
            {"id": "q2", "question": "Second?", "evidence": [{"page_number": 2, "text": "second"}]},
        ],
    })
    monkeypatch.setattr(main, "load_dataset", Mock(return_value=value))
    return value


def test_evaluation_info_is_read_only(dataset, monkeypatch):
    runner = AsyncMock()
    monkeypatch.setattr(main, "run_evaluation", runner)

    response = client.get("/evaluations/retrieval")

    assert response.status_code == 200
    assert response.json() == {
        "title": "Test benchmark", "source_file": "test.pdf", "question_count": 2,
        "top_k": 5, "candidate_limit": 20, "modes": list(main.MODES),
    }
    runner.assert_not_awaited()


def test_evaluation_returns_metrics_and_per_question_ranks(dataset, monkeypatch):
    runner = AsyncMock(return_value={
        "dense": [1, None],
        "hybrid": [3, 5],
        "hybrid + Cohere": [1, 2],
    })
    monkeypatch.setattr(main, "run_evaluation", runner)

    response = client.post("/evaluations/retrieval")

    assert response.status_code == 200
    result = response.json()
    assert result["modes"][0] == {
        "mode": "dense",
        "metrics": {"hit@1": 0.5, "hit@3": 0.5, "hit@5": 0.5, "mrr@5": 0.5},
    }
    assert result["questions"][1] == {
        "id": "q2", "question": "Second?",
        "ranks": {"dense": None, "hybrid": 5, "hybrid + Cohere": 2},
    }
    runner.assert_awaited_once_with(dataset)


@pytest.mark.parametrize(
    ("error", "status", "detail"),
    [
        (EvaluationPreconditionError("Index test.pdf first."), 400, "Index test.pdf first."),
        (RerankerProviderError("sensitive provider detail"), 502, "Cohere request failed. Check its API key and provider logs."),
    ],
)
def test_evaluation_surfaces_failures(dataset, monkeypatch, error, status, detail):
    monkeypatch.setattr(main, "run_evaluation", AsyncMock(side_effect=error))

    response = client.post("/evaluations/retrieval")

    assert response.status_code == status
    assert response.json() == {"detail": detail}


@pytest.mark.parametrize(
    ("error", "expected"),
    [
        (
            APIStatusError("private response", response=httpx.Response(429, request=httpx.Request("POST", "https://example.test")), body=None),
            "OpenAI request failed. Check its API key and provider logs.",
        ),
        (
            RerankerProviderError("private response"),
            "Cohere request failed. Check its API key and provider logs.",
        ),
    ],
)
def test_evaluation_reports_provider_without_exposing_response(dataset, monkeypatch, caplog, error, expected):
    monkeypatch.setattr(main, "run_evaluation", AsyncMock(side_effect=error))

    response = client.post("/evaluations/retrieval")

    assert response.status_code == 502
    assert response.json() == {"detail": expected}
    assert "private response" not in caplog.text
    assert "OpenAI" in caplog.text or "Cohere" in caplog.text


def test_evaluation_uses_shared_qdrant_client(dataset, monkeypatch):
    with closing(QdrantClient(":memory:")) as qdrant:
        qdrant.create_collection(
            collection_name=vector_store.COLLECTION_NAME,
            vectors_config=models.VectorParams(size=2, distance=models.Distance.COSINE),
        )
        monkeypatch.setattr(vector_store, "client", qdrant)
        embed = AsyncMock(return_value=[[1.0, 0.0], [1.0, 0.0]])
        monkeypatch.setattr(embeddings, "create_embeddings", embed)

        first_chunk = {
            "file_name": "test.pdf", "page_number": 1, "chunk_index": 1, "text": "first",
        }
        qdrant.upsert(
            collection_name=vector_store.COLLECTION_NAME,
            points=[
                models.PointStruct(id=1, vector=[1.0, 0.0], payload=first_chunk),
                models.PointStruct(
                    id=2,
                    vector=[1.0, 0.0],
                    payload={
                        "file_name": "test.pdf",
                        "page_number": 2,
                        "chunk_index": 1,
                        "text": "second",
                    },
                ),
            ],
        )
        point = models.ScoredPoint(
            id=1, version=0, score=1.0, payload=first_chunk,
        )
        monkeypatch.setattr(
            vector_store, "search_chunks", Mock(return_value=[point])
        )
        monkeypatch.setattr(
            vector_store, "search_hybrid_chunks", Mock(return_value=[point])
        )
        rerank = AsyncMock(return_value=[first_chunk])
        monkeypatch.setattr(reranker, "rerank_sources", rerank)

        response = client.post("/evaluations/retrieval")

        assert response.status_code == 200
        assert response.json()["questions"][0]["ranks"] == dict.fromkeys(main.MODES, 1)
        assert response.json()["questions"][1]["ranks"] == dict.fromkeys(main.MODES, None)
        embed.assert_awaited_once_with(["First?", "Second?"])
        assert rerank.await_count == 2

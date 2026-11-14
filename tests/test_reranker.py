import asyncio
from unittest.mock import AsyncMock, Mock

import pytest

from app import reranker
from app.schemas import SourceChunk


def test_rerank_sources_reorders_original_chunks_by_cohere_result_indexes(
    monkeypatch,
):
    sources: list[SourceChunk] = [
        {
            "text": "A less relevant passage.",
            "file_name": "book.pdf",
            "page_number": 4,
            "chunk_index": 1,
        },
        {
            "text": "The answer is in this passage.",
            "file_name": "book.pdf",
            "page_number": 8,
            "chunk_index": 2,
        },
    ]
    rerank_mock = AsyncMock(
        return_value=Mock(results=[Mock(index=1), Mock(index=0)])
    )
    monkeypatch.setattr(reranker, "client", Mock(rerank=rerank_mock))

    response = asyncio.run(
        reranker.rerank_sources("What is the answer?", sources, limit=2)
    )

    assert response == [sources[1], sources[0]]
    rerank_mock.assert_awaited_once_with(
        model=reranker.RERANK_MODEL,
        query="What is the answer?",
        documents=[
            "A less relevant passage.",
            "The answer is in this passage.",
        ],
        top_n=2,
    )


def test_rerank_sources_rejects_invalid_result_indexes(monkeypatch):
    sources: list[SourceChunk] = [
        {
            "text": "A passage.",
            "file_name": "book.pdf",
            "page_number": 4,
            "chunk_index": 1,
        }
    ]
    rerank_mock = AsyncMock(return_value=Mock(results=[Mock(index=1)]))
    monkeypatch.setattr(reranker, "client", Mock(rerank=rerank_mock))

    with pytest.raises(
        reranker.RerankerProviderError,
        match="Cohere returned an invalid reranking result.",
    ):
        asyncio.run(
            reranker.rerank_sources("Question?", sources, limit=1)
        )

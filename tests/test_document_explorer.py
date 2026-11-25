from unittest.mock import Mock

from fastapi.testclient import TestClient
from qdrant_client import QdrantClient, models

from app import main, vector_store
from app.schemas import ChunkInput

client = TestClient(main.app)


def test_list_documents_groups_chunks_and_counts_pages(monkeypatch):
    chunks = [
        ChunkInput(file_name="b.pdf", page_number=2, chunk_index=1, text="B"),
        ChunkInput(file_name="a.pdf", page_number=1, chunk_index=2, text="Second"),
        ChunkInput(file_name="a.pdf", page_number=1, chunk_index=1, text="First"),
        ChunkInput(file_name="a.pdf", page_number=3, chunk_index=1, text="Third"),
    ]
    monkeypatch.setattr(main, "list_document_chunks", Mock(return_value=chunks))

    response = client.get("/documents")

    assert response.status_code == 200
    assert response.json() == {"documents": [
        {"filename": "a.pdf", "chunk_count": 3, "page_count": 2},
        {"filename": "b.pdf", "chunk_count": 1, "page_count": 1},
    ]}


def test_document_chunks_sorted_and_missing_document_returns_404(monkeypatch):
    chunks = [
        ChunkInput(file_name="a.pdf", page_number=2, chunk_index=1, text="Third"),
        ChunkInput(file_name="a.pdf", page_number=1, chunk_index=2, text="Second"),
        ChunkInput(file_name="a.pdf", page_number=1, chunk_index=1, text="First"),
    ]
    load = Mock(side_effect=[chunks, []])
    monkeypatch.setattr(main, "list_document_chunks", load)

    response = client.get("/documents/chunks", params={"filename": "a.pdf"})
    assert response.status_code == 200
    assert [chunk["text"] for chunk in response.json()["chunks"]] == [
        "First", "Second", "Third"
    ]
    assert load.call_args_list[0].args == ("a.pdf",)
    assert client.get("/documents/chunks", params={"filename": "missing.pdf"}).status_code == 404


def test_explorer_reads_all_chunks_from_qdrant(monkeypatch):
    qdrant = QdrantClient(":memory:")
    qdrant.create_collection(
        collection_name=vector_store.COLLECTION_NAME,
        vectors_config=models.VectorParams(size=2, distance=models.Distance.COSINE),
    )
    monkeypatch.setattr(vector_store, "client", qdrant)
    chunks = [
        {"file_name": "demo.pdf", "page_number": 1, "chunk_index": i, "text": f"Chunk {i}"}
        for i in range(1, 103)
    ]
    vector_store.store_chunks(chunks, [[1.0, 0.0] for _ in chunks])

    documents = client.get("/documents")
    response = client.get("/documents/chunks", params={"filename": "demo.pdf"})

    assert documents.json() == {"documents": [
        {"filename": "demo.pdf", "chunk_count": 102, "page_count": 1}
    ]}
    assert [item["chunk_index"] for item in response.json()["chunks"]] == list(range(1, 103))
    qdrant.close()

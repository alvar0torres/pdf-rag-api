from contextlib import closing
from unittest.mock import Mock

import numpy as np
import pytest
from fastapi.testclient import TestClient
from qdrant_client import QdrantClient, models

from app import main, vector_store

client = TestClient(main.app)


@pytest.fixture
def qdrant(monkeypatch):
    with closing(QdrantClient(":memory:")) as database:
        database.create_collection(
            collection_name=vector_store.COLLECTION_NAME,
            vectors_config=models.VectorParams(size=2, distance=models.Distance.COSINE),
        )
        monkeypatch.setattr(vector_store, "client", database)
        yield database


def insert_chunks(database, vectors):
    database.upsert(
        collection_name=vector_store.COLLECTION_NAME,
        points=[
            models.PointStruct(
                id=index,
                vector=vector,
                payload={
                    "file_name": "test.pdf",
                    "page_number": 1,
                    "chunk_index": index,
                    "text": f"Chunk {index}",
                },
            )
            for index, vector in enumerate(vectors, start=1)
        ],
    )


def test_empty_and_single_chunk(qdrant):
    assert client.get("/documents/map").json() == {"points": []}
    insert_chunks(qdrant, [[1.0, 0.0]])

    point = client.get("/documents/map").json()["points"][0]
    assert point == {
        "id": "1",
        "file_name": "test.pdf",
        "page_number": 1,
        "chunk_index": 1,
        "text": "Chunk 1",
        "position": [0.0, 0.0, 0.0],
        "cluster": 0,
    }


def test_map_projects_vectors_and_colors_similar_embeddings(qdrant):
    insert_chunks(qdrant, [[1.0, 0.01]] * 4 + [[0.01, 1.0]] * 4)

    response = client.get("/documents/map")

    assert response.status_code == 200
    points = response.json()["points"]
    assert len(points) == 8
    assert all(len(point["position"]) == 3 and np.isfinite(point["position"]).all() for point in points)
    assert len({point["cluster"] for point in points[:4]}) == 1
    assert len({point["cluster"] for point in points[4:]}) == 1
    assert points[0]["cluster"] != points[4]["cluster"]


def test_map_handles_two_chunks(qdrant):
    insert_chunks(qdrant, [[1.0, 0.0], [0.0, 1.0]])

    points = client.get("/documents/map").json()["points"]

    assert len(points) == 2
    assert all(len(point["position"]) == 3 and np.isfinite(point["position"]).all() for point in points)


def test_map_reads_all_pages(qdrant, monkeypatch):
    from app import embedding_map

    insert_chunks(qdrant, [[1.0, 0.0]] * 101)
    monkeypatch.setattr(embedding_map, "TSNE", Mock(return_value=Mock(
        fit_transform=Mock(return_value=np.zeros((101, 3))),
    )))
    monkeypatch.setattr(embedding_map, "KMeans", Mock(return_value=Mock(
        fit_predict=Mock(return_value=np.zeros(101, dtype=int)),
    )))
    assert len(client.get("/documents/map").json()["points"]) == 101

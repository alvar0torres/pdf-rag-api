import math

import numpy as np
from sklearn.cluster import KMeans
from sklearn.manifold import TSNE

from app import vector_store
from app.schemas import ChunkInput


def build_embedding_map() -> list[dict]:
    records = []
    offset = None
    while True:
        points, offset = vector_store.client.scroll(
            collection_name=vector_store.COLLECTION_NAME,
            limit=100,
            offset=offset,
            with_payload=True,
            with_vectors=True,
        )
        records.extend(points)
        if offset is None:
            break

    if not records:
        return []

    chunks = []
    vectors = []
    for point in records:
        if not isinstance(point.vector, list) or not point.vector:
            raise ValueError(f"Chunk {point.id} does not have a dense embedding.")
        chunks.append(ChunkInput.model_validate(point.payload))
        vectors.append(point.vector)

    embeddings = np.asarray(vectors, dtype=np.float64)
    if embeddings.ndim != 2 or not np.isfinite(embeddings).all():
        raise ValueError("Indexed embeddings must have consistent finite dimensions.")
    norms = np.linalg.norm(embeddings, axis=1)
    if (norms == 0).any():
        raise ValueError("Indexed embeddings must not be zero vectors.")
    embeddings = embeddings / norms[:, np.newaxis]

    count = len(records)
    cluster_count = min(8, max(1, round(math.sqrt(count / 2))))
    if cluster_count == 1:
        labels = np.zeros(count, dtype=int)
    else:
        labels = KMeans(
            n_clusters=cluster_count, random_state=42, n_init=10
        ).fit_predict(embeddings)

    if count == 1:
        coordinates = np.zeros((1, 3))
    else:
        coordinates = TSNE(
            n_components=3,
            perplexity=min(30.0, max(1.0, (count - 1) / 3)),
            metric="cosine",
            init="random",
            random_state=42,
        ).fit_transform(embeddings)

    return [
        {
            "id": str(point.id),
            "file_name": chunk.file_name,
            "page_number": chunk.page_number,
            "chunk_index": chunk.chunk_index,
            "text": chunk.text,
            "position": position.tolist(),
            "cluster": int(label),
        }
        for point, chunk, position, label in zip(
            records, chunks, coordinates, labels, strict=True
        )
    ]

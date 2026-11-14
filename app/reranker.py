import os

import cohere
import httpx
from cohere.core.api_error import ApiError
from dotenv import load_dotenv

from app.schemas import SourceChunk

load_dotenv()

RERANK_MODEL = "rerank-v5.0-fast"
api_key = os.getenv("COHERE_API_KEY")
client = cohere.AsyncClientV2(api_key=api_key) if api_key else None


class RerankerProviderError(RuntimeError):
    pass


async def rerank_sources(
    question: str,
    sources: list[SourceChunk],
    limit: int,
) -> list[SourceChunk]:
    if not sources:
        return []

    if client is None:
        raise RuntimeError("COHERE_API_KEY is not configured.")

    try:
        response = await client.rerank(
            model=RERANK_MODEL,
            query=question,
            documents=[source["text"] for source in sources],
            top_n=min(limit, len(sources)),
        )
    except (ApiError, httpx.HTTPError) as error:
        raise RerankerProviderError("Cohere reranking request failed.") from error

    ranked_sources: list[SourceChunk] = []
    seen_indexes: set[int] = set()
    for result in response.results:
        if not 0 <= result.index < len(sources) or result.index in seen_indexes:
            raise RerankerProviderError(
                "Cohere returned an invalid reranking result."
            )

        seen_indexes.add(result.index)
        ranked_sources.append(sources[result.index])

    return ranked_sources

import logging

from fastapi import FastAPI, File, HTTPException, UploadFile
from openai import OpenAIError

from app.document_processing import extract_pdf_data
from app.embeddings import create_embeddings
from app.generation import generate_answer
from app.reranker import RerankerProviderError, rerank_sources
from app.vector_store import (
    search_chunks,
    search_keyword_chunks,
    search_hybrid_chunks,
    store_chunks,
    delete_document_chunks,
    list_document_chunks,
)
from app.schemas import (
    AskRequest,
    AskResponse,
    Citation,
    ChunkInput,
    EmbeddingRequest,
    IndexChunksRequest,
    SearchRequest,
)
from evals.evaluate_retrieval import (
    CANDIDATE_LIMIT,
    DEFAULT_DATASET,
    MODES,
    TOP_K,
    EvaluationPreconditionError,
    calculate_metrics,
    load_dataset,
    run_evaluation,
)

app = FastAPI(title="RAG-Lab API")
RERANK_CANDIDATE_LIMIT = 20
logger = logging.getLogger(__name__)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/evaluations/retrieval")
def retrieval_evaluation_info():
    dataset = load_dataset(DEFAULT_DATASET)
    return {
        "title": dataset.title,
        "source_file": dataset.source_file,
        "question_count": len(dataset.questions),
        "top_k": TOP_K,
        "candidate_limit": CANDIDATE_LIMIT,
        "modes": MODES,
    }


@app.post("/evaluations/retrieval")
async def evaluate_retrieval():
    dataset = load_dataset(DEFAULT_DATASET)
    try:
        ranks_by_mode = await run_evaluation(dataset)
    except EvaluationPreconditionError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except (OpenAIError, RerankerProviderError) as error:
        provider = "OpenAI" if isinstance(error, OpenAIError) else "Cohere"
        logger.warning(
            "Retrieval evaluation %s request failed (%s)",
            provider,
            type(error).__name__,
        )
        raise HTTPException(
            status_code=502,
            detail=f"{provider} request failed. Check its API key and provider logs.",
        ) from error

    return {
        "title": dataset.title,
        "source_file": dataset.source_file,
        "question_count": len(dataset.questions),
        "top_k": TOP_K,
        "candidate_limit": CANDIDATE_LIMIT,
        "modes": [
            {"mode": mode, "metrics": calculate_metrics(ranks_by_mode[mode])}
            for mode in MODES
        ],
        "questions": [
            {
                "id": question.id,
                "question": question.question,
                "ranks": {mode: ranks_by_mode[mode][index] for mode in MODES},
            }
            for index, question in enumerate(dataset.questions)
        ],
    }


@app.post("/embeddings")
async def create_embedding_endpoint(request: EmbeddingRequest):
    embeddings = await create_embeddings(request.texts)

    return {
        "embedding_count": len(embeddings),
        "dimensions": len(embeddings[0]),
        "previews": [embedding[:5] for embedding in embeddings],
    }


@app.post("/documents/extract")
async def extract_pdf(file: UploadFile = File(...)):
    filename, pages = await extract_pdf_data(file)

    return {
        "filename": filename,
        "page_count": len(pages),
        "chunk_count": sum(len(page["chunks"]) for page in pages),
        "pages": pages,
    }


@app.get("/documents")
def list_documents():
    documents: dict[str, list[ChunkInput]] = {}
    for chunk in list_document_chunks():
        documents.setdefault(chunk.file_name, []).append(chunk)

    return {
        "documents": [
            {
                "filename": filename,
                "chunk_count": len(chunks),
                "page_count": len({chunk.page_number for chunk in chunks}),
            }
            for filename, chunks in sorted(documents.items())
        ]
    }


@app.get("/documents/chunks")
def get_document_chunks(filename: str):
    chunks = list_document_chunks(filename)
    if not chunks:
        raise HTTPException(status_code=404, detail="No indexed document found.")
    chunks.sort(key=lambda chunk: (chunk.page_number, chunk.chunk_index))
    return {"filename": filename, "chunks": chunks}


@app.post("/documents/index")
async def index_chunks(request: IndexChunksRequest):
    chunks = [chunk.model_dump() for chunk in request.chunks]
    texts = [chunk["text"] for chunk in chunks]

    embeddings = await create_embeddings(texts)
    store_chunks(chunks, embeddings)

    return {"indexed_count": len(chunks)}


@app.post("/search")
async def search(request: SearchRequest):
    embeddings = await create_embeddings([request.question])
    results = search_chunks(embeddings[0], limit=request.limit)

    return {
        "question": request.question,
        "results": [
            {
                "score": result.score,
                "text": result.payload.get("text") if result.payload else None,
                "file_name": (
                    result.payload.get("file_name") if result.payload else None
                ),
                "page_number": (
                    result.payload.get("page_number") if result.payload else None
                ),
            }
            for result in results
        ],
    }


@app.post("/search/keyword")
async def keyword_search(request: SearchRequest):
    results = search_keyword_chunks(request.question, limit=request.limit)

    return {
        "question": request.question,
        "results": [
            {
                "score": result.score,
                "text": result.payload.get("text") if result.payload else None,
                "file_name": (
                    result.payload.get("file_name") if result.payload else None
                ),
                "page_number": (
                    result.payload.get("page_number") if result.payload else None
                ),
            }
            for result in results
        ],
    }


@app.post("/search/hybrid")
async def hybrid_search(request: SearchRequest):
    embeddings = await create_embeddings([request.question])
    results = search_hybrid_chunks(
        embeddings[0],
        request.question,
        limit=request.limit,
    )

    return {
        "question": request.question,
        "results": [
            {
                "score": result.score,
                "text": result.payload.get("text") if result.payload else None,
                "file_name": (
                    result.payload.get("file_name") if result.payload else None
                ),
                "page_number": (
                    result.payload.get("page_number") if result.payload else None
                ),
            }
            for result in results
        ],
    }


@app.post("/ask", response_model=AskResponse)
async def ask(request: AskRequest):
    recent_history = request.history[-6:]
    retrieval_context = [
        f"{message.role}: {message.content}" for message in recent_history
    ]
    retrieval_context.append(f"user: {request.question}")
    retrieval_query = "\n".join(retrieval_context)
    question_embedding = (await create_embeddings([retrieval_query]))[0]
    results = search_hybrid_chunks(
        question_embedding,
        retrieval_query,
        limit=RERANK_CANDIDATE_LIMIT,
    )

    sources = [result.payload for result in results if result.payload is not None]

    if not sources:
        return AskResponse(
            answer="I could not find an answer in the provided sources.",
            citations=[],
        )

    try:
        sources = await rerank_sources(retrieval_query, sources, request.limit)
    except RerankerProviderError as error:
        raise HTTPException(
            status_code=502,
            detail="The reranking service request failed.",
        ) from error

    generated = await generate_answer(request.question, sources, recent_history)

    # Map the model's source IDs back to retrieved chunks.
    sources_by_id = {
        f"S{index}": source for index, source in enumerate(sources, start=1)
    }

    citations = []
    for source_id in generated.source_ids:
        source = sources_by_id.get(source_id)

        if source is None:
            raise HTTPException(
                status_code=502,
                detail=f"The answer model returned an unknown source ID: {source_id}",
            )

        citations.append(
            Citation(
                file_name=source["file_name"],
                page_number=source["page_number"],
                quote=source["text"],
            )
        )

    return AskResponse(answer=generated.answer, citations=citations)


@app.post("/documents/ingest")
async def ingest_pdf(file: UploadFile = File(...)):
    filename, pages = await extract_pdf_data(file)

    # Add source details to every chunk before storing it.
    chunks: list[dict[str, str | int]] = []
    for page in pages:
        for chunk in page["chunks"]:
            chunks.append(
                {
                    "text": chunk["text"],
                    "file_name": filename,
                    "page_number": page["page_number"],
                    "chunk_index": chunk["chunk_index"],
                }
            )

    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="No text could be extracted from this PDF.",
        )

    # Send chunks in batches of at most 100 to the embedding API.
    embeddings: list[list[float]] = []
    for batch_start in range(0, len(chunks), 100):
        batch = chunks[batch_start : batch_start + 100]
        batch_embeddings = await create_embeddings([chunk["text"] for chunk in batch])
        embeddings.extend(batch_embeddings)

    delete_document_chunks(filename)
    store_chunks(chunks, embeddings)

    return {
        "filename": filename,
        "page_count": len(pages),
        "chunk_count": len(chunks),
        "indexed_count": len(chunks),
    }


@app.delete("/documents/delete")
async def delete_document(filename: str):
    delete_document_chunks(filename)
    return {"message": f"Document deleted: {filename}"}

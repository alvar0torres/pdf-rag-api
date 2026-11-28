# RAG-Lab

A learning project that demonstrates a Retrieval-Augmented Generation (RAG) API for PDF documents. It extracts and chunks PDF text, creates embeddings, stores chunks in a local Qdrant database, and answers questions with citations linked to retrieved source chunks.

## How it works

1. Upload a PDF for extraction or ingestion.
2. Extract text page by page and split it into overlapping chunks using LangChain's recursive character splitter.
3. Generate embeddings with OpenAI's `text-embedding-3-small` model and store them in Qdrant.
4. Combine dense and BM25 retrieval with Qdrant's RRF, then rerank the candidates with Cohere. For chat follow-ups, the current question and up to six previous messages are used as retrieval context.
5. Pass the top-ranked chunks to `gpt-4o-mini` and map its source IDs back to document citations.

## Requirements

- Python 3.10 or newer
- An OpenAI API key with access to the embedding and chat models used by the app
- A Cohere API key for reranking

OpenAI and Cohere API calls may incur charges.

## Setup

From the project directory, create a virtual environment:

```bash
python -m venv .venv
```

Activate it using the command for your shell:

```bash
source .venv/bin/activate
```

Install dependencies and configure the API key:

```bash
python -m pip install -r requirements.txt
cp .env.template .env
```

Replace the placeholder values for `OPENAI_API_KEY` and `COHERE_API_KEY` in `.env` with your keys. Do not commit `.env`.

## Run the API

```bash
uvicorn app.main:app --reload
```

The API is available at `http://127.0.0.1:8000`. Interactive API documentation is at `http://127.0.0.1:8000/docs`.

## Run the frontend

With the API running, start the React development server in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). The development server proxies API requests to `http://127.0.0.1:8000`. In **Index documents**, drop or select one PDF to preview its extracted chunks, then select **Index document** to create embeddings and store them. Previewing does not index the document; indexing can incur OpenAI charges and replaces indexed chunks with the same filename. In **Explorer**, browse indexed filenames and stored text chunks; the original PDF is not stored. Page counts in the explorer count pages with indexed text, not total PDF pages. In **Chat**, ask questions and follow up in the same conversation; recent turns are included as context for retrieval and answer generation. Chat requests use the configured embedding, reranking, and answer providers and may incur charges. Conversations remain available while navigating within the app, until cleared or refreshed. Refreshing the page clears the preview, not the index.

## Main endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Check that the API is running. |
| `GET` | `/evaluations/retrieval` | Get retrieval benchmark details. |
| `POST` | `/evaluations/retrieval` | Run the retrieval benchmark and return metrics and per-question ranks. |
| `GET` | `/documents` | List indexed filenames and chunk/page counts. |
| `GET` | `/documents/chunks?filename=example.pdf` | Retrieve indexed chunks for a filename. |
| `POST` | `/documents/extract` | Extract page text and chunks from an uploaded PDF without indexing it. |
| `POST` | `/documents/ingest` | Extract a PDF, create embeddings, and replace indexed chunks with the same filename. |
| `POST` | `/documents/index` | Create embeddings and index supplied chunks. |
| `POST` | `/search` | Return the top matching chunks for a question. |
| `POST` | `/search/keyword` | Return the top matching chunks using Qdrant's BM25 text search. |
| `POST` | `/search/hybrid` | Combine dense and BM25 results using Qdrant's RRF fusion. |
| `POST` | `/ask` | Generate an answer using retrieved chunks and return source citations; optionally include conversation history. |
| `DELETE` | `/documents/delete?filename=example.pdf` | Delete indexed chunks for a filename. |

### Example: ingest a PDF and ask a question

```bash
curl -X POST http://127.0.0.1:8000/documents/ingest \
  -F "file=@example.pdf"
```

```bash
curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What is this document about?","limit":5}'
```

An `/ask` response has this shape:

```json
{
  "answer": "The answer based on retrieved sources.",
  "citations": [
    {
      "file_name": "example.pdf",
      "page_number": 1,
      "quote": "Text from the retrieved source chunk."
    }
  ]
}
```

For follow-up questions, `/ask` accepts an optional `history` list of messages with `role` (`user` or `assistant`) and `content` fields. The API accepts up to 12 previous messages and uses the most recent six for retrieval and answer generation. Older messages may remain visible in the frontend but are not used as context.

## Tests

Run the test suite with:

```bash
python -m pytest
```

Tests mock external services, so they don't make OpenAI calls or modify the local Qdrant database.

Run the frontend component tests with:

```bash
cd frontend
npm test
```

The frontend tests mock document API calls and do not require a running backend.

## Retrieval evaluation

The benchmark in `evals/botany_questions.json` compares dense search, hybrid search, and hybrid search followed by Cohere reranking. Each question has one or more manually labeled evidence passages and their PDF page numbers. A retrieved chunk counts as relevant only if it comes from the expected file and page and contains a labeled passage after normalizing case, whitespace, and Unicode compatibility differences such as ligatures. It reports Hit@1, Hit@3, Hit@5, and MRR@5. These scores are not directly comparable with the earlier page-only scores.

Before making provider calls, the script checks that every labeled passage exists in an indexed chunk. If a check fails, verify the PDF version and chunking, then re-ingest the PDF or update the label. Multiple passages are alternatives: finding any one counts as a hit. Matching is exact after normalization, not semantic, so valid unlabeled evidence or passages split across chunks can still count as misses. Ensure each label supports its question.

Ingest `data/sample_documents/intro_botany.pdf` as `intro_botany.pdf`, then stop the API server before running the benchmark. The local Qdrant database can only be opened by one process at a time.

```bash
python -m evals.evaluate_retrieval
```

The benchmark makes one batched OpenAI embeddings request and one Cohere reranking request per question, so provider usage may incur charges. It requires `OPENAI_API_KEY` and `COHERE_API_KEY` in `.env`. Cohere rate limits may stop the run; if that happens, wait for the limit to reset before trying again.

Alternatively, with `intro_botany.pdf` indexed, open **Evaluation** in the frontend and select **Run evaluation**. The API runs the same benchmark in its own process, so the API server must remain running. The page shows metrics and per-question ranks after the run completes; leaving or refreshing it discards the displayed results and may not stop provider requests already in progress. This first version uses the bundled dataset and fixed benchmark configuration.

If a provider request fails, the page identifies OpenAI or Cohere and suggests checking its API key and provider logs. The API log records the provider and error type without logging provider response details.

## Current scope and limitations

- PDF documents only; Markdown and other formats are not implemented.
- Chunking uses LangChain's `RecursiveCharacterTextSplitter` with a 1,000-character chunk size and 150-character overlap; it is not semantic chunking.
- `/ask` retrieves hybrid candidates, reranks them with Cohere, then generates an answer with citations.
- The retrieval benchmark evaluates retrieval only; answer quality and citation correctness are not yet evaluated.
- The Qdrant database is local and persistent in `qdrant_data/`.
- The frontend supports PDF preview and indexing, indexed-document exploration, chat with source citations, and the bundled retrieval evaluation.
- The answer response includes an answer and citations; a confidence score is not implemented.
- This is a learning project, not a hardened production deployment. Authentication, authorization, deployment configuration, and operational monitoring are outside its current scope.

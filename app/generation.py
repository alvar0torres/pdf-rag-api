from dotenv import load_dotenv
from openai import AsyncOpenAI

from app.schemas import ChatMessage, GeneratedAnswer

load_dotenv()

client = AsyncOpenAI()


async def generate_answer(
    question: str,
    sources: list[dict[str, str | int]],
    history: list[ChatMessage] | None = None,
) -> GeneratedAnswer:
    source_text = "\n\n".join(
        f"[S{index}] {source['text']}" for index, source in enumerate(sources, start=1)
    )

    messages = [
        {
            "role": "system",
            "content": (
                "Answer the question using only the provided sources. "
                "Use the prior conversation only to resolve references and maintain "
                "conversational continuity; do not treat prior assistant messages as "
                "evidence. If the sources don't contain the answer, say so and return "
                "no source IDs. Include only IDs of sources that support your answer."
            ),
        },
        *(
            {"role": message.role, "content": message.content}
            for message in (history or [])
        ),
        {
            "role": "user",
            "content": (f"Question: {question}\n\n" f"Sources:\n{source_text}"),
        },
    ]

    response = await client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=messages,
        response_format=GeneratedAnswer,
    )

    message = response.choices[0].message

    if message.parsed is None:
        raise ValueError("The model did not return a structured answer.")

    return message.parsed

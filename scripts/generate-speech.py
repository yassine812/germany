"""Regenerate the original German pronunciation models (requires edge-tts)."""

import asyncio
import json
from pathlib import Path

import edge_tts

WEB = Path(__file__).resolve().parents[1] / "web"
VOICES = {"female": "de-DE-KatjaNeural", "male": "de-DE-ConradNeural"}


async def main():
    topics = json.loads((WEB / "speech.json").read_text(encoding="utf8"))
    output = WEB / "speech"
    output.mkdir(exist_ok=True)
    limit = asyncio.Semaphore(5)

    async def record(topic, index, exercise, gender, voice):
        target = output / f"{topic}-{index}-{gender}.mp3"
        if target.exists() and target.stat().st_size > 1000:
            return
        async with limit:
            temporary = target.with_suffix(".part")
            for delay in (1, 3, None):
                try:
                    await edge_tts.Communicate(
                        exercise.get("model", exercise["text"]), voice, rate="-22%"
                    ).save(str(temporary))
                    temporary.replace(target)
                    return
                except Exception:
                    if delay is None:
                        temporary.unlink(missing_ok=True)
                        raise
                    await asyncio.sleep(delay)

    await asyncio.gather(*(
        record(topic, index, exercise, gender, voice)
        for topic, exercises in topics.items()
        for index, exercise in enumerate(exercises)
        for gender, voice in VOICES.items()
    ))
    print(f"{len(list(output.glob('*.mp3')))} modèles de prononciation")


if __name__ == "__main__":
    asyncio.run(main())

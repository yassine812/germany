"""Regenerate the original German pronunciation models (requires edge-tts)."""

import argparse
import asyncio
import json
from pathlib import Path

import edge_tts

WEB = Path(__file__).resolve().parents[1] / "web"
VOICES = {"female": "de-DE-KatjaNeural", "male": "de-DE-ConradNeural"}
LETTERS = "abcdefghijklmnopqrstuvwxyzäöüß"
LETTER_EXAMPLES = dict(zip(LETTERS, (
    "Apfel", "Ball", "Cent", "Dach", "Esel", "Fisch", "Garten", "Haus", "Igel", "Jacke",
    "Katze", "Lampe", "Mutter", "Nase", "Oma", "Park", "Quelle", "Rose", "Sonne", "Tasse",
    "Uhr", "Vogel", "Wasser", "Xylophon", "Ypsilon", "Zug", "Äpfel", "Öl", "Tür", "Straße",
)))
LETTER_MODELS = {letter: f"{letter.upper() if letter != 'ß' else 'Eszett'} wie {example}."
                 for letter, example in LETTER_EXAMPLES.items()}


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh-letters", action="store_true")
    args = parser.parse_args()
    topics = json.loads((WEB / "speech.json").read_text(encoding="utf8"))
    output = WEB / "speech"
    output.mkdir(exist_ok=True)
    (output / "letters").mkdir(exist_ok=True)
    limit = asyncio.Semaphore(5)

    async def record(key, text, gender, voice, letters=False):
        target = output / f"{key}-{gender}.mp3"
        if target.exists() and target.stat().st_size > 1000 and not (letters and args.refresh_letters):
            return
        async with limit:
            temporary = target.with_suffix(".part")
            for delay in (1, 3, None):
                try:
                    await edge_tts.Communicate(
                        text, voice, rate="-22%"
                    ).save(str(temporary))
                    temporary.replace(target)
                    return
                except Exception:
                    if delay is None:
                        temporary.unlink(missing_ok=True)
                        raise
                    await asyncio.sleep(delay)

    jobs = [
        record(f"{topic}-{index}", "Ä wie Äpfel. Ö wie Öl. Ü wie in Tür."
               if exercise.get("alphabetAnswer") == "äöü" else exercise.get("model", exercise["text"]),
               gender, voice, bool(exercise.get("alphabetAnswer")))
        for topic, exercises in topics.items()
        for index, exercise in enumerate(exercises)
        for gender, voice in VOICES.items()
    ]
    jobs.extend(record(f"letters/{i}", LETTER_MODELS[letter], gender, voice, True)
                for i, letter in enumerate(LETTERS) for gender, voice in VOICES.items())
    await asyncio.gather(*jobs)
    print(f"{len(list(output.rglob('*.mp3')))} modèles de prononciation")


if __name__ == "__main__":
    asyncio.run(main())

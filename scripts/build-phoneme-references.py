"""Build the IPA references from the two recorded German model voices.

Supply a ZIPA model directory containing model.int8.onnx and tokens.txt.
Dependencies: onnxruntime, kaldi-native-fbank, numpy and FFmpeg.
"""

import argparse
import json
import subprocess
from pathlib import Path

import kaldi_native_fbank as kaldi
import numpy as np
import onnxruntime as ort

WEB = Path(__file__).resolve().parents[1] / "web"


def phones(path, ffmpeg, session, tokens, options):
    pcm = subprocess.check_output([
        ffmpeg, "-nostdin", "-v", "error", "-i", str(path), "-ac", "1",
        "-ar", "16000", "-f", "f32le", "-"
    ])
    samples = np.frombuffer(pcm, dtype="<f4")
    audio = samples * (.9 / max(np.abs(samples).max(), .001))
    bank = kaldi.OnlineFbank(options)
    bank.accept_waveform(16000, audio.tolist())
    bank.input_finished()
    features = np.array([bank.get_frame(i) for i in range(bank.num_frames_ready)], dtype=np.float32)
    output, lengths = session.run(None, {
        "x": features[None, :, :], "x_lens": np.array([len(features)], dtype=np.int64)
    })
    frames = int(lengths[0])
    frame_seconds = len(samples) / 16000 / frames
    result = []
    last = -1
    for index, probabilities in enumerate(output[0, :frames]):
        token = int(probabilities.argmax())
        probability = float(np.exp(probabilities[token]))
        if token != last:
            result.append([tokens[token], round(index * frame_seconds, 3),
                           round((index + 1) * frame_seconds, 3), round(probability, 3)])
        else:
            result[-1][2] = round((index + 1) * frame_seconds, 3)
            result[-1][3] = max(result[-1][3], round(probability, 3))
        last = token
    return [row for row in result if row[0] not in {"<blk>", "<sos/eos>", "<unk>", "▁", "ʔ"}
            and row[0] not in "ʰʲʷʼː˞ˠˤ̴̥̩̪̺̃̚" and row[3] >= .25]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model_directory", type=Path)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    args = parser.parse_args()
    vocabulary = dict(reversed(line.rsplit(" ", 1)) for line in
                      (args.model_directory / "tokens.txt").read_text(encoding="utf8").splitlines())
    tokens = {int(key): value for key, value in vocabulary.items()}
    model_options = ort.SessionOptions()
    model_options.intra_op_num_threads = 4
    session = ort.InferenceSession(str(args.model_directory / "model.int8.onnx"), model_options,
                                   providers=["CPUExecutionProvider"])
    options = kaldi.FbankOptions()
    options.frame_opts.dither = 0
    options.frame_opts.snip_edges = False
    options.mel_opts.num_bins = 80
    source = json.loads((WEB / "speech.json").read_text(encoding="utf8"))
    targets = ([f"{topic}-{index}" for topic, rows in source.items() for index in range(len(rows))] +
               [f"letters/{index}" for index in range(30)])
    references = {key: {voice: phones(WEB / "speech" / f"{key}-{voice}.mp3", args.ffmpeg,
                                       session, tokens, options) for voice in ("female", "male")}
                  for key in targets}
    (WEB / "phonemes.json").write_text(json.dumps(references, ensure_ascii=False, separators=(",", ":")),
                                       encoding="utf8")
    print(f"{len(references)} IPA references in two voices")


if __name__ == "__main__":
    main()

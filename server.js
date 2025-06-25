// server.js
import express from 'express';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { v4 as uuid } from 'uuid';
import fs from 'node:fs/promises';
import path from 'node:path';

ffmpeg.setFfmpegPath(ffmpegPath);

const upload = multer({ dest: 'tmp/' });
const app = express();
const PORT = process.env.PORT || 4000;

/**
 * POST /convert
 * multipart/form-data  field "file"  -> webm blob
 * optional query:  width=1920  crf=18  preset=slow
 */
app.post('/convert', upload.single('file'), async (req, res, next) => {
  try {
    const src = req.file.path;
    const out = `tmp/${uuid()}.mp4`;

    const {
      width = 0,          // 0 ➞ keep original
      crf = 20,           // visually lossless 15-23
      preset = 'medium',  // ffmpeg x264 preset
    } = req.query;

    const command = ffmpeg(src)
      .videoCodec('libx264')
      .audioCodec('aac')           // in case you add audio later
      .outputOptions([
        '-pix_fmt yuv420p',        // iOS requires this
        `-crf ${crf}`,
        `-preset ${preset}`,
        '-movflags +faststart',    // mp4 starts playing before fully downloaded
      ])
      .on('end', async () => {
        await fs.unlink(src);      // tidy
        res.download(out, 'logo360.mp4', async () => {
          await fs.unlink(out);    // tidy
        });
      })
      .on('error', next);

    if (width > 0) command.size(`${width}x?`); // keep aspect ratio

    command.save(out);
  } catch (err) {
    next(err);
  }
});

app.listen(PORT, () => console.log(`⚡  converter running on :${PORT}`));

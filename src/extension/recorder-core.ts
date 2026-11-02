// The recording engine shared by the tab recorder (offscreen document) and the
// window/screen recorder (a small extension window): MediaRecorder to WebM, then
// the file is indexed and saved to IndexedDB.
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Output, WebMOutputFormat } from 'mediabunny'
import { putVideo } from '../shared/db'

let recorder: MediaRecorder | null = null
let stream: MediaStream | null = null
let chunks: Blob[] = []
let mime = 'video/webm'

export async function startRecording(video: MediaTrackConstraints, onEnded?: () => void) {
  stream = await navigator.mediaDevices.getUserMedia({ audio: false, video })
  // Fires if the user presses Chrome's "Stop sharing" button.
  stream.getVideoTracks()[0].addEventListener('ended', () => onEnded?.())
  mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'
  chunks = []
  recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const started = new Promise<number>((r) => (recorder!.onstart = () => r(Date.now())))
  recorder.start(1000)
  const startedAt = await started
  const track = stream.getVideoTracks()[0]
  const s = track.getSettings() as MediaTrackSettings & { displaySurface?: string }
  return { startedAt, w: s.width ?? 0, h: s.height ?? 0, surface: s.displaySurface, label: track.label }
}

export function pauseRecording(pause: boolean) {
  if (pause && recorder?.state === 'recording') recorder.pause()
  if (!pause && recorder?.state === 'paused') recorder.resume()
}

export async function stopRecording(videoId: string | null) {
  if (!recorder) return { duration: 0 }
  const rec = recorder
  const done = new Promise((r) => (rec.onstop = r))
  if (rec.state !== 'inactive') rec.stop()
  await done
  stream?.getTracks().forEach((t) => t.stop())
  const raw = new Blob(chunks, { type: 'video/webm' })
  recorder = null
  stream = null
  chunks = []
  if (!videoId) return { duration: 0 }

  // MediaRecorder files have no index or duration, which makes seeking slow.
  // Copying them into a fresh WebM (no re-encoding) adds both.
  let blob: Blob = raw
  let duration = 0
  try {
    const input = new Input({ source: new BlobSource(raw), formats: ALL_FORMATS })
    const output = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() })
    const conversion = await Conversion.init({ input, output })
    await conversion.execute()
    blob = new Blob([(output.target as BufferTarget).buffer!], { type: 'video/webm' })
    const fixed = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS })
    duration = Math.round((await fixed.computeDuration()) * 1000)
  } catch (err) {
    console.warn('Could not index the recording; keeping the original file.', err)
  }
  await putVideo({ id: videoId, blob, mime })
  return { duration, size: blob.size }
}

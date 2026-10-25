import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle, Square, Play, Download, Trash2, Loader2, Captions, Upload, RefreshCw,
  AlertCircle, Video, Mic, Search, ExternalLink,
} from "lucide-react";

/* =========================================================
   MoM card → Recording & Transcript
   • Records the WHOLE meeting from this browser: the user picks the
     Google Meet tab ("share tab audio") + this device's microphone.
   • Live transcription: browser speech recognition of this device's mic.
   • Transcript import (.txt / .vtt / .sbv) and Google Meet fetch.
   Files are uploaded to the backend and only served to logged-in users
   of the same organization.
========================================================= */

const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

const token = () =>
  localStorage.getItem("token") || localStorage.getItem("authToken") || sessionStorage.getItem("token") || "";

const authHeaders = (json = false) => ({
  ...(json ? { "Content-Type": "application/json" } : {}),
  ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
});

const request = async (path, options = {}) => {
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { ...authHeaders(Boolean(options.json)), ...(options.headers || {}) }, body: options.json ? JSON.stringify(options.json) : options.body });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok || data.success === false) throw new Error(data.message || `Server error ${res.status}`);
  return data;
};

const SpeechRecognitionImpl =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const pickMimeType = () =>
  ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(
    (t) => window.MediaRecorder?.isTypeSupported?.(t)
  ) || "";

const formatDuration = (sec) => {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const formatSize = (bytes) =>
  bytes > 1024 * 1024 * 1024
    ? `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
    : bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const SOURCE_LABEL = {
  whisper: "Transcribed from the meeting recording (Whisper, on your server)",
  google: "Google Meet transcript",
  live: "Live transcription (this device's microphone)",
  import: "Imported transcript file",
};

const MeetingMediaPanel = ({ meeting, canEdit, currentUserName, onChanged, notify }) => {
  const meetingId = meeting._id || meeting.id;

  // ---------- recording state ----------
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploadPct, setUploadPct] = useState(null);
  const [recError, setRecError] = useState("");
  const [playUrl, setPlayUrl] = useState("");
  const [loadingPlay, setLoadingPlay] = useState(false);
  const recorderRef = useRef(null);
  const streamsRef = useRef([]);
  const chunksRef = useRef([]);
  const startedRef = useRef(0);
  const audioCtxRef = useRef(null);

  // ---------- transcript state ----------
  const [liveOn, setLiveOn] = useState(false);
  const [interim, setInterim] = useState("");
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const recognitionRef = useRef(null);
  const pendingRef = useRef([]);
  const flushTimer = useRef(null);
  const fileRef = useRef(null);

  const transcript = meeting.transcript || { entries: [], source: "" };
  const jobStatus = transcript.status || "";
  const transcribing = jobStatus === "queued" || jobStatus === "processing";
  const entries = transcript.entries || [];
  const hasOtherTranscript = entries.length > 0 && transcript.source && transcript.source !== "live";

  const visibleEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => `${e.speaker} ${e.text}`.toLowerCase().includes(q));
  }, [entries, query]);

  // While the server transcribes the recording, check every 5 s for the result
  useEffect(() => {
    if (!transcribing) return undefined;
    const t = setInterval(async () => {
      try {
        const res = await request(`/meetings/${meetingId}/transcript`);
        const next = res.data.transcript || {};
        if (next.status !== jobStatus || (next.entries || []).length !== entries.length) {
          onChanged?.({ transcript: next });
          if (next.status === "done") notify?.("Transcript ready");
        }
      } catch {
        /* try again next tick */
      }
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcribing, jobStatus, meetingId]);

  const transcribeNow = async () => {
    if (entries.length && !window.confirm("Replace the current transcript with one made from the recording?")) return;
    setBusy("whisper");
    setRecError("");
    try {
      const res = await request(`/meetings/${meetingId}/transcript/whisper`, { method: "POST" });
      onChanged?.({ transcript: { ...transcript, status: "queued", error: "" } });
      notify?.(res.message);
    } catch (err) {
      setRecError(err.message);
    } finally {
      setBusy("");
    }
  };

  // Timer while recording
  useEffect(() => {
    if (!recording) return undefined;
    const t = setInterval(() => setElapsed((Date.now() - startedRef.current) / 1000), 500);
    return () => clearInterval(t);
  }, [recording]);

  // Warn before closing the page mid-recording
  useEffect(() => {
    if (!recording) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [recording]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      stopTracks();
      stopRecognition();
      if (playUrl) URL.revokeObjectURL(playUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const stopTracks = () => {
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streamsRef.current = [];
    audioCtxRef.current?.close?.().catch(() => {});
    audioCtxRef.current = null;
  };

  // ---------- live transcription ----------
  const flushLive = async () => {
    const batch = pendingRef.current.splice(0);
    if (!batch.length) return;
    try {
      const res = await request(`/meetings/${meetingId}/transcript`, {
        method: "PUT",
        json: { source: "live", append: true, entries: batch },
      });
      onChanged?.({ transcript: res.data.transcript });
    } catch (err) {
      pendingRef.current.unshift(...batch); // retry next time
      setRecError(`Transcript not saved yet: ${err.message}`);
    }
  };

  const startRecognition = () => {
    if (!SpeechRecognitionImpl) return false;
    const rec = new SpeechRecognitionImpl();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-IN";
    rec.onresult = (event) => {
      let partial = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const r = event.results[i];
        if (r.isFinal) {
          const text = r[0].transcript.trim();
          if (text) {
            pendingRef.current.push({ speaker: currentUserName || "Me", text, at: new Date().toISOString() });
          }
        } else {
          partial += r[0].transcript;
        }
      }
      setInterim(partial);
    };
    // Chrome stops recognition after silence — restart while we're live
    rec.onend = () => {
      if (recognitionRef.current === rec) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setRecError("Microphone permission denied — live transcription is off.");
    };
    recognitionRef.current = rec;
    rec.start();
    flushTimer.current = setInterval(flushLive, 10000);
    setLiveOn(true);
    return true;
  };

  function stopRecognition() {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    clearInterval(flushTimer.current);
    setInterim("");
    setLiveOn(false);
  }

  // ---------- recording ----------
  const startRecording = async () => {
    setRecError("");
    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) {
      setRecError("This browser cannot record. Use Google Chrome or Microsoft Edge on a computer.");
      return;
    }
    try {
      // 1) The Google Meet tab (video + everyone's audio)
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: true,
        preferCurrentTab: false,
        selfBrowserSurface: "exclude",
        systemAudio: "include",
      });
      streamsRef.current.push(display);

      // 2) This device's microphone (your own voice)
      let mic = null;
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        streamsRef.current.push(mic);
      } catch {
        /* recording continues without the mic */
      }

      // Mix both audio sources into one track
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();
      let audioSources = 0;
      [display, mic].forEach((s) => {
        if (s && s.getAudioTracks().length) {
          ctx.createMediaStreamSource(s).connect(dest);
          audioSources += 1;
        }
      });

      const tracks = [...display.getVideoTracks(), ...(audioSources ? dest.stream.getAudioTracks() : [])];
      const mixed = new MediaStream(tracks);
      const recorder = new MediaRecorder(mixed, { mimeType: pickMimeType() || undefined });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data?.size && chunksRef.current.push(e.data);
      recorder.onstop = uploadRecording;
      display.getVideoTracks()[0]?.addEventListener("ended", () => stopRecording()); // "Stop sharing" in Chrome
      recorder.start(5000);
      recorderRef.current = recorder;
      startedRef.current = Date.now();
      setElapsed(0);
      setRecording(true);

      if (!display.getAudioTracks().length) {
        setRecError(
          'Tab audio was not shared, so other participants will not be heard. Stop and choose the Google Meet tab with "Also share tab audio" ticked.'
        );
      }
      if (meeting.transcription && !hasOtherTranscript && !startRecognition() && !SpeechRecognitionImpl) {
        notify?.("Live transcription needs Google Chrome — recording continues without it.");
      }
    } catch (err) {
      stopTracks();
      if (err?.name !== "NotAllowedError") setRecError(err.message || "Could not start recording.");
    }
  };

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    stopRecognition();
    flushLive();
    setRecording(false);
  }

  const uploadRecording = () => {
    stopTracks();
    // Plain container type (no ";codecs=…" suffix) — that's what servers / players expect
    const baseType = (recorderRef.current?.mimeType || "video/webm").split(";")[0];
    const blob = new Blob(chunksRef.current, { type: baseType });
    chunksRef.current = [];
    recorderRef.current = null;
    if (!blob.size) {
      setRecError("Nothing was recorded.");
      return;
    }
    const durationSec = Math.round((Date.now() - startedRef.current) / 1000);
    const form = new FormData();
    form.append("durationSec", String(durationSec));
    form.append("recording", blob, `meeting.${blob.type.includes("mp4") ? "mp4" : "webm"}`);

    // XHR for upload progress
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/meetings/${meetingId}/recording`);
    if (token()) xhr.setRequestHeader("Authorization", `Bearer ${token()}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && setUploadPct(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setUploadPct(null);
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        notify?.(data.message || "Recording saved to this MoM");
        onChanged?.({
          recordingFile: data.data,
          ...(data.transcribing ? { transcript: { ...(meeting.transcript || {}), status: "queued", error: "" } } : {}),
        });
      } else {
        setRecError(`Upload failed: ${data.message || xhr.status}. Use "Download" below to keep a copy.`);
        // keep a local copy so nothing is lost
        setPlayUrl(URL.createObjectURL(blob));
      }
    };
    xhr.onerror = () => {
      setUploadPct(null);
      setRecError("Upload failed (network). The recording is kept below — download it.");
      setPlayUrl(URL.createObjectURL(blob));
    };
    setUploadPct(0);
    xhr.send(form);
  };

  const loadRecording = async (download = false) => {
    setLoadingPlay(true);
    try {
      const res = await fetch(`${API_BASE_URL}/meetings/${meetingId}/recording${download ? "?download=1" : ""}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Recording not available");
      const url = URL.createObjectURL(await res.blob());
      if (download) {
        const a = document.createElement("a");
        a.href = url;
        a.download = meeting.recordingFile?.name || "meeting-recording.webm";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } else {
        if (playUrl) URL.revokeObjectURL(playUrl);
        setPlayUrl(url);
      }
    } catch (err) {
      setRecError(err.message);
    } finally {
      setLoadingPlay(false);
    }
  };

  const deleteRecording = async () => {
    if (!window.confirm("Delete this meeting recording permanently?")) return;
    try {
      await request(`/meetings/${meetingId}/recording`, { method: "DELETE" });
      if (playUrl) URL.revokeObjectURL(playUrl);
      setPlayUrl("");
      onChanged?.({ recordingFile: null });
      notify?.("Recording deleted");
    } catch (err) {
      setRecError(err.message);
    }
  };

  // ---------- transcript actions ----------
  const fetchFromGoogle = async () => {
    setBusy("google");
    setRecError("");
    try {
      const res = await request(`/meetings/${meetingId}/transcript/google`, { method: "POST" });
      onChanged?.({ transcript: res.data.transcript, googleRecordingUrl: res.data.googleRecordingUrl });
      notify?.(res.message);
    } catch (err) {
      setRecError(err.message);
    } finally {
      setBusy("");
    }
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.(txt|vtt|sbv|srt)$/i.test(file.name)) {
      setRecError("Choose a transcript file: .txt, .vtt, .sbv or .srt");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setRecError("Transcript file is larger than 2 MB");
      return;
    }
    setBusy("import");
    setRecError("");
    try {
      const res = await request(`/meetings/${meetingId}/transcript/import`, {
        method: "POST",
        json: { text: await file.text() },
      });
      onChanged?.({ transcript: res.data.transcript });
      notify?.(res.message);
    } catch (err) {
      setRecError(err.message);
    } finally {
      setBusy("");
    }
  };

  const clearTranscript = async () => {
    if (!window.confirm("Remove the whole transcript from this MoM?")) return;
    try {
      await request(`/meetings/${meetingId}/transcript`, { method: "DELETE" });
      onChanged?.({ transcript: { source: "", entries: [] } });
    } catch (err) {
      setRecError(err.message);
    }
  };

  const file = meeting.recordingFile;

  return (
    <div style={styles.wrap}>
      <style>{"@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .25 } }"}</style>
      {/* ================= RECORDING ================= */}
      {(meeting.recording || file) && (
        <div style={styles.section}>
          <div style={styles.head}>
            <span style={styles.title}><Video size={14} /> Meeting Recording</span>
            {recording && (
              <span style={styles.live}>
                <span style={styles.liveDot} /> REC {formatDuration(elapsed)}
                {liveOn && <> · <Captions size={11} /> live transcript</>}
              </span>
            )}
          </div>

          {canEdit && !recording && uploadPct === null && (
            <div style={styles.row}>
              <button type="button" style={styles.primary} onClick={startRecording}>
                <Circle size={12} fill="#fff" /> {file ? "Record again" : "Start recording"}
              </button>
              <span style={styles.hint}>
                Choose the <strong>Google Meet tab</strong> and tick <strong>“Also share tab audio”</strong> to record everyone.
                Your microphone is added automatically.
              </span>
            </div>
          )}
          {recording && (
            <button type="button" style={styles.danger} onClick={stopRecording}>
              <Square size={12} fill="#fff" /> Stop & save recording
            </button>
          )}
          {uploadPct !== null && (
            <div style={styles.progressWrap}>
              <Loader2 size={13} className="loading-spinner" /> Uploading recording… {uploadPct}%
              <div style={styles.track}><div style={{ ...styles.fill, width: `${uploadPct}%` }} /></div>
            </div>
          )}

          {file && (
            <div style={styles.fileRow}>
              <Mic size={13} color="#1677a8" />
              <span style={{ flex: 1 }}>
                <strong>{formatDuration(file.durationSec)}</strong> · {formatSize(file.size)} · saved{" "}
                {file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : ""}
              </span>
              <button type="button" style={styles.ghost} onClick={() => loadRecording(false)} disabled={loadingPlay}>
                {loadingPlay ? <Loader2 size={11} className="loading-spinner" /> : <Play size={11} />} Play
              </button>
              <button type="button" style={styles.ghost} onClick={() => loadRecording(true)} disabled={loadingPlay}>
                <Download size={11} /> Download
              </button>
              {canEdit && (
                <button type="button" style={{ ...styles.ghost, color: "#be123c" }} onClick={deleteRecording}>
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          )}
          {meeting.googleRecordingUrl && (
            <a href={meeting.googleRecordingUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
              <ExternalLink size={11} /> Google Meet recording (Google Drive)
            </a>
          )}
          {playUrl && <video src={playUrl} controls style={styles.video} />}
          {!file && !canEdit && <div style={styles.empty}>No recording yet.</div>}
        </div>
      )}

      {/* ================= TRANSCRIPT ================= */}
      {(meeting.transcription || entries.length > 0) && (
        <div style={styles.section}>
          <div style={styles.head}>
            <span style={styles.title}>
              <Captions size={14} /> Transcript
              {entries.length > 0 && <span style={styles.count}>{entries.length} lines</span>}
            </span>
            {entries.length > 5 && (
              <span style={styles.search}>
                <Search size={11} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search transcript" style={styles.searchInput} />
              </span>
            )}
          </div>
          {transcript.source && <div style={styles.source}>{SOURCE_LABEL[transcript.source]}</div>}

          {canEdit && (
            <div style={styles.row}>
              {meeting.googleMeetLink && (
                <button type="button" style={styles.ghost} onClick={fetchFromGoogle} disabled={busy === "google"}>
                  {busy === "google" ? <Loader2 size={11} className="loading-spinner" /> : <RefreshCw size={11} />} Fetch from Google Meet
                </button>
              )}
              {meeting.recordingFile && (
                <button type="button" style={styles.ghost} onClick={transcribeNow} disabled={busy === "whisper" || transcribing}>
                  {busy === "whisper" || transcribing ? <Loader2 size={11} className="loading-spinner" /> : <Captions size={11} />} Transcribe recording
                </button>
              )}
              <button type="button" style={styles.ghost} onClick={() => fileRef.current?.click()} disabled={busy === "import"}>
                {busy === "import" ? <Loader2 size={11} className="loading-spinner" /> : <Upload size={11} />} Import transcript file
              </button>
              <input ref={fileRef} type="file" accept=".txt,.vtt,.sbv,.srt,text/plain,text/vtt" hidden onChange={importFile} />
              {entries.length > 0 && (
                <button type="button" style={{ ...styles.ghost, color: "#be123c" }} onClick={clearTranscript}>
                  <Trash2 size={11} /> Clear
                </button>
              )}
            </div>
          )}

          {transcribing && (
            <div style={styles.progressWrap}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Loader2 size={13} className="loading-spinner" />
                {jobStatus === "queued" ? "Waiting to transcribe the recording…" : "Transcribing the recording… (about ¼ of the meeting length)"}
              </span>
            </div>
          )}
          {jobStatus === "failed" && transcript.error && (
            <div style={styles.error}><AlertCircle size={13} /> <span>Transcription failed: {transcript.error}</span></div>
          )}

          <div style={styles.lines}>
            {visibleEntries.length === 0 && !interim && !transcribing && (
              <div style={styles.empty}>
                {entries.length
                  ? "No lines match your search."
                  : meeting.recordingFile
                  ? "No transcript yet. Click “Transcribe recording” to create it from the recording."
                  : "No transcript yet. Record the meeting — the transcript is created from the recording automatically — or import a transcript file."}
              </div>
            )}
            {visibleEntries.map((e, i) => (
              <div key={i} style={styles.line}>
                <span style={styles.time}>
                  {e.at
                    ? new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : e.offsetSec !== null && e.offsetSec !== undefined
                    ? formatDuration(e.offsetSec)
                    : ""}
                </span>
                <span>
                  <strong style={styles.speaker}>{e.speaker}:</strong> {e.text}
                </span>
              </div>
            ))}
            {interim && (
              <div style={{ ...styles.line, opacity: 0.6, fontStyle: "italic" }}>
                <span style={styles.time}>now</span>
                <span><strong style={styles.speaker}>{currentUserName || "Me"}:</strong> {interim}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {recError && (
        <div style={styles.error}>
          <AlertCircle size={13} /> <span style={{ flex: 1 }}>{recError}</span>
          <button type="button" style={styles.x} onClick={() => setRecError("")}>×</button>
        </div>
      )}
    </div>
  );
};

const styles = {
  wrap: { display: "flex", flexDirection: "column", gap: 12, marginTop: 12 },
  section: { border: "1px solid #dce8ee", borderRadius: 12, padding: 12, background: "#fbfdfe", display: "flex", flexDirection: "column", gap: 9 },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  title: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#20536c" },
  count: { marginLeft: 6, fontSize: 9, fontWeight: 700, color: "#0e7490", background: "#ecfeff", borderRadius: 999, padding: "2px 7px" },
  live: { display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 800, color: "#be123c" },
  liveDot: { width: 8, height: 8, borderRadius: "50%", background: "#e11d48", animation: "pulse 1s infinite" },
  row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  hint: { fontSize: 10, color: "#6b8796", lineHeight: 1.4, flex: 1, minWidth: 180 },
  primary: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 9, padding: "8px 12px", background: "linear-gradient(135deg,#e11d48,#be123c)", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" },
  danger: { display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", border: "none", borderRadius: 9, padding: "8px 12px", background: "#0f172a", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" },
  ghost: { display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid #d6e6ec", borderRadius: 8, padding: "6px 9px", background: "#fff", color: "#0e7490", fontSize: 10, fontWeight: 700, cursor: "pointer" },
  fileRow: { display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", fontSize: 10, color: "#4d6878", padding: "7px 9px", borderRadius: 9, background: "#eef8fb", border: "1px solid #cfe6f0" },
  link: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: "#1677a8", fontWeight: 700 },
  video: { width: "100%", maxHeight: 360, borderRadius: 10, background: "#000" },
  progressWrap: { display: "flex", flexDirection: "column", gap: 5, fontSize: 10, color: "#4d6878" },
  track: { height: 5, borderRadius: 99, background: "#e6f0f3", overflow: "hidden" },
  fill: { height: "100%", background: "linear-gradient(90deg,#06b6d4,#14b8a6)", transition: "width .2s" },
  source: { fontSize: 9, color: "#7b93a1", marginTop: -4 },
  lines: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto", paddingRight: 4 },
  line: { display: "flex", gap: 8, fontSize: 11, color: "#28485a", lineHeight: 1.45 },
  time: { flexShrink: 0, width: 44, fontSize: 9, color: "#93a8b4", paddingTop: 2 },
  speaker: { color: "#0e7490" },
  empty: { fontSize: 10, color: "#8ba0af", lineHeight: 1.5 },
  search: { display: "flex", alignItems: "center", gap: 4, border: "1px solid #dce8ee", borderRadius: 8, padding: "2px 7px", background: "#fff", color: "#8ba0af" },
  searchInput: { border: "none", outline: "none", fontSize: 10, width: 110, background: "transparent" },
  error: { display: "flex", alignItems: "flex-start", gap: 6, fontSize: 10, color: "#9f1239", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 9, padding: "7px 9px" },
  x: { border: "none", background: "transparent", color: "#9f1239", cursor: "pointer", fontSize: 14, lineHeight: 1 },
};

export default MeetingMediaPanel;

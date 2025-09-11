import React, { useEffect, useRef, useState } from "react";
import "./App.css";

const AVATAR_IMG = "/didinterviewer.png"; // lives in frontend/public/
const AVATAR_IDLE_LOOP = ""; 

const QUESTIONS = [
  "Tell me about yourself.",
  "What are your strengths and weaknesses?",
  "Describe a challenge you faced at work and how you handled it.",
  "Why do you want this role?",
  "Where do you see yourself in five years?"
];

const RECORD_SECONDS = 10; // test
const API_BASE = process.env.REACT_APP_API_URL?.replace(/\/$/, "") || ""; // with CRA proxy, "" hits localhost:3000 -> proxied to 5000

export default function App() {
  // --- candidate form state ---
  const [phase, setPhase] = useState("form"); // form | idle | running | done
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [jobRole, setJobRole] = useState("");

  // --- interview/recording state ---
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const countdownRef = useRef(null);
  const avatarWrapperRef = useRef(null);

  const [qIndex, setQIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RECORD_SECONDS);
  const [showNext, setShowNext] = useState(false);
  const [busy, setBusy] = useState(false);

  const [avatarVideoMode, setAvatarVideoMode] = useState(false);

  const [avatarVideoUrl, setAvatarVideoUrl] = useState(null);
  const avatarVideoRef = useRef(null);


  // prepare camera+mic
  const prepareStream = async () => {
    if (!streamRef.current) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    }
  };

  // D-ID request + play the returned video in avatar slot
  async function playAvatarFor(text) {
     const r = await fetch(`${API_BASE}/avatar/talk?text=${encodeURIComponent(text)}`);
       const data = await r.json();
       if (!data.ok || !data.url) throw new Error(data.error || "avatar failed");
       setAvatarVideoMode(true);
       setAvatarVideoUrl(data.url);
       return new Promise((resolve) => {
         const waitForVideo = () => {
           const v = avatarVideoRef.current;
           if (!v) return requestAnimationFrame(waitForVideo);
           v.onended = () => { setAvatarVideoUrl(null); setAvatarVideoMode(false); resolve(); };
           v.oncanplay = () => v.play().catch(() => {});
         };
         waitForVideo();
       });
     }

  const mmss = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
  };

  const uploadRecording = async (blob, filename) => {
    const form = new FormData();
    form.append("file", blob, filename);
    form.append("candidateName", candidateName.trim());
    form.append("candidateEmail", candidateEmail.trim());
    form.append("jobRole", jobRole.trim());
    const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) throw new Error(data?.error || `Upload failed`);
    console.log("Uploaded →", data.path || data.viewLink || data.downloadLink);
    return data;
  };

  const startRecorder = (currentIndex) =>
    new Promise((resolveStart) => {
      const chunks = [];
      if (!streamRef.current || !streamRef.current.getTracks().length) {
       throw new Error("No media stream available");
       }
       let options;
       try {
         if (window.MediaRecorder && MediaRecorder.isTypeSupported) {
           if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
             options = { mimeType: "video/webm;codecs=vp9" };
           } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
             options = { mimeType: "video/webm;codecs=vp8" };
           } else if (MediaRecorder.isTypeSupported("video/webm")) {
             options = { mimeType: "video/webm" };
           }
         }
       } catch {}
      const mr = options ? new MediaRecorder(streamRef.current, options) : new MediaRecorder(streamRef.current);

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
         try { mediaRecorderRef.current.stop(); } catch {}
       }
        

      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const fname = `answer_q${currentIndex + 1}.webm`;
        try {
          await uploadRecording(blob, fname);
        } catch (e) {
          console.error(e);
          alert("Upload failed. Check backend logs.");
        }
        setShowNext(true);
        resolveStart();
      };

      mr.start();
      setIsRecording(true);
      setIsPaused(false);
      setSecondsLeft(RECORD_SECONDS);
      setShowNext(false);

      clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            if (mr.state !== "inactive") mr.stop();
            setIsRecording(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

  const handlePauseResume = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    if (mr.state === "recording") {
      mr.pause(); setIsPaused(true); clearInterval(countdownRef.current);
    } else if (mr.state === "paused") {
      mr.resume(); setIsPaused(false);
      clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            if (mr.state !== "inactive") mr.stop();
            setIsRecording(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  // Ask current question via D-ID avatar video, then record
  const askCurrentQuestionThenRecord = async (idx) => {
    if (busy) return;
    setBusy(true);
    try {
      await prepareStream();
      window.speechSynthesis.cancel(); // ensure browser TTS queue is clear
      const text = QUESTIONS[idx ?? qIndex];

      await playAvatarFor(text);           // <-- speak via D-ID video
      await startRecorder(idx);            // <-- then capture the answer
    } finally {
      setBusy(false);
    }
  };

  const onNextQuestion = async () => {
    const next = qIndex + 1;
    if (next < QUESTIONS.length) {
      setQIndex(next);
      setShowNext(false);
      await askCurrentQuestionThenRecord(next);
    } else {
      window.speechSynthesis.cancel();
      setPhase("done");
    }
  };

  // --- Form submit -> move to idle (ready to start) ---
  const onSubmitForm = (e) => {
    e.preventDefault();
    if (!candidateName.trim() || !candidateEmail.trim() || !jobRole.trim()) {
      alert("Please fill Name, Email, and Job Role.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail.trim())) {
      alert("Enter a valid email.");
      return;
    }
    setPhase("idle");
  };

  // cleanup
  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis.cancel();
        const mr = mediaRecorderRef.current;
        const stream = streamRef.current;
        if (mr && mr.state !== "inactive") mr.stop();
        if (stream) stream.getTracks().forEach((t) => t.stop());
        clearInterval(countdownRef.current);
        setAvatarVideoMode(false);
        setAvatarVideoUrl(null);
      } catch {}
    };
  }, []);

  return (
    <div className="page">
      {/* LEFT: Avatar + controls or Form */}
      <div className="left">
        <div
          ref={avatarWrapperRef}
          className="avatar-wrapper"
        >
          {avatarVideoUrl ? (
            // During ASKING (D-ID video)
            <video
              ref={avatarVideoRef}
              src={avatarVideoUrl}
              autoPlay
              playsInline
              className="avatar portrait"
            />
          ) : isRecording ? (
            // During ANSWERING (neutral idle)
            AVATAR_IDLE_LOOP ? (
              <video
                src={AVATAR_IDLE_LOOP}
                autoPlay
                loop
                muted
                playsInline
                className="avatar portrait"
              />
            ) : (
              <img
                src={AVATAR_IMG}
                alt="HR Avatar"
                className="avatar portrait idle"
              />
            )
          ) : (
            // Idle (before start / between screens)
            <img
              src={AVATAR_IMG}
              alt="HR Avatar"
              className="avatar portrait"
            />
          )}
      </div>

        {phase === "form" && (
          <form className="card" onSubmit={onSubmitForm} style={{ minWidth: 320 }}>
            <h2 style={{ marginBottom: 12 }}>Candidate Details</h2>
            <input className="input" placeholder="Name" value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)} />
            <input className="input" placeholder="Email" type="email" value={candidateEmail}
              onChange={(e) => setCandidateEmail(e.target.value)} />
            <input className="input" placeholder="Job role" value={jobRole}
              onChange={(e) => setJobRole(e.target.value)} />
            <button className="primary" type="submit" style={{ marginTop: 10 }}>Continue</button>
          </form>
        )}

        {phase === "idle" && (
          <button className="primary" onClick={async () => {
            setPhase("running");
            setQIndex(0);
            setShowNext(false);
            await askCurrentQuestionThenRecord(0);  // auto-start Q1
          }}>
            Start Interview
          </button>
        )}

        {phase === "running" && (
          <>
            <div className="question-count">Question {qIndex + 1} / {QUESTIONS.length}</div>
            <div className="question-text">{QUESTIONS[qIndex]}</div>
            <div className="timer" data-live={isRecording && !isPaused}>⏳ {mmss(secondsLeft)}</div>

            {!showNext && (
              <div className="record-pill" data-on={isRecording}>
                {isRecording ? (isPaused ? "Resume" : "Recording...") : "Processing..."}
              </div>
            )}

            {isRecording && !showNext && (
              <div className="controls">
                <button className="secondary" onClick={handlePauseResume}>
                  {isPaused ? "Resume" : "Pause"}
                </button>
              </div>
            )}

            {showNext && (
              <button className="primary" style={{ marginTop: 12 }} onClick={onNextQuestion}>
                {qIndex < QUESTIONS.length - 1 ? "Next Question" : "Finish Interview"}
              </button>
            )}
          </>
        )}

        {phase === "done" && (
          <div className="done-box">✅ Interview complete. Responses uploaded.</div>
        )}
      </div>

      {/* RIGHT: Candidate camera preview */}
      <div className="right">
        <video ref={videoRef} autoPlay muted playsInline className="preview" />
        <div className="hint">Camera preview • Mic required • Uploads after each answer.</div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import "./App.css";

const QUESTIONS = [
  "Tell me about yourself.",
  "What are your strengths and weaknesses?",
  "Describe a challenge you faced at work and how you handled it.",
  "Why do you want this role?",
  "Where do you see yourself in five years?"
];

const RECORD_SECONDS = 10; // set to 10 for testing
const API_BASE = process.env.REACT_APP_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

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

  const [qIndex, setQIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RECORD_SECONDS);
  const [showNext, setShowNext] = useState(false); // ⬅ show “Next question” after upload
  const [busy, setBusy] = useState(false); // <-- prevents double-trigger
  const [mouthOpen, setMouthOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = (text) =>
    new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
  
      // start/stop indicators
      u.onstart = () => {
        setIsSpeaking(true);
        setMouthOpen(true);
      };
      u.onend = () => {
        setMouthOpen(false);
        setIsSpeaking(false);
        resolve();
      };
  
      // flap on boundaries (words/phonemes)
      u.onboundary = () => {
        setMouthOpen(true);
        // brief close after 120ms (simple flap)
        clearTimeout(speak._t);
        speak._t = setTimeout(() => setMouthOpen(false), 120);
      };
  
      // safety: cancel any queued speech first
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    });
  

  const mmss = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
  };

  const uploadRecording = async (blob, filename) => {
    const form = new FormData();
    form.append("file", blob, filename);
    // send candidate metadata so backend can route to subfolder
    form.append("candidateName", candidateName.trim());
    form.append("candidateEmail", candidateEmail.trim());
    form.append("jobRole", jobRole.trim());
    const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) throw new Error(data?.error || `Upload failed`);
    console.log("Uploaded →", data.viewLink || data.downloadLink || data.path);
    return data;
  };

  const startRecorder = (currentIndex) =>
    new Promise((resolveStart) => {
      const chunks = [];
      const mr = new MediaRecorder(streamRef.current, { mimeType: "video/webm" });
      mediaRecorderRef.current = mr;

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
        // when upload done, show “Next question” button
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

  // ADD: prepare the camera+mic stream once
  const prepareStream = async () => {
    if (!streamRef.current) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    }
  };


  // 🟡 Ask current question, then auto-record. After stop+upload, we DO NOT auto-advance.
  const askCurrentQuestionThenRecord = async (idx) => {
      if (busy) return;          // <-- guard: do nothing if already in-flight
      setBusy(true);
      try {
        await prepareStream();
        window.speechSynthesis.cancel(); // safety: clear any queued speech
        const text = QUESTIONS[idx ?? qIndex];
        await speak(text);
        await startRecorder(idx);
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
    // very light email check
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
  
        // cache refs at cleanup start
        const mr = mediaRecorderRef.current;
        const stream = streamRef.current;
  
        if (mr && mr.state !== "inactive") {
          mr.stop();
        }
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }
  
        clearInterval(countdownRef.current);
        setMouthOpen?.(false);
        setIsSpeaking?.(false);
      } catch {}
    };
  }, []); // keep dependency array empty for unmount cleanup
  

  return (
    <div className="page">
      {/* LEFT: Avatar + controls or Form */}
      <div className="left">
      <div className={`avatar-wrapper ${isSpeaking ? "speaking" : ""}`}
      /* tune these numbers to hit the exact spot */
         style={{
          "--mouth-x": "50%",   // center horizontally
          "--mouth-y": "39%",   // move up/down to the “arrowed” spot
          "--mouth-w": "50px",  // width
          "--mouth-h": "10px"   // closed height
     }}>
  <img src="/interviewer.png" alt="HR Avatar" className="avatar" />
  <div className={`mouth ${mouthOpen ? "open" : ""}`} />
</div>



        {/* === Candidate Form === */}
        {phase === "form" && (
          <form className="card" onSubmit={onSubmitForm} style={{minWidth: 320}}>
            <h2 style={{marginBottom: 12}}>Candidate Details</h2>
            <input
              className="input"
              placeholder="Name"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
            />
            <input
              className="input"
              placeholder="Email"
              value={candidateEmail}
              onChange={(e) => setCandidateEmail(e.target.value)}
              type="email"
            />
            <input
              className="input"
              placeholder="Job role"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
            />
            <button className="primary" type="submit" style={{marginTop: 10}}>
              Continue
            </button>
          </form>
        )}

        {/* === Start button after form === */}
        {phase === "idle" && (
          <button className="primary" onClick={async () => {
            setPhase("running");
            setQIndex(0);
            setShowNext(false); 
            await askCurrentQuestionThenRecord(0);
            // First question will only start when user clicks "Next Question"
          }}>
            Start Interview
          </button>
        )}

        {/* === During interview === */}
        {phase === "running" && (
          <>
            <div className="question-count">Question {qIndex + 1} / {QUESTIONS.length}</div>
            <div classname="question-text">{QUESTIONS[qIndex]}</div>
            <div className="timer" data-live={isRecording && !isPaused}>⏳ {mmss(secondsLeft)}</div>
            {!showNext && (
              <div className="record-pill" data-on={isRecording}>
                {isRecording ? (isPaused ? "Resume" : "Recording...") : "Processing..."}
              </div>)}
            {/* show controls ONLY while recording and BEFORE Next appears */}
            {isRecording && !showNext && (
            <div className="controls">
            <button className="secondary" onClick={handlePauseResume}>
              {isPaused ? "Resume" : "Pause"}
            </button>
            </div>
        )}

            {/* Show Next only AFTER upload completes */}
            {showNext && (
              <button className="primary" style={{marginTop: 12}} onClick={onNextQuestion}>
                {qIndex < QUESTIONS.length - 1 ? "Next Question" : "Finish Interview"}
              </button>
            )}
          </>
        )}

        {phase === "done" && (
          <div className="done-box">
            ✅ Interview complete. Responses uploaded.
          </div>
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

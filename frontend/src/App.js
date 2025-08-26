import React, { useEffect, useRef, useState } from "react";
import "./App.css";

const QUESTIONS = [
  "Tell me about yourself.",
  "What are your strengths and weaknesses?",
  "Describe a challenge you faced at work and how you handled it.",
  "Why do you want this role?",
  "Where do you see yourself in five years?"
];

// seconds per answer (change to 120 for 2 minutes)
const RECORD_SECONDS = 20
;

export default function App() {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const countdownRef = useRef(null);

  const [step, setStep] = useState("idle"); // idle | running | done
  const [qIndex, setQIndex] = useState(0);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RECORD_SECONDS);

  const speak = (text) =>
    new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.onend = resolve;
      u.rate = 1;   // tune if you like
      u.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    });

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

  const uploadBlob = async (blob, filename, questionNumber) => {
    try {
      const form = new FormData();
      form.append("file", blob, filename);
      form.append("questionNumber", String(questionNumber));

      const res = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: form
      });

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      return await res.json(); // { ok: true, url?: string }
    } catch (e) {
      console.error(e);
    }
  };

  const startRecorder = () =>
    new Promise((resolveStart) => {
      const chunks = [];
      const mr = new MediaRecorder(streamRef.current, { mimeType: "video/webm" });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mr.onstop = async () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const filename = `answer_q${qIndex + 1}.webm`;

        // ✅ upload to backend (which can also forward to Google Drive)
        await uploadBlob(blob, filename, qIndex + 1);

        resolveStart();
      };

      mr.start();                 // begin
      setIsRecording(true);
      setIsPaused(false);
      setSecondsLeft(RECORD_SECONDS);

      // countdown timer tick
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
      mr.pause();
      setIsPaused(true);
      clearInterval(countdownRef.current); // stop ticking while paused
    } else if (mr.state === "paused") {
      mr.resume();
      setIsPaused(false);
      // resume countdown
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

  const runInterview = async () => {
    setStep("running");
    await prepareStream();

    for (let i = 0; i < QUESTIONS.length; i++) {
      setQIndex(i);
      await speak(QUESTIONS[i]);
      await startRecorder(); // auto-stops via countdown + onstop uploads
    }

    window.speechSynthesis.cancel();
    setStep("done");
  };

  // cleanup
  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis.cancel();
        clearInterval(countdownRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
      } catch {}
    };
  }, []);

  const mmss = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
  };

  return (
    <div className="page">
      {/* LEFT: Avatar + controls */}
      <div className="left">
        <img src="/interviewer.png" alt="HR Avatar" className="avatar" />

        {step === "idle" && (
          <button className="primary" onClick={runInterview}>
            Start Interview
          </button>
        )}

        {step === "running" && (
          <>
            <div className="question-count">
              Question {qIndex + 1} / {QUESTIONS.length}
            </div>

            <div className="timer" data-live={isRecording && !isPaused}>
              ⏳ {mmss(secondsLeft)}
            </div>

            <div className="record-pill" data-on={isRecording}>
              {isRecording ? (isPaused ? "Paused" : "Recording…") : "Preparing…"}
            </div>

            <div className="controls">
              <button
                className="secondary"
                onClick={handlePauseResume}
                disabled={!isRecording}
              >
                {isPaused ? "Resume" : "Pause"}
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="done-box">
            ✅ Interview complete. Videos uploaded to backend.
          </div>
        )}
      </div>

      {/* RIGHT: Candidate camera preview */}
      <div className="right">
        <video ref={videoRef} autoPlay muted playsInline className="preview" />
        <div className="hint">
          Camera preview • Mic required • Uploads after each answer.
        </div>
      </div>
    </div>
  );
}

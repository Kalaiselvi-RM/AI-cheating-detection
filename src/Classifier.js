import React, { useCallback, useEffect, useRef, useState } from "react";
import * as tmImage from "@teachablemachine/image";
 
// 1. Paste the URL (or /public path) of YOUR Teachable Machine model here.
//    It must end with a slash, e.g. "https://teachablemachine.withgoogle.com/models/XXXX/"
const MODEL_URL = "/model/";
 
// 2. Tuning
const OK_LABEL = /straight/i; // any class matching this counts as "focused"
const MIN_CONFIDENCE = 0.8; // how sure the model must be before we trust it
const AWAY_SECONDS = 3; // looking away this long raises a warning
const MAX_WARNINGS = 3; // at this many warnings the session is flagged
const UI_INTERVAL_MS = 120; // how often the screen refreshes (the model runs faster)
 
const clock = (t) => new Date(t).toLocaleTimeString([], { hour12: false });
 
export default function Classifier() {
  const camBox = useRef(null);
  const model = useRef(null);
  const webcam = useRef(null);
  const raf = useRef(0);
  const running = useRef(false);
  const away = useRef({ since: null, flagged: false, eventId: null });
  const lastUi = useRef(0);
 
  const [phase, setPhase] = useState("idle"); // idle | loading | running | error
  const [error, setError] = useState("");
  const [preds, setPreds] = useState([]);
  const [awayFor, setAwayFor] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const [events, setEvents] = useState([]);
  const [totalAway, setTotalAway] = useState(0);
 
  const handle = useCallback((raw) => {
    const sorted = [...raw].sort((a, b) => b.probability - a.probability);
    const top = sorted[0];
    const now = Date.now();
    const a = away.current;
    const isAway = !OK_LABEL.test(top.className) && top.probability >= MIN_CONFIDENCE;
 
    if (isAway) {
      if (!a.since) a.since = now;
      const secs = (now - a.since) / 1000;
 
      if (secs >= AWAY_SECONDS && !a.flagged) {
        a.flagged = true;
        a.eventId = now;
        setWarnings((w) => w + 1);
        setEvents((prev) => [
          { id: now, time: now, label: top.className, seconds: secs, ongoing: true },
          ...prev,
        ]);
      }
      if (a.flagged && now - lastUi.current > UI_INTERVAL_MS) {
        const id = a.eventId;
        setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, seconds: secs } : e)));
      }
    } else if (a.since) {
      if (a.flagged) {
        const id = a.eventId;
        const secs = (now - a.since) / 1000;
        setTotalAway((t) => t + secs);
        setEvents((prev) =>
          prev.map((e) => (e.id === id ? { ...e, seconds: secs, ongoing: false } : e))
        );
      }
      away.current = { since: null, flagged: false, eventId: null };
    }
 
    if (now - lastUi.current > UI_INTERVAL_MS) {
      lastUi.current = now;
      setPreds(sorted);
      setAwayFor(away.current.since ? (now - away.current.since) / 1000 : 0);
    }
  }, []);
 
  const loop = useCallback(async () => {
    if (!running.current) return;
    webcam.current.update();
    const out = await model.current.predict(webcam.current.canvas);
    handle(out);
    raf.current = requestAnimationFrame(loop);
  }, [handle]);
 
  const stop = useCallback(() => {
    running.current = false;
    cancelAnimationFrame(raf.current);
    if (webcam.current) {
      webcam.current.stop();
      if (camBox.current && webcam.current.canvas?.parentNode === camBox.current) {
        camBox.current.removeChild(webcam.current.canvas);
      }
      webcam.current = null;
    }
    away.current = { since: null, flagged: false, eventId: null };
    setPhase("idle");
    setAwayFor(0);
  }, []);
 
  const start = async () => {
    setError("");
    setPhase("loading");
    try {
      if (!model.current) {
        model.current = await tmImage.load(MODEL_URL + "model.json", MODEL_URL + "metadata.json");
      }
      const cam = new tmImage.Webcam(480, 360, true); // flipped like a mirror
      await cam.setup();
      await cam.play();
      webcam.current = cam;
      camBox.current.appendChild(cam.canvas);
 
      setWarnings(0);
      setEvents([]);
      setTotalAway(0);
      running.current = true;
      setPhase("running");
      raf.current = requestAnimationFrame(loop);
    } catch (e) {
      const denied = e && (e.name === "NotAllowedError" || e.name === "PermissionDeniedError");
      setError(
        denied
          ? "Camera access was blocked. Allow the camera in your browser's address bar, then try again."
          : "Could not start. Check that MODEL_URL points to a valid Teachable Machine model and that a camera is connected."
      );
      setPhase("error");
    }
  };
 
  useEffect(() => () => stop(), [stop]);
 
  const exportLog = () => {
    const rows = ["time,direction,seconds"].concat(
      events.map((e) => `${clock(e.time)},${e.label},${e.seconds.toFixed(1)}`)
    );
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "session-log.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
 
  const flagged = warnings >= MAX_WARNINGS;
  const state =
    phase !== "running" ? "idle" : flagged ? "flagged" : away.current.flagged ? "warning" : awayFor > 0 ? "watch" : "ok";
 
  const message = {
    idle: "Camera is off",
    ok: "Looking at the screen",
    watch: `Looking away, ${Math.max(0, AWAY_SECONDS - awayFor).toFixed(1)}s until warning`,
    warning: "Warning recorded: looking away",
    flagged: `Session flagged: ${warnings} warnings`,
  }[state];
 
  return (
    <div className="monitor">
      <section className="stage">
        <div className={`status status-${state}`} role="status" aria-live="polite">
          {message}
        </div>
 
        <div className="camera">
          <div ref={camBox} className="camera-feed" />
          {phase !== "running" && (
            <div className="camera-empty">
              {phase === "loading" && <p>Loading model and camera…</p>}
              {phase === "error" && <p className="error-text">{error}</p>}
              {phase === "idle" && <p>Start the camera to begin monitoring.</p>}
            </div>
          )}
        </div>
 
        <div className="controls">
          {phase === "running" ? (
            <button className="btn btn-stop" onClick={stop}>
              Stop session
            </button>
          ) : (
            <button className="btn btn-start" onClick={start} disabled={phase === "loading"}>
              {phase === "loading" ? "Starting…" : phase === "error" ? "Try again" : "Start camera"}
            </button>
          )}
          <button className="btn btn-quiet" onClick={exportLog} disabled={events.length === 0}>
            Download log (CSV)
          </button>
        </div>
      </section>
 
      <aside className="side">
        <div className="counts">
          <div>
            <span className="count-num">{warnings}</span>
            <span className="count-label">of {MAX_WARNINGS} warnings</span>
          </div>
          <div>
            <span className="count-num">{totalAway.toFixed(0)}s</span>
            <span className="count-label">time looking away</span>
          </div>
        </div>
 
        <h2 className="side-title">Head direction</h2>
        {preds.length === 0 ? (
          <p className="muted">Results appear once the camera is running.</p>
        ) : (
          <ul className="bars">
            {preds.map((p, i) => (
              <li key={p.className}>
                <div className="bar-head">
                  <span className={i === 0 ? "bar-name bar-top" : "bar-name"}>{p.className}</span>
                  <span>{(p.probability * 100).toFixed(0)}%</span>
                </div>
                <div className="bar-track">
                  <div
                    className={`bar-fill ${OK_LABEL.test(p.className) ? "fill-ok" : "fill-away"}`}
                    style={{ width: `${p.probability * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
 
        <h2 className="side-title">Event log</h2>
        {events.length === 0 ? (
          <p className="muted">No warnings yet. A warning is logged after {AWAY_SECONDS} seconds of looking away.</p>
        ) : (
          <ul className="log">
            {events.map((e) => (
              <li key={e.id}>
                <span className="log-time">{clock(e.time)}</span>
                <span>
                  Looking {e.label.toLowerCase()} for {e.seconds.toFixed(1)}s{e.ongoing ? " (ongoing)" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
 












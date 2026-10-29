import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  PlayCircle, CheckCircle2, Lock, Award, Users, Trash2, Loader2, ChevronLeft, Clock, Mail, Download, Settings, GripVertical, BookOpen, Maximize2, BarChart3, XCircle,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { supabase } from "../lib/supabaseClient.js";
import { navy, gold, grey, Badge, WORDMARK_SRC } from "../lib/ui.jsx";

// NBD-brand accent colours cycled per connection line, so each matched pair
// gets its own recognisable colour across both columns and the line itself.
const LINE_COLORS = ["#5e8f1e", "#8a6d1f", "#2b6f6f", navy[900], "#9b5de5", "#c1440e"];
const RIGHT_COLOR = "#4a6b3d";
const WRONG_COLOR = "#a3372f";

function formatDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return `${d.toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })}, ${d.toLocaleTimeString("en-IE", { hour: "numeric", minute: "2-digit" })}`;
}

function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// Loads YouTube's official Player API once and reuses it — this is what
// lets us genuinely detect "the video ended," unlike a plain iframe embed
// (e.g. Google Drive's), which tells the parent page nothing.
let youtubeApiPromise = null;
function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previous) previous();
      resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return youtubeApiPromise;
}

// Prevents dragging the YouTube progress bar forward past what's actually
// been watched. YouTube's IFrame API has no "disable seeking" flag, so this
// polls currentTime and snaps back to the furthest point genuinely reached
// whenever it jumps ahead — rewinding to rewatch is still fine.
function YouTubePlayer({ videoId, onEnded, onDuration }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const maxWatchedRef = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let pollId = null;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !containerRef.current) return;
      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, cc_load_policy: 0 },
        events: {
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) onEnded();
          },
          onReady: () => {
            setReady(true);
            if (onDuration) {
              const d = playerRef.current?.getDuration?.();
              if (d) onDuration(d);
            }
            pollId = window.setInterval(() => {
              const player = playerRef.current;
              if (!player || !player.getCurrentTime) return;
              const t = player.getCurrentTime();
              if (t > maxWatchedRef.current + 1.5) {
                player.seekTo(maxWatchedRef.current, true);
              } else if (t > maxWatchedRef.current) {
                maxWatchedRef.current = t;
              }
            }, 500);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      if (pollId) window.clearInterval(pollId);
      if (playerRef.current?.destroy) playerRef.current.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: 10, overflow: "hidden", marginBottom: 16, background: "#000" }}>
      {!ready && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "#a39a8d", zIndex: 1 }}>
          <Loader2 size={22} className="spin" />
          <span style={{ fontSize: 14 }}>Loading video…</span>
        </div>
      )}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

// ================= QUIZ STEP =================
// Questions are fetched without their correct answers, and grading happens
// server-side via the submit_quiz_answers RPC — the client never sees
// correct_index, so the answer key can't be read out of the network tab.

// ================= QUIZ QUESTION TYPES =================

function isAnswered(q, value) {
  if (value === undefined) return false;
  if (q.type === "match_pairs") return Object.keys(value).length === q.left.length;
  if (q.type === "categorize") return Object.keys(value).length === q.items.length;
  if (q.type === "numeric") return value !== "";
  return true;
}

function MultipleChoiceQuestion({ q, value, onChange }) {
  return (
    <>
      {q.options.map((opt, oi) => (
        <label key={oi} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", fontSize: 16, color: "#3d3830", cursor: "pointer" }}>
          <input type="radio" name={q.id} checked={value === oi} onChange={() => onChange(oi)} />
          {opt}
        </label>
      ))}
    </>
  );
}

function NumericQuestion({ q, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: "9px 12px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 16, width: 140 }}
      />
      {q.unit && <span style={{ color: "#8a8074", fontSize: 15 }}>{q.unit}</span>}
    </div>
  );
}

function SequenceQuestion({ q, value, onChange }) {
  const lookup = Object.fromEntries(q.items.map((it) => [it.id, it.text]));
  const order = value || q.items.map((it) => it.id);
  const dragIndex = useRef(null);
  const [overIndex, setOverIndex] = useState(null);

  function handleDrop(dropIndex) {
    const from = dragIndex.current;
    setOverIndex(null);
    if (from === null || from === dropIndex) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved);
    onChange(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontSize: 13, color: "#a39a8d", margin: 0 }}>Drag into the correct order.</p>
      {order.map((id, i) => (
        <div
          key={id}
          draggable
          onDragStart={() => { dragIndex.current = i; }}
          onDragOver={(e) => { e.preventDefault(); setOverIndex(i); }}
          onDragLeave={() => setOverIndex((cur) => (cur === i ? null : cur))}
          onDrop={() => handleDrop(i)}
          style={{
            display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 8, padding: "11px 14px", cursor: "grab",
            border: overIndex === i ? `2px dashed ${navy[500]}` : "1px solid #e4dfd6",
          }}
        >
          <GripVertical size={16} color="#a39a8d" />
          <span style={{ fontSize: 13, color: "#a39a8d", fontWeight: 700, width: 14 }}>{i + 1}</span>
          <span style={{ fontSize: 16, color: navy[900] }}>{lookup[id]}</span>
        </div>
      ))}
    </div>
  );
}

function dotCenter(el, containerEl) {
  const r = el.getBoundingClientRect();
  const c = containerEl.getBoundingClientRect();
  return { x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top };
}

function MatchPairsQuestion({ q, value, onChange, feedback }) {
  const mapping = value || {};
  const containerRef = useRef(null);
  const leftDots = useRef(new Map());
  const rightDots = useRef(new Map());
  const [positions, setPositions] = useState({});
  const [drag, setDrag] = useState(null); // { leftId, x, y } — container-relative

  const recomputePositions = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const next = {};
    leftDots.current.forEach((el, id) => { next["L:" + id] = dotCenter(el, c); });
    rightDots.current.forEach((el, id) => { next["R:" + id] = dotCenter(el, c); });
    setPositions(next);
  }, []);

  useLayoutEffect(() => { recomputePositions(); }, [q, mapping, recomputePositions]);
  useEffect(() => {
    window.addEventListener("resize", recomputePositions);
    return () => window.removeEventListener("resize", recomputePositions);
  }, [recomputePositions]);

  useEffect(() => {
    if (!drag) return;
    function move(e) {
      const c = containerRef.current.getBoundingClientRect();
      setDrag((d) => d && { ...d, x: e.clientX - c.left, y: e.clientY - c.top });
    }
    function up(e) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const rightEl = el && el.closest("[data-right-id]");
      setDrag((d) => {
        if (rightEl && d) {
          const rightId = rightEl.getAttribute("data-right-id");
          const next = { ...mapping, [d.leftId]: rightId };
          for (const k of Object.keys(next)) {
            if (k !== d.leftId && next[k] === rightId) delete next[k];
          }
          onChange(next);
        }
        return null;
      });
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, mapping, onChange]);

  function startDrag(leftId, e) {
    if (feedback) return;
    e.preventDefault();
    const c = containerRef.current.getBoundingClientRect();
    setDrag({ leftId, x: e.clientX - c.left, y: e.clientY - c.top });
  }
  function lineColor(leftId, cycleIndex) {
    if (feedback) return feedback[leftId] ? RIGHT_COLOR : WRONG_COLOR;
    return LINE_COLORS[cycleIndex % LINE_COLORS.length];
  }
  function clearPair(leftId) {
    const next = { ...mapping };
    delete next[leftId];
    onChange(next);
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: grey, marginBottom: 10 }}>Drag the dot from each item on the left to its match on the right.</div>
      <div ref={containerRef} style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 680 }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
          {q.left.map((item, i) => {
            const rightId = mapping[item.id];
            if (!rightId) return null;
            const p1 = positions["L:" + item.id];
            const p2 = positions["R:" + rightId];
            if (!p1 || !p2) return null;
            const color = lineColor(item.id, i);
            return (
              <g key={item.id}>
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={3} strokeLinecap="round" />
                <circle cx={p1.x} cy={p1.y} r={6} fill={color} />
                <circle cx={p2.x} cy={p2.y} r={6} fill={color} />
              </g>
            );
          })}
          {drag && positions["L:" + drag.leftId] && (
            <line
              x1={positions["L:" + drag.leftId].x} y1={positions["L:" + drag.leftId].y}
              x2={drag.x} y2={drag.y}
              stroke={navy[900]} strokeWidth={3} strokeDasharray="6 5" strokeLinecap="round"
            />
          )}
        </svg>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 1 }}>
          {q.left.map((item, i) => {
            const matched = !!mapping[item.id];
            const color = matched ? lineColor(item.id, i) : LINE_COLORS[i % LINE_COLORS.length];
            return (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 15, fontWeight: 600, color: navy[900],
                    border: matched ? `2px solid ${color}` : "1px solid #e4dfd6",
                    background: matched ? `${color}14` : "#fff",
                  }}
                >
                  {item.text}
                  {matched && !feedback && (
                    <button
                      onClick={() => clearPair(item.id)}
                      style={{ marginLeft: 8, fontSize: 12, color: grey, background: "none", border: "none", textDecoration: "underline", cursor: "pointer" }}
                    >
                      clear
                    </button>
                  )}
                </div>
                <div
                  ref={(el) => { if (el) leftDots.current.set(item.id, el); else leftDots.current.delete(item.id); }}
                  onPointerDown={(e) => startDrag(item.id, e)}
                  style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0, touchAction: "none",
                    cursor: feedback ? "default" : "grab",
                    border: `3px solid ${matched ? color : navy[700]}`,
                    background: matched ? color : "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  }}
                />
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 1 }}>
          {q.right.map((item) => {
            const pairedLeftId = q.left.find((l) => mapping[l.id] === item.id)?.id;
            const pairedLeftIndex = q.left.findIndex((l) => mapping[l.id] === item.id);
            const isPaired = pairedLeftIndex !== -1;
            const color = isPaired ? lineColor(pairedLeftId, pairedLeftIndex) : navy[700];
            return (
              <div key={item.id} data-right-id={item.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  ref={(el) => { if (el) rightDots.current.set(item.id, el); else rightDots.current.delete(item.id); }}
                  style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    border: `3px solid ${color}`, background: isPaired ? color : "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  }}
                />
                <div
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 15,
                    border: isPaired ? `2px solid ${color}` : "1px solid #e4dfd6",
                    background: isPaired ? `${color}14` : "#fff",
                  }}
                >
                  {item.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CategorizeQuestion({ q, value, onChange }) {
  const mapping = value || {};
  const dragItem = useRef(null);
  const unplaced = q.items.filter((it) => mapping[it.id] === undefined);

  function dropOn(bucketIndex) {
    if (dragItem.current == null) return;
    onChange({ ...mapping, [dragItem.current]: bucketIndex });
    dragItem.current = null;
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: "#a39a8d", margin: "0 0 10px" }}>Drag each item into the category it belongs in.</p>
      {unplaced.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {unplaced.map((it) => (
            <div
              key={it.id}
              draggable
              onDragStart={() => { dragItem.current = it.id; }}
              style={{ padding: "8px 14px", background: "#fff", border: "1px solid #e4dfd6", borderRadius: 999, fontSize: 14, cursor: "grab" }}
            >
              {it.text}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(q.buckets.length, 4)}, 1fr)`, gap: 10 }}>
        {q.buckets.map((bucket, bi) => (
          <div
            key={bi}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dropOn(bi)}
            style={{ minHeight: 100, border: "2px dashed #ddd5cb", borderRadius: 8, padding: 10, background: "#fafaf7" }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#8a8074", marginBottom: 8 }}>{bucket}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {q.items.filter((it) => mapping[it.id] === bi).map((it) => (
                <div
                  key={it.id}
                  draggable
                  onDragStart={() => { dragItem.current = it.id; }}
                  style={{ padding: "6px 12px", background: navy[100], borderRadius: 999, fontSize: 13, cursor: "grab" }}
                >
                  {it.text}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DragChoiceQuestion({ q, value, onChange, feedback }) {
  const containerRef = useRef(null);
  const bubbleDot = useRef(null);
  const optionDots = useRef(new Map());
  const [positions, setPositions] = useState({});
  const [drag, setDrag] = useState(null); // { x, y } — container-relative

  const color = feedback == null ? navy[700] : feedback ? RIGHT_COLOR : WRONG_COLOR;

  const recomputePositions = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const next = {};
    if (bubbleDot.current) next.bubble = dotCenter(bubbleDot.current, c);
    optionDots.current.forEach((el, oi) => { next["O:" + oi] = dotCenter(el, c); });
    setPositions(next);
  }, []);

  useLayoutEffect(() => { recomputePositions(); }, [q, value, recomputePositions]);
  useEffect(() => {
    window.addEventListener("resize", recomputePositions);
    return () => window.removeEventListener("resize", recomputePositions);
  }, [recomputePositions]);

  useEffect(() => {
    if (!drag) return;
    function move(e) {
      const c = containerRef.current.getBoundingClientRect();
      setDrag((d) => d && { x: e.clientX - c.left, y: e.clientY - c.top });
    }
    function up(e) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const optionEl = el && el.closest("[data-option-index]");
      if (optionEl) onChange(Number(optionEl.getAttribute("data-option-index")));
      setDrag(null);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, onChange]);

  function startDrag(e) {
    if (feedback != null) return;
    e.preventDefault();
    const c = containerRef.current.getBoundingClientRect();
    setDrag({ x: e.clientX - c.left, y: e.clientY - c.top });
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: grey, marginBottom: 10 }}>Drag the dot from the question to the correct answer.</div>
      <div ref={containerRef} style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "center", maxWidth: 680 }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
          {value != null && positions.bubble && positions["O:" + value] && (
            <g>
              <line x1={positions.bubble.x} y1={positions.bubble.y} x2={positions["O:" + value].x} y2={positions["O:" + value].y} stroke={color} strokeWidth={3} strokeLinecap="round" />
              <circle cx={positions.bubble.x} cy={positions.bubble.y} r={6} fill={color} />
              <circle cx={positions["O:" + value].x} cy={positions["O:" + value].y} r={6} fill={color} />
            </g>
          )}
          {drag && positions.bubble && (
            <line x1={positions.bubble.x} y1={positions.bubble.y} x2={drag.x} y2={drag.y} stroke={navy[900]} strokeWidth={3} strokeDasharray="6 5" strokeLinecap="round" />
          )}
        </svg>

        <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative", zIndex: 1 }}>
          <div
            style={{
              position: "relative", background: "#fff", border: `2px solid ${color}`, borderRadius: 16,
              padding: "12px 14px", fontSize: 15, fontWeight: 600, color: navy[900], flex: 1, minWidth: 0,
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            }}
          >
            {q.text}
          </div>
          <div
            ref={bubbleDot}
            onPointerDown={startDrag}
            style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0, touchAction: "none",
              cursor: feedback != null ? "default" : "grab",
              border: `3px solid ${color}`, background: value != null ? color : "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 1 }}>
          {q.options.map((opt, oi) => {
            const isChosen = value === oi;
            const optColor = isChosen ? color : navy[700];
            return (
              <div key={oi} data-option-index={oi} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  ref={(el) => { if (el) optionDots.current.set(oi, el); else optionDots.current.delete(oi); }}
                  style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    border: `3px solid ${optColor}`, background: isChosen ? optColor : "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  }}
                />
                <div
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 15,
                    border: isChosen ? `2px solid ${optColor}` : "1px solid #e4dfd6",
                    background: isChosen ? `${optColor}14` : "#fff",
                  }}
                >
                  {opt}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FillBlankQuestion({ q, value, onChange, feedback }) {
  const match = q.text.match(/_{2,}/);
  const before = match ? q.text.slice(0, match.index) : q.text;
  const after = match ? q.text.slice(match.index + match[0].length) : "";

  const containerRef = useRef(null);
  const blankRef = useRef(null);
  const [drag, setDrag] = useState(null); // { optionIndex, x, y } — container-relative
  const [overBlank, setOverBlank] = useState(false);

  const color = feedback == null ? navy[700] : feedback ? RIGHT_COLOR : WRONG_COLOR;

  function startDrag(oi, e) {
    if (feedback != null) return;
    e.preventDefault();
    const c = containerRef.current.getBoundingClientRect();
    setDrag({ optionIndex: oi, x: e.clientX - c.left, y: e.clientY - c.top });
  }

  useEffect(() => {
    if (!drag) return;
    function insideBlank(e) {
      const b = blankRef.current.getBoundingClientRect();
      return e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;
    }
    function move(e) {
      const c = containerRef.current.getBoundingClientRect();
      setOverBlank(insideBlank(e));
      setDrag((d) => d && { ...d, x: e.clientX - c.left, y: e.clientY - c.top });
    }
    function up(e) {
      const landed = insideBlank(e);
      setDrag((d) => {
        if (landed && d) onChange(d.optionIndex);
        return null;
      });
      setOverBlank(false);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, onChange]);

  return (
    <div>
      <div style={{ fontSize: 13, color: grey, marginBottom: 10 }}>Drag the correct word into the blank.</div>
      <div ref={containerRef} style={{ position: "relative" }}>
        <div style={{ fontSize: 17, color: navy[900], lineHeight: 2.4, marginBottom: 20 }}>
          {before}
          <span
            ref={blankRef}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              minWidth: 90, minHeight: 34, margin: "0 6px", borderRadius: 8, padding: "4px 12px",
              border: `2px dashed ${value != null ? color : overBlank ? navy[700] : "#c7bfae"}`,
              background: value != null ? `${color}14` : overBlank ? "#eef5e2" : "#faf8f3",
              fontWeight: 700, color: navy[900], verticalAlign: "middle",
            }}
          >
            {value != null && (
              <>
                {q.options[value]}
                {feedback == null && (
                  <button
                    onClick={() => onChange(undefined)}
                    style={{ marginLeft: 8, background: "none", border: "none", color: grey, cursor: "pointer", fontSize: 13 }}
                    title="Clear"
                  >
                    ×
                  </button>
                )}
              </>
            )}
          </span>
          {after}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {q.options.map((opt, oi) => {
            const placed = value === oi;
            return (
              <div
                key={oi}
                onPointerDown={(e) => !placed && startDrag(oi, e)}
                style={{
                  padding: "9px 16px", borderRadius: 999, fontSize: 15, fontWeight: 600, touchAction: "none",
                  border: `2px solid ${navy[700]}`, color: navy[700], background: "#fff",
                  cursor: feedback != null || placed ? "default" : "grab",
                  opacity: placed ? 0.35 : 1,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                {opt}
              </div>
            );
          })}
        </div>

        {drag && (
          <div
            style={{
              position: "absolute", left: drag.x, top: drag.y, transform: "translate(-50%, -50%)",
              padding: "9px 16px", borderRadius: 999, fontSize: 15, fontWeight: 600, pointerEvents: "none",
              border: `2px solid ${navy[700]}`, color: navy[700], background: "#fff", boxShadow: "0 3px 10px rgba(0,0,0,0.18)",
            }}
          >
            {q.options[drag.optionIndex]}
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionBody({ q, value, onChange, feedback }) {
  if (q.type === "numeric") return <NumericQuestion q={q} value={value} onChange={onChange} />;
  if (q.type === "sequence") return <SequenceQuestion q={q} value={value} onChange={onChange} />;
  if (q.type === "match_pairs") return <MatchPairsQuestion q={q} value={value} onChange={onChange} feedback={feedback} />;
  if (q.type === "categorize") return <CategorizeQuestion q={q} value={value} onChange={onChange} />;
  if (q.type === "drag_choice") return <DragChoiceQuestion q={q} value={value} onChange={onChange} feedback={feedback} />;
  if (q.type === "fill_blank") return <FillBlankQuestion q={q} value={value} onChange={onChange} feedback={feedback} />;
  return <MultipleChoiceQuestion q={q} value={value} onChange={onChange} />;
}

function QuizResultModal({ passed, onPrimary, primaryLabel, onDismiss }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(32,27,21,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: "36px 32px", maxWidth: 360, width: "100%", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
        {passed ? (
          <CheckCircle2 size={48} color="#4a6b3d" style={{ marginBottom: 14 }} />
        ) : (
          <XCircle size={48} color="#a3372f" style={{ marginBottom: 14 }} />
        )}
        <h3 style={{ fontSize: 22, fontWeight: 700, color: navy[900], margin: "0 0 8px" }}>
          {passed ? "Congratulations!" : "Incorrect"}
        </h3>
        <p style={{ color: "#8a8074", fontSize: 16, margin: "0 0 22px", lineHeight: 1.5 }}>
          {passed ? "You passed the quiz." : "A couple of answers weren't quite right."}
        </p>
        <button
          onClick={onPrimary}
          style={{
            background: passed ? "#4a6b3d" : navy[700], color: "#fff", border: "none", borderRadius: 999,
            padding: "11px 28px", fontSize: 16, fontWeight: 600, cursor: "pointer", width: "100%", marginBottom: passed ? 0 : 10,
          }}
        >
          {passed ? primaryLabel : "Retry"}
        </button>
        {!passed && (
          <button onClick={onDismiss} style={{ background: "none", border: "none", color: navy[700], fontSize: 14, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
            Review my answers first
          </button>
        )}
      </div>
    </div>
  );
}

function QuizStep({ step, onComplete, onBack, nextStep, onGoToNext }) {
  const [questions, setQuestions] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [perQuestion, setPerQuestion] = useState(null);
  const [pairResults, setPairResults] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc("get_quiz_questions", { p_step_id: step.id }).then(({ data, error: rpcError }) => {
      if (cancelled) return;
      if (rpcError) { setLoadError(rpcError.message); return; }
      const list = data || [];
      setQuestions(list);
      const seeded = {};
      for (const q of list) {
        if (q.type === "sequence") seeded[q.id] = q.items.map((it) => it.id);
        else if (q.type === "match_pairs" || q.type === "categorize") seeded[q.id] = {};
      }
      setAnswers(seeded);
    });
    return () => { cancelled = true; };
  }, [step.id]);

  async function submit() {
    const unanswered = questions.some((q) => !isAnswered(q, answers[q.id]));
    if (unanswered) { setError("Answer every question before submitting"); return; }
    setSubmitting(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("submit_quiz_answers", {
      p_step_id: step.id,
      p_answers: answers,
    });
    setSubmitting(false);
    if (rpcError) { setError(rpcError.message); return; }
    setResult(data.passed ? "pass" : "fail");
    setPerQuestion(data.results || null);
    setPairResults(data.pair_results || null);
    setShowModal(true);
    if (data.passed) onComplete();
  }

  function tryAgain() {
    setResult(null);
    setPerQuestion(null);
    setPairResults(null);
    setShowModal(false);
    setError("");
  }

  if (loadError) return <div style={{ color: "#a3372f", fontSize: 16 }}>{loadError}</div>;
  if (!questions) {
    return <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a8074", fontSize: 16 }}><Loader2 size={16} className="spin" /> Loading quiz…</div>;
  }

  const nextLabel = !nextStep ? "Back to sequence" : nextStep.type === "video" ? "Continue to next video" : nextStep.type === "quiz" ? "Continue to next quiz" : "Continue to the next step";

  return (
    <div>
      {showModal && result && (
        <QuizResultModal
          passed={result === "pass"}
          primaryLabel={nextLabel}
          onPrimary={() => { setShowModal(false); if (onGoToNext) onGoToNext(); else onBack(); }}
          onDismiss={() => setShowModal(false)}
        />
      )}
      <button
        onClick={onBack}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 600,
          color: navy[700], marginBottom: 14, background: "#fff", border: "1px solid #e4dfd6",
          borderRadius: 999, padding: "8px 16px", cursor: "pointer",
        }}
      >
        <ChevronLeft size={15} /> Back
      </button>
      <h3 style={{ fontSize: 19, fontWeight: 600, color: navy[900], margin: "0 0 14px" }}>Quick check: {step.title}</h3>
      {result === "fail" && (
        <div style={{ background: "#fdf6e3", border: "1px solid #eddfad", color: "#8a6d1f", fontSize: 15, padding: "12px 14px", borderRadius: 8, marginBottom: 14 }}>
          Almost there! A couple of answers weren't quite right — have another look below and give it another go.
        </div>
      )}
      {questions.map((q, qi) => {
        const wasWrong = perQuestion && perQuestion[q.id] === false;
        const wasRight = perQuestion && perQuestion[q.id] === true;
        return (
          <div
            key={q.id}
            style={{
              marginBottom: 16,
              padding: perQuestion ? "12px 14px" : 0,
              borderRadius: 8,
              background: wasWrong ? "#fdecea" : wasRight ? "#f2f7e9" : "transparent",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 500, color: navy[900], marginBottom: 8 }}>
              {qi + 1}. {q.text}
              {wasRight && <CheckCircle2 size={16} color="#4a6b3d" />}
              {wasWrong && <span style={{ color: "#a3372f", fontSize: 13, fontWeight: 700 }}>Not quite</span>}
            </div>
            <QuestionBody
              q={q}
              value={answers[q.id]}
              onChange={(v) => setAnswers({ ...answers, [q.id]: v })}
              feedback={
                q.type === "match_pairs" ? (pairResults ? pairResults[q.id] : null)
                : q.type === "drag_choice" || q.type === "fill_blank" ? (perQuestion ? perQuestion[q.id] : null)
                : null
              }
            />
          </div>
        );
      })}
      {error && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 10 }}>{error}</div>}
      {result === "fail" ? (
        <button onClick={tryAgain} style={{ background: navy[700], color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 16, fontWeight: 500 }}>
          Try again
        </button>
      ) : (
        <button onClick={submit} disabled={submitting} style={{ background: navy[700], color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 16, fontWeight: 500, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? "Checking…" : "Submit answers"}
        </button>
      )}
    </div>
  );
}

// ================= VIDEO STEP =================

function VideoStep({ step, onComplete, onBack }) {
  const [error, setError] = useState("");
  const [playbackUrl, setPlaybackUrl] = useState(step.video_storage_path ? null : step.video_url);
  const [resolving, setResolving] = useState(!!step.video_storage_path);
  const [videoReady, setVideoReady] = useState(false);
  const maxWatchedRef = useRef(0);

  useEffect(() => {
    if (!step.video_storage_path) { setPlaybackUrl(step.video_url); setResolving(false); return; }
    let cancelled = false;
    setResolving(true);
    supabase.storage.from("training-videos").createSignedUrl(step.video_storage_path, 3600).then(({ data, error: urlError }) => {
      if (cancelled) return;
      setResolving(false);
      if (urlError) { setError(urlError.message); return; }
      setPlaybackUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [step.id, step.video_storage_path, step.video_url]);

  // Opportunistically records the video's real length the first time
  // anyone plays it, for honest weekly-activity-hours reporting instead of
  // relying only on the free-text duration typed in admin.
  function recordDuration(seconds) {
    if (!seconds || !isFinite(seconds)) return;
    supabase.rpc("record_video_duration", { p_step_id: step.id, p_seconds: Math.round(seconds) });
  }

  async function markWatched() {
    setError("");
    const { error: rpcError } = await supabase.rpc("complete_video_step", { p_step_id: step.id });
    if (rpcError) { setError(rpcError.message); return; }
    onComplete();
  }

  const hasSource = !!(step.video_storage_path || step.video_url);
  const youtubeId = !step.video_storage_path ? extractYouTubeId(step.video_url) : null;

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 600,
          color: navy[700], marginBottom: 14, background: "#fff", border: "1px solid #e4dfd6",
          borderRadius: 999, padding: "8px 16px", cursor: "pointer",
        }}
      >
        <ChevronLeft size={15} /> Back
      </button>
      <h3 style={{ fontSize: 19, fontWeight: 600, color: navy[900], margin: "0 0 14px" }}>{step.title}</h3>
      {youtubeId && <YouTubePlayer videoId={youtubeId} onEnded={markWatched} onDuration={recordDuration} />}
      {!youtubeId && resolving && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a8074", fontSize: 16, marginBottom: 16 }}><Loader2 size={16} className="spin" /> Loading video…</div>
      )}
      {!youtubeId && !resolving && playbackUrl && (
        <div style={{ position: "relative", marginBottom: 16 }}>
          {!videoReady && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "#a39a8d", background: "#000", borderRadius: 10, zIndex: 1 }}>
              <Loader2 size={22} className="spin" />
              <span style={{ fontSize: 14 }}>Loading video…</span>
            </div>
          )}
          <video
            key={playbackUrl}
            src={playbackUrl}
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            onCanPlay={() => setVideoReady(true)}
            onLoadedMetadata={(e) => recordDuration(e.currentTarget.duration)}
            onTimeUpdate={(e) => {
              if (e.currentTarget.currentTime > maxWatchedRef.current) maxWatchedRef.current = e.currentTarget.currentTime;
            }}
            onSeeking={(e) => {
              // Rewatching earlier parts is fine; jumping ahead past what's actually been watched isn't.
              if (e.currentTarget.currentTime > maxWatchedRef.current + 1.5) {
                e.currentTarget.currentTime = maxWatchedRef.current;
              }
            }}
            onEnded={markWatched}
            onError={() => setError("This video couldn't be played. It may not have finished uploading correctly — try re-uploading it from the admin panel.")}
            style={{ width: "100%", borderRadius: 10, background: "#000", display: "block" }}
          />
        </div>
      )}
      {!youtubeId && !resolving && !playbackUrl && !hasSource && (
        <div style={{ background: "#fdf6e3", border: "1px solid #eddfad", color: "#8a6d1f", fontSize: 15, padding: "10px 14px", borderRadius: 8, marginBottom: 16 }}>
          No video uploaded for this step yet.
        </div>
      )}
      {error && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 10 }}>{error}</div>}
      <p style={{ fontSize: 14, color: "#a39a8d" }}>Continue unlocks automatically once the video finishes playing.</p>
    </div>
  );
}

// ================= CERTIFICATE STEP =================

// Waits for any <img> inside el to finish loading, so html2canvas doesn't
// snapshot the certificate before the brand logo / wordmark have painted.
async function waitForImages(el) {
  const imgs = Array.from(el.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise((res) => { img.onload = res; img.onerror = res; })
    )
  );
}

async function buildCertificatePdf(el) {
  await waitForImages(el);
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width, canvas.height] });
  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  return pdf;
}

function CertificateStep({ step, brand, participantName, onComplete, onBack }) {
  const [claiming, setClaiming] = useState(true);
  const [issuedAt, setIssuedAt] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const certRef = useRef(null);
  const claimRef = useRef(null);
  const savedCopyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc("claim_certificate_step", { p_step_id: step.id }).then(({ data, error: rpcError }) => {
      if (cancelled) return;
      setClaiming(false);
      if (rpcError) { setError(rpcError.message); return; }
      claimRef.current = data;
      setIssuedAt(data.issued_at);
      onComplete();
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  // Once the certificate has rendered, quietly upload a copy to Storage so
  // there's a server-side record even if the learner never hits Download.
  useEffect(() => {
    if (claiming || error || !issuedAt || savedCopyRef.current) return;
    const claim = claimRef.current;
    if (!claim || claim.pdf_stored) { savedCopyRef.current = true; return; }
    savedCopyRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        // let the layout settle for one frame before snapshotting
        await new Promise((r) => setTimeout(r, 150));
        if (cancelled || !certRef.current) return;
        const pdf = await buildCertificatePdf(certRef.current);
        const path = `${claim.user_id}/${claim.brand_id}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("certificates")
          .upload(path, pdf.output("blob"), { contentType: "application/pdf", upsert: true });
        if (upErr || cancelled) return;
        await supabase.rpc("record_certificate_pdf", { p_brand_id: claim.brand_id, p_path: path });
      } catch {
        // A failed background copy shouldn't disrupt the learner — they can
        // still download it themselves, and the row stays flagged as not stored.
      }
    })();
    return () => { cancelled = true; };
  }, [claiming, error, issuedAt]);

  async function downloadPdf() {
    if (!certRef.current) return;
    setDownloading(true);
    const pdf = await buildCertificatePdf(certRef.current);
    pdf.save(`${brand.name.replace(/\s+/g, "-")}-certificate-${participantName.replace(/\s+/g, "-")}.pdf`);
    setDownloading(false);
  }

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 600,
          color: navy[700], marginBottom: 14, background: "#fff", border: "1px solid #e4dfd6",
          borderRadius: 999, padding: "8px 16px", cursor: "pointer",
        }}
      >
        <ChevronLeft size={15} /> Back
      </button>

      {claiming && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a8074", fontSize: 16, marginBottom: 14 }}><Loader2 size={16} className="spin" /> Preparing your certificate…</div>}
      {error && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 14 }}>{error}</div>}

      {!claiming && !error && (
        <>
          {step.cert_template_url ? (
            <div
              ref={certRef}
              style={{ position: "relative", width: 900, maxWidth: "100%", margin: "0 auto 18px", containerType: "inline-size" }}
            >
              <img src={step.cert_template_url} alt={`${brand.name} certificate`} style={{ display: "block", width: "100%" }} />
              <div
                style={{
                  position: "absolute", left: `${step.cert_name_x ?? 50}%`, top: `${step.cert_name_y ?? 55}%`,
                  transform: "translate(-50%, -50%)", whiteSpace: "nowrap",
                  // The name has to shrink exactly in step with the certificate
                  // image on a narrow screen — a literal px size here would stay
                  // full-size while only the image scaled down, so it's sized
                  // relative to the container's own rendered width (cqw) instead.
                  fontSize: `calc(${step.cert_name_font_size ?? 34} / 900 * 100cqw)`,
                  color: step.cert_name_color || "#1a2b3d",
                  fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 600,
                }}
              >
                {participantName}
              </div>
            </div>
          ) : (
            <div
              ref={certRef}
              style={{
                width: 900, maxWidth: "100%", aspectRatio: "1.41 / 1", margin: "0 auto 18px", background: "#fff",
                border: `6px solid ${gold}`, borderRadius: 4, padding: "5% 8%",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center",
                boxSizing: "border-box",
              }}
            >
              {brand.logo_url && <img src={brand.logo_url} alt={brand.name} style={{ maxHeight: 64, maxWidth: 220, objectFit: "contain", marginBottom: 24 }} />}
              <div style={{ fontSize: 15, letterSpacing: 3, color: "#8a8074", textTransform: "uppercase", marginBottom: 18 }}>Certificate of Participation</div>
              <div style={{ fontSize: 16, color: "#6b6155", marginBottom: 8 }}>This certifies that</div>
              <div style={{ fontSize: 34, fontWeight: 600, color: navy[900], marginBottom: 18, fontFamily: "Georgia, 'Times New Roman', serif" }}>{participantName}</div>
              <div style={{ fontSize: 16, color: "#6b6155", marginBottom: 28, maxWidth: 480 }}>
                has successfully completed the <strong>{brand.name}</strong> training programme
              </div>
              <div style={{ fontSize: 15, color: "#a39a8d", marginBottom: 16 }}>{formatDate(issuedAt)}</div>
              <img src={WORDMARK_SRC} alt="National Beauty Distribution" style={{ height: 22 }} />
            </div>
          )}

          <div style={{ textAlign: "center" }}>
            <button
              onClick={downloadPdf}
              disabled={downloading}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: navy[700], color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 16, fontWeight: 500, opacity: downloading ? 0.7 : 1 }}
            >
              <Download size={15} /> {downloading ? "Preparing PDF…" : "Download certificate (PDF)"}
            </button>
          </div>
        </>
      )}
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ================= SEQUENCE =================

const STEP_ICON = { video: PlayCircle, quiz: CheckCircle2, certificate: Award };
const STEP_LABEL = { video: "Video", quiz: "Quiz", certificate: "Certificate" };

function StepRow({ step, done, locked, onOpen }) {
  const Icon = STEP_ICON[step.type];
  return (
    <button
      onClick={() => !locked && onOpen(step.id)}
      disabled={locked}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: "13px 16px", opacity: locked ? 0.55 : 1, cursor: locked ? "default" : "pointer" }}
    >
      {locked ? <Lock size={16} color="#a39a8d" /> : done ? <CheckCircle2 size={16} color="#4a6b3d" /> : <Icon size={16} color={navy[500]} />}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, color: navy[900], fontSize: 16 }}>{step.title}</div>
        <div style={{ fontSize: 14, color: "#8a8074" }}>{STEP_LABEL[step.type]}{step.type === "video" && step.duration ? ` · ${step.duration}` : ""}</div>
      </div>
      {done && <Badge tone="gold">Done</Badge>}
    </button>
  );
}

function CustomerBrandDetail({ brand, completedStepIds, onStepCompleted, participantName, onBack }) {
  const [openStepId, setOpenStepId] = useState(null);
  const steps = [...brand.steps].sort((a, b) => a.order_index - b.order_index);
  const active = steps.find((s) => s.id === openStepId);
  const doneCount = steps.filter((s) => completedStepIds.has(s.id)).length;

  if (active) {
    const activeIndex = steps.findIndex((s) => s.id === active.id);
    const nextStep = activeIndex >= 0 ? steps[activeIndex + 1] : null;
    const onBackToList = () => setOpenStepId(null);
    // Quiz/certificate stay on screen to show their result — only video
    // auto-returns to the list, since there's nothing else to show there.
    const refreshOnly = () => onStepCompleted(active.id);
    const refreshAndReturn = () => { onStepCompleted(active.id); setOpenStepId(null); };
    const goToNext = () => { onStepCompleted(active.id); setOpenStepId(nextStep ? nextStep.id : null); };
    if (active.type === "quiz") return <QuizStep step={active} onComplete={refreshOnly} onBack={onBackToList} nextStep={nextStep} onGoToNext={goToNext} />;
    if (active.type === "video") return <VideoStep step={active} onComplete={refreshAndReturn} onBack={onBackToList} />;
    return <CertificateStep step={active} brand={brand} participantName={participantName} onComplete={refreshOnly} onBack={onBackToList} />;
  }

  const brandPct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
  const status = doneCount === 0 ? "Start" : doneCount === steps.length && steps.length > 0 ? "Completed" : "Resume";
  let lastActivity = null;
  for (const s of steps) {
    const ts = completedStepIds.get(s.id);
    if (ts && (!lastActivity || ts > lastActivity)) lastActivity = ts;
  }

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 600,
          color: navy[700], marginBottom: 14, background: "#fff", border: "1px solid #e4dfd6",
          borderRadius: 999, padding: "8px 16px", cursor: "pointer",
        }}
      >
        <ChevronLeft size={15} /> All brands
      </button>
      <div
        style={{
          background: `linear-gradient(120deg, ${navy[700]} 0%, ${navy[500]} 100%)`,
          borderRadius: 18,
          padding: "32px 36px",
          marginBottom: 28,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        {brand.logo_url && (
          <div style={{ height: 88, width: 88, flexShrink: 0, borderRadius: 16, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 14, boxShadow: "0 4px 14px rgba(0,0,0,0.18)" }}>
            <img src={brand.logo_url} alt={brand.name} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
          </div>
        )}
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1.5, opacity: 0.85, marginBottom: 4, fontWeight: 700 }}>Brand training</div>
          <h3 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 4px" }}>{brand.name}</h3>
          {brand.tagline && <p style={{ margin: "0 0 14px", fontSize: 16, opacity: 0.9 }}>{brand.tagline}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: 14, maxWidth: 360 }}>
            <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.3)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${brandPct}%`, background: "#fff" }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>{doneCount} / {steps.length} complete</div>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              display: "inline-block", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700,
              padding: "4px 12px", borderRadius: 999, marginBottom: 10,
              background: status === "Completed" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.18)",
              color: status === "Completed" ? "#4a6b3d" : "#fff",
            }}
          >
            {status}
          </div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            Last activity<br />
            <span style={{ fontWeight: 600, fontSize: 14 }}>{lastActivity ? formatDateTime(lastActivity) : "Not started yet"}</span>
          </div>
          {status === "Completed" && (
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>
              Completed on<br />
              <span style={{ fontWeight: 600, fontSize: 14 }}>{formatDateTime(lastActivity)}</span>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((s, i) => {
          const done = completedStepIds.has(s.id);
          const locked = i > 0 && !completedStepIds.has(steps[i - 1].id);
          return <StepRow key={s.id} step={s} done={done} locked={locked} onOpen={setOpenStepId} />;
        })}
        {steps.length === 0 && <div style={{ color: "#8a8074", fontSize: 16 }}>No steps added to this brand yet — check back soon.</div>}
      </div>
    </div>
  );
}

// ================= DASHBOARD =================

function CustomerDashboard({ brands, completedStepIds, onStepCompleted, participantName, openBrandId, setOpenBrandId }) {
  const brand = brands.find((b) => b.id === openBrandId);
  if (brand) return <CustomerBrandDetail brand={brand} completedStepIds={completedStepIds} onStepCompleted={onStepCompleted} participantName={participantName} onBack={() => setOpenBrandId(null)} />;
  const totalSteps = brands.reduce((s, b) => s + b.steps.length, 0);
  const totalDone = brands.reduce((s, b) => s + b.steps.filter((st) => completedStepIds.has(st.id)).length, 0);
  const certifiedCount = brands.filter((b) => b.steps.length > 0 && b.steps.every((st) => completedStepIds.has(st.id))).length;
  const overallPct = totalSteps ? Math.round((totalDone / totalSteps) * 100) : 0;

  return (
    <div>
      <div
        style={{
          background: `linear-gradient(120deg, ${navy[700]} 0%, ${navy[500]} 100%)`,
          borderRadius: 18,
          padding: "36px 40px",
          marginBottom: 28,
          color: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 24,
        }}
      >
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Welcome back{participantName ? `, ${participantName.split(" ")[0]}` : ""}</h2>
        </div>
        <div style={{ display: "flex", gap: 32 }}>
          <div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{brands.length}</div>
            <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1, opacity: 0.85 }}>Brand{brands.length === 1 ? "" : "s"}</div>
          </div>
          <div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{overallPct}%</div>
            <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1, opacity: 0.85 }}>Complete</div>
          </div>
          <div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{certifiedCount}</div>
            <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1, opacity: 0.85 }}>Certified</div>
          </div>
        </div>
      </div>

      {brands.length === 0 && <div style={{ color: "#8a8074", fontSize: 16 }}>No brands approved on this account yet.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {brands.map((b) => {
          const done = b.steps.filter((s) => completedStepIds.has(s.id)).length;
          const pct = b.steps.length ? Math.round((done / b.steps.length) * 100) : 0;
          return (
            <button key={b.id} onClick={() => setOpenBrandId(b.id)} style={{ textAlign: "left", background: "#fff", border: "1px solid #e4dfd6", borderRadius: 16, padding: 0, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderBottom: "1px solid #f0ece3", padding: 24 }}>
                {b.logo_url ? (
                  <img src={b.logo_url} alt={b.name} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
                ) : (
                  <div style={{ fontWeight: 700, fontSize: 24, color: navy[900] }}>{b.name}</div>
                )}
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 17, color: navy[900] }}>{b.name}</div>
                  {b.steps.length > 0 && (
                    <div
                      style={{
                        flexShrink: 0, fontSize: 14, fontWeight: 700, padding: "8px 18px", borderRadius: 999,
                        background: done === 0 ? navy[700] : pct === 100 ? "#4a6b3d" : navy[500],
                        color: "#fff",
                      }}
                    >
                      {done === 0 ? "Start" : pct === 100 ? "Completed" : "Resume"}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 15, color: "#8a8074", marginBottom: 12 }}>{done} of {b.steps.length} steps complete</div>
                <div style={{ height: 8, background: "#e4dfd6", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#4a6b3d" : navy[500] }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ================= TEAM =================

const STATUS_TONE = { Completed: "gold", "In progress": "navy", "Not started": "muted" };

// Plain-stroke SVG donut — no chart library needed for a handful of
// segments. Segments are drawn clockwise starting from 12 o'clock.
function DonutRing({ segments, size = 84, strokeWidth = 10, centerLabel, centerSub }) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let offset = 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#efe9e3" strokeWidth={strokeWidth} />
        {segments.map((seg, i) => {
          if (seg.value <= 0) return null;
          const len = (seg.value / total) * c;
          const circle = (
            <circle
              key={i}
              cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={seg.color} strokeWidth={strokeWidth}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
            />
          );
          offset += len;
          return circle;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: navy[900] }}>{centerLabel}</div>
        {centerSub && <div style={{ fontSize: 11, color: "#8a8074" }}>{centerSub}</div>}
      </div>
    </div>
  );
}

// One tab per team member, each seeing only their own row of stats — the
// holder can switch between teammates, but a staff member never gets this
// component rendered at all (CustomerTeam only renders it when isHolder).
function StaffTrainingDashboard({ team, brands, teamProgress, big = false }) {
  const [selectedId, setSelectedId] = useState(team[0]?.id ?? null);
  const selectedUser = team.find((u) => u.id === selectedId) || team[0];
  const completed = (selectedUser && teamProgress[selectedUser.id]) || new Map();

  if (!selectedUser || brands.length === 0) return null;

  let completedCount = 0, inProgressCount = 0, notStartedCount = 0, lastActivity = null;
  const rows = brands.map((brand) => {
    const steps = [...brand.steps].sort((a, b) => a.order_index - b.order_index);
    const total = steps.length;
    const done = steps.filter((s) => completed.has(s.id)).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const status = total === 0 ? null : done === total ? "Completed" : done > 0 ? "In progress" : "Not started";
    if (status === "Completed") completedCount++;
    else if (status === "In progress") inProgressCount++;
    else if (status === "Not started") notStartedCount++;

    const quizStep = steps.find((s) => s.type === "quiz");
    const quizDone = !!quizStep && completed.has(quizStep.id);

    let brandLastActivity = null;
    for (const s of steps) {
      const ts = completed.get(s.id);
      if (ts && (!brandLastActivity || ts > brandLastActivity)) brandLastActivity = ts;
      if (ts && (!lastActivity || ts > lastActivity)) lastActivity = ts;
    }

    return { brand, total, done, pct, status, quizStep, quizDone, brandLastActivity };
  });

  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: big ? 24 : 17, fontWeight: 700, color: navy[900], margin: "0 0 4px" }}>Team training status</h3>
      <p style={{ color: "#8a8074", fontSize: big ? 16 : 15, margin: "0 0 20px" }}>Pick a name to see their own course-by-course status — nobody sees anyone else's.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {team.map((u) => (
          <button
            key={u.id}
            onClick={() => setSelectedId(u.id)}
            style={{
              padding: big ? "11px 22px" : "8px 16px", borderRadius: 999, fontSize: big ? 16 : 14, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${selectedId === u.id ? navy[700] : "#e4dfd6"}`,
              background: selectedId === u.id ? navy[700] : "#fff",
              color: selectedId === u.id ? "#fff" : navy[900],
            }}
          >
            {u.name}{u.role === "holder" ? " (you)" : ""}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: big ? 22 : 16, fontWeight: 700, color: navy[900] }}>{selectedUser.name}{selectedUser.role === "holder" ? " (you)" : ""}</div>
        <div style={{ fontSize: big ? 16 : 14, color: "#8a8074" }}>{selectedUser.email}</div>
      </div>

      <div style={{ display: "flex", gap: big ? 40 : 28, alignItems: "center", flexWrap: "wrap", background: "#fff", border: "1px solid #e4dfd6", borderRadius: 16, padding: big ? "32px 36px" : "20px 24px", marginBottom: 24 }}>
        <DonutRing
          segments={[
            { value: completedCount, color: "#4a6b3d" },
            { value: inProgressCount, color: "#c99a2e" },
            { value: notStartedCount, color: "#e4dfd6" },
          ]}
          size={big ? 130 : 84}
          strokeWidth={big ? 15 : 10}
          centerLabel={brands.length}
          centerSub="Courses"
        />
        <div style={{ display: "flex", flexDirection: "column", gap: big ? 10 : 6, fontSize: big ? 16 : 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#4a6b3d", display: "inline-block" }} /> {completedCount} completed</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#c99a2e", display: "inline-block" }} /> {inProgressCount} in progress</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#e4dfd6", display: "inline-block" }} /> {notStartedCount} not started</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: big ? 14 : 13, color: "#8a8074" }}>Last activity</div>
          <div style={{ fontSize: big ? 20 : 16, fontWeight: 600, color: navy[900] }}>{lastActivity ? formatDate(lastActivity) : "No activity yet"}</div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: big ? 16 : 14 }}>
          <thead>
            <tr>
              {["Course", "Status", "Progress", "Quiz", "Last activity"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: big ? "12px 16px" : "8px 12px", color: "#8a8074", fontSize: big ? 14 : 13, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e4dfd6", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ brand, total, done, pct, status, quizStep, quizDone, brandLastActivity }) => (
              <tr key={brand.id}>
                <td style={{ padding: big ? "14px 16px" : "10px 12px", borderBottom: "1px solid #f0ece3" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {brand.logo_url && <img src={brand.logo_url} alt={brand.name} style={{ height: big ? 26 : 20, maxWidth: big ? 90 : 70, objectFit: "contain" }} />}
                    <span style={{ fontWeight: 600, color: navy[900] }}>{brand.name}</span>
                  </div>
                </td>
                <td style={{ padding: big ? "14px 16px" : "10px 12px", borderBottom: "1px solid #f0ece3" }}>
                  {status ? <Badge tone={STATUS_TONE[status]}>{status.toUpperCase()}</Badge> : <span style={{ color: "#a39a8d" }}>No steps yet</span>}
                </td>
                <td style={{ padding: big ? "14px 16px" : "10px 12px", borderBottom: "1px solid #f0ece3", whiteSpace: "nowrap" }}>{done} / {total} ({pct}%)</td>
                <td style={{ padding: big ? "14px 16px" : "10px 12px", borderBottom: "1px solid #f0ece3" }}>
                  {!quizStep ? <span style={{ color: "#a39a8d" }}>—</span> : quizDone ? <span style={{ color: "#4a6b3d", fontWeight: 600 }}>100%</span> : <span style={{ color: "#a39a8d" }}>Not taken</span>}
                </td>
                <td style={{ padding: big ? "14px 16px" : "10px 12px", borderBottom: "1px solid #f0ece3", whiteSpace: "nowrap" }}>{brandLastActivity ? formatDate(brandLastActivity) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerTeam({ team, currentUserId, onAdd, onRemove, isHolder = false }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) { setError("Enter a first name, last name, and email first"); return; }
    setBusy(true);
    setError("");
    const err = await onAdd({ name: `${firstName.trim()} ${lastName.trim()}`, email: email.trim() });
    setBusy(false);
    if (err) { setError(err); return; }
    setFirstName(""); setLastName(""); setEmail("");
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: navy[900], margin: "0 0 4px" }}>Team</h2>
      <p style={{ color: "#8a8074", fontSize: 16, margin: "0 0 20px" }}>
        {isHolder
          ? "Add staff to your account. They sign in with the exact email you enter here, choosing their own password the first time."
          : "Everyone on your account's team."}
      </p>

      {isHolder && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
            <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" style={{ flex: 1, minWidth: 120, padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 16 }} />
            <input required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" style={{ flex: 1, minWidth: 120, padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 16 }} />
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={{ flex: 1, minWidth: 140, padding: "8px 10px", border: "1px solid #ddd5cb", borderRadius: 6, fontSize: 16 }} />
            <button onClick={add} disabled={busy} style={{ background: navy[700], color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 15, opacity: busy ? 0.7 : 1 }}>Add</button>
          </div>
          {error && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 12 }}>{error}</div>}
        </>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {team.map((u) => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, background: u.role === "holder" ? navy[50] : "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: "12px 14px" }}>
            <Users size={16} color={navy[700]} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 16, color: navy[900], display: "flex", alignItems: "center", gap: 8 }}>
                {u.name}{u.id === currentUserId ? " (you)" : ""}{u.role === "holder" ? " · main account holder" : ""}
                {u.status === "pending" && <Badge tone="muted">Pending NBD approval</Badge>}
              </div>
              <div style={{ fontSize: 14, color: "#8a8074" }}>{u.email}</div>
            </div>
            {isHolder && u.role === "staff" && (
              <button onClick={() => onRemove(u.id)} style={{ background: "none" }}>
                <Trash2 size={15} color="#a39a8d" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ================= ACCOUNT STATUS (pending / declined) =================

function AccountStatusScreen({ account }) {
  const declined = account.status === "declined";
  return (
    <div style={{ maxWidth: 420, margin: "60px auto", textAlign: "center" }}>
      <Clock size={32} color={navy[500]} style={{ marginBottom: 12 }} />
      <h2 style={{ fontSize: 22, fontWeight: 600, color: navy[900], margin: "0 0 8px" }}>
        {declined ? "Access not approved" : "Your account is waiting on approval"}
      </h2>
      <p style={{ color: "#8a8074", fontSize: 16, lineHeight: 1.6 }}>
        {declined
          ? `Training access for ${account.company_name} wasn't approved. Contact your NBD rep if you think this is a mistake.`
          : "Please check back in 48 hours. You'll get access as soon as it's approved."}
      </p>
    </div>
  );
}

// ================= CERTIFICATES =================

function MyCertificates({ userId }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("certificates")
      .select("id,brand_id,issued_at,pdf_path,brands(name,logo_url)")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) { setError(err.message); return; }
        setRows(data || []);
      });
    return () => { cancelled = true; };
  }, [userId]);

  async function download(row) {
    if (!row.pdf_path) return;
    setOpeningId(row.id);
    const { data, error: err } = await supabase.storage.from("certificates").createSignedUrl(row.pdf_path, 60);
    setOpeningId(null);
    if (err || !data?.signedUrl) { setError(err?.message || "Couldn't open that file"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: navy[900], margin: "0 0 4px" }}>Certificates</h2>
      <p style={{ color: "#8a8074", fontSize: 16, margin: "0 0 20px" }}>Every certificate you've earned, saved here for whenever you need it.</p>

      {error && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 12 }}>{error}</div>}
      {!rows && !error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a8074", fontSize: 16 }}><Loader2 size={16} className="spin" /> Loading…</div>
      )}
      {rows && rows.length === 0 && (
        <div style={{ color: "#a39a8d", fontSize: 16 }}>No certificates yet — complete a brand's training to earn one.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(rows || []).map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 16, background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ width: 48, height: 40, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {r.brands?.logo_url ? (
                <img src={r.brands.logo_url} alt={r.brands.name} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
              ) : (
                <Award size={22} color={navy[500]} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 16, color: navy[900] }}>{r.brands?.name || "—"}</div>
              <div style={{ fontSize: 14, color: "#8a8074" }}>Issued {formatDate(r.issued_at)}</div>
            </div>
            {r.pdf_path ? (
              <button
                onClick={() => download(r)}
                disabled={openingId === r.id}
                style={{ display: "flex", alignItems: "center", gap: 6, background: navy[700], color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 15, fontWeight: 500 }}
              >
                <Download size={15} /> {openingId === r.id ? "Opening…" : "Download"}
              </button>
            ) : (
              <span style={{ fontSize: 13, color: "#a39a8d" }}>Preparing…</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ================= EDUCATION BROCHURE =================

const BROCHURE_URL = "https://online.flippingbook.com/view/679291008/";

function EducationBrochure() {
  const [loaded, setLoaded] = useState(false);
  const frameWrapRef = useRef(null);

  function goFullscreen() {
    const el = frameWrapRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 4 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: navy[900], margin: 0 }}>Education Brochure</h2>
        <button
          onClick={goFullscreen}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e4dfd6", color: navy[700], borderRadius: 8, padding: "8px 14px", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}
        >
          <Maximize2 size={14} /> View full screen
        </button>
      </div>
      <p style={{ color: "#8a8074", fontSize: 16, margin: "8px 0 16px" }}>
        Want to continue your education journey with some in-person training? Browse our education brochure to see our full offering — at the end of each brand's section you'll find a timetable with links straight through to our booking page.
      </p>
      <div ref={frameWrapRef} style={{ position: "relative", width: "100%", paddingTop: loaded ? "62%" : "0", height: loaded ? undefined : 420, borderRadius: 10, overflow: "hidden", border: "1px solid #e4dfd6", background: "#fafaf7" }}>
        {!loaded && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "#a39a8d" }}>
            <Loader2 size={22} className="spin" />
            <span style={{ fontSize: 14 }}>Loading brochure…</span>
          </div>
        )}
        <iframe
          src={BROCHURE_URL}
          title="NBD Education Brochure"
          allow="clipboard-write; fullscreen"
          allowFullScreen
          onLoad={() => setLoaded(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", opacity: loaded ? 1 : 0, transition: "opacity .25s ease" }}
        />
      </div>
    </div>
  );
}

// ================= SETTINGS =================

function AccountSettings({ user, account, onNameSaved }) {
  const [name, setName] = useState(user.name);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameNotice, setNameNotice] = useState("");

  const [customerNumber, setCustomerNumber] = useState(account.customer_number || "");
  const [companyName, setCompanyName] = useState(account.company_name);
  const [contactName, setContactName] = useState(account.main_contact_name);
  const [contactEmail, setContactEmail] = useState(account.main_contact_email);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [accountNotice, setAccountNotice] = useState("");

  async function saveName(e) {
    e.preventDefault();
    if (!name.trim()) { setNameError("Name can't be empty"); return; }
    setNameSaving(true);
    setNameError("");
    setNameNotice("");
    const { error } = await supabase.rpc("update_my_profile", { p_name: name.trim() });
    setNameSaving(false);
    if (error) { setNameError(error.message); return; }
    setNameNotice("Saved.");
    onNameSaved(name.trim());
  }

  async function saveAccount(e) {
    e.preventDefault();
    if (!companyName.trim() || !contactName.trim() || !contactEmail.trim()) {
      setAccountError("Fill in every field first.");
      return;
    }
    setAccountSaving(true);
    setAccountError("");
    setAccountNotice("");
    const { error } = await supabase.rpc("update_my_account", {
      p_customer_number: customerNumber.trim(),
      p_company_name: companyName.trim(),
      p_main_contact_name: contactName.trim(),
      p_main_contact_email: contactEmail.trim(),
    });
    setAccountSaving(false);
    if (error) { setAccountError(error.message); return; }
    setAccountNotice("Saved.");
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: navy[900], margin: "0 0 4px" }}>Settings</h2>
      <p style={{ color: "#8a8074", fontSize: 16, margin: "0 0 24px" }}>Update your own details and your company's account details.</p>

      <form onSubmit={saveName} style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#6b6155", marginBottom: 12 }}>Your profile</div>
        <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Full name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: "9px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 16, boxSizing: "border-box" }} />
        <p style={{ fontSize: 14, color: "#a39a8d", margin: "0 0 12px" }}>This is the name printed on your certificates.</p>
        {nameError && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 10 }}>{nameError}</div>}
        {nameNotice && <div style={{ color: "#4d6b2c", fontSize: 15, marginBottom: 10 }}>{nameNotice}</div>}
        <button type="submit" disabled={nameSaving} style={{ background: navy[700], color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 15, opacity: nameSaving ? 0.7 : 1 }}>{nameSaving ? "Saving…" : "Save name"}</button>
      </form>

      <form onSubmit={saveAccount} style={{ background: "#fff", border: "1px solid #e4dfd6", borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#6b6155", marginBottom: 12 }}>Company details</div>
        <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Customer number</label>
        <input value={customerNumber} onChange={(e) => setCustomerNumber(e.target.value)} style={{ width: "100%", padding: "9px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 16, boxSizing: "border-box" }} />
        <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Salon / business name</label>
        <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={{ width: "100%", padding: "9px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 16, boxSizing: "border-box" }} />
        <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Main contact name</label>
        <input value={contactName} onChange={(e) => setContactName(e.target.value)} style={{ width: "100%", padding: "9px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 16, boxSizing: "border-box" }} />
        <label style={{ fontSize: 15, color: "#6b6155", display: "block", marginBottom: 4 }}>Main contact email</label>
        <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} style={{ width: "100%", padding: "9px 10px", border: "1px solid #ddd5cb", borderRadius: 6, marginBottom: 12, fontSize: 16, boxSizing: "border-box" }} />
        <p style={{ fontSize: 14, color: "#a39a8d", margin: "0 0 12px" }}>This doesn't change the email you sign in with — that stays as-is.</p>
        {accountError && <div style={{ color: "#a3372f", fontSize: 15, marginBottom: 10 }}>{accountError}</div>}
        {accountNotice && <div style={{ color: "#4d6b2c", fontSize: 15, marginBottom: 10 }}>{accountNotice}</div>}
        <button type="submit" disabled={accountSaving} style={{ background: navy[700], color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 15, opacity: accountSaving ? 0.7 : 1 }}>{accountSaving ? "Saving…" : "Save company details"}</button>
      </form>
    </div>
  );
}

// ================= ROOT =================

export default function CustomerApp({ user, account }) {
  const [tab, setTab] = useState("training");
  const [displayName, setDisplayName] = useState(user.name);
  const [brands, setBrands] = useState(null);
  const [completedStepIds, setCompletedStepIds] = useState(new Map());
  const [team, setTeam] = useState([]);
  const [teamProgress, setTeamProgress] = useState({});
  const [loadError, setLoadError] = useState("");
  const [openBrandId, setOpenBrandId] = useState(null);
  const isHolder = user.role === "holder";
  // Once a brand's open, the drill-down (step list, video, quiz, certificate)
  // takes the full page — the sidebar nav would only squeeze it and make
  // drag-based quiz questions cramped on a phone screen.
  const isDrilledIntoTraining = tab === "training" && !!openBrandId;

  async function loadProgress() {
    const { data } = await supabase.from("step_progress").select("step_id,completed_at").eq("user_id", user.id);
    setCompletedStepIds(new Map((data || []).map((row) => [row.step_id, row.completed_at])));
  }

  async function loadTeam() {
    const { data } = await supabase.from("app_users").select("id,name,email,role,status").eq("account_id", account.id).neq("status", "declined").order("role", { ascending: false });
    setTeam(data || []);
  }

  async function loadTeamProgress() {
    if (!isHolder) return;
    const { data } = await supabase.rpc("get_team_progress");
    const byUser = {};
    for (const row of data || []) {
      if (!byUser[row.user_id]) byUser[row.user_id] = new Map();
      byUser[row.user_id].set(row.step_id, row.completed_at);
    }
    setTeamProgress(byUser);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (account.status !== "approved") return;
      const { data, error } = await supabase
        .from("brands")
        .select("id,name,tagline,logo_url,steps:brand_steps(id,type,title,video_url,video_storage_path,duration,order_index,cert_template_url,cert_name_x,cert_name_y,cert_name_font_size,cert_name_color)");
      if (cancelled) return;
      if (error) { setLoadError(error.message); return; }
      setBrands(data || []);
      await loadProgress();
      await loadTeam();
      await loadTeamProgress();
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);

  if (account.status !== "approved") {
    return <AccountStatusScreen account={account} />;
  }

  if (loadError) return <div style={{ color: "#a3372f", fontSize: 16 }}>{loadError}</div>;
  if (!brands) {
    return <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a8074", fontSize: 16 }}><Loader2 size={16} className="spin" /> Loading your training…</div>;
  }

  // The brands table itself is intentionally readable by everyone (the
  // apply-for-access form needs the full catalog pre-login), so the
  // approved_brand_ids filter has to be applied here — only approved brands
  // should ever reach a customer's own dashboard.
  // The admin's full-access demo account always sees every brand, regardless
  // of approved_brand_ids — robust even as new brands get added later.
  const approvedBrands = account.is_demo ? brands : brands.filter((b) => account.approved_brand_ids.includes(b.id));

  async function handleStepCompleted() {
    await loadProgress();
    await loadTeamProgress();
  }

  async function handleAddStaff({ name, email }) {
    const { error } = await supabase.from("app_users").insert({ account_id: account.id, name, email, role: "staff", status: "pending" });
    if (error) return error.message.includes("duplicate") ? "That email is already on the team." : error.message;
    await loadTeam();
    return null;
  }

  async function handleRemoveStaff(id) {
    await supabase.from("app_users").delete().eq("id", id);
    await loadTeam();
  }

  return (
    <div className="nbd-shell-layout">
      <style>{`
        .nbd-shell-layout { display: flex; gap: 24px; }
        .nbd-shell-nav { width: 170px; flex-shrink: 0; }
        @media (max-width: 760px) {
          .nbd-shell-layout { flex-direction: column; }
          .nbd-shell-nav { width: 100%; }
        }
      `}</style>
      {!isDrilledIntoTraining && (
        <div className="nbd-shell-nav">
          {[
            { id: "training", label: "Training", icon: PlayCircle },
            { id: "certificates", label: "Certificates", icon: Award },
            { id: "team", label: "Team", icon: Users },
            ...(isHolder ? [{ id: "progress", label: "Team progress", icon: BarChart3 }] : []),
            { id: "settings", label: "Settings", icon: Settings },
            { id: "brochure", label: "Education Brochure", icon: BookOpen },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 8, fontSize: 16, marginBottom: 4, background: tab === t.id ? navy[100] : "transparent", color: tab === t.id ? navy[900] : "#6b6155", fontWeight: tab === t.id ? 500 : 400, border: "none" }}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
          <a
            href="mailto:education@nationalbeauty.ie?subject=Request%20another%20brand"
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 8, fontSize: 15, color: "#a39a8d", marginTop: 12, textDecoration: "none" }}
          >
            <Mail size={14} /> Contact NBD to request another brand
          </a>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {tab === "training" && (
          <CustomerDashboard
            brands={approvedBrands}
            completedStepIds={completedStepIds}
            onStepCompleted={handleStepCompleted}
            participantName={displayName}
            openBrandId={openBrandId}
            setOpenBrandId={setOpenBrandId}
          />
        )}
        {tab === "certificates" && <MyCertificates userId={user.id} />}
        {tab === "brochure" && <EducationBrochure />}
        {tab === "team" && (
          <CustomerTeam
            team={team}
            currentUserId={user.id}
            onAdd={handleAddStaff}
            onRemove={handleRemoveStaff}
            isHolder={isHolder}
          />
        )}
        {tab === "progress" && isHolder && <StaffTrainingDashboard team={team} brands={approvedBrands} teamProgress={teamProgress} big />}
        {tab === "settings" && <AccountSettings user={user} account={account} onNameSaved={setDisplayName} />}
      </div>
    </div>
  );
}

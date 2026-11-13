import React, { useEffect, useRef, useState } from 'react';
import { Download, Film, Pause, Play, RotateCcw } from 'lucide-react';
import { CrisisStatePayload } from '../types';

interface Props {
  heading: string;
  crisis: CrisisStatePayload | null;
}

const TOTAL_DURATION_SEC = 16;

export const VideoStudio: React.FC<Props> = ({ heading, crisis }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playing, setPlaying] = useState(true);
  const [timeSec, setTimeSec] = useState(0);
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);

  const after = crisis?.after;
  const before = crisis?.before;

  const drawFrame = (ctx: CanvasRenderingContext2D, t: number) => {
    const w = 1280;
    const h = 720;

    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#0F172A');
    bg.addColorStop(0.55, '#1E1B4B');
    bg.addColorStop(1, '#312E81');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const scene = Math.min(3, Math.floor(t / 4));
    const localT = (t % 4) / 4;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fillRect(0, 0, w, 74);
    ctx.fillStyle = '#93C5FD';
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillText('SMARTTRANSIT AI · LIVE DATA TELEMETRY STORYBOARD', 48, 45);
    ctx.fillStyle = '#C4B5FD';
    ctx.textAlign = 'right';
    ctx.fillText(`SCENE 0${scene + 1} / 04 · ${t.toFixed(1)}s`, w - 48, 45);
    ctx.textAlign = 'left';

    if (scene === 0) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 54px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Every Rural Student Deserves', 64, 190);
      ctx.fillStyle = '#A5B4FC';
      ctx.fillText('Safe, On-Time Campus Transit.', 64, 258);
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '400 24px "DM Sans", sans-serif';
      ctx.fillText(
        'Connecting 8 villages, 10 government buses, 5 verified ParentRide vehicles & 3 colleges.',
        64,
        320
      );

      const cards = [
        { k: '8 Villages', v: 'Connected Mesh' },
        { k: '10 Buses', v: 'Live GPS Tracking' },
        { k: '150+ Students', v: '30 Exam Candidates' },
        { k: '4 Languages', v: 'EN · KN · HI · TA' },
      ];
      cards.forEach((c, idx) => {
        const cx = 64 + idx * 290;
        const cy = 410 + Math.sin(localT * Math.PI + idx) * 6;
        ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
        ctx.strokeStyle = 'rgba(129, 140, 248, 0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(cx, cy, 265, 160, 14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 32px "JetBrains Mono", monospace';
        ctx.fillText(c.k, cx + 24, cy + 72);
        ctx.fillStyle = '#93C5FD';
        ctx.font = '500 18px "DM Sans", sans-serif';
        ctx.fillText(c.v, cx + 24, cy + 114);
      });
    } else if (scene === 1) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 42px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Live Fleet Telemetry & RouteRescue AI', 64, 140);

      const pts = [
        { x: 160, y: 420, label: 'V1 Kengeri' },
        { x: 380, y: 270, label: 'V6 Tavarekere' },
        { x: 640, y: 310, label: 'V8 Kanakapura' },
        { x: 650, y: 175, label: 'I3 Jr College' },
        { x: 960, y: 220, label: 'I1 Polytechnic' },
        { x: 1030, y: 440, label: 'I2 Engg Inst' },
      ];
      const edges = [
        [0, 1],
        [1, 2],
        [1, 3],
        [3, 4],
        [2, 4],
        [2, 5],
        [4, 5],
      ];
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 5;
      for (const [a, b] of edges) {
        ctx.beginPath();
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
        ctx.stroke();
      }

      const busX = 160 + (960 - 160) * localT;
      const busY = 420 + (220 - 420) * localT;
      ctx.fillStyle = '#16A34A';
      ctx.beginPath();
      ctx.roundRect(busX - 28, busY - 18, 56, 36, 8);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 15px "JetBrains Mono", monospace';
      ctx.fillText('B01', busX - 16, busY + 5);

      for (const p of pts) {
        ctx.fillStyle = p.label.startsWith('I') ? '#7C3AED' : '#2563EB';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E2E8F0';
        ctx.font = '600 18px "DM Sans", sans-serif';
        ctx.fillText(p.label, p.x - 45, p.y + 42);
      }
    } else if (scene === 2) {
      ctx.fillStyle = '#FCA5A5';
      ctx.font = '700 20px "JetBrains Mono", monospace';
      ctx.fillText('SIMULATED EMERGENCY SCENARIO · 4 SIMULTANEOUS SHOCKS', 64, 130);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 44px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Exam-Day Crisis Command & Dijkstra Rerouting', 64, 185);

      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 8;
      ctx.setLineDash([18, 12]);
      ctx.beginPath();
      ctx.moveTo(320, 380);
      ctx.lineTo(740, 380);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#FECACA';
      ctx.font = '700 20px "JetBrains Mono", monospace';
      ctx.fillText('FLOODED & BLOCKED (V6 <-> V8)', 375, 422);

      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(320, 380);
      ctx.lineTo(530, 260);
      ctx.lineTo(740, 380);
      ctx.lineTo(1040, 310);
      ctx.stroke();
      ctx.fillStyle = '#6EE7B7';
      ctx.fillText('DIJKSTRA MIN-HEAP DETOUR (V6 -> I3 -> V8 -> I1)', 360, 240);
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 44px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Orchestrated Outcome & Student Safety', 64, 150);

      const served = after?.students_served ?? 184;
      const total = after?.total_students ?? 210;
      const examOnTime = after?.exam_students_reaching_on_time ?? 40;
      const examTotal = after?.exam_students_total ?? 40;
      const baselineTotal = before?.total_students ?? 150;

      const boxes = [
        { title: 'Baseline -> Surge Demand', val: `${baselineTotal} -> ${total} Students` },
        { title: 'Students Served', val: `${served} / ${total} Verified` },
        { title: 'Exam Students On Time', val: `${examOnTime} / ${examTotal} Priority` },
        { title: 'Indian Emergency SOS', val: '112 · 100 · 108 · 1098 · 1091' },
      ];
      boxes.forEach((b, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const bx = 64 + col * 585;
        const by = 220 + row * 195;
        ctx.fillStyle = 'rgba(30, 41, 59, 0.92)';
        ctx.strokeStyle = i === 3 ? '#EF4444' : '#6366F1';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(bx, by, 550, 160, 14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#94A3B8';
        ctx.font = '600 18px "DM Sans", sans-serif';
        ctx.fillText(b.title, bx + 28, by + 56);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 32px "JetBrains Mono", monospace';
        ctx.fillText(b.val, bx + 28, by + 112);
      });
    }

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, h - 10, w, 10);
    ctx.fillStyle = '#6366F1';
    ctx.fillRect(0, h - 10, (w * t) / TOTAL_DURATION_SEC, 10);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawFrame(ctx, timeSec);
  }, [timeSec, crisis]);

  useEffect(() => {
    if (!playing) return;
    let rafId = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTimeSec((prev) => {
        const next = prev + dt;
        return next >= TOTAL_DURATION_SEC ? 0 : next;
      });
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [playing]);

  const handleRecordAndDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas || recording) return;
    setRecordError(null);
    setVideoUrl(null);
    setRecording(true);
    setPlaying(false);
    setTimeSec(0);

    try {
      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start();
      const ctx = canvas.getContext('2d');
      const fps = 30;
      const totalFrames = TOTAL_DURATION_SEC * fps;
      for (let f = 0; f <= totalFrames; f++) {
        const t = f / fps;
        setTimeSec(t);
        if (ctx) drawFrame(ctx, t);
        await new Promise((r) => setTimeout(r, 1000 / fps));
      }
      recorder.stop();
      await stopped;

      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    } catch (e) {
      setRecordError(e instanceof Error ? e.message : 'Browser MediaRecorder is unavailable.');
    } finally {
      setRecording(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-indigo-700">1280×720 HD AI-VISUAL MP4 VIDEO + LIVE DATA STORYBOARD</p>
          <h2 className="text-2xl font-bold text-slate-900">{heading}</h2>
        </div>

        <a
          href="/smarttransit_ai_demo.mp4"
          download="smarttransit_ai_demo.mp4"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:from-blue-700 hover:to-indigo-700"
        >
          <Download className="h-4 w-4" />
          Download AI Showcase MP4
        </a>
      </div>

      {/* Rendered Cinematic AI Visual MP4 Video */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              SmartTransit AI — 16s HD Showcase Video (MP4)
            </h3>
            <p className="text-xs text-slate-500">
              Assembled from 4 AI-generated rural transit &amp; crisis scenes with motion zoom and crossfade transitions.
            </p>
          </div>
          <span className="font-mono text-xs text-indigo-700">1280×720 · H.264 MP4</span>
        </div>
        <div className="bg-slate-950">
          <video
            src="/smarttransit_ai_demo.mp4"
            controls
            playsInline
            loop
            className="w-full max-h-[520px] mx-auto block"
          />
        </div>
      </section>

      {/* Interactive Live-Telemetry Storyboard Canvas + WebM Exporter */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Live Crisis Telemetry Video Renderer (.webm)
            </h3>
            <p className="text-xs text-slate-500">
              Reflects your current SQLite &amp; Exam-Day Crisis metrics in real time.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPlaying((p) => !p)}
              disabled={recording}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={() => setTimeSec(0)}
              disabled={recording}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restart
            </button>
            <button
              onClick={handleRecordAndDownload}
              disabled={recording}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              <Film className="h-3.5 w-3.5" />
              {recording ? `Rendering (${Math.round((timeSec / TOTAL_DURATION_SEC) * 100)}%)...` : 'Export Live Telemetry WebM'}
            </button>
          </div>
        </div>

        {recordError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800">
            {recordError}
          </div>
        )}

        {videoUrl && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
            <span className="font-medium">Live Telemetry Video rendered successfully (16s · 1280×720).</span>
            <a
              href={videoUrl}
              download="smarttransit_live_telemetry.webm"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 font-semibold text-white hover:bg-emerald-800"
            >
              <Download className="h-3.5 w-3.5" />
              Download WebM
            </a>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-950 overflow-hidden">
          <canvas ref={canvasRef} width={1280} height={720} className="w-full h-auto block" />
        </div>
      </section>
    </div>
  );
};

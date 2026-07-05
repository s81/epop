'use client';

import { useState, useEffect, useRef } from 'react';

const HOUR_PX = 64;
const ROW_H = 36;
const WC_LABEL_W = 84;
const SNAP_MS = 900_000;

const MODEL_COLORS: Record<string, string> = {
  'DESK-01': '#6366f1',
  'DESK-02': '#8b5cf6',
  'CHAR-01': '#f59e0b',
  'CHAR-02': '#10b981',
  'CAB-01':  '#3b82f6',
};
const DEFAULT_COLOR = '#9ca3af';

type OpRow = {
  id: number;
  orderNumber: string;
  modelCode: string;
  modelNameAr: string;
  quantity: number;
  sequence: number;
  workCenterCode: string;
  workCenterNameAr: string;
  status: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
};

type Op = OpRow & { start: Date; end: Date };

function groupBy<T extends Record<string, unknown>>(arr: T[], key: string): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const item of arr) {
    const k = String(item[key]);
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function GanttChart({
  operations,
  onReschedule,
}: {
  operations: OpRow[];
  onReschedule: (opId: number, start: string, end: string) => Promise<{ success: boolean } | { error: string }>;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragProposal, setDragProposal] = useState<{ opId: number; left: number } | null>(null);
  const dragStartRef = useRef<{ startX: number; origStart: Date; origEnd: Date; opId: number } | null>(null);
  const proposalRef = useRef<{ start: Date; end: Date; opId: number } | null>(null);
  const rangeStartRef = useRef(new Date());

  useEffect(() => {
    if (!isDragging) return;

    function onMouseMove(e: MouseEvent) {
      const ds = dragStartRef.current;
      if (!ds) return;
      const deltaX = e.clientX - ds.startX;
      const deltaMs = (deltaX / HOUR_PX) * 3_600_000;
      let startMs = ds.origStart.getTime() + deltaMs;
      startMs = Math.floor(startMs / SNAP_MS) * SNAP_MS;
      const duration = ds.origEnd.getTime() - ds.origStart.getTime();
      const newStart = new Date(startMs);
      const newEnd = new Date(startMs + duration);
      const left = ((startMs - rangeStartRef.current.getTime()) / 3_600_000) * HOUR_PX;
      proposalRef.current = { start: newStart, end: newEnd, opId: ds.opId };
      setDragProposal({ opId: ds.opId, left: Math.max(0, left) });
    }

    function onMouseUp() {
      const p = proposalRef.current;
      const ds = dragStartRef.current;
      if (p && ds) {
        const moved = p.start.getTime() !== ds.origStart.getTime() || p.end.getTime() !== ds.origEnd.getTime();
        if (moved) {
          onReschedule(ds.opId, p.start.toISOString(), p.end.toISOString())
            .then((r) => { if ('error' in r) console.error(r.error); })
            .catch(console.error);
        }
      }
      dragStartRef.current = null;
      proposalRef.current = null;
      setDragProposal(null);
      setIsDragging(false);
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      const ds = dragStartRef.current;
      if (!ds) return;
      const deltaX = e.touches[0].clientX - ds.startX;
      const deltaMs = (deltaX / HOUR_PX) * 3_600_000;
      let startMs = ds.origStart.getTime() + deltaMs;
      startMs = Math.floor(startMs / SNAP_MS) * SNAP_MS;
      const duration = ds.origEnd.getTime() - ds.origStart.getTime();
      const newStart = new Date(startMs);
      const newEnd = new Date(startMs + duration);
      const left = ((startMs - rangeStartRef.current.getTime()) / 3_600_000) * HOUR_PX;
      proposalRef.current = { start: newStart, end: newEnd, opId: ds.opId };
      setDragProposal({ opId: ds.opId, left: Math.max(0, left) });
    }

    function onTouchEnd() {
      onMouseUp();
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, onReschedule]);

  useEffect(() => {
    if (!isDragging) return;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  const scheduled = operations.filter((o) => o.scheduledStart && o.scheduledEnd);
  if (scheduled.length === 0) return null;

  const ops: Op[] = scheduled.map((o) => ({
    ...o,
    start: new Date(o.scheduledStart!),
    end: new Date(o.scheduledEnd!),
  }));

  const rangeStart = (() => {
    const minMs = Math.min(...ops.map((o) => o.start.getTime()));
    const rs = new Date(minMs);
    rs.setHours(8, 0, 0, 0);
    return rs;
  })();
  const maxMs = Math.max(...ops.map((o) => o.end.getTime()));
  const rangeEnd = new Date(maxMs);
  if (rangeEnd.getHours() >= 16 || (rangeEnd.getHours() === 16 && rangeEnd.getMinutes() > 0)) {
    rangeEnd.setDate(rangeEnd.getDate() + 1);
  }
  rangeEnd.setHours(16, 0, 0, 0);

  rangeStartRef.current = rangeStart;

  const totalHours = (rangeEnd.getTime() - rangeStart.getTime()) / 3_600_000;
  const timelineW = totalHours * HOUR_PX;

  const dayHeaders: { label: string; left: number }[] = [];
  const hourTicks: { label: string; left: number }[] = [];
  const cursor = new Date(rangeStart);
  while (cursor < rangeEnd) {
    const h = cursor.getHours();
    const left = ((cursor.getTime() - rangeStart.getTime()) / 3_600_000) * HOUR_PX;
    if (h === 8) {
      dayHeaders.push({
        label: cursor.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
        left,
      });
    }
    hourTicks.push({ label: `${String(h).padStart(2, '0')}:00`, left });
    cursor.setHours(h + 1);
  }

  const wcEntries = groupBy(ops, 'workCenterCode');
  const wcOrder = Object.keys(wcEntries);
  const rows = wcOrder.length;

  return (
    <>
      <style>{`
@media print {
  @page { size: landscape; margin: 1cm; }
  .no-print { display: none !important; }
  .gantt-print-container,
  .gantt-print-container * {
    overflow: visible !important;
  }
  .gantt-print-container {
    border: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }
  .gantt-print-scroll {
    overflow: visible !important;
    width: 100% !important;
  }
  .gantt-bar {
    border: 1px solid #000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
      `}</style>
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden gantt-print-container">
      <div className="flex">
        {/* WC labels (fixed left column) */}
        <div style={{ width: WC_LABEL_W, minWidth: WC_LABEL_W }}>
          <div className="h-14 border-b border-gray-200 bg-gray-50" />
          {wcOrder.map((code) => (
            <div
              key={code}
              className="border-b border-gray-100 flex items-center px-2 text-xs font-semibold text-gray-600 truncate"
              style={{ height: ROW_H }}
            >
              {code}
            </div>
          ))}
        </div>

        {/* Scrollable timeline */}
        <div className="overflow-x-auto flex-1 gantt-print-scroll">
          <div style={{ width: Math.max(timelineW, 600), minWidth: '100%' }}>
            {/* Time axis */}
            <div className="relative h-14 border-b border-gray-200 bg-gray-50">
              {dayHeaders.map((d) => (
                <div
                  key={d.label}
                  className="absolute top-1 text-xs font-medium text-gray-600"
                  style={{ left: d.left }}
                >
                  {d.label}
                </div>
              ))}
              {hourTicks.map((t) => (
                <div
                  key={t.label}
                  className="absolute border-l border-gray-200"
                  style={{ left: t.left, top: 22, height: 34 }}
                >
                  <span className="pl-1 text-[10px] text-gray-400">{t.label}</span>
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="relative" style={{ height: rows * ROW_H, minHeight: 80 }}>
              {hourTicks.map((t) => (
                <div
                  key={'g' + t.label}
                  className="absolute top-0 bottom-0 border-l border-gray-50"
                  style={{ left: t.left, zIndex: 0 }}
                />
              ))}
              {wcOrder.map((code, ri) => {
                const wcOps = wcEntries[code] as Op[];
                return (
                  <div
                    key={code}
                    className="absolute w-full border-b border-gray-100"
                    style={{ top: ri * ROW_H, height: ROW_H, zIndex: 1 }}
                  >
                    {wcOps.map((op) => {
                      const isDraggingThis = dragProposal?.opId === op.id;
                      const left = isDraggingThis
                        ? dragProposal.left
                        : ((op.start.getTime() - rangeStart.getTime()) / 3_600_000) * HOUR_PX;
                      const w = Math.max(
                        ((op.end.getTime() - op.start.getTime()) / 3_600_000) * HOUR_PX,
                        4,
                      );
                      const color = MODEL_COLORS[op.modelCode] || DEFAULT_COLOR;
                      const draggable = op.status === 'QUEUED' && !isDragging;
                      return (
                        <div
                          key={op.id}
                          className={`absolute top-1.5 rounded h-5 group gantt-bar ${isDraggingThis ? 'opacity-70 shadow-lg' : draggable ? 'cursor-grab' : 'cursor-pointer'}`}
                          style={{ left, width: w, backgroundColor: color }}
                          onMouseDown={draggable ? (e) => {
                            e.preventDefault();
                            dragStartRef.current = {
                              startX: e.clientX,
                              origStart: op.start,
                              origEnd: op.end,
                              opId: op.id,
                            };
                            setIsDragging(true);
                          } : undefined}
                          onTouchStart={draggable ? (e) => {
                            dragStartRef.current = {
                              startX: e.touches[0].clientX,
                              origStart: op.start,
                              origEnd: op.end,
                              opId: op.id,
                            };
                            setIsDragging(true);
                          } : undefined}
                        >
                          {w > 45 && (
                            <span className="block text-[10px] text-white px-1 leading-5 truncate font-medium">
                              {op.modelCode} s{op.sequence}
                            </span>
                          )}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-20">
                            <div className="bg-gray-900 text-white text-xs rounded px-2 py-1.5 whitespace-nowrap shadow-lg">
                              <div className="font-semibold">{op.orderNumber}</div>
                              <div>{op.modelCode} — {op.modelNameAr}</div>
                              <div>Seq {op.sequence} · Qty {op.quantity} · {op.status}</div>
                              <div className="text-gray-300">{fmt(op.scheduledStart!)} → {fmt(op.scheduledEnd!)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

'use client';
import { useState, useEffect, useActionState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { OperationStatus, OperationEventType } from '@/db/schema';
import type { applyEventAction, reportMaintenanceAction, rejectWithDefectAction } from './actions';
import { ConfirmModal } from './ConfirmModal';

// ---- Types ----

type WorkCenter = { id: number; code: string; nameAr: string; nameEn: string };

type QueueItem = {
  id: number;
  sequence: number;
  status: OperationStatus;
  modelNameAr: string;
  modelNameEn: string;
  modelCode: string;
  orderNumber: string;
  quantity: number;
  startedAt: string | null;
};

type EventItem = {
  id: number;
  eventType: OperationEventType;
  operatorId: string | null;
  occurredAt: string;
  modelNameAr: string;
  modelCode: string;
};

// ---- Label / badge maps ----

const STATUS_BADGE: Record<OperationStatus, string> = {
  QUEUED:     'bg-gray-600 text-gray-100',
  IN_PROGRESS:'bg-green-700 text-green-100',
  PAUSED:     'bg-amber-700 text-amber-100',
  PENDING_QC: 'bg-blue-700 text-blue-100',
  COMPLETED:  'bg-emerald-700 text-emerald-100',
  REJECTED:   'bg-red-700 text-red-100',
};

const STATUS_LABEL: Record<OperationStatus, string> = {
  QUEUED:     'في الانتظار / Queued',
  IN_PROGRESS:'جاري التنفيذ / In Progress',
  PAUSED:     'موقوف / Paused',
  PENDING_QC: 'بانتظار الجودة / Pending QC',
  COMPLETED:  'مكتمل / Completed',
  REJECTED:   'مرفوض / Rejected',
};

const EVENT_BADGE: Record<OperationEventType, string> = {
  START:  'bg-green-900 text-green-300',
  PAUSE:  'bg-amber-900 text-amber-300',
  RESUME: 'bg-green-900 text-green-300',
  FINISH: 'bg-blue-900 text-blue-300',
  ACCEPT: 'bg-emerald-900 text-emerald-300',
  REJECT: 'bg-red-900 text-red-300',
  RESTART:'bg-purple-900 text-purple-300',
};

const EVENT_LABEL: Record<OperationEventType, string> = {
  START:  'بدء / Start',
  PAUSE:  'إيقاف / Pause',
  RESUME: 'استئناف / Resume',
  FINISH: 'إنهاء / Finish',
  ACCEPT: 'قبول / Accept',
  REJECT: 'رفض / Reject',
  RESTART:'إعادة / Rework',
};

const SUCCESS_MESSAGE: Record<OperationEventType, string> = {
  START:  'تم البدء / Started',
  PAUSE:  'تم الإيقاف / Paused',
  RESUME: 'تم الاستئناف / Resumed',
  FINISH: 'تم الإنهاء / Finished',
  ACCEPT: 'تم القبول / Accepted',
  REJECT: 'تم الرفض / Rejected',
  RESTART:'تمت الإعادة / Reworked',
};

const MAINTENANCE_CATEGORIES = [
  { value: 'MECHANICAL', labelAr: 'ميكانيكي', labelEn: 'Mechanical' },
  { value: 'ELECTRICAL', labelAr: 'كهربائي',  labelEn: 'Electrical' },
  { value: 'TOOLING',    labelAr: 'أدوات',    labelEn: 'Tooling' },
  { value: 'OTHER',      labelAr: 'أخرى',     labelEn: 'Other' },
];

const DEFECT_CATEGORIES = [
  { value: 'DIMENSIONAL', labelAr: 'أبعاد',   labelEn: 'Dimensional' },
  { value: 'SURFACE',     labelAr: 'سطح',     labelEn: 'Surface / Paint' },
  { value: 'ASSEMBLY',    labelAr: 'تجميع',   labelEn: 'Assembly' },
  { value: 'OTHER',       labelAr: 'أخرى',    labelEn: 'Other' },
];

// ---- Sound effects ----

let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (!_audioCtx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    _audioCtx = new Ctor();
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

function playSuccessSound() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(659, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {}
}

function playErrorSound() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

// ---- ActionForm helper ----

function ActionForm({
  op,
  eventType,
  label,
  colorClass,
  workCenterId,
  operatorId,
  dispatch,
  onSubmit,
  disabled,
}: {
  op: QueueItem;
  eventType: OperationEventType;
  label: string;
  colorClass: string;
  workCenterId: number;
  operatorId: string;
  dispatch: (payload: FormData) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  disabled?: boolean;
}) {
  return (
    <form action={dispatch} onSubmit={onSubmit} className="flex-1">
      <input type="hidden" name="operationId" value={op.id} />
      <input type="hidden" name="eventType" value={eventType} />
      <input type="hidden" name="workCenterId" value={workCenterId} />
      <input type="hidden" name="operatorId" value={operatorId} />
      <button
        type="submit"
        disabled={disabled}
        className={`w-full min-h-[72px] text-xl font-bold rounded-xl text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${colorClass}`}
      >
        {label}{disabled ? ' ...' : ''}
      </button>
    </form>
  );
}

// ---- Main component ----

type Modal = 'maintenance' | 'reject' | null;

export function TabletClient({
  workCenter,
  queue,
  events,
  onAction,
  onMaintenance,
  onRejectWithDefect,
}: {
  workCenter: WorkCenter;
  queue: QueueItem[];
  events: EventItem[];
  onAction: typeof applyEventAction;
  onMaintenance: typeof reportMaintenanceAction;
  onRejectWithDefect: typeof rejectWithDefectAction;
}) {
  const router = useRouter();
  const [operatorId, setOperatorId] = useState('');
  const [operatorError, setOperatorError] = useState(false);
  const [actionState, dispatchAction, isFormPending] = useActionState(onAction, null);
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [elapsed, setElapsed] = useState('');
  const [isTransitionPending, startTransition] = useTransition();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, 8000);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => {
    if (!displayError) return;
    const id = setTimeout(() => setDisplayError(null), 4000);
    return () => clearTimeout(id);
  }, [displayError]);

  useEffect(() => {
    if (!successMessage) return;
    const id = setTimeout(() => setSuccessMessage(null), 2000);
    return () => clearTimeout(id);
  }, [successMessage]);

  const active = queue[0] ?? null;
  const upcoming = queue.slice(1);

  useEffect(() => {
    if (!actionState) return;
    if ('error' in actionState) {
      setDisplayError(actionState.error);
      router.refresh();
      playErrorSound();
    } else if ('eventType' in actionState) {
      setSuccessMessage(SUCCESS_MESSAGE[actionState.eventType as OperationEventType]);
      playSuccessSound();
    }
  }, [actionState, router]);

  useEffect(() => {
    if (active?.status !== 'IN_PROGRESS' || !active?.startedAt) {
      setElapsed('');
      return;
    }
    function tick() {
      const start = new Date(active.startedAt!).getTime();
      const diff = Date.now() - start;
      const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      setElapsed(`⏱ ${h}:${m}:${s}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active?.status, active?.startedAt]);

  function handleActionSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!operatorId.trim()) {
      e.preventDefault();
      setOperatorError(true);
      return;
    }
    setOperatorError(false);
    setDisplayError(null);
  }

  function handleRejectClick() {
    if (!operatorId.trim()) {
      setOperatorError(true);
      return;
    }
    setOperatorError(false);
    setModal('reject');
  }

  function handleMaintenanceClick() {
    setModal('maintenance');
  }

  function handleMaintenanceConfirm(category: string, note?: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.append('workCenterId', String(workCenter.id));
      if (active) fd.append('operationId', String(active.id));
      fd.append('category', category);
      if (note) fd.append('note', note);
      fd.append('operatorId', operatorId);
      try {
        const result = await onMaintenance(null, fd);
        setModal(null);
        if (result?.error) setDisplayError(result.error);
      } catch (e) {
        setModal(null);
        setDisplayError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function handleRejectConfirm(defectCategory: string, note?: string) {
    if (!active) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append('operationId', String(active.id));
      fd.append('defectCategory', defectCategory);
      fd.append('note', note ?? '');
      fd.append('workCenterId', String(workCenter.id));
      fd.append('operatorId', operatorId);
      try {
        const result = await onRejectWithDefect(null, fd);
        setModal(null);
        if (result?.error) setDisplayError(result.error);
        router.refresh();
      } catch (e) {
        setModal(null);
        setDisplayError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div dir="rtl" className="bg-gray-950 text-white min-h-screen flex flex-col">
      {/* Modals */}
      {modal === 'maintenance' && (
        <ConfirmModal
          title="نوع العطل / Problem Type"
          categories={MAINTENANCE_CATEGORIES}
          noteField
          onConfirm={handleMaintenanceConfirm}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'reject' && (
        <ConfirmModal
          title="سبب الرفض / Defect Type"
          categories={DEFECT_CATEGORIES}
          noteField
          onConfirm={handleRejectConfirm}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold">{workCenter.nameAr}</h1>
          <p className="text-sm text-gray-400">{workCenter.nameEn} · {workCenter.code}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <input
            type="text"
            value={operatorId}
            onChange={(e) => {
              setOperatorId(e.target.value);
              setOperatorError(false);
            }}
            placeholder="رقم الموظف / Badge ID"
            className={`bg-gray-800 border rounded px-3 py-2 text-sm w-48 outline-none focus:ring-1 focus:ring-blue-500 ${
              operatorError ? 'border-red-500' : 'border-gray-600'
            }`}
          />
          {operatorError && (
            <p className="text-red-400 text-xs">أدخل رقم الموظف / Enter badge ID</p>
          )}
        </div>
      </header>

      {/* Main area */}
      <div className="flex-1 flex flex-col gap-4 p-4 overflow-hidden">

        {/* Active operation card */}
        {active ? (
          <div className="bg-gray-800 rounded-2xl p-6 flex-shrink-0">
            <div className="flex items-start justify-between mb-4 gap-4">
              <div className="min-w-0">
                <h2 className="text-4xl font-bold leading-tight">{active.modelNameAr}</h2>
                <p className="text-sm text-gray-400 mt-1">
                  {active.orderNumber} · تسلسل {active.sequence}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">
                  {active.modelCode} × {active.quantity}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium flex-shrink-0 ${STATUS_BADGE[active.status]}`}
              >
                {STATUS_LABEL[active.status]}
              </span>
            </div>

            {active.status === 'IN_PROGRESS' && (
              <p className="text-center text-2xl font-mono text-green-400 mb-4">{elapsed}</p>
            )}

            {/* FSM buttons */}
            <div className="flex gap-3">
              {active.status === 'QUEUED' && (
                <ActionForm
                  op={active}
                  eventType="START"
                  label="بدء / Start"
                  colorClass="bg-green-600 hover:bg-green-500"
                  workCenterId={workCenter.id}
                  operatorId={operatorId}
                  dispatch={dispatchAction}
                  onSubmit={handleActionSubmit}
                  disabled={isFormPending}
                />
              )}
              {active.status === 'IN_PROGRESS' && (
                <>
                  <ActionForm
                    op={active}
                    eventType="PAUSE"
                    label="إيقاف / Pause"
                    colorClass="bg-amber-500 hover:bg-amber-400"
                    workCenterId={workCenter.id}
                    operatorId={operatorId}
                    dispatch={dispatchAction}
                    onSubmit={handleActionSubmit}
                    disabled={isFormPending}
                  />
                  <ActionForm
                    op={active}
                    eventType="FINISH"
                    label="إنهاء / Finish"
                    colorClass="bg-blue-600 hover:bg-blue-500"
                    workCenterId={workCenter.id}
                    operatorId={operatorId}
                    dispatch={dispatchAction}
                    onSubmit={handleActionSubmit}
                    disabled={isFormPending}
                  />
                </>
              )}
              {active.status === 'PAUSED' && (
                <ActionForm
                  op={active}
                  eventType="RESUME"
                  label="استئناف / Resume"
                  colorClass="bg-green-600 hover:bg-green-500"
                  workCenterId={workCenter.id}
                  operatorId={operatorId}
                  dispatch={dispatchAction}
                  onSubmit={handleActionSubmit}
                  disabled={isFormPending}
                />
              )}
              {active.status === 'PENDING_QC' && (
                <>
                  <ActionForm
                    op={active}
                    eventType="ACCEPT"
                    label="قبول / Accept"
                    colorClass="bg-green-600 hover:bg-green-500"
                    workCenterId={workCenter.id}
                    operatorId={operatorId}
                    dispatch={dispatchAction}
                    onSubmit={handleActionSubmit}
                    disabled={isFormPending}
                  />
                  <button
                    type="button"
                    onClick={handleRejectClick}
                    disabled={isTransitionPending}
                    className="flex-1 min-h-[72px] text-xl font-bold rounded-xl text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors"
                  >
                    رفض / Reject
                  </button>
                </>
              )}
              {active.status === 'REJECTED' && (
                <ActionForm
                  op={active}
                  eventType="RESTART"
                  label="إعادة العمل / Rework"
                  colorClass="bg-purple-600 hover:bg-purple-500"
                  workCenterId={workCenter.id}
                  operatorId={operatorId}
                  dispatch={dispatchAction}
                  onSubmit={handleActionSubmit}
                  disabled={isFormPending}
                />
              )}
            </div>

            {successMessage && (
              <div className="bg-green-700 border border-green-600 rounded-xl p-4 mt-3">
                <p className="text-green-100 text-base font-medium">
                  ✓ {successMessage}
                </p>
              </div>
            )}
            {displayError && (
              <div className="bg-red-900/50 border border-red-700 rounded-xl p-4 mt-3">
                <p className="text-red-200 text-base font-medium">
                  ⚠ {displayError}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-2xl p-6 flex-shrink-0 flex items-center justify-center min-h-[200px]">
            <p className="text-gray-400 text-xl text-center">
              لا توجد عمليات مفتوحة
              <br />
              <span className="text-base text-gray-500">No open operations</span>
            </p>
          </div>
        )}

        {/* Upcoming queue list */}
        {upcoming.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-4 flex-shrink-0">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">الطابور / Queue</h3>
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {upcoming.map((op) => (
                <div
                  key={op.id}
                  className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-gray-500 text-sm flex-shrink-0">{op.sequence}</span>
                    <span className="font-medium truncate">{op.modelNameAr}</span>
                    <span className="text-gray-400 text-sm flex-shrink-0">{op.orderNumber}</span>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ms-2 ${STATUS_BADGE[op.status]}`}
                  >
                    {STATUS_LABEL[op.status].split(' / ')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event feed */}
        <div className="bg-gray-900 rounded-xl p-4 flex-1 min-h-0 flex flex-col">
          <h3 className="text-sm font-semibold text-gray-400 mb-3 flex-shrink-0">السجل / Log</h3>
          <div className="overflow-y-auto flex-1">
            {events.length === 0 ? (
              <p className="text-gray-600 text-sm">لا توجد أحداث / No events yet</p>
            ) : (
              <div className="space-y-1.5">
                {events.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-3 text-sm py-1">
                    <span className="text-gray-500 text-xs w-12 flex-shrink-0 font-mono">
                      {ev.occurredAt.slice(11, 16)}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${EVENT_BADGE[ev.eventType]}`}
                    >
                      {EVENT_LABEL[ev.eventType]}
                    </span>
                    <span className="text-gray-300 truncate">{ev.modelNameAr}</span>
                    {ev.operatorId && (
                      <span className="text-gray-500 text-xs flex-shrink-0">{ev.operatorId}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer nav */}
      <footer className="px-6 py-3 bg-gray-900 border-t border-gray-800 flex-shrink-0">
        {displayError && !active && (
          <div className="bg-red-900/50 border border-red-700 rounded-xl p-4 mb-3">
            <p className="text-red-200 text-base font-medium">
              ⚠ {displayError}
            </p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <Link href="/tablet" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            ← محطات العمل / Work Centers
          </Link>
          <button
            type="button"
            onClick={handleMaintenanceClick}
            disabled={isTransitionPending}
            className="text-xs text-amber-500 hover:text-amber-400 disabled:opacity-50 transition-colors font-medium"
          >
            ⚠ إبلاغ عن عطل / Report Maintenance
          </button>
        </div>
      </footer>
    </div>
  );
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Dialog } from '@/components/ui/Dialog';
import { StepForm } from './form';
import type { deleteStep, moveStep } from './actions';

type Step = {
  id: number;
  sequence: number;
  workCenterId: number;
  workCenterCode: string;
  workCenterNameEn: string;
  manTimeMinutes: number;
  machineTimeMinutes: number;
  setupTimeMinutes: number;
  mco: string | null;
};

type WorkCenter = { id: number; code: string; nameEn: string };

export function RoutingClient({
  modelId,
  modelCode,
  modelNameEn,
  steps,
  workCenters,
  onMove,
  onDelete,
}: {
  modelId: number;
  modelCode: string;
  modelNameEn: string;
  steps: Step[];
  workCenters: WorkCenter[];
  onMove: typeof moveStep;
  onDelete: typeof deleteStep;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; step?: Step }>({ open: false });
  const close = () => setDialog({ open: false });

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/routing"
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Routing
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-semibold text-gray-900">
          {modelCode} — {modelNameEn}
        </h1>
        <button
          onClick={() => setDialog({ open: true, step: undefined })}
          className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Add Step
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">Seq</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Work Center</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Man (min)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Machine (min)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Setup (min)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">MCO</th>
              <th className="px-4 py-3 w-36" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {steps.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                  No steps yet — click "+ Add Step" to define this model's routing
                </td>
              </tr>
            )}
            {steps.map((step, i) => (
              <tr key={step.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{step.sequence}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {step.workCenterCode} — {step.workCenterNameEn}
                </td>
                <td className="px-4 py-3 text-gray-700">{step.manTimeMinutes}</td>
                <td className="px-4 py-3 text-gray-700">{step.machineTimeMinutes}</td>
                <td className="px-4 py-3 text-gray-700">{step.setupTimeMinutes}</td>
                <td className="px-4 py-3 text-gray-500">{step.mco ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end items-center">
                    {/* Move up/down — one form, two named submit buttons */}
                    <form action={onMove} className="inline-flex">
                      <input type="hidden" name="id" value={step.id} />
                      <button
                        name="direction"
                        value="up"
                        type="submit"
                        disabled={i === 0}
                        className="px-1.5 py-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        name="direction"
                        value="down"
                        type="submit"
                        disabled={i === steps.length - 1}
                        className="px-1.5 py-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors"
                        title="Move down"
                      >
                        ↓
                      </button>
                    </form>

                    <button
                      onClick={() => setDialog({ open: true, step })}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Edit
                    </button>

                    <form action={onDelete} className="inline">
                      <input type="hidden" name="id" value={step.id} />
                      <input type="hidden" name="modelId" value={modelId} />
                      <button
                        type="submit"
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                        onClick={(e) => {
                          if (!confirm('Delete this step?')) e.preventDefault();
                        }}
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={dialog.open}
        onClose={close}
        title={dialog.step ? 'Edit Step' : 'Add Step'}
      >
        <StepForm
          key={dialog.step?.id ?? 'new'}
          modelId={modelId}
          step={dialog.step}
          workCenters={workCenters}
          onSuccess={close}
        />
      </Dialog>
    </div>
  );
}

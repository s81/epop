'use client';
import type { OperationStatus, OperationEventType } from '@/db/schema';
import type { applyEventAction } from './actions';

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
};
type EventItem = {
  id: number;
  eventType: OperationEventType;
  operatorId: string | null;
  occurredAt: string;
  modelNameAr: string;
  modelCode: string;
};

export function TabletClient(_props: {
  workCenter: WorkCenter;
  queue: QueueItem[];
  events: EventItem[];
  onAction: typeof applyEventAction;
}) {
  return <div>Tablet stub — replaced in Task 4</div>;
}

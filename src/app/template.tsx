'use client';

import RecordEditControls from '@/components/record-edit-controls';
import TaskCreateGuard from '@/components/task-create-guard';

export default function Template({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}<RecordEditControls /><TaskCreateGuard /></>;
}

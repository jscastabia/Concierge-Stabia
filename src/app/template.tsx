'use client';

import RecordEditControls from '@/components/record-edit-controls';
import TaskTools from '@/components/task-tools';
import AppEnhancements from '@/components/app-enhancements';

export default function Template({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}<RecordEditControls /><TaskTools /><AppEnhancements /></>;
}

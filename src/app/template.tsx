'use client';

import RecordEditControls from '@/components/record-edit-controls';

export default function Template({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}<RecordEditControls /></>;
}

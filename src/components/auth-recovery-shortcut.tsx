'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthRecoveryShortcut() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!supabase || window.location.pathname !== '/') return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (mounted) setShow(!data.session); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (mounted) setShow(!session); });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);
  if (!show) return null;
  return <Link className="auth-recovery-link" href="/recuperar-senha">Esqueci minha senha</Link>;
}

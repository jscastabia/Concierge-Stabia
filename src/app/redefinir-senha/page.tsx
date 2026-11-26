'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) { setError('A conexão com o Supabase não está configurada neste site.'); return; }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (mounted && data.session) setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted && (event === 'PASSWORD_RECOVERY' || session)) setReady(true);
    });
    const timer = window.setTimeout(() => {
      if (mounted && !window.location.hash.includes('access_token')) setError('O link não trouxe uma sessão de recuperação válida. Solicite um novo link e abra-o no mesmo navegador.');
    }, 1800);
    return () => { mounted = false; window.clearTimeout(timer); data.subscription.unsubscribe(); };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    if (password.length < 8) { setError('Use uma senha com pelo menos 8 caracteres.'); return; }
    if (password !== confirm) { setError('As senhas não são iguais.'); return; }
    if (!supabase || !ready) { setError('Sessão de recuperação ausente ou expirada. Solicite um novo link.'); return; }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) { setError(`Não foi possível atualizar a senha: ${updateError.message}`); return; }
    setNotice('Senha atualizada. Agora você pode voltar ao login e entrar com a nova senha.');
    await supabase.auth.signOut();
  }
  return <main className="auth-page"><section className="auth-card"><span className="eyebrow">CONCIERGE STABIA</span><h1>Definir nova senha</h1><p>Escolha uma senha segura para sua conta.</p>{notice && <div className="auth-notice" role="status">{notice}</div>}{error && <div className="auth-error" role="alert">{error}</div>}{ready && !notice && <form onSubmit={submit}><label>Nova senha<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label><label>Confirmar nova senha<input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={event => setConfirm(event.target.value)} /></label><button className="primary-btn" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar nova senha'}</button></form>}<p><Link href="/">Ir para o login</Link> · <Link href="/recuperar-senha">Solicitar outro link</Link></p></section></main>;
}

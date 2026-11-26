'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault(); setNotice(''); setError('');
    if (!supabase) { setError('A conexão com o Supabase não foi configurada neste deploy.'); return; }
    setBusy(true);
    const redirectTo = `${window.location.origin}/redefinir-senha`;
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setBusy(false);
    if (requestError) {
      setError(requestError.message.includes('redirect')
        ? 'O Supabase não permite este endereço de retorno. Em Authentication → URL Configuration, adicione a URL completa deste site seguida de /redefinir-senha aos Redirect URLs permitidos.'
        : `Não foi possível solicitar o e-mail: ${requestError.message}`);
      return;
    }
    setNotice('Se este e-mail estiver cadastrado, o Supabase enviará um link para redefinir a senha. Confira também a caixa de spam. Se a mensagem não chegar, verifique o SMTP e os limites de envio em Authentication → SMTP Settings.');
  }
  return <main className="auth-page"><section className="auth-card"><span className="eyebrow">CONCIERGE STABIA</span><h1>Recuperar senha</h1><p>Informe o e-mail cadastrado. Enviaremos um link para criar uma nova senha.</p>{notice && <div className="auth-notice" role="status">{notice}</div>}{error && <div className="auth-error" role="alert">{error}</div>}<form onSubmit={submit}><label>E-mail da conta<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@empresa.com.br"/></label><button className="primary-btn" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar link de recuperação'}</button></form><p><Link href="/">Voltar para o login</Link></p></section></main>;
}

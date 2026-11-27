'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import AgendaCalendar from '@/components/agenda-calendar';
import { Check, X } from 'lucide-react';

export default function AppEnhancements() {
  const [agendaHost, setAgendaHost] = useState<HTMLElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const previousPanel = useRef<HTMLElement | null>(null);
  const panelDisplay = useRef('');

  const syncNavigation = useCallback(() => {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.main-nav .nav-item'));
    const agendaButton = buttons.find(button => button.textContent?.trim().startsWith('Agenda'));
    const teamButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button => /^\s*Equipe\b/.test(button.textContent ?? ''));
    teamButton?.remove();

    const isAgenda = Boolean(agendaButton?.classList.contains('active'));
    const existingPanel = Array.from(document.querySelectorAll<HTMLElement>('.tasks-panel')).find(panel =>
      panel.textContent?.includes('Próximas atividades'),
    );
    if (isAgenda && existingPanel) {
      if (previousPanel.current !== existingPanel) {
        if (previousPanel.current) previousPanel.current.style.display = panelDisplay.current;
        previousPanel.current = existingPanel;
        panelDisplay.current = existingPanel.style.display;
      }
      existingPanel.style.display = 'none';
      setAgendaHost(existingPanel.parentElement);
    } else {
      if (previousPanel.current) previousPanel.current.style.display = panelDisplay.current;
      previousPanel.current = null;
      setAgendaHost(null);
    }

    const settingsButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button => /^\s*Configurações\b/.test(button.textContent ?? ''));
    if (settingsButton && !settingsButton.dataset.accountSettingsBound) {
      settingsButton.dataset.accountSettingsBound = 'true';
      settingsButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        void loadAccount();
      }, true);
    }
  }, []);

  async function loadAccount() {
    setError('');
    setNotice('');
    setNewPassword('');
    if (!supabase) {
      setError('O serviço de autenticação não está configurado.');
      setSettingsOpen(true);
      return;
    }
    const { data, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !data.user) {
      setError('Não foi possível carregar o perfil da conta. Entre novamente.');
      setSettingsOpen(true);
      return;
    }
    setDisplayName(String(data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? ''));
    setEmail(data.user.email ?? '');
    setSettingsOpen(true);
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError('');
    setNotice('');
    const attributes: { email?: string; password?: string; data?: Record<string, string> } = {
      data: { full_name: displayName.trim() },
    };
    if (email.trim()) attributes.email = email.trim();
    if (newPassword) attributes.password = newPassword;
    const { error: updateError } = await supabase.auth.updateUser(attributes);
    setSaving(false);
    if (updateError) {
      setError(updateError.message || 'Não foi possível atualizar o perfil.');
      return;
    }
    setNewPassword('');
    setNotice(attributes.email ? 'Perfil atualizado. A alteração do e-mail pode exigir confirmação pelo e-mail recebido.' : 'Perfil atualizado com sucesso.');
  }

  useEffect(() => {
    syncNavigation();
    const observer = new MutationObserver(syncNavigation);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => {
      observer.disconnect();
      if (previousPanel.current) previousPanel.current.style.display = panelDisplay.current;
    };
  }, [syncNavigation]);

  return <>
    {agendaHost && createPortal(<div className="agenda-calendar-mount"><AgendaCalendar /></div>, agendaHost)}
    {settingsOpen && <div className="account-settings-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setSettingsOpen(false); }}>
      <section className="account-settings-modal" role="dialog" aria-modal="true" aria-labelledby="account-settings-title">
        <header className="account-settings-head"><div><span className="eyebrow">PERFIL DA CONTA</span><h2 id="account-settings-title">Configurações</h2></div><button type="button" className="icon-btn" aria-label="Fechar configurações" onClick={() => setSettingsOpen(false)}><X size={17}/></button></header>
        <form className="account-settings-form" onSubmit={event => void saveAccount(event)}>
          <label>Nome exibido<input value={displayName} onChange={event => setDisplayName(event.target.value)} autoComplete="name" /></label>
          <label>E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Nova senha <span>(deixe em branco para manter a atual)</span><input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} placeholder="Mínimo de 8 caracteres" /></label>
          {error && <p className="account-settings-error" role="alert">{error}</p>}
          {notice && <p className="account-settings-notice" role="status"><Check size={15}/>{notice}</p>}
          <footer><button type="button" className="secondary-btn" onClick={() => setSettingsOpen(false)} disabled={saving}>Fechar</button><button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Salvando…' : 'Salvar perfil'}</button></footer>
        </form>
      </section>
    </div>}
    <style>{`
      .agenda-calendar-mount{margin-top:18px}
      .agenda-calendar{padding:22px;border:1px solid #e8ebf2;border-radius:14px;background:#fff}
      .calendar-toolbar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:20px}
      .calendar-toolbar h2{margin:7px 0 4px;font-size:22px}.calendar-toolbar p{margin:0;color:#788398;font-size:13px}
      .calendar-navigation{display:flex;align-items:center;gap:10px}.calendar-navigation strong{min-width:150px;text-align:center;text-transform:capitalize}
      .calendar-navigation .icon-btn{display:grid;place-items:center;width:34px;height:34px;border:1px solid #e8ebf2;border-radius:8px;background:#fff;color:#5146e5}
      .calendar-navigation .secondary-btn{min-height:34px;padding:0 12px;border:1px solid #e8ebf2;border-radius:8px;background:#fff;color:#475268}
      .calendar-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:18px}
      .calendar-weekdays,.calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
      .calendar-weekdays{margin-bottom:7px}.calendar-weekdays span{text-align:center;color:#788398;font-size:11px;font-weight:700;padding:8px}
      .calendar-day{position:relative;display:flex;min-width:0;min-height:95px;flex-direction:column;align-items:flex-start;gap:6px;padding:8px;border:1px solid #edf0f5;border-right:0;border-bottom:0;background:#fff;text-align:left;color:#172033}
      .calendar-day:nth-child(7n){border-right:1px solid #edf0f5}.calendar-day:nth-last-child(-n+7){border-bottom:1px solid #edf0f5}
      .calendar-day:hover,.calendar-day.selected{background:#f5f4ff}.calendar-day.outside{background:#fafbfc;color:#aab2c0}.calendar-day.today .calendar-day-number{display:grid;width:24px;height:24px;place-items:center;border-radius:50%;background:#5146e5;color:#fff}
      .calendar-day-number{font-size:12px;font-weight:700}.calendar-dots{display:flex;align-items:center;gap:4px}.calendar-dots i,.calendar-legend i{width:7px;height:7px;border-radius:50%}.trip-dot{background:#5146e5}.task-dot{background:#f59e0b}.calendar-dots small{font-size:9px;color:#788398}
      .calendar-day-events{display:grid;width:100%;gap:3px;overflow:hidden}.calendar-day-events small{overflow:hidden;padding:3px 4px;border-radius:4px;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.trip-event{background:#eeedff;color:#5146e5}.task-event{background:#fff5df;color:#a45b00}
      .calendar-sidebar{min-height:400px;padding:14px;border:1px solid #edf0f5;border-radius:11px;background:#fcfcfe}.calendar-selected-heading{display:flex;align-items:center;gap:10px;padding-bottom:13px;border-bottom:1px solid #edf0f5;color:#5146e5}.calendar-selected-heading div{display:grid;gap:4px}.calendar-selected-heading b{text-transform:capitalize;color:#172033;font-size:13px}.calendar-selected-heading small,.calendar-event-card small{color:#788398;font-size:11px}
      .calendar-empty{padding:20px 5px;color:#788398;font-size:12px}.calendar-events-list{display:grid;gap:9px;margin-top:12px}.calendar-event-card{display:grid;gap:6px;padding:11px;border:1px solid #e8ebf2;border-radius:9px;background:#fff}.calendar-event-card>b{font-size:12px}.calendar-event-time{color:#5146e5;font-size:10px;font-weight:700}.calendar-event-actions{display:flex;justify-content:flex-end}.calendar-event-actions button{display:inline-flex;align-items:center;gap:3px;border:0;background:transparent;color:#5146e5;font-size:11px;font-weight:700}
      .calendar-legend{display:flex;gap:16px;margin-top:18px;padding-top:12px;border-top:1px solid #edf0f5}.calendar-legend span{display:flex;align-items:center;gap:6px;color:#788398;font-size:10px}.calendar-error{color:#b91c1c;font-size:12px}
      .account-settings-overlay{position:fixed;z-index:200;inset:0;display:grid;place-items:center;padding:18px;background:#1820387a;backdrop-filter:blur(3px)}.account-settings-modal{width:min(100%,480px);overflow:hidden;border:1px solid #e8ebf2;border-radius:16px;background:#fff;box-shadow:0 24px 70px #26325225}.account-settings-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #edf0f5}.account-settings-head h2{margin:6px 0 0;font-size:20px}.account-settings-form{display:grid;gap:15px;padding:20px}.account-settings-form label{display:grid;gap:7px;color:#475268;font-size:12px;font-weight:700}.account-settings-form label span{font-weight:400;color:#788398}.account-settings-form input{width:100%;min-height:40px;padding:9px 11px;border:1px solid #dfe3ec;border-radius:9px;background:#fff}.account-settings-form footer{display:flex;justify-content:flex-end;gap:9px;padding-top:13px;border-top:1px solid #edf0f5}.account-settings-error{margin:0;color:#b91c1c;font-size:12px}.account-settings-notice{display:flex;align-items:center;gap:7px;margin:0;color:#15803d;font-size:12px}
      @media(max-width:900px){.calendar-layout{grid-template-columns:1fr}.calendar-sidebar{min-height:0}.calendar-day{min-height:75px;padding:5px}.calendar-day-events small{font-size:8px}}
      @media(max-width:600px){.agenda-calendar{padding:12px}.calendar-toolbar{align-items:flex-start;flex-direction:column}.calendar-navigation{width:100%;justify-content:space-between}.calendar-navigation strong{min-width:0}.calendar-weekdays span{padding:5px 1px;font-size:9px}.calendar-day{min-height:64px;padding:4px}.calendar-day-events small{font-size:7px}.calendar-layout{gap:12px}}
    `}</style>
  </>;
}

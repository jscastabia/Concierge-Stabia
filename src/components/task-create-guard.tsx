'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** Reliable capture-phase handler for the task-creation form, with visible errors. */
export default function TaskCreateGuard() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    const handleSubmit = async (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.querySelector('[name="title"]')) return;
      // Only handle the task-creation form; the trip form uses passenger_name.
      if (!form.querySelector('[name="priority"]') || !form.querySelector('[name="due_date"]')) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      if (busy) return;

      const { data: sessionData, error: sessionError } = await supabase!.auth.getSession();
      const user = sessionData.session?.user;
      if (sessionError || !user) {
        setMessage('Sua sessão expirou. Entre novamente para criar a tarefa.');
        return;
      }

      const formData = new FormData(form);
      const title = String(formData.get('title') ?? '').trim();
      if (!title) {
        setMessage('Informe o título da tarefa.');
        return;
      }

      setBusy(true);
      setMessage('Salvando tarefa…');
      try {
        const { error } = await supabase!.from('tasks').insert({
          owner_id: user.id,
          trip_id: String(formData.get('trip_id') ?? '') || null,
          title,
          description: String(formData.get('description') ?? '').trim() || null,
          due_date: String(formData.get('due_date') ?? '') || null,
          due_time: String(formData.get('due_time') ?? '') || null,
          priority: String(formData.get('priority') ?? 'medium'),
          status: 'pending',
        });

        if (error) {
          console.error('Task creation failed:', error);
          setMessage('Não foi possível salvar a tarefa. Confira sua conexão e as permissões do Supabase.');
          setBusy(false);
          return;
        }

        setMessage('Tarefa adicionada à sua agenda.');
        window.setTimeout(() => window.location.reload(), 500);
      } catch (error) {
        console.error('Unexpected task creation error:', error);
        setMessage('Ocorreu um erro ao salvar a tarefa. Tente novamente.');
        setBusy(false);
      }
    };

    document.addEventListener('submit', handleSubmit, true);
    return () => document.removeEventListener('submit', handleSubmit, true);
  }, [busy]);

  if (!message) return null;
  return <div role="status" style={{ position: 'fixed', zIndex: 150, right: 20, bottom: 20, maxWidth: 430, padding: '12px 15px', border: '1px solid #e0ddff', borderRadius: 10, background: '#fff', color: '#334155', boxShadow: '0 12px 35px #0f172a22', fontSize: 13 }}>
    {message}
  </div>;
}

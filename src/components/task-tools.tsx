'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2 } from 'lucide-react';

type TaskRecord = { id: string; owner_id: string; title: string; trip_id: string | null };
type TripRecord = { id: string; passenger_name: string; destination: string };

/** Keeps task actions wired to the existing UI and reports database errors visibly. */
export default function TaskTools() {
  const [userId, setUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const tasksRef = useRef<TaskRecord[]>([]);
  const tripsRef = useRef<TripRecord[]>([]);
  const tripForNextTaskRef = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    const load = async (id: string | null) => {
      setUserId(id);
      tasksRef.current = [];
      tripsRef.current = [];
      if (!id) return;
      const [tasksResult, tripsResult] = await Promise.all([
        supabase!.from('tasks').select('id,owner_id,title,trip_id').eq('owner_id', id),
        supabase!.from('trips').select('id,passenger_name,destination').eq('owner_id', id),
      ]);
      if (!mounted) return;
      if (!tasksResult.error) tasksRef.current = (tasksResult.data ?? []) as TaskRecord[];
      if (!tripsResult.error) tripsRef.current = (tripsResult.data ?? []) as TripRecord[];
    };

    supabase.auth.getSession().then(({ data }) => void load(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => void load(session?.user.id ?? null));
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let scheduled = false;

    const handleTripTaskButton = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLButtonElement>('.trip-detail button');
      if (!button || !button.textContent?.includes('Nova tarefa')) return;
      const detail = button.closest('.trip-detail');
      if (!detail) return;
      const text = detail.textContent ?? '';
      const matches = tripsRef.current.filter(trip =>
        text.includes(trip.passenger_name) && text.includes(trip.destination),
      );
      tripForNextTaskRef.current = matches.length === 1 ? matches[0].id : null;
      window.setTimeout(() => {
        const select = document.querySelector<HTMLSelectElement>('.overlay form.form-grid select[name="trip_id"]');
        if (select && tripForNextTaskRef.current) {
          select.value = tripForNextTaskRef.current;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, 0);
    };

    const decorate = () => {
      scheduled = false;
      document.querySelectorAll<HTMLElement>('.trip-task, .task-row').forEach(row => {
        if (row.querySelector('.task-delete-control')) return;
        const isTripTask = row.classList.contains('trip-task');
        const title = row.querySelector(isTripTask ? '.trip-task-info b' : '.task-row-main b')?.textContent?.trim();
        if (!title) return;
        let matches = tasksRef.current.filter(task => task.title === title);
        const text = row.textContent ?? '';
        if (matches.length > 1) {
          matches = matches.filter(task => {
            if (!task.trip_id) return text.includes('Atividade geral');
            const trip = tripsRef.current.find(item => item.id === task.trip_id);
            return Boolean(trip && text.includes(trip.passenger_name));
          });
        }
        if (matches.length > 1) {
          matches = matches.filter(task => task.trip_id === null ? text.includes('Atividade geral') : true);
        }
        if (matches.length !== 1) return;
        const task = matches[0];

        // For unlinked tasks, the existing chevron opens the task editor instead of doing nothing.
        if (!task.trip_id) {
          const chevron = row.querySelector<HTMLButtonElement>('.icon-btn');
          const editButton = row.querySelector<HTMLButtonElement>('.record-edit-control');
          if (chevron && editButton && !chevron.dataset.taskFallback) {
            chevron.dataset.taskFallback = 'true';
            chevron.addEventListener('click', event => {
              event.preventDefault();
              event.stopPropagation();
              editButton.click();
            }, true);
          }
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'task-delete-control';
        button.dataset.taskId = task.id;
        button.title = 'Excluir tarefa';
        button.setAttribute('aria-label', `Excluir tarefa ${task.title}`);
        button.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:30px;height:30px;margin:4px;border:1px solid #fee2e2;border-radius:8px;background:#fff;color:#dc2626;cursor:pointer';
        button.append('×');
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          void deleteTask(task);
        });
        row.appendChild(button);
      });

      const taskForm = document.querySelector<HTMLFormElement>('.overlay form.form-grid');
      const taskSelect = taskForm?.querySelector<HTMLSelectElement>('select[name="trip_id"]');
      if (taskSelect && tripForNextTaskRef.current && taskSelect.value !== tripForNextTaskRef.current) {
        taskSelect.value = tripForNextTaskRef.current;
        taskSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(decorate);
    };
    document.addEventListener('click', handleTripTaskButton, true);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    return () => {
      document.removeEventListener('click', handleTripTaskButton, true);
      observer.disconnect();
    };
  }, [userId]);

  async function deleteTask(task: TaskRecord) {
    if (!supabase || !userId || busy) return;
    if (!window.confirm(`Excluir a tarefa “${task.title}”? Esta ação não pode ser desfeita.`)) return;
    setBusy(true);
    setNotice('');
    setError('');
    const { data, error: deleteError } = await supabase.from('tasks')
      .delete().eq('id', task.id).eq('owner_id', userId).select('id').maybeSingle();
    setBusy(false);
    if (deleteError || !data) {
      console.error('Task deletion failed:', deleteError);
      setError('Não foi possível excluir a tarefa. Se ela tiver anexos, exclua os anexos primeiro.');
      return;
    }
    tasksRef.current = tasksRef.current.filter(item => item.id !== task.id);
    setNotice('Tarefa excluída.');
    window.setTimeout(() => window.location.reload(), 500);
  }

  if (!notice && !error) return null;
  return <div role={error ? 'alert' : 'status'} style={{ position: 'fixed', zIndex: 160, right: 20, bottom: 20, maxWidth: 430, display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', border: `1px solid ${error ? '#fecaca' : '#bbf7d0'}`, borderRadius: 10, background: '#fff', color: error ? '#b91c1c' : '#166534', boxShadow: '0 12px 35px #0f172a22', fontSize: 13 }}>
    <Trash2 size={16}/><span>{busy ? 'Excluindo tarefa…' : error || notice}</span>
    <button type="button" onClick={() => { setError(''); setNotice(''); }} aria-label="Fechar aviso" style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>×</button>
  </div>;
}

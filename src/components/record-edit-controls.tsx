'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Pencil, X } from 'lucide-react';

type TripRow = {
  id: string;
  passenger_name: string;
  company: string | null;
  secretary: string | null;
  destination: string;
  country: string | null;
  departure_date: string;
  return_date: string;
  airline: string | null;
  notes: string | null;
};
type TaskRow = {
  id: string;
  trip_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'not_started' | 'pending' | 'in_progress' | 'completed' | 'overdue';
};
type RecordToEdit = { kind: 'trip'; row: TripRow } | { kind: 'task'; row: TaskRow };
type FormValues = Record<string, string>;

const inputStyle: React.CSSProperties = {
  width: '100%', minHeight: 40, padding: '9px 11px', border: '1px solid #dfe3ec',
  borderRadius: 9, background: '#fff', color: '#172033', fontSize: 13,
};
const labelStyle: React.CSSProperties = {
  display: 'grid', gap: 6, color: '#475268', fontSize: 12, fontWeight: 700,
};
const primaryButtonStyle: React.CSSProperties = {
  minHeight: 40, padding: '0 15px', border: 0, borderRadius: 9,
  background: '#5146e5', color: '#fff', fontSize: 12, fontWeight: 700,
};

/** Adds editing controls to trip cards and task rows without replacing the existing page. */
export default function RecordEditControls() {
  const [userId, setUserId] = useState<string | null>(null);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [editing, setEditing] = useState<RecordToEdit | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const tripsRef = useRef<TripRow[]>([]);
  const tasksRef = useRef<TaskRow[]>([]);

  const loadRecords = useCallback(async (id: string | null) => {
    setUserId(id);
    tripsRef.current = [];
    tasksRef.current = [];
    setTrips([]);
    setTasks([]);
    if (!id || !supabase) return;

    const [tripResult, taskResult] = await Promise.all([
      supabase.from('trips').select('*').eq('owner_id', id),
      supabase.from('tasks').select('*').eq('owner_id', id),
    ]);
    const nextTrips = (tripResult.data ?? []) as TripRow[];
    const nextTasks = (taskResult.data ?? []) as TaskRow[];
    tripsRef.current = nextTrips;
    tasksRef.current = nextTasks;
    setTrips(nextTrips);
    setTasks(nextTasks);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const load = async (id: string | null) => {
      if (!mounted) return;
      await loadRecords(id);
    };
    supabase.auth.getSession().then(({ data }) => {
      void load(data.session?.user.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void load(session?.user.id ?? null);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [loadRecords]);

  useEffect(() => {
    if (!userId || (!trips.length && !tasks.length)) return;
    let scheduled = false;

    const insertButton = (host: HTMLElement, record: RecordToEdit) => {
      if (host.querySelector(`[data-edit-record-id="${record.row.id}"]`)) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'record-edit-control';
      button.dataset.editRecordId = record.row.id;
      button.setAttribute('aria-label', record.kind === 'trip' ? 'Editar informações da viagem' : 'Editar tarefa');
      button.title = record.kind === 'trip' ? 'Editar viagem' : 'Editar tarefa';
      button.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:30px;margin:4px;padding:0 9px;border:1px solid #e0ddff;border-radius:8px;background:#fff;color:#5146e5;font-size:11px;font-weight:600;cursor:pointer';
      button.append(document.createTextNode('Editar'));
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        setError('');
        setNotice('');
        if (record.kind === 'trip') {
          setValues({
            passenger_name: record.row.passenger_name ?? '', company: record.row.company ?? '',
            secretary: record.row.secretary ?? '', destination: record.row.destination ?? '',
            country: record.row.country ?? '', departure_date: record.row.departure_date ?? '',
            return_date: record.row.return_date ?? '', airline: record.row.airline ?? '', notes: record.row.notes ?? '',
          });
        } else {
          setValues({
            trip_id: record.row.trip_id ?? '', title: record.row.title ?? '',
            description: record.row.description ?? '', category: record.row.category ?? '',
            due_date: record.row.due_date ?? '', due_time: record.row.due_time?.slice(0, 5) ?? '',
            priority: record.row.priority ?? 'medium', status: record.row.status ?? 'pending',
          });
        }
        setEditing(record);
      });
      host.appendChild(button);
    };

    const decorate = () => {
      scheduled = false;
      const allTrips = tripsRef.current;
      const allTasks = tasksRef.current;

      document.querySelectorAll<HTMLElement>('.trip-card, .trip-detail').forEach(card => {
        const text = card.textContent ?? '';
        const matches = allTrips.filter(trip =>
          text.includes(trip.passenger_name) && text.includes(trip.destination),
        );
        if (matches.length !== 1) return;
        const target = card.classList.contains('trip-card')
          ? card.querySelector<HTMLElement>('.trip-card-top') ?? card
          : card;
        insertButton(target, { kind: 'trip', row: matches[0] });
      });

      document.querySelectorAll<HTMLElement>('.trip-task, .task-row').forEach(taskElement => {
        const title = taskElement.classList.contains('trip-task')
          ? taskElement.querySelector('.trip-task-info b')?.textContent?.trim()
          : taskElement.querySelector('.task-row-main b')?.textContent?.trim();
        if (!title) return;
        let matches = allTasks.filter(task => task.title === title);
        const visibleText = taskElement.textContent ?? '';
        if (matches.length > 1) {
          matches = matches.filter(task => {
            if (!task.trip_id) return visibleText.includes('Atividade geral');
            const trip = allTrips.find(item => item.id === task.trip_id);
            return Boolean(trip && visibleText.includes(trip.passenger_name));
          });
        }
        if (matches.length > 1) {
          matches = matches.filter(task => {
            if (!task.due_date) return visibleText.includes('Sem prazo');
            const date = new Intl.DateTimeFormat('pt-BR', {
              timeZone: 'UTC', day: '2-digit', month: 'short',
            }).format(new Date(`${task.due_date}T12:00:00Z`));
            return visibleText.toLocaleLowerCase('pt-BR').includes(date.toLocaleLowerCase('pt-BR'));
          });
        }
        if (matches.length !== 1) return;
        insertButton(taskElement, { kind: 'task', row: matches[0] });
      });
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(decorate);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    return () => observer.disconnect();
  }, [userId, trips.length, tasks.length]);

  function updateField(key: string, value: string) {
    setValues(current => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userId || !editing) return;
    setBusy(true);
    setError('');

    const table = editing.kind === 'trip' ? 'trips' : 'tasks';
    const payload = editing.kind === 'trip'
      ? {
          passenger_name: values.passenger_name.trim(),
          company: values.company.trim() || null,
          secretary: values.secretary.trim() || null,
          destination: values.destination.trim(),
          country: values.country.trim() || null,
          departure_date: values.departure_date,
          return_date: values.return_date,
          airline: values.airline.trim() || null,
          notes: values.notes.trim() || null,
          updated_at: new Date().toISOString(),
        }
      : {
          trip_id: values.trip_id || null,
          title: values.title.trim(),
          description: values.description.trim() || null,
          category: values.category.trim() || null,
          due_date: values.due_date || null,
          due_time: values.due_time || null,
          priority: values.priority,
          status: values.status,
          completed_at: values.status === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        };

    const { data, error: saveError } = await supabase.from(table)
      .update(payload)
      .eq('id', editing.row.id)
      .eq('owner_id', userId)
      .select('id')
      .maybeSingle();

    setBusy(false);
    if (saveError || !data) {
      setError(editing.kind === 'trip'
        ? 'Não foi possível salvar as alterações. Confira se a data de retorno é igual ou posterior à data de ida.'
        : 'Não foi possível salvar as alterações da tarefa. Confira os campos e tente novamente.');
      return;
    }

    setEditing(null);
    setNotice(editing.kind === 'trip' ? 'Informações da viagem atualizadas.' : 'Tarefa atualizada.');
    window.setTimeout(() => window.location.reload(), 700);
  }

  const close = () => {
    if (busy) return;
    setEditing(null);
    setError('');
  };

  if (!editing && !notice) return null;

  return <>
    {editing && <div onMouseDown={event => { if (event.target === event.currentTarget) close(); }} style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'grid', placeItems: 'center', overflowY: 'auto', padding: 18, background: '#0f172a88' }}>
      <section role="dialog" aria-modal="true" aria-labelledby="record-edit-title" style={{ width: 'min(100%, 620px)', maxHeight: '92vh', overflowY: 'auto', border: '1px solid #e8ebf2', borderRadius: 18, background: '#fff', boxShadow: '0 24px 70px #0f172a33' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '17px 20px', borderBottom: '1px solid #edf0f5', background: '#fff' }}>
          <div><span style={{ color: '#5146e5', fontSize: 10, fontWeight: 800, letterSpacing: '.13em' }}>CONCIERGE STABIA</span><h2 id="record-edit-title" style={{ margin: '5px 0 0', color: '#172033', fontSize: 18 }}>{editing.kind === 'trip' ? 'Editar informações da viagem' : 'Editar tarefa'}</h2></div>
          <button type="button" onClick={close} disabled={busy} aria-label="Fechar edição" style={{ display: 'grid', width: 34, height: 34, placeItems: 'center', border: 0, borderRadius: 8, background: '#f1f3f8', color: '#64748b', cursor: 'pointer' }}><X size={17}/></button>
        </header>
        <form onSubmit={event => void save(event)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, padding: 20 }}>
          {editing.kind === 'trip' ? <>
            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>Passageiro *<input style={inputStyle} value={values.passenger_name ?? ''} onChange={event => updateField('passenger_name', event.target.value)} required /></label>
            <label style={labelStyle}>Empresa<input style={inputStyle} value={values.company ?? ''} onChange={event => updateField('company', event.target.value)} /></label>
            <label style={labelStyle}>Secretaria responsável<input style={inputStyle} value={values.secretary ?? ''} onChange={event => updateField('secretary', event.target.value)} /></label>
            <label style={labelStyle}>Destino *<input style={inputStyle} value={values.destination ?? ''} onChange={event => updateField('destination', event.target.value)} required /></label>
            <label style={labelStyle}>País<input style={inputStyle} value={values.country ?? ''} onChange={event => updateField('country', event.target.value)} /></label>
            <label style={labelStyle}>Data de ida *<input style={inputStyle} type="date" value={values.departure_date ?? ''} onChange={event => updateField('departure_date', event.target.value)} required /></label>
            <label style={labelStyle}>Data de retorno *<input style={inputStyle} type="date" value={values.return_date ?? ''} min={values.departure_date} onChange={event => updateField('return_date', event.target.value)} required /></label>
            <label style={labelStyle}>Companhia aérea<input style={inputStyle} value={values.airline ?? ''} onChange={event => updateField('airline', event.target.value)} /></label>
            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>Observações<textarea style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }} value={values.notes ?? ''} onChange={event => updateField('notes', event.target.value)} /></label>
          </> : <>
            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>Título *<input style={inputStyle} value={values.title ?? ''} onChange={event => updateField('title', event.target.value)} required /></label>
            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>Viagem relacionada<select style={inputStyle} value={values.trip_id ?? ''} onChange={event => updateField('trip_id', event.target.value)}><option value="">Atividade geral</option>{trips.map(trip => <option key={trip.id} value={trip.id}>{trip.passenger_name} · {trip.destination}</option>)}</select></label>
            <label style={labelStyle}>Categoria<input style={inputStyle} value={values.category ?? ''} onChange={event => updateField('category', event.target.value)} /></label>
            <label style={labelStyle}>Prioridade<select style={inputStyle} value={values.priority ?? 'medium'} onChange={event => updateField('priority', event.target.value)}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></label>
            <label style={labelStyle}>Data limite<input style={inputStyle} type="date" value={values.due_date ?? ''} onChange={event => updateField('due_date', event.target.value)} /></label>
            <label style={labelStyle}>Horário<input style={inputStyle} type="time" value={values.due_time ?? ''} onChange={event => updateField('due_time', event.target.value)} /></label>
            <label style={labelStyle}>Status<select style={inputStyle} value={values.status ?? 'pending'} onChange={event => updateField('status', event.target.value)}><option value="not_started">Não iniciada</option><option value="pending">Pendente</option><option value="in_progress">Em andamento</option><option value="completed">Concluída</option><option value="overdue">Atrasada</option></select></label>
            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>Descrição<textarea style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }} value={values.description ?? ''} onChange={event => updateField('description', event.target.value)} /></label>
          </>}
          {error && <p role="alert" style={{ gridColumn: '1 / -1', margin: 0, color: '#b91c1c', fontSize: 12 }}>{error}</p>}
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 9, paddingTop: 12, borderTop: '1px solid #edf0f5' }}>
            <button type="button" onClick={close} disabled={busy} style={{ minHeight: 40, padding: '0 14px', border: '1px solid #dfe3ec', borderRadius: 9, background: '#fff', color: '#475268', fontSize: 12, fontWeight: 600 }}>Cancelar</button>
            <button type="submit" disabled={busy} style={{ ...primaryButtonStyle, opacity: busy ? .65 : 1 }}>{busy ? 'Salvando…' : 'Salvar alterações'}</button>
          </div>
        </form>
      </section>
    </div>}
    {notice && <div role="status" style={{ position: 'fixed', zIndex: 120, right: 20, bottom: 20, padding: '12px 15px', border: '1px solid #bbf7d0', borderRadius: 10, background: '#f0fdf4', color: '#166534', fontSize: 13 }}>{notice}</div>}
  </>;
}

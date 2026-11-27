'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

type TaskRecord = { id: string; owner_id: string; title: string; trip_id: string | null; due_date: string | null; due_time: string | null; status: string };
type TripRecord = { id: string; owner_id: string; passenger_name: string; destination: string; departure_date: string; return_date: string };
type CalendarItem = { key: string; kind: 'task' | 'trip'; title: string; detail: string; date: string; time: string; status: string; tripId?: string; taskId?: string };

const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const monthLabel = (date: Date) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function AgendaCalendar() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const tasksRef = useRef<TaskRecord[]>([]);
  const tripsRef = useRef<TripRecord[]>([]);
  const userRef = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const load = async (id: string | null) => {
      userRef.current = id;
      setUserId(id);
      setTasks([]);
      setTrips([]);
      tasksRef.current = [];
      tripsRef.current = [];
      if (!id) return;
      setLoading(true);
      const [taskResult, tripResult] = await Promise.all([
        supabase!.from('tasks').select('id,owner_id,title,trip_id,due_date,due_time,status').eq('owner_id', id),
        supabase!.from('trips').select('id,owner_id,passenger_name,destination,departure_date,return_date').eq('owner_id', id),
      ]);
      if (!mounted || userRef.current !== id) return;
      if (taskResult.error || tripResult.error) setError('Não foi possível carregar todos os eventos da agenda.');
      const nextTasks = (taskResult.data ?? []) as TaskRecord[];
      const nextTrips = (tripResult.data ?? []) as TripRecord[];
      tasksRef.current = nextTasks;
      tripsRef.current = nextTrips;
      setTasks(nextTasks);
      setTrips(nextTrips);
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => void load(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => void load(session?.user.id ?? null));
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  const items = useMemo<CalendarItem[]>(() => {
    const result: CalendarItem[] = [];
    tasks.forEach(task => {
      if (!task.due_date) return;
      const trip = trips.find(item => item.id === task.trip_id);
      result.push({
        key: `task-${task.id}`, kind: 'task', title: task.title,
        detail: trip ? `${trip.passenger_name} · ${trip.destination}` : 'Atividade geral',
        date: task.due_date.slice(0, 10), time: task.due_time?.slice(0, 5) ?? '', status: task.status,
        tripId: task.trip_id ?? undefined, taskId: task.id,
      });
    });
    trips.forEach(trip => {
      result.push({ key: `departure-${trip.id}`, kind: 'trip', title: `Embarque · ${trip.passenger_name}`, detail: trip.destination, date: trip.departure_date.slice(0, 10), time: '', status: 'travel', tripId: trip.id });
      result.push({ key: `return-${trip.id}`, kind: 'trip', title: `Retorno · ${trip.passenger_name}`, detail: trip.destination, date: trip.return_date.slice(0, 10), time: '', status: 'travel', tripId: trip.id });
    });
    return result;
  }, [tasks, trips]);

  const monthCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      return { date, key: dateKey(date), inMonth: date.getMonth() === month.getMonth() };
    });
  }, [month]);

  const selectedItems = useMemo(() => items.filter(item => item.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time)), [items, selectedDate]);

  function openTrip(tripId?: string) {
    if (!tripId) return;
    const trip = tripsRef.current.find(item => item.id === tripId);
    if (!trip) return;
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.trip-card .card-main, .trip-card .card-open'));
    const button = buttons.find(item => {
      const text = item.textContent ?? '';
      return text.includes(trip.passenger_name) && text.includes(trip.destination);
    });
    if (button) button.click();
    else {
      const search = document.querySelector<HTMLInputElement>('.global-search input');
      if (search) {
        search.value = trip.passenger_name;
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.querySelector<HTMLButtonElement>('.main-nav .nav-item:nth-child(2)')?.click();
      window.setTimeout(() => {
        const card = Array.from(document.querySelectorAll<HTMLElement>('.trip-card')).find(element => {
          const text = element.textContent ?? '';
          return text.includes(trip.passenger_name) && text.includes(trip.destination);
        });
        card?.querySelector<HTMLButtonElement>('.card-main, .card-open')?.click();
      }, 100);
    }
  }

  function openTask(taskId?: string) {
    if (!taskId) return;
    const edit = document.querySelector<HTMLButtonElement>(`[data-edit-record-id="${CSS.escape(taskId)}"]`);
    edit?.click();
  }

  const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  if (!userId && !loading) return <section className="panel agenda-calendar"><p>Entre para visualizar sua agenda.</p></section>;

  return <section className="panel agenda-calendar">
    <header className="calendar-toolbar">
      <div><span className="eyebrow">AGENDA OPERACIONAL</span><h2>Calendário</h2><p>Viagens, embarques, retornos e tarefas com prazo.</p></div>
      <div className="calendar-navigation">
        <button type="button" className="icon-btn" aria-label="Mês anterior" onClick={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ChevronLeft size={17}/></button>
        <strong>{monthLabel(month)}</strong>
        <button type="button" className="icon-btn" aria-label="Próximo mês" onClick={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight size={17}/></button>
        <button type="button" className="secondary-btn small" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(todayKey()); }}>Hoje</button>
      </div>
    </header>
    {error && <p role="alert" className="calendar-error">{error}</p>}
    <div className="calendar-layout">
      <div className="calendar-main">
        <div className="calendar-weekdays">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {monthCells.map(cell => {
            const dayItems = items.filter(item => item.date === cell.key);
            return <button type="button" key={cell.key} onClick={() => setSelectedDate(cell.key)} className={`calendar-day${cell.inMonth ? '' : ' outside'}${cell.key === todayKey() ? ' today' : ''}${cell.key === selectedDate ? ' selected' : ''}`} aria-label={`${cell.key}, ${dayItems.length} eventos`}>
              <span className="calendar-day-number">{cell.date.getDate()}</span>
              <span className="calendar-dots">{dayItems.slice(0, 3).map(item => <i key={item.key} className={item.kind === 'task' ? 'task-dot' : 'trip-dot'} />)}{dayItems.length > 3 && <small>+{dayItems.length - 3}</small>}</span>
              <span className="calendar-day-events">{dayItems.slice(0, 2).map(item => <small key={item.key} className={item.kind === 'task' ? 'task-event' : 'trip-event'}>{item.title}</small>)}</span>
            </button>;
          })}
        </div>
      </div>
      <aside className="calendar-sidebar">
        <div className="calendar-selected-heading"><CalendarDays size={18}/><div><b>{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${selectedDate}T12:00:00`))}</b><small>{selectedItems.length} evento(s)</small></div></div>
        {loading ? <p className="calendar-empty">Carregando agenda…</p> : selectedItems.length === 0 ? <p className="calendar-empty">Nenhum evento nesta data.</p> : <div className="calendar-events-list">{selectedItems.map(item => <article key={item.key} className={`calendar-event-card ${item.kind}`}><span className="calendar-event-time">{item.time || (item.kind === 'trip' ? 'Viagem' : 'Sem horário')}</span><b>{item.title}</b><small>{item.detail}</small><div className="calendar-event-actions"><button type="button" className="text-action" onClick={() => item.kind === 'trip' ? openTrip(item.tripId) : item.tripId ? openTrip(item.tripId) : openTask(item.taskId)}>{item.kind === 'trip' || item.tripId ? 'Abrir viagem' : 'Editar tarefa'} <ChevronRight size={14}/></button></div></article>)}</div>}
        <div className="calendar-legend"><span><i className="trip-dot"/>Viagens</span><span><i className="task-dot"/>Tarefas</span></div>
      </aside>
    </div>
  </section>;
}

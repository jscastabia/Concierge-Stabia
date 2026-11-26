'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Activity, AlertCircle, ArrowLeft, ArrowUpRight, CalendarDays, Check, CheckCheck, Clock3, FileText, Hotel, MapPin, Paperclip, Plane, Plus, Search, ShieldCheck, Trash2, UploadCloud, Users, X } from 'lucide-react';

type Tab = 'overview' | 'flights' | 'hotels' | 'transfers' | 'tasks' | 'documents';
type Row = Record<string, any>;
const flightStatuses = [
  ['not_available', 'Ainda não disponível'], ['pending', 'Pendente'], ['in_progress', 'Em andamento'],
  ['completed', 'Realizado'], ['unable', 'Não foi possível realizar'], ['not_applicable', 'Não aplicável'],
];
const hotelStatuses = [
  ['not_requested', 'Não solicitado'], ['requested', 'Solicitação enviada'], ['awaiting_confirmation', 'Aguardando confirmação'],
  ['confirmed', 'Confirmado'], ['issue', 'Problema identificado'], ['cancelled', 'Cancelado'],
];
const transferStatuses = [['pending', 'Pendente'], ['requested', 'Solicitado'], ['confirmed', 'Confirmado'], ['completed', 'Concluído'], ['cancelled', 'Cancelado']];
const passStatuses = [['awaiting', 'Aguardando recebimento'], ['received', 'Recebido'], ['sent', 'Enviado']];
const allowedMime = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const todayInBrazil = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const brDate = (value?: string | null, withYear = true) => value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', ...(withYear ? { year: 'numeric' as const } : {}) }).format(new Date(value)) : 'Sem data';
const brTime = (value?: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '';
const dateTimeInput = (value: FormDataEntryValue | null) => value ? new Date(`${String(value)}:00-03:00`).toISOString() : null;

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`grid gap-1.5 text-xs font-semibold text-slate-600 ${className}`}>{label}{children}</label>;
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 ${props.className ?? ''}`} />;
}
function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 ${props.className ?? ''}`}>{children}</select>;
}
function StatusSelect({ value, options, onChange }: { value: string; options: string[][]; onChange: (value: string) => void }) {
  return <Select aria-label="Status" value={value} onChange={event => onChange(event.target.value)}>{options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select>;
}
function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><section className="my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4"><div><span className="text-[10px] font-bold tracking-[.16em] text-violet-600">CONCIERGE STABIA</span><h2 className="mt-1 text-lg font-bold text-slate-800">{title}</h2></div><button onClick={close} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Fechar"><X size={18}/></button></header>{children}</section></div>;
}

export default function OperationsPage() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [trips, setTrips] = useState<Row[]>([]);
  const [flights, setFlights] = useState<Row[]>([]);
  const [checkIns, setCheckIns] = useState<Row[]>([]);
  const [passes, setPasses] = useState<Row[]>([]);
  const [hotels, setHotels] = useState<Row[]>([]);
  const [transfers, setTransfers] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [documents, setDocuments] = useState<Row[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [modal, setModal] = useState<'flight' | 'hotel' | 'transfer' | 'task' | null>(null);
  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploadFlight, setUploadFlight] = useState<Row | null>(null);

  const loadData = useCallback(async () => {
    if (!supabase || !session?.user?.id) return;
    setLoading(true);
    const names = ['trips', 'flight_segments', 'check_ins', 'boarding_passes', 'hotel_reservations', 'transfers', 'tasks', 'documents'];
    const results = await Promise.all(names.map(name => supabase!.from(name).select('*')));
    const failures = results.filter(result => result.error);
    if (failures.length) setError(`Não foi possível carregar ${failures.length} conjunto(s) de dados. Confirme se as duas migrations foram executadas neste projeto Supabase.`);
    else setError('');
    setTrips((results[0].data ?? []) as Row[]);
    setFlights((results[1].data ?? []) as Row[]);
    setCheckIns((results[2].data ?? []) as Row[]);
    setPasses((results[3].data ?? []) as Row[]);
    setHotels((results[4].data ?? []) as Row[]);
    setTransfers((results[5].data ?? []) as Row[]);
    setTasks((results[6].data ?? []) as Row[]);
    setDocuments((results[7].data ?? []) as Row[]);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setAuthLoading(false); });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session) void loadData(); }, [session, loadData]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer); }, [notice]);

  const today = todayInBrazil();
  const tripFor = (id?: string | null) => trips.find(trip => trip.id === id);
  const filteredFlights = useMemo(() => flights.filter(flight => {
    const trip = tripFor(flight.trip_id);
    const text = `${flight.passenger_name} ${flight.airline} ${flight.flight_number ?? ''} ${flight.origin} ${flight.destination} ${trip?.company ?? ''}`.toLocaleLowerCase('pt-BR');
    const day = String(flight.departure_at ?? '').slice(0, 10);
    return (!query || text.includes(query.toLocaleLowerCase('pt-BR'))) && (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
  }), [flights, trips, query, fromDate, toDate]);
  const filteredHotels = hotels.filter(hotel => `${hotel.guest_name} ${hotel.hotel_name} ${hotel.city ?? ''} ${hotel.country ?? ''} ${hotel.reservation_number ?? ''}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  const filteredTransfers = transfers.filter(item => `${item.passenger_name} ${item.pickup_location} ${item.destination} ${item.company_name ?? ''}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  const pendingCheckins = checkIns.filter(item => !['completed', 'not_applicable'].includes(item.status));
  const dueCheckins = pendingCheckins.filter(item => item.available_at && item.available_at.slice(0, 10) <= today);
  const awaitingHotels = hotels.filter(item => ['requested', 'awaiting_confirmation', 'issue'].includes(item.status));
  const passesToSend = passes.filter(item => item.status === 'received');
  const overdueTasks = tasks.filter(task => task.status !== 'completed' && task.due_date && task.due_date < today);

  const agenda = useMemo(() => {
    const items: { at: string; title: string; detail: string; kind: string; id: string }[] = [];
    checkIns.filter(item => item.status !== 'completed' && item.status !== 'not_applicable' && item.available_at).forEach(item => {
      const flight = flights.find(row => row.id === item.flight_segment_id);
      if (flight) items.push({ at: item.available_at, title: `Check-in · ${flight.passenger_name}`, detail: `${flight.airline} ${flight.flight_number ?? ''} · ${flight.origin} → ${flight.destination}`, kind: 'Check-in', id: flight.id });
    });
    hotels.filter(item => item.confirmation_deadline && item.status !== 'confirmed' && item.status !== 'cancelled').forEach(item => items.push({ at: item.confirmation_deadline, title: `Confirmar hotel · ${item.guest_name}`, detail: item.hotel_name, kind: 'Hotel', id: item.id }));
    transfers.filter(item => item.status !== 'completed' && item.status !== 'cancelled').forEach(item => items.push({ at: item.pickup_at, title: `Transfer · ${item.passenger_name}`, detail: `${item.pickup_location} → ${item.destination}`, kind: 'Transfer', id: item.id }));
    tasks.filter(item => item.status !== 'completed' && item.due_date).forEach(item => items.push({ at: `${item.due_date}T${item.due_time ?? '23:59'}:00-03:00`, title: item.title, detail: tripFor(item.trip_id)?.passenger_name ?? 'Atividade geral', kind: 'Tarefa', id: item.id }));
    flights.forEach(item => items.push({ at: item.departure_at, title: `Embarque · ${item.passenger_name}`, detail: `${item.airline} ${item.flight_number ?? ''} · ${item.origin} → ${item.destination}`, kind: 'Voo', id: item.id }));
    hotels.forEach(item => {
      items.push({ at: `${item.check_in}T12:00:00-03:00`, title: `Check-in hotel · ${item.guest_name}`, detail: item.hotel_name, kind: 'Hotel', id: item.id });
      items.push({ at: `${item.check_out}T12:00:00-03:00`, title: `Check-out hotel · ${item.guest_name}`, detail: item.hotel_name, kind: 'Hotel', id: item.id });
    });
    return items.filter(item => {
      const day = item.at.slice(0, 10);
      return (!fromDate || day >= fromDate) && (!toDate || day <= toDate) && (!query || `${item.title} ${item.detail}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
    }).sort((a, b) => a.at.localeCompare(b.at));
  }, [checkIns, flights, hotels, transfers, tasks, trips, fromDate, toDate, query]);

  async function signIn(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!supabase) return;
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError('Não foi possível entrar. Confira o e-mail e a senha.');
  }
  async function saveFlight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !session?.user) return;
    const form = new FormData(event.currentTarget);
    const tripId = String(form.get('trip_id'));
    const { data: flight, error: saveError } = await supabase.from('flight_segments').insert({
      owner_id: session.user.id, trip_id: tripId, passenger_name: String(form.get('passenger_name')).trim(), airline: String(form.get('airline')).trim(),
      flight_number: String(form.get('flight_number') || '').trim() || null, origin: String(form.get('origin')).trim(), destination: String(form.get('destination')).trim(),
      departure_at: dateTimeInput(form.get('departure_at')), arrival_at: dateTimeInput(form.get('arrival_at')),
    }).select().single();
    if (saveError || !flight) { setError('Não foi possível salvar o voo. Confira os dados e as permissões.'); return; }
    const availability = dateTimeInput(form.get('available_at'));
    const [{ error: checkError }, { error: passError }] = await Promise.all([
      supabase.from('check_ins').insert({ owner_id: session.user.id, trip_id: tripId, flight_segment_id: flight.id, available_at: availability, status: availability && new Date(availability) > new Date() ? 'not_available' : 'pending' }),
      supabase.from('boarding_passes').insert({ owner_id: session.user.id, trip_id: tripId, flight_segment_id: flight.id, status: 'awaiting' }),
    ]);
    if (checkError || passError) setError('O voo foi salvo, mas não foi possível criar todos os procedimentos vinculados. Recarregue e confira os dados.');
    else setNotice('Voo e procedimentos de check-in e cartão criados.');
    setModal(null); await loadData();
  }
  async function saveHotel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !session?.user) return;
    const form = new FormData(event.currentTarget);
    const { error: saveError } = await supabase.from('hotel_reservations').insert({ owner_id: session.user.id, trip_id: String(form.get('trip_id')), hotel_name: String(form.get('hotel_name')).trim(), city: String(form.get('city') || '').trim() || null, country: String(form.get('country') || '').trim() || null, guest_name: String(form.get('guest_name')).trim(), check_in: form.get('check_in'), check_out: form.get('check_out'), reservation_number: String(form.get('reservation_number') || '').trim() || null, room_information: String(form.get('room_information') || '').trim() || null, confirmation_deadline: dateTimeInput(form.get('confirmation_deadline')), status: String(form.get('status')) });
    if (saveError) { setError('Não foi possível salvar a reserva. Verifique a viagem e as datas.'); return; }
    setModal(null); setNotice('Reserva de hotel cadastrada.'); await loadData();
  }
  async function saveTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !session?.user) return;
    const form = new FormData(event.currentTarget);
    const { error: saveError } = await supabase.from('transfers').insert({ owner_id: session.user.id, trip_id: String(form.get('trip_id')), passenger_name: String(form.get('passenger_name')).trim(), pickup_location: String(form.get('pickup_location')).trim(), destination: String(form.get('destination')).trim(), pickup_at: dateTimeInput(form.get('pickup_at')), driver_name: String(form.get('driver_name') || '').trim() || null, driver_contact: String(form.get('driver_contact') || '').trim() || null, company_name: String(form.get('company_name') || '').trim() || null, booking_reference: String(form.get('booking_reference') || '').trim() || null, status: String(form.get('status')) });
    if (saveError) { setError('Não foi possível salvar o transfer. Confira os campos obrigatórios.'); return; }
    setModal(null); setNotice('Transfer cadastrado.'); await loadData();
  }
  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !session?.user) return;
    const form = new FormData(event.currentTarget);
    const { error: saveError } = await supabase.from('tasks').insert({ owner_id: session.user.id, trip_id: String(form.get('trip_id') || '') || null, title: String(form.get('title')).trim(), description: String(form.get('description') || '').trim() || null, category: String(form.get('category') || '').trim() || null, due_date: String(form.get('due_date') || '') || null, due_time: String(form.get('due_time') || '') || null, priority: String(form.get('priority') || 'medium'), status: 'pending' });
    if (saveError) { setError('Não foi possível salvar a tarefa.'); return; }
    setModal(null); setNotice('Tarefa adicionada à agenda.'); await loadData();
  }
  async function updateStatus(table: string, id: string, values: Row, success: string) {
    if (!supabase) return;
    const { error: updateError } = await supabase.from(table).update({ ...values, updated_at: new Date().toISOString() }).eq('id', id);
    if (updateError) setError('Não foi possível atualizar o status.'); else { setNotice(success); await loadData(); }
  }
  async function toggleTask(task: Row) {
    const done = task.status !== 'completed';
    await updateStatus('tasks', task.id, { status: done ? 'completed' : 'pending', completed_at: done ? new Date().toISOString() : null }, done ? 'Tarefa concluída.' : 'Tarefa reaberta.');
  }
  async function handleUpload(file?: File) {
    if (!file || !supabase || !session?.user || !uploadFlight) return;
    if (!allowedMime.includes(file.type)) { setError('Formato não permitido. Use PDF, JPG, PNG, WebP ou documento Office.'); return; }
    if (file.size > 20 * 1024 * 1024) { setError('O arquivo deve ter no máximo 20 MB.'); return; }
    setBusy(true);
    const path = `${session.user.id}/${uploadFlight.trip_id}/voos/${crypto.randomUUID()}-${file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: storageError } = await supabase.storage.from('trip-documents').upload(path, file, { contentType: file.type });
    if (storageError) { setBusy(false); setError('Falha no upload. Confira se o bucket privado e as políticas foram criados.'); return; }
    const { data: doc, error: docError } = await supabase.from('documents').insert({ owner_id: session.user.id, trip_id: uploadFlight.trip_id, file_name: file.name, storage_path: path, category: 'cartao_embarque', mime_type: file.type, size_bytes: file.size }).select().single();
    if (docError || !doc) { await supabase.storage.from('trip-documents').remove([path]); setBusy(false); setError('Não foi possível registrar os dados do arquivo.'); return; }
    const currentPass = passes.find(item => item.flight_segment_id === uploadFlight.id);
    const passResult = currentPass
      ? await supabase.from('boarding_passes').update({ status: 'received', received_at: new Date().toISOString(), document_id: doc.id }).eq('id', currentPass.id)
      : await supabase.from('boarding_passes').insert({ owner_id: session.user.id, trip_id: uploadFlight.trip_id, flight_segment_id: uploadFlight.id, status: 'received', received_at: new Date().toISOString(), document_id: doc.id });
    setBusy(false); setUploadFlight(null); if (uploadRef.current) uploadRef.current.value = '';
    if (passResult.error) setError('Arquivo guardado, mas o status do cartão não foi atualizado.'); else { setNotice('Cartão de embarque anexado e marcado como recebido.'); await loadData(); }
  }
  async function openDocument(doc: Row) {
    if (!supabase) return;
    const { data, error: openError } = await supabase.storage.from('trip-documents').createSignedUrl(doc.storage_path, 60);
    if (openError || !data?.signedUrl) setError('Não foi possível abrir o arquivo com sua sessão.'); else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }
  function tripName(tripId: string) {
    const trip = tripFor(tripId);
    return trip ? `${trip.passenger_name} · ${trip.destination}` : 'Viagem não encontrada';
  }

  if (authLoading) return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">Carregando sua operação…</main>;
  if (!supabase) return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><div className="max-w-lg rounded-2xl border bg-white p-8 shadow-sm"><h1 className="text-xl font-bold">Configure o Supabase</h1><p className="mt-2 text-sm text-slate-500">Adicione a URL e a chave publicável nas variáveis do site para continuar.</p></div></main>;
  if (!session) return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><form onSubmit={signIn} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-600 text-lg font-bold text-white">S</span><b>Concierge Stabia</b></div><span className="text-[10px] font-bold tracking-widest text-violet-600">ÁREA OPERACIONAL</span><h1 className="mb-5 mt-2 text-2xl font-bold">Entrar na conta</h1><div className="grid gap-3"><Field label="E-mail"><Input type="email" required value={email} onChange={event => setEmail(event.target.value)} /></Field><Field label="Senha"><Input type="password" required value={password} onChange={event => setPassword(event.target.value)} /></Field><button className="mt-2 rounded-lg bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700">Entrar</button>{error && <p className="text-xs text-red-600">{error}</p>}</div></form></main>;

  const nav: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Visão geral', icon: <Activity size={16}/> }, { id: 'flights', label: 'Voos e check-ins', icon: <Plane size={16}/> },
    { id: 'hotels', label: 'Hotéis', icon: <Hotel size={16}/> }, { id: 'transfers', label: 'Transfers', icon: <MapPin size={16}/> },
    { id: 'tasks', label: 'Tarefas e agenda', icon: <CheckCheck size={16}/> }, { id: 'documents', label: 'Documentos', icon: <FileText size={16}/> },
  ];
  const tabTitle: Record<Tab, string> = { overview: 'Operação de viagens', flights: 'Voos e check-ins', hotels: 'Reservas de hotel', transfers: 'Transfers', tasks: 'Tarefas e agenda', documents: 'Documentos da operação' };
  const formClass = 'grid grid-cols-1 gap-4 p-6 sm:grid-cols-2';
  const textAreaClass = 'min-h-20 rounded-lg border border-slate-200 p-3 text-sm font-normal outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100';

  return <main className="min-h-screen bg-slate-50 text-slate-800">
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-7"><div className="flex min-w-0 items-center gap-3"><Link href="/" aria-label="Voltar ao painel" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={18}/></Link><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-600 font-bold text-white">S</span><div><b className="block text-sm">Concierge Stabia</b><span className="text-[10px] text-slate-400">Gestão da operação</span></div></div><div className="flex items-center gap-2"><span className="hidden text-xs text-slate-500 sm:block">{session.user.email}</span><button onClick={() => supabase?.auth.signOut()} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Sair</button></div></div></header>
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><span className="text-[10px] font-bold tracking-[.16em] text-violet-600">CONCIERGE · BRASÍLIA</span><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{tabTitle[tab]}</h1><p className="mt-1 text-sm text-slate-500">Acompanhe procedimentos, prazos e documentos conectados às viagens.</p></div><div className="flex flex-wrap gap-2">{tab === 'flights' && <button onClick={() => setModal('flight')} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700"><Plus size={15}/> Novo voo</button>}{tab === 'hotels' && <button onClick={() => setModal('hotel')} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700"><Plus size={15}/> Nova reserva</button>}{tab === 'transfers' && <button onClick={() => setModal('transfer')} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700"><Plus size={15}/> Novo transfer</button>}{tab === 'tasks' && <button onClick={() => setModal('task')} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700"><Plus size={15}/> Nova tarefa</button>}</div></div>
      {(error || notice) && <div className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-xs ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}><span className="mt-0.5">{error ? <AlertCircle size={15}/> : <Check size={15}/>}</span><span className="flex-1">{error || notice}</span><button onClick={() => { setError(''); setNotice(''); }} aria-label="Fechar" className="opacity-70"><X size={14}/></button></div>}
      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5">{nav.map(item => <button key={item.id} onClick={() => setTab(item.id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${tab === item.id ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>{item.icon}{item.label}</button>)}</nav>
      {tab !== 'overview' && <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3"><label className="flex min-w-[210px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search size={15} className="text-slate-400"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar passageiro, voo, hotel…" className="h-9 min-w-0 flex-1 text-xs outline-none"/></label><label className="flex items-center gap-2 text-[10px] text-slate-500">De <Input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className="min-h-9 text-xs"/></label><label className="flex items-center gap-2 text-[10px] text-slate-500">Até <Input type="date" value={toDate} onChange={event => setToDate(event.target.value)} className="min-h-9 text-xs"/></label><button onClick={() => { setQuery(''); setFromDate(''); setToDate(''); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-violet-600 hover:bg-violet-50">Limpar filtros</button></div>}
      {loading && <div className="mb-3 text-xs text-violet-600">Sincronizando dados salvos…</div>}

      {tab === 'overview' && <>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
          ['Check-ins pendentes', pendingCheckins.length, 'text-amber-700 bg-amber-50'], ['Check-ins para agir', dueCheckins.length, 'text-red-700 bg-red-50'],
          ['Hotéis aguardando', awaitingHotels.length, 'text-blue-700 bg-blue-50'], ['Cartões a enviar', passesToSend.length, 'text-violet-700 bg-violet-50'],
        ].map(([label, value, tone]) => <article key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4"><span className="text-xs text-slate-500">{label}</span><div className="mt-3 flex items-end justify-between"><strong className="text-3xl">{value}</strong><span className={`rounded-md px-2 py-1 text-[9px] font-bold ${tone}`}>Acompanhar</span></div></article>)}</section>
        <div className="mt-5 grid gap-4 xl:grid-cols-[1.4fr_1fr]"><section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><div><span className="text-[10px] font-bold tracking-widest text-violet-600">AGENDA</span><h2 className="mt-1 font-bold">Atividades por data e horário</h2></div><CalendarDays size={18} className="text-violet-500"/></div>{agenda.length ? <div className="divide-y divide-slate-100">{agenda.slice(0, 14).map((item, index) => <div key={`${item.kind}-${item.id}-${index}`} className="flex items-center gap-3 py-3"><div className="w-20 shrink-0 text-[10px] font-semibold text-slate-500">{brDate(item.at)}<br/><span className="text-violet-600">{brTime(item.at)}</span></div><span className="h-8 w-1 shrink-0 rounded-full bg-violet-300"/><div className="min-w-0 flex-1"><b className="block truncate text-xs">{item.title}</b><span className="block truncate text-[10px] text-slate-400">{item.detail}</span></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] text-slate-500">{item.kind}</span></div>)}</div> : <Empty text="Ainda não há atividades programadas. Cadastre voos, tarefas, hotéis ou transfers."/>}</section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><span className="text-[10px] font-bold tracking-widest text-violet-600">ACESSO RÁPIDO</span><h2 className="mt-1 font-bold">O que precisa de atenção</h2><div className="mt-4 grid gap-2">{[
            { label: `Check-ins com disponibilidade hoje ou antes (${dueCheckins.length})`, tab: 'flights' as Tab, tone: 'bg-amber-50 text-amber-800' },
            { label: `Hotéis aguardando retorno (${awaitingHotels.length})`, tab: 'hotels' as Tab, tone: 'bg-blue-50 text-blue-800' },
            { label: `Cartões recebidos que faltam enviar (${passesToSend.length})`, tab: 'flights' as Tab, tone: 'bg-violet-50 text-violet-800' },
            { label: `Tarefas atrasadas (${overdueTasks.length})`, tab: 'tasks' as Tab, tone: 'bg-red-50 text-red-800' },
          ].map(item => <button key={item.tab + item.label} onClick={() => setTab(item.tab)} className={`flex items-center justify-between rounded-lg px-3 py-3 text-left text-xs font-medium ${item.tone}`}><span>{item.label}</span><ArrowUpRight size={14}/></button>)}</div><div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-3"><p className="text-[10px] leading-5 text-slate-500"><ShieldCheck size={13} className="mr-1 inline text-emerald-600"/>Procedimentos possuem status próprios e não mudam quando a etapa da viagem é movida no Kanban.</p></div></section></div>
      </>}

      {tab === 'flights' && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h2 className="font-bold">Trechos, check-ins e cartões</h2><p className="mt-1 text-[10px] text-slate-500">{filteredFlights.length} voo(s) • check-in organizado pelo horário de disponibilidade</p></div><Plane size={18} className="text-violet-500"/></div><div className="divide-y divide-slate-100">{filteredFlights.sort((a,b) => String(a.departure_at).localeCompare(String(b.departure_at))).map(flight => { const check = checkIns.find(row => row.flight_segment_id === flight.id); const pass = passes.find(row => row.flight_segment_id === flight.id); const doc = documents.find(row => row.id === pass?.document_id); return <article key={flight.id} className="grid gap-3 p-4 lg:grid-cols-[1.1fr_1fr_1fr_1.2fr_auto] lg:items-center"><div><div className="flex items-center gap-2"><b className="text-xs">{flight.passenger_name}</b><span className="rounded bg-slate-100 px-1.5 py-1 text-[9px] text-slate-500">{tripFor(flight.trip_id)?.company ?? 'Corporativo'}</span></div><span className="mt-1 block text-[10px] text-slate-500">{tripName(flight.trip_id)}</span><span className="mt-1 block text-[10px] font-semibold text-slate-700">{flight.airline} {flight.flight_number ?? ''}</span></div><div className="text-xs"><b>{flight.origin} → {flight.destination}</b><span className="mt-1 block text-[10px] text-slate-500">Partida: {brDate(flight.departure_at)} às {brTime(flight.departure_at)}</span></div><div><span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-slate-400">Check-in · {check?.available_at ? `${brDate(check.available_at)} ${brTime(check.available_at)}` : 'sem horário'}</span><StatusSelect value={check?.status ?? 'pending'} options={flightStatuses} onChange={value => check && updateStatus('check_ins', check.id, { status: value, completed_at: value === 'completed' ? new Date().toISOString() : null }, 'Status de check-in atualizado.')}/></div><div><span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-slate-400">Cartão de embarque</span><div className="flex flex-wrap items-center gap-2"><StatusSelect value={pass?.status ?? 'awaiting'} options={passStatuses} onChange={value => pass && updateStatus('boarding_passes', pass.id, { status: value, sent_at: value === 'sent' ? new Date().toISOString() : pass.sent_at, received_at: value === 'received' ? new Date().toISOString() : pass.received_at, recipient_type: value === 'sent' ? 'passenger' : pass.recipient_type, recipient_name: value === 'sent' ? flight.passenger_name : pass.recipient_name }, 'Status do cartão atualizado.')}/><button onClick={() => { setUploadFlight(flight); uploadRef.current?.click(); }} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-[9px] font-semibold text-slate-600 hover:bg-slate-50"><Paperclip size={12}/>{busy ? 'Enviando' : 'Anexar'}</button>{doc && <button onClick={() => openDocument(doc)} className="text-[9px] text-violet-600 underline">Ver arquivo</button>}</div></div><button onClick={() => setTab('documents')} className="inline-flex items-center gap-1 text-[10px] text-violet-600"><FileText size={14}/> Documentos</button></article>; })}{filteredFlights.length === 0 && <Empty text="Nenhum trecho encontrado. Use “Novo voo” para cadastrar um voo e seu check-in."/>}</div><input ref={uploadRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" onChange={event => void handleUpload(event.target.files?.[0])}/></section>}

      {tab === 'hotels' && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h2 className="font-bold">Reservas de hotel</h2><p className="mt-1 text-[10px] text-slate-500">Acompanhe confirmações, períodos e follow-ups</p></div><Hotel size={18} className="text-violet-500"/></div><div className="divide-y divide-slate-100">{filteredHotels.map(hotel => <article key={hotel.id} className="grid gap-3 p-4 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center"><div><b className="text-xs">{hotel.hotel_name}</b><span className="mt-1 block text-[10px] text-slate-500">{hotel.city}{hotel.country ? `, ${hotel.country}` : ''} · {hotel.guest_name}</span><span className="mt-1 block text-[10px] text-slate-400">{tripName(hotel.trip_id)}</span></div><div className="text-[10px] text-slate-600">{brDate(hotel.check_in)} – {brDate(hotel.check_out)}<span className="mt-1 block text-slate-400">Reserva: {hotel.reservation_number || 'não informada'}</span></div><div><span className="mb-1 block text-[9px] text-slate-400">Confirmação</span><StatusSelect value={hotel.status} options={hotelStatuses} onChange={value => updateStatus('hotel_reservations', hotel.id, { status: value, confirmed_at: value === 'confirmed' ? new Date().toISOString() : hotel.confirmed_at }, 'Status do hotel atualizado.')}/></div><div className="text-[10px] text-slate-500">{hotel.confirmation_deadline ? `Prazo ${brDate(hotel.confirmation_deadline)} ${brTime(hotel.confirmation_deadline)}` : hotel.room_information || '—'}</div></article>)}{filteredHotels.length === 0 && <Empty text="Nenhuma reserva de hotel encontrada. Cadastre uma reserva para acompanhar a confirmação."/>}</div></section>}

      {tab === 'transfers' && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h2 className="font-bold">Transfers programados</h2><p className="mt-1 text-[10px] text-slate-500">Horários, pontos de encontro e confirmação</p></div><MapPin size={18} className="text-violet-500"/></div><div className="divide-y divide-slate-100">{filteredTransfers.map(item => <article key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_1.3fr_1fr_auto] md:items-center"><div><b className="text-xs">{item.passenger_name}</b><span className="mt-1 block text-[10px] text-slate-500">{tripName(item.trip_id)}</span><span className="mt-1 block text-[10px] text-slate-400">{item.company_name || 'Operadora não informada'}</span></div><div className="text-xs">{item.pickup_location} → {item.destination}<span className="mt-1 block text-[10px] text-slate-500">{brDate(item.pickup_at)} às {brTime(item.pickup_at)}</span></div><div className="text-[10px] text-slate-500">{item.driver_name || 'Motorista a confirmar'} · {item.driver_contact || 'sem contato'}<span className="mt-1 block">Ref.: {item.booking_reference || '—'}</span></div><StatusSelect value={item.status} options={transferStatuses} onChange={value => updateStatus('transfers', item.id, { status: value }, 'Status do transfer atualizado.')}/></article>)}{filteredTransfers.length === 0 && <Empty text="Nenhum transfer encontrado. Cadastre um transfer para organizar o transporte."/>}</div></section>}

      {tab === 'tasks' && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h2 className="font-bold">Tarefas e atividades</h2><p className="mt-1 text-[10px] text-slate-500">Ordenadas cronologicamente; conclua diretamente por aqui</p></div><button onClick={() => setModal('task')} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white"><Plus size={14}/> Nova tarefa</button></div><div className="divide-y divide-slate-100">{tasks.filter(task => !query || `${task.title} ${task.description ?? ''} ${tripName(task.trip_id)}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).sort((a,b) => `${a.due_date ?? '9999'}${a.due_time ?? ''}`.localeCompare(`${b.due_date ?? '9999'}${b.due_time ?? ''}`)).map(task => <article key={task.id} className="flex items-center gap-3 p-4"><button onClick={() => void toggleTask(task)} className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${task.status === 'completed' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent'}`} aria-label="Concluir tarefa"><Check size={13}/></button><div className="min-w-0 flex-1"><b className={`block truncate text-xs ${task.status === 'completed' ? 'text-slate-400 line-through' : ''}`}>{task.title}</b><span className="mt-1 block truncate text-[10px] text-slate-500">{task.trip_id ? tripName(task.trip_id) : 'Atividade geral'}{task.description ? ` · ${task.description}` : ''}</span></div><span className={`hidden rounded-full px-2 py-1 text-[9px] sm:block ${task.priority === 'high' ? 'bg-red-50 text-red-700' : task.priority === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}</span><span className={`shrink-0 text-[10px] ${task.due_date && task.due_date < today && task.status !== 'completed' ? 'font-bold text-red-600' : 'text-slate-500'}`}>{task.due_date ? `${brDate(task.due_date)} ${task.due_time ?? ''}` : 'Sem prazo'}</span><button onClick={() => { setUploadFlight(null); setNotice('Para anexar um arquivo a esta tarefa, abra a viagem no painel principal e use o ícone de clipe da tarefa.'); }} className="rounded p-1 text-slate-400 hover:bg-slate-100" title="Anexos da tarefa"><Paperclip size={14}/></button></article>)}{tasks.length === 0 && <Empty text="Nenhuma tarefa cadastrada."/>}</div></section>}

      {tab === 'documents' && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-4"><h2 className="font-bold">Arquivos privados da operação</h2><p className="mt-1 text-[10px] text-slate-500">Cartões, comprovantes e documentos armazenados no bucket privado Supabase.</p></div><div className="divide-y divide-slate-100">{documents.filter(doc => !query || `${doc.file_name} ${doc.category} ${tripName(doc.trip_id)}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).map(doc => <button key={doc.id} onClick={() => void openDocument(doc)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50"><span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-50 text-violet-600"><FileText size={17}/></span><span className="min-w-0 flex-1"><b className="block truncate text-xs">{doc.file_name}</b><small className="mt-1 block truncate text-[10px] text-slate-400">{doc.category} · {doc.trip_id ? tripName(doc.trip_id) : 'Documento da conta'} · {brDate(doc.created_at)}</small></span><ArrowUpRight size={15} className="text-slate-400"/></button>)}{documents.length === 0 && <Empty text="Nenhum documento anexado ainda. Os cartões enviados pelos voos aparecerão aqui."/>}</div></section>}
      <footer className="mt-6 flex flex-col justify-between gap-2 text-[10px] text-slate-400 sm:flex-row"><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>Dados sincronizados com o Supabase</span><span>Datas e horários de operação · America/Sao_Paulo</span></footer>
    </div>

    {modal === 'flight' && <Modal title="Cadastrar trecho e check-in" close={() => setModal(null)}><form className={formClass} onSubmit={event => void saveFlight(event)}><Field label="Viagem *" className="sm:col-span-2"><Select name="trip_id" required defaultValue=""><option value="" disabled>Selecione uma viagem</option>{trips.filter(trip => !trip.archived_at).map(trip => <option key={trip.id} value={trip.id}>{trip.passenger_name} · {trip.destination}</option>)}</Select></Field><Field label="Passageiro *"><Input name="passenger_name" required placeholder="Nome completo"/></Field><Field label="Companhia aérea *"><Input name="airline" required placeholder="Ex.: LATAM"/></Field><Field label="Número do voo"><Input name="flight_number" placeholder="Ex.: LA1234"/></Field><Field label="Origem *"><Input name="origin" required placeholder="GRU"/></Field><Field label="Destino *"><Input name="destination" required placeholder="LIS"/></Field><Field label="Partida *"><Input name="departure_at" type="datetime-local" required/></Field><Field label="Chegada"><Input name="arrival_at" type="datetime-local"/></Field><Field label="Check-in disponível em"><Input name="available_at" type="datetime-local"/></Field><div className="sm:col-span-2 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-[10px] text-slate-400">O voo cria check-in e cartão pendentes independentemente.</span><button className="rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-bold text-white">Salvar voo</button></div></form></Modal>}
    {modal === 'hotel' && <Modal title="Cadastrar reserva de hotel" close={() => setModal(null)}><form className={formClass} onSubmit={event => void saveHotel(event)}><Field label="Viagem *" className="sm:col-span-2"><Select name="trip_id" required defaultValue=""><option value="" disabled>Selecione uma viagem</option>{trips.map(trip => <option key={trip.id} value={trip.id}>{trip.passenger_name} · {trip.destination}</option>)}</Select></Field><Field label="Hotel *"><Input name="hotel_name" required placeholder="Nome do hotel"/></Field><Field label="Hóspede *"><Input name="guest_name" required placeholder="Nome completo"/></Field><Field label="Cidade"><Input name="city"/></Field><Field label="País"><Input name="country"/></Field><Field label="Check-in *"><Input name="check_in" type="date" required/></Field><Field label="Check-out *"><Input name="check_out" type="date" required/></Field><Field label="Número da reserva"><Input name="reservation_number"/></Field><Field label="Quarto"><Input name="room_information"/></Field><Field label="Prazo para confirmação"><Input name="confirmation_deadline" type="datetime-local"/></Field><Field label="Status"><Select name="status" defaultValue="not_requested">{hotelStatuses.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</Select></Field><div className="sm:col-span-2 flex justify-end border-t border-slate-100 pt-4"><button className="rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-bold text-white">Salvar reserva</button></div></form></Modal>}
    {modal === 'transfer' && <Modal title="Cadastrar transfer" close={() => setModal(null)}><form className={formClass} onSubmit={event => void saveTransfer(event)}><Field label="Viagem *" className="sm:col-span-2"><Select name="trip_id" required defaultValue=""><option value="" disabled>Selecione uma viagem</option>{trips.map(trip => <option key={trip.id} value={trip.id}>{trip.passenger_name} · {trip.destination}</option>)}</Select></Field><Field label="Passageiro *"><Input name="passenger_name" required/></Field><Field label="Data e horário de busca *"><Input name="pickup_at" type="datetime-local" required/></Field><Field label="Local de embarque *"><Input name="pickup_location" required placeholder="Aeroporto, hotel…"/></Field><Field label="Destino *"><Input name="destination" required/></Field><Field label="Empresa de transfer"><Input name="company_name"/></Field><Field label="Referência da reserva"><Input name="booking_reference"/></Field><Field label="Motorista"><Input name="driver_name"/></Field><Field label="Contato do motorista"><Input name="driver_contact"/></Field><Field label="Status"><Select name="status" defaultValue="pending">{transferStatuses.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</Select></Field><div className="sm:col-span-2 flex justify-end border-t border-slate-100 pt-4"><button className="rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-bold text-white">Salvar transfer</button></div></form></Modal>}
    {modal === 'task' && <Modal title="Criar tarefa operacional" close={() => setModal(null)}><form className={formClass} onSubmit={event => void saveTask(event)}><Field label="Título *" className="sm:col-span-2"><Input name="title" required placeholder="Ex.: Solicitar confirmação do hotel"/></Field><Field label="Viagem relacionada" className="sm:col-span-2"><Select name="trip_id" defaultValue=""><option value="">Atividade geral</option>{trips.map(trip => <option key={trip.id} value={trip.id}>{trip.passenger_name} · {trip.destination}</option>)}</Select></Field><Field label="Categoria"><Input name="category" placeholder="Check-in, hotel, documentos…"/></Field><Field label="Prioridade"><Select name="priority" defaultValue="medium"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></Select></Field><Field label="Data limite"><Input name="due_date" type="date"/></Field><Field label="Horário"><Input name="due_time" type="time"/></Field><Field label="Descrição" className="sm:col-span-2"><textarea name="description" className={textAreaClass} rows={3}/></Field><div className="sm:col-span-2 flex justify-end border-t border-slate-100 pt-4"><button className="rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-bold text-white">Criar tarefa</button></div></form></Modal>}
  </main>;
}

function Empty({ text }: { text: string }) {
  return <div className="flex min-h-36 flex-col items-center justify-center px-5 text-center"><div className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><Clock3 size={18}/></div><b className="text-xs text-slate-600">Nenhum registro por enquanto</b><span className="mt-1 max-w-md text-[10px] leading-5 text-slate-400">{text}</span></div>;
}

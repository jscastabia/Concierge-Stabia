'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, hasSupabaseConfig, Trip, TripStage, Task, TravelDocument } from '@/lib/supabase';
import { Activity, AlertCircle, ArrowDownUp, ArrowUpRight, Bell, CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, FileText, Filter, LayoutDashboard, LogOut, MapPin, Menu, MoreHorizontal, Paperclip, Plane, Plus, Search, Settings, ShieldCheck, Sparkles, UploadCloud, Users, X } from 'lucide-react';

const stages: { id: TripStage; label: string; tone: string }[] = [
  { id: 'new', label: 'Novas viagens', tone: 'gray' },
  { id: 'preparation', label: 'Em preparação', tone: 'purple' },
  { id: 'checkin', label: 'Check-in pendente', tone: 'amber' },
  { id: 'ready', label: 'Pronto para embarque', tone: 'blue' },
  { id: 'traveling', label: 'Em viagem', tone: 'indigo' },
  { id: 'completed', label: 'Concluídas', tone: 'green' },
];
const stageNames: Record<TripStage, string> = Object.fromEntries(stages.map(s => [s.id, s.label])) as Record<TripStage, string>;
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const dateBR = (value?: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : '—';
const taskStatusLabel: Record<Task['status'], string> = { not_started: 'Não iniciada', pending: 'Pendente', in_progress: 'Em andamento', completed: 'Concluída', overdue: 'Atrasada' };
const priorityLabel = { low: 'Baixa', medium: 'Média', high: 'Alta' };

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal"><header className="modal-head"><div><span className="eyebrow">CONCIERGE STABIA</span><h2>{title}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={19}/></button></header>{children}</section></div>;
}

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<TravelDocument[]>([]);
  const [view, setView] = useState<'dashboard' | 'viagens' | 'tarefas' | 'agenda'>('dashboard');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [authError, setAuthError] = useState('');
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState<'trip' | 'task' | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!supabase || !session?.user?.id) return;
    setLoading(true);
    const [tripResult, taskResult, docResult] = await Promise.all([
      supabase.from('trips').select('*').order('departure_date', { ascending: true }),
      supabase.from('tasks').select('*').order('due_date', { ascending: true }),
      supabase.from('documents').select('*').order('created_at', { ascending: false }),
    ]);
    if (tripResult.error || taskResult.error || docResult.error) setMessage('Não foi possível carregar todos os dados. Confira as migrações e as políticas do Supabase.');
    setTrips((tripResult.data ?? []) as Trip[]);
    setTasks((taskResult.data ?? []) as Task[]);
    setDocuments((docResult.data ?? []) as TravelDocument[]);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setAuthLoading(false); });
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session) loadData(); }, [session, loadData]);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 4500); return () => clearTimeout(timer); }, [message]);

  const visibleTrips = useMemo(() => trips.filter(t => {
    const q = query.trim().toLocaleLowerCase('pt-BR');
    const matchesText = !q || [t.passenger_name, t.company, t.destination, t.country, t.airline].some(v => v?.toLocaleLowerCase('pt-BR').includes(q));
    const matchesFilter = filter === 'all' || (filter === 'completed' ? t.stage === 'completed' : t.stage !== 'completed');
    return matchesText && matchesFilter;
  }), [trips, query, filter]);
  const todayTasks = tasks.filter(t => t.due_date === today && t.status !== 'completed').sort((a, b) => (a.due_time ?? '').localeCompare(b.due_time ?? ''));
  const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.due_date && t.due_date < today);
  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const activeTrips = trips.filter(t => t.stage !== 'completed');
  const upcomingTrips = activeTrips.filter(t => t.departure_date >= today);
  const inProgressTrips = activeTrips.filter(t => t.stage === 'traveling');
  const taskTrip = (id: string | null) => trips.find(t => t.id === id);

  async function signIn(e: FormEvent) {
    e.preventDefault(); setAuthError('');
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError('Não foi possível entrar. Verifique seu e-mail e sua senha.');
  }
  async function signOut() { await supabase?.auth.signOut(); setTrips([]); setTasks([]); }
  async function createTrip(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!supabase || !session?.user) return;
    const data = new FormData(e.currentTarget);
    const payload = { owner_id: session.user.id, passenger_name: String(data.get('passenger_name')).trim(), company: String(data.get('company') || '').trim() || null, secretary: String(data.get('secretary') || '').trim() || null, destination: String(data.get('destination')).trim(), country: String(data.get('country') || '').trim() || null, departure_date: String(data.get('departure_date')), return_date: String(data.get('return_date')), airline: String(data.get('airline') || '').trim() || null, notes: String(data.get('notes') || '').trim() || null, stage: 'new' as TripStage };
    const { error } = await supabase.from('trips').insert(payload);
    if (error) { setMessage('Erro ao salvar viagem. Confira os campos e a conexão com o Supabase.'); return; }
    setModal(null); setMessage('Viagem cadastrada com sucesso.'); await loadData();
  }
  async function createTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!supabase || !session?.user) return;
    const data = new FormData(e.currentTarget);
    const payload = { owner_id: session.user.id, trip_id: String(data.get('trip_id') || '') || null, title: String(data.get('title')).trim(), description: String(data.get('description') || '').trim() || null, due_date: String(data.get('due_date') || '') || null, due_time: String(data.get('due_time') || '') || null, priority: String(data.get('priority') || 'medium'), status: 'pending' };
    const { error } = await supabase.from('tasks').insert(payload);
    if (error) { setMessage('Erro ao salvar tarefa. Verifique a conexão com o Supabase.'); return; }
    setModal(null); setMessage('Tarefa adicionada à sua agenda.'); await loadData();
  }
  async function moveTrip(trip: Trip, stage: TripStage) {
    if (!supabase || trip.stage === stage) return;
    const { error } = await supabase.from('trips').update({ stage, updated_at: new Date().toISOString() }).eq('id', trip.id);
    if (error) setMessage('Não foi possível atualizar a etapa da viagem.'); else { setTrips(prev => prev.map(t => t.id === trip.id ? { ...t, stage } : t)); setMessage(`Etapa atualizada: ${stageNames[stage]}. Os procedimentos mantêm seus status próprios.`); }
  }
  async function toggleTask(task: Task) {
    if (!supabase) return;
    const status = task.status === 'completed' ? 'pending' : 'completed';
    const { error } = await supabase.from('tasks').update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', task.id);
    if (error) setMessage('Não foi possível atualizar a tarefa.'); else { setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t)); setMessage(status === 'completed' ? 'Tarefa concluída.' : 'Tarefa reaberta.'); }
  }
  async function uploadFile(file?: File) {
    if (!file || !supabase || !session?.user || !selectedTrip) return;
    const taskId = uploadTarget;
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.type)) { setMessage('Formato não permitido. Envie PDF, JPG, PNG, WebP ou documento Office.'); return; }
    if (file.size > 20 * 1024 * 1024) { setMessage('O arquivo deve ter no máximo 20 MB.'); return; }
    setUploading(true);
    const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${session.user.id}/${selectedTrip.id}/${taskId ?? 'viagem'}/${crypto.randomUUID()}-${safeName}`;
    const { error: storageError } = await supabase.storage.from('trip-documents').upload(path, file, { contentType: file.type, upsert: false });
    if (storageError) { setUploading(false); setMessage('Falha no envio. Confira o bucket privado e as políticas de armazenamento.'); return; }
    const { error } = await supabase.from('documents').insert({ owner_id: session.user.id, trip_id: selectedTrip.id, task_id: taskId, file_name: file.name, storage_path: path, category: taskId ? 'anexo_tarefa' : 'documento_viagem', mime_type: file.type, size_bytes: file.size });
    if (error) { await supabase.storage.from('trip-documents').remove([path]); setMessage('Arquivo enviado, mas não foi possível salvar seus dados; o upload foi removido.'); }
    else { setMessage('Arquivo anexado com segurança.'); await loadData(); }
    setUploading(false); setUploadTarget(null); if (fileInput.current) fileInput.current.value = '';
  }
  async function openDocument(doc: TravelDocument) {
    if (!supabase) return;
    const { data, error } = await supabase.storage.from('trip-documents').createSignedUrl(doc.storage_path, 60);
    if (error || !data?.signedUrl) setMessage('Não foi possível abrir o arquivo. Verifique suas permissões.'); else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }
  function selectUploadTarget(taskId: string | null) { setUploadTarget(taskId); fileInput.current?.click(); }

  if (authLoading) return <div className="loading-screen"><div className="brand-mark">S</div><span>Preparando seu espaço de trabalho…</span></div>;
  if (!hasSupabaseConfig) return <main className="setup-screen"><div className="setup-card"><div className="brand-mark">S</div><span className="eyebrow">CONFIGURAÇÃO INICIAL</span><h1>Vamos conectar seu espaço de trabalho</h1><p>O site já está preparado para salvar viagens, tarefas e anexos no Supabase. Configure as credenciais para ativar login, banco de dados e armazenamento privado.</p><ol><li>Crie um projeto no Supabase.</li><li>Execute <strong>supabase/migrations/202611260001_init.sql</strong> no SQL Editor.</li><li>Copie <strong>.env.example</strong> para <strong>.env.local</strong> e informe a URL e a chave anon do projeto.</li><li>Cadastre seu usuário em Authentication → Users e publique na Netlify com as mesmas variáveis.</li></ol><div className="setup-note"><ShieldCheck size={18}/><span>Documentos usam bucket privado. Nunca adicione a chave service_role ao navegador.</span></div><a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="primary-btn">Abrir Supabase <ArrowUpRight size={16}/></a></div></main>;
  if (!session) return <main className="login-screen"><div className="login-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="travel-globe">✦</div><div className="art-copy"><span className="eyebrow">CONCIERGE STABIA</span><h1>Suas viagens,<br/>sob controle.</h1><p>Uma operação mais leve começa com tudo no lugar.</p></div><div className="art-foot">PLATAFORMA DE GESTÃO DE VIAGENS CORPORATIVAS</div></div><section className="login-panel"><div className="login-box"><div className="brand-row"><div className="brand-mark">S</div><b>Concierge<span>Stabia</span></b></div><span className="eyebrow">BEM-VINDA DE VOLTA</span><h2>Acesse sua conta</h2><p>Entre para acompanhar sua operação de viagens.</p><form onSubmit={signIn} className="form-stack"><label>E-mail<input type="email" autoComplete="email" required placeholder="voce@empresa.com.br" value={email} onChange={e => setEmail(e.target.value)}/></label><label>Senha<input type="password" autoComplete="current-password" required placeholder="Sua senha" value={password} onChange={e => setPassword(e.target.value)}/></label>{authError && <p className="form-error"><AlertCircle size={16}/>{authError}</p>}<button className="primary-btn wide" type="submit">Entrar no sistema <ArrowUpRight size={16}/></button></form><div className="login-secure"><ShieldCheck size={15}/>Acesso seguro • Dados protegidos</div></div></section></main>;

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand-row sidebar-brand"><div className="brand-mark">S</div><b>Concierge<span>Stabia</span></b></div><div className="workspace-chip"><div className="workspace-avatar">CS</div><div><b>Stabia Travel</b><small>Operação concierge</small></div><ChevronDown size={15}/></div>
      <div className="side-label">MENU PRINCIPAL</div><nav className="main-nav">
        <button className={view === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setView('dashboard')}><LayoutDashboard size={18}/> Visão geral</button>
        <button className={view === 'viagens' ? 'nav-item active' : 'nav-item'} onClick={() => setView('viagens')}><Plane size={18}/> Viagens<span className="nav-count">{activeTrips.length}</span></button>
        <button className={view === 'tarefas' ? 'nav-item active' : 'nav-item'} onClick={() => setView('tarefas')}><CheckCheck size={18}/> Tarefas<span className="nav-count">{pendingTasks.length}</span></button>
        <button className={view === 'agenda' ? 'nav-item active' : 'nav-item'} onClick={() => setView('agenda')}><CalendarDays size={18}/> Agenda</button>
      </nav><div className="side-label tools-label">PREFERÊNCIAS</div><button className="nav-item muted" onClick={() => setMessage('Configurações de equipe serão habilitadas na próxima etapa.')}><Users size={18}/> Equipe <span className="soon">EM BREVE</span></button><button className="nav-item muted" onClick={() => setMessage('Configurações do espaço serão habilitadas na próxima etapa.')}><Settings size={18}/> Configurações</button>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18}/></div><b>Precisa de ajuda?</b><p>Seu espaço está pronto para evoluir com você.</p><button onClick={() => setMessage('Entre em contato com o suporte da sua equipe.')}>Falar com suporte <ArrowUpRight size={13}/></button></div><div className="user-row"><div className="user-avatar">{(session.user.email?.[0] ?? 'U').toUpperCase()}</div><div className="user-details"><b>{session.user.email?.split('@')[0]}</b><small>{session.user.email}</small></div><button className="icon-btn logout" onClick={signOut} aria-label="Sair"><LogOut size={17}/></button></div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="breadcrumb"><span>Workspace</span><ChevronRight size={15}/><b>{view === 'dashboard' ? 'Visão geral' : view === 'viagens' ? 'Viagens' : view === 'tarefas' ? 'Tarefas' : 'Agenda'}</b></div><div className="top-actions"><div className="global-search"><Search size={17}/><input placeholder="Buscar passageiro, empresa, destino…" value={query} onChange={e => setQuery(e.target.value)}/><kbd>⌘ K</kbd></div><button className="icon-btn notification" aria-label="Notificações" onClick={() => setMessage(`${overdueTasks.length} tarefa(s) atrasada(s) exigem atenção.`)}><Bell size={18}/>{overdueTasks.length > 0 && <i/>}</button><div className="top-avatar">{(session.user.email?.[0] ?? 'U').toUpperCase()}</div></div></header>
      <div className="page-content"><div className="welcome-row"><div><div className="date-kicker"><span className="live-dot"/> QUINTA-FEIRA, {new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()).toUpperCase()}</div><h1>{view === 'dashboard' ? 'Bom dia, vamos organizar?' : view === 'viagens' ? 'Todas as viagens' : view === 'tarefas' ? 'Tarefas e pendências' : 'Agenda operacional'}</h1><p>{view === 'dashboard' ? 'Aqui está o panorama da sua operação hoje.' : 'Acompanhe e organize cada detalhe da sua operação.'}</p></div><div className="welcome-actions"><button className="secondary-btn" onClick={() => setModal('task')}><Plus size={16}/> Nova tarefa</button><button className="primary-btn" onClick={() => setModal('trip')}><Plus size={17}/> Nova viagem</button></div></div>
      {message && <div className="toast"><Check size={16}/>{message}<button onClick={() => setMessage('')} aria-label="Fechar"><X size={14}/></button></div>}
      {loading && <div className="sync-line"><span className="spinner"/> Sincronizando dados…</div>}
      {view === 'dashboard' && <>
        <section className="stats-grid">
          <StatCard label="Viagens ativas" value={activeTrips.length} detail="Em operação" icon={<Plane size={18}/>} tone="violet"/>
          <StatCard label="Próximas viagens" value={upcomingTrips.length} detail="Com embarque futuro" icon={<CalendarDays size={18}/>} tone="blue"/>
          <StatCard label="Em andamento" value={inProgressTrips.length} detail="Passageiros viajando" icon={<MapPin size={18}/>} tone="amber"/>
          <StatCard label="Concluídas" value={trips.filter(t => t.stage === 'completed').length} detail="Viagens finalizadas" icon={<CheckCheck size={18}/>} tone="green"/>
          <StatCard label="Tarefas pendentes" value={pendingTasks.length} detail="Aguardando ação" icon={<Activity size={18}/>} tone="pink"/>
          <StatCard label="Atrasadas" value={overdueTasks.length} detail="Precisam de atenção" icon={<AlertCircle size={18}/>} tone="red"/>
        </section>
        <div className="dashboard-grid"><section className="panel agenda-panel"><div className="panel-heading"><div><span className="eyebrow">{new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long' }).format(new Date()).toUpperCase()}</span><h2>Minha agenda de hoje</h2></div><button className="text-action" onClick={() => setView('agenda')}>Ver agenda <ArrowUpRight size={15}/></button></div>
          {todayTasks.length === 0 ? <div className="empty-agenda"><div className="empty-icon"><Sparkles size={20}/></div><b>Seu dia está em aberto</b><span>As tarefas com prazo de hoje aparecem aqui automaticamente.</span><button onClick={() => setModal('task')}><Plus size={15}/> Adicionar tarefa de hoje</button></div> : <div className="agenda-list">{todayTasks.map(task => <div className="agenda-item" key={task.id}><div className="agenda-time">{task.due_time?.slice(0,5) ?? '—'}</div><div className="agenda-rail"><i/></div><div className="agenda-info"><b>{task.title}</b><span>{taskTrip(task.trip_id)?.passenger_name ?? 'Atividade geral'}{taskTrip(task.trip_id)?.destination ? ` · ${taskTrip(task.trip_id)?.destination}` : ''}</span></div><button className="complete-btn" onClick={() => toggleTask(task)} title="Concluir tarefa"><Check size={16}/></button></div>)}</div>}
        </section><section className="panel attention-panel"><div className="panel-heading"><div><span className="eyebrow">ACOMPANHAMENTO</span><h2>Precisa de atenção</h2></div><span className="attention-count">{overdueTasks.length + pendingTasks.filter(t => t.due_date === today).length}</span></div><div className="attention-list">{overdueTasks.slice(0, 3).map(task => <div className="attention-item" key={task.id}><span className="attention-icon danger"><AlertCircle size={16}/></span><div><b>{task.title}</b><span>Atrasada desde {dateBR(task.due_date)} · {taskTrip(task.trip_id)?.passenger_name ?? 'Sem viagem'}</span></div><ChevronRight size={16}/></div>)}{pendingTasks.filter(t => t.due_date === today).slice(0, 3).map(task => <div className="attention-item" key={task.id}><span className="attention-icon warning"><Clock3 size={16}/></span><div><b>{task.title}</b><span>Prazo hoje {task.due_time?.slice(0,5) ? `às ${task.due_time.slice(0,5)}` : ''} · {taskTrip(task.trip_id)?.passenger_name ?? 'Sem viagem'}</span></div><ChevronRight size={16}/></div>)}{overdueTasks.length === 0 && pendingTasks.filter(t => t.due_date === today).length === 0 && <div className="all-clear"><div><CheckCheck size={20}/></div><b>Tudo em dia por aqui</b><span>Nenhum prazo vencido ou pendência para hoje.</span></div>}</div><button className="attention-footer" onClick={() => setView('tarefas')}>Ver todas as tarefas <ArrowUpRight size={15}/></button></section></div>
        <Board trips={visibleTrips} onMove={moveTrip} onSelect={setSelectedTrip} onCreate={() => setModal('trip')} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} compact/>
      </>}
      {view === 'viagens' && <Board trips={visibleTrips} onMove={moveTrip} onSelect={setSelectedTrip} onCreate={() => setModal('trip')} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter}/>}
      {view === 'tarefas' && <section className="panel tasks-panel"><div className="panel-heading"><div><span className="eyebrow">ORGANIZAÇÃO</span><h2>Suas tarefas</h2></div><button className="primary-btn small" onClick={() => setModal('task')}><Plus size={15}/> Nova tarefa</button></div><div className="task-filters"><button className="filter-chip active"><Filter size={14}/> Todas <span>{tasks.length}</span></button><button className="filter-chip" onClick={() => setMessage(`${pendingTasks.length} tarefa(s) pendente(s).`)}>Pendentes <span>{pendingTasks.length}</span></button><button className="filter-chip" onClick={() => setMessage(`${overdueTasks.length} tarefa(s) atrasada(s).`)}>Atrasadas <span>{overdueTasks.length}</span></button></div><TaskList tasks={tasks.filter(t => !query || `${t.title} ${t.description ?? ''} ${taskTrip(t.trip_id)?.passenger_name ?? ''}`.toLowerCase().includes(query.toLowerCase()))} trips={trips} toggleTask={toggleTask} openTrip={setSelectedTrip}/></section>}
      {view === 'agenda' && <section className="panel tasks-panel"><div className="panel-heading"><div><span className="eyebrow">AGENDA OPERACIONAL</span><h2>Próximas atividades</h2></div><button className="primary-btn small" onClick={() => setModal('task')}><Plus size={15}/> Nova tarefa</button></div><div className="agenda-date-banner"><CalendarDays size={18}/><div><b>Hoje, {dateBR(today)}</b><span>Atividades ordenadas por horário</span></div></div>{tasks.filter(t => t.status !== 'completed').sort((a,b) => `${a.due_date ?? '9999'}${a.due_time ?? ''}`.localeCompare(`${b.due_date ?? '9999'}${b.due_time ?? ''}`)).length ? <TaskList tasks={tasks.filter(t => t.status !== 'completed').sort((a,b) => `${a.due_date ?? '9999'}${a.due_time ?? ''}`.localeCompare(`${b.due_date ?? '9999'}${b.due_time ?? ''}`))} trips={trips} toggleTask={toggleTask} openTrip={setSelectedTrip}/> : <div className="empty-agenda"><div className="empty-icon"><CalendarDays size={20}/></div><b>Nenhuma atividade pendente</b><span>Crie tarefas para organizar os próximos passos.</span></div>}</section>}
      <footer className="page-footer"><span>Concierge Stabia <i/> Seu espaço de trabalho está sincronizado</span><span>Fuso horário: Brasília (GMT−3)</span></footer>
      </div>
    </main>
    {modal === 'trip' && <Modal title="Cadastrar nova viagem" onClose={() => setModal(null)}><form className="form-grid" onSubmit={createTrip}><label className="full">Nome do passageiro *<input name="passenger_name" required placeholder="Ex.: Ana Souza"/></label><label>Empresa<input name="company" placeholder="Nome da empresa"/></label><label>Secretária responsável<input name="secretary" placeholder="Nome da responsável"/></label><label>Destino *<input name="destination" required placeholder="Cidade"/></label><label>País<input name="country" placeholder="País"/></label><label>Data de ida *<input type="date" name="departure_date" required/></label><label>Data de retorno *<input type="date" name="return_date" required/></label><label className="full">Companhia aérea<input name="airline" placeholder="Ex.: LATAM Airlines"/></label><label className="full">Observações<textarea name="notes" rows={3} placeholder="Informações importantes sobre a viagem…"/></label><div className="form-foot full"><span><ShieldCheck size={14}/> Dados salvos com segurança</span><button className="primary-btn" type="submit">Salvar viagem <ArrowUpRight size={15}/></button></div></form></Modal>}
    {modal === 'task' && <Modal title="Adicionar tarefa" onClose={() => setModal(null)}><form className="form-grid" onSubmit={createTask}><label className="full">Título da tarefa *<input name="title" required placeholder="Ex.: Confirmar reserva do hotel"/></label><label className="full">Viagem relacionada<select name="trip_id"><option value="">Atividade geral</option>{trips.filter(t => t.stage !== 'completed').map(t => <option key={t.id} value={t.id}>{t.passenger_name} · {t.destination}</option>)}</select></label><label>Data limite<input type="date" name="due_date"/></label><label>Horário<input type="time" name="due_time"/></label><label>Prioridade<select name="priority"><option value="medium">Média</option><option value="high">Alta</option><option value="low">Baixa</option></select></label><label className="full">Descrição<textarea rows={3} name="description" placeholder="Detalhes ou instruções…"/></label><div className="form-foot full"><span><Paperclip size={14}/> Depois de salvar, você poderá anexar arquivos à tarefa na viagem.</span><button className="primary-btn" type="submit">Criar tarefa <ArrowUpRight size={15}/></button></div></form></Modal>}
    {selectedTrip && <Modal title="Detalhes da viagem" onClose={() => { setSelectedTrip(null); setUploadTarget(null); }}><div className="trip-detail"><div className="detail-hero"><div className="detail-destination"><span className="detail-plane"><Plane size={20}/></span><div><span className="eyebrow">{selectedTrip.company ?? 'VIAGEM CORPORATIVA'}</span><h3>{selectedTrip.destination}{selectedTrip.country ? `, ${selectedTrip.country}` : ''}</h3></div></div><span className={`stage-pill ${stages.find(s => s.id === selectedTrip.stage)?.tone}`}>{stageNames[selectedTrip.stage]}</span></div><div className="detail-grid"><Detail label="Passageiro" value={selectedTrip.passenger_name}/><Detail label="Companhia aérea" value={selectedTrip.airline ?? 'Não informada'}/><Detail label="Embarque" value={dateBR(selectedTrip.departure_date)}/><Detail label="Retorno" value={dateBR(selectedTrip.return_date)}/><Detail label="Secretária" value={selectedTrip.secretary ?? 'Não informada'}/><Detail label="Observações" value={selectedTrip.notes ?? 'Nenhuma observação'}/></div><div className="detail-section-head"><div><h4>Documentos e anexos</h4><span>Arquivos privados vinculados à viagem e às tarefas</span></div><button className="secondary-btn small" onClick={() => selectUploadTarget(null)} disabled={uploading}><UploadCloud size={15}/>{uploading ? 'Enviando…' : 'Anexar arquivo'}</button></div><input ref={fileInput} type="file" className="hidden-file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" onChange={e => uploadFile(e.target.files?.[0])}/><div className="document-list">{documents.filter(d => d.trip_id === selectedTrip.id && !d.task_id).map(doc => <DocumentRow key={doc.id} doc={doc} onOpen={openDocument}/>)}</div>{documents.filter(d => d.trip_id === selectedTrip.id && !d.task_id).length === 0 && <p className="muted-empty">Nenhum documento anexado à viagem ainda.</p>}<div className="detail-section-head tasks-detail-head"><div><h4>Tarefas da viagem</h4><span>{tasks.filter(t => t.trip_id === selectedTrip.id).length} atividade(s)</span></div><button className="text-action" onClick={() => { setSelectedTrip(null); setModal('task'); }}>+ Nova tarefa</button></div><div className="trip-task-list">{tasks.filter(t => t.trip_id === selectedTrip.id).map(task => <div className="trip-task" key={task.id}><button className={task.status === 'completed' ? 'task-check checked' : 'task-check'} onClick={() => toggleTask(task)}>{task.status === 'completed' && <Check size={13}/>}</button><div className="trip-task-info"><b className={task.status === 'completed' ? 'strike' : ''}>{task.title}</b><span>{task.due_date ? dateBR(task.due_date) : 'Sem prazo'} {task.due_time ? `· ${task.due_time.slice(0,5)}` : ''} · {priorityLabel[task.priority]}</span></div><button className="icon-btn attach-task" title="Anexar arquivo à tarefa" onClick={() => selectUploadTarget(task.id)}><Paperclip size={16}/></button>{documents.filter(d => d.task_id === task.id).map(doc => <button key={doc.id} className="doc-chip" onClick={() => openDocument(doc)}><FileText size={13}/>{doc.file_name}</button>)}</div>)}{tasks.filter(t => t.trip_id === selectedTrip.id).length === 0 && <p className="muted-empty">Nenhuma tarefa vinculada. Adicione uma atividade para esta viagem.</p>}</div><div className="stage-change"><span>Mover viagem para</span><select value={selectedTrip.stage} onChange={e => { const stage = e.target.value as TripStage; moveTrip(selectedTrip, stage); setSelectedTrip({ ...selectedTrip, stage }); }} aria-label="Etapa da viagem">{stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select><small>Isso não altera o status de tarefas ou procedimentos.</small></div></div></Modal>}
    {!selectedTrip && uploadTarget !== null && null}
  </div>;
}

function StatCard({ label, value, detail, icon, tone }: { label: string; value: number; detail: string; icon: React.ReactNode; tone: string }) { return <article className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-copy"><span>{label}</span><strong>{value.toString().padStart(2, '0')}</strong><small>{detail}</small></div><div className={`stat-spark ${tone}`}><span/><span/><span/><span/><span/></div></article>; }
function Board({ trips, onMove, onSelect, onCreate, query, setQuery, filter, setFilter, compact = false }: { trips: Trip[]; onMove: (t: Trip, s: TripStage) => void; onSelect: (t: Trip) => void; onCreate: () => void; query: string; setQuery: (v: string) => void; filter: 'all' | 'pending' | 'completed'; setFilter: (v: 'all' | 'pending' | 'completed') => void; compact?: boolean }) {
  return <section className={`board-section ${compact ? 'compact-board' : ''}`}><div className="board-top"><div><span className="eyebrow">ACOMPANHAMENTO VISUAL</span><h2>{compact ? 'Painel de viagens' : 'Quadro de viagens'}</h2><p>Organize etapas sem alterar os status individuais dos procedimentos.</p></div><div className="board-controls"><div className="board-search"><Search size={15}/><input placeholder="Buscar viagem…" value={query} onChange={e => setQuery(e.target.value)}/></div><select className="board-filter" value={filter} onChange={e => setFilter(e.target.value as typeof filter)} aria-label="Filtrar viagens"><option value="all">Todas as viagens</option><option value="pending">Em andamento</option><option value="completed">Concluídas</option></select><button className="icon-btn sort-btn" title="Ordenação por data de embarque"><ArrowDownUp size={16}/></button></div></div><div className="board-meta"><span><i className="live-dot"/> {trips.length} viagem(ns) encontrada(s)</span><button className="text-action" onClick={onCreate}><Plus size={15}/> Nova viagem</button></div><div className="kanban-scroll"><div className="kanban-grid">{stages.map(stage => { const list = trips.filter(t => t.stage === stage.id); return <div className="kanban-column" key={stage.id}><div className="column-heading"><span className={`column-dot ${stage.tone}`}/><b>{stage.label}</b><span className="column-count">{list.length}</span><button className="icon-btn more-column" aria-label="Mais opções"><MoreHorizontal size={17}/></button></div>{stage.id === 'new' && <button className="add-card-btn" onClick={onCreate}><Plus size={15}/> Cadastrar viagem</button>}<div className="card-stack">{list.map(trip => <TripCard key={trip.id} trip={trip} stage={stage} onSelect={() => onSelect(trip)} onMove={onMove}/>)}</div>{list.length === 0 && stage.id !== 'new' && <div className="column-empty">Nenhuma viagem nesta etapa</div>}</div>; })}</div></div></section>;
}
function TripCard({ trip, stage, onSelect, onMove }: { trip: Trip; stage: typeof stages[number]; onSelect: () => void; onMove: (t: Trip, s: TripStage) => void }) {
  const [menu, setMenu] = useState(false);
  const stageTasks = (trip as any).pending_count as number | undefined;
  return <article className="trip-card"><div className="trip-card-top"><span className={`stage-pill ${stage.tone}`}><i/> {stage.label}</span><div className="card-menu-wrap"><button className="icon-btn" onClick={() => setMenu(!menu)} aria-label="Alterar etapa"><MoreHorizontal size={18}/></button>{menu && <div className="stage-menu">{stages.filter(s => s.id !== trip.stage).map(s => <button key={s.id} onClick={() => { onMove(trip, s.id); setMenu(false); }}>{s.label}</button>)}</div>}</div></div><button className="card-main" onClick={onSelect}><b>{trip.passenger_name}</b><span className="card-company"><Users size={13}/>{trip.company ?? 'Empresa não informada'}</span><span className="card-destination"><MapPin size={14}/>{trip.destination}{trip.country ? `, ${trip.country}` : ''}</span><div className="card-dates"><span><CalendarDays size={13}/>{dateBR(trip.departure_date)} – {dateBR(trip.return_date)}</span></div>{trip.airline && <span className="airline-chip"><Plane size={12}/>{trip.airline}</span>}</button><div className="card-footer"><span className="task-counter"><CheckCheck size={14}/>{stageTasks ?? '—'} pendências</span><button className="card-open" onClick={onSelect}>Abrir viagem <ChevronRight size={14}/></button></div></article>; }
function TaskList({ tasks, trips, toggleTask, openTrip }: { tasks: Task[]; trips: Trip[]; toggleTask: (t: Task) => void; openTrip: (t: Trip) => void }) {
  return <div className="task-table">{tasks.length === 0 ? <div className="table-empty"><CheckCheck size={22}/><b>Nenhuma tarefa encontrada</b><span>As tarefas cadastradas aparecerão aqui.</span></div> : tasks.map(task => { const trip = trips.find(t => t.id === task.trip_id); const isLate = task.status !== 'completed' && task.due_date && task.due_date < today; return <div className="task-row" key={task.id}><button className={task.status === 'completed' ? 'task-check checked' : 'task-check'} onClick={() => toggleTask(task)} aria-label="Alterar conclusão">{task.status === 'completed' && <Check size={13}/>}</button><div className="task-row-main"><b className={task.status === 'completed' ? 'strike' : ''}>{task.title}</b><span>{trip ? <button className="inline-link" onClick={() => openTrip(trip)}>{trip.passenger_name} · {trip.destination}</button> : 'Atividade geral'}</span></div><span className={`priority-dot ${task.priority}`}>{priorityLabel[task.priority]}</span><span className={`task-due ${isLate ? 'late' : ''}`}>{task.due_date ? `${dateBR(task.due_date)}${task.due_time ? ` · ${task.due_time.slice(0,5)}` : ''}` : 'Sem prazo'}</span><span className={`task-status ${task.status}`}>{isLate ? 'Atrasada' : taskStatusLabel[task.status]}</span><button className="icon-btn" onClick={() => trip && openTrip(trip)} aria-label="Abrir viagem"><ChevronRight size={17}/></button></div>; })}</div>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div className="detail-cell"><span>{label}</span><b>{value}</b></div>; }
function DocumentRow({ doc, onOpen }: { doc: TravelDocument; onOpen: (d: TravelDocument) => void }) { return <button className="document-row" onClick={() => onOpen(doc)}><span className="document-icon"><FileText size={17}/></span><span className="document-name"><b>{doc.file_name}</b><small>Adicionado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(doc.created_at))}</small></span><ArrowUpRight size={15}/></button>; }

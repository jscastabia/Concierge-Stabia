'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2 } from 'lucide-react';

type DocumentRow = {
  id: string;
  file_name: string;
  storage_path: string;
  created_at: string;
  trip_id: string | null;
  task_id: string | null;
};
type TaskRow = { id: string; title: string; trip_id: string | null };

/** Adds per-file delete buttons to the existing trip and task attachment rows. */
export default function AttachmentDeleteControls() {
  const [userId, setUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const documentsRef = useRef<DocumentRow[]>([]);
  const tasksRef = useRef<TaskRow[]>([]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    const loadUserData = async (id: string | null) => {
      setUserId(id);
      documentsRef.current = [];
      tasksRef.current = [];
      if (!id) return;

      const [documentsResult, tasksResult] = await Promise.all([
        supabase!.from('documents').select('id,file_name,storage_path,created_at,trip_id,task_id').eq('owner_id', id),
        supabase!.from('tasks').select('id,title,trip_id').eq('owner_id', id),
      ]);
      if (!mounted) return;
      if (!documentsResult.error) documentsRef.current = (documentsResult.data ?? []) as DocumentRow[];
      if (!tasksResult.error) tasksRef.current = (tasksResult.data ?? []) as TaskRow[];
    };

    supabase.auth.getSession().then(({ data }) => {
      void loadUserData(data.session?.user.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadUserData(session?.user.id ?? null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let scheduled = false;

    const addDeleteButtons = () => {
      scheduled = false;
      document.querySelectorAll<HTMLElement>('.document-row, .doc-chip').forEach(row => {
        if (row.nextElementSibling?.classList.contains('attachment-delete-control')) return;

        const text = (row.textContent ?? '').trim();
        const filenameMatch = documentsRef.current.filter(doc => text.includes(doc.file_name));
        let match: DocumentRow | undefined;

        if (row.classList.contains('document-row')) {
          const dated = filenameMatch.filter(doc => {
            const date = new Intl.DateTimeFormat('pt-BR', {
              dateStyle: 'short',
              timeZone: 'America/Sao_Paulo',
            }).format(new Date(doc.created_at));
            return text.includes(date);
          });
          if (dated.length === 1) match = dated[0];
          else if (filenameMatch.length === 1) match = filenameMatch[0];
        } else {
          const taskTitle = row.closest('.trip-task')?.querySelector('.trip-task-info b')?.textContent?.trim();
          const matchingTasks = tasksRef.current.filter(task => task.title === taskTitle);
          const matchingTaskIds = new Set(matchingTasks.map(task => task.id));
          const taskDocuments = filenameMatch.filter(doc => doc.task_id && matchingTaskIds.has(doc.task_id));
          if (taskDocuments.length === 1) match = taskDocuments[0];
        }

        if (!match) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'attachment-delete-control';
        button.dataset.documentId = match.id;
        button.setAttribute('aria-label', `Excluir anexo ${match.file_name}`);
        button.title = `Excluir ${match.file_name}`;
        button.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:30px;height:30px;margin:4px;border:1px solid #fee2e2;border-radius:8px;background:#fff;color:#dc2626;cursor:pointer';
        button.append('×');
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          void deleteAttachment(match!);
        });
        row.insertAdjacentElement('afterend', button);
      });
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(addDeleteButtons);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    return () => observer.disconnect();
  }, [userId]);

  async function deleteAttachment(doc: DocumentRow) {
    if (!supabase || !userId || busy) return;
    if (!window.confirm(`Excluir o anexo “${doc.file_name}”? Esta ação não pode ser desfeita.`)) return;

    setBusy(true);
    setError('');
    setNotice('');

    const { error: storageError } = await supabase.storage.from('trip-documents').remove([doc.storage_path]);
    if (storageError) {
      setBusy(false);
      setError('Não foi possível excluir o arquivo. Verifique a política de exclusão do bucket no Supabase.');
      return;
    }

    const { data, error: rowError } = await supabase
      .from('documents')
      .delete()
      .eq('id', doc.id)
      .eq('owner_id', userId)
      .select('id')
      .maybeSingle();

    if (rowError || !data) {
      setBusy(false);
      setError('O arquivo saiu do armazenamento, mas o registro não pôde ser excluído. Execute a migration de exclusão de documentos no Supabase e atualize a página.');
      return;
    }

    documentsRef.current = documentsRef.current.filter(item => item.id !== doc.id);
    document.querySelectorAll<HTMLElement>('.document-row, .doc-chip').forEach(row => {
      const button = row.nextElementSibling;
      if (button instanceof HTMLButtonElement && button.dataset.documentId === doc.id) {
        button.remove();
        row.remove();
      }
    });
    setBusy(false);
    setNotice(`Anexo excluído: ${doc.file_name}`);
    window.setTimeout(() => window.location.reload(), 900);
  }

  if (!notice && !error) return null;
  return (
    <div role={error ? 'alert' : 'status'} style={{ position: 'fixed', zIndex: 100, right: 20, bottom: 20, maxWidth: 430, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', color: error ? '#b91c1c' : '#334155', boxShadow: '0 12px 35px #0f172a22', fontSize: 13 }}>
      <Trash2 size={16} />
      <span>{busy ? 'Excluindo anexo…' : error || notice}</span>
      <button type="button" onClick={() => { setError(''); setNotice(''); }} aria-label="Fechar aviso" style={{ border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer' }}>×</button>
    </div>
  );
}

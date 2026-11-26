'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2, X } from 'lucide-react';

type DocumentRow = { id: string; file_name: string; storage_path: string; created_at: string };

/** Adds safe, per-file delete controls to the attachment rows in the trip detail card. */
export default function AttachmentDeleteControls() {
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const documentsRef = useRef<DocumentRow[]>([]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const loadForUser = async (id: string | null) => {
      setUserId(id);
      documentsRef.current = [];
      if (!id) return;
      const { data, error } = await supabase!.from('documents')
        .select('id,file_name,storage_path,created_at')
        .eq('owner_id', id);
      if (mounted && !error) documentsRef.current = (data ?? []) as DocumentRow[];
    };
    supabase.auth.getSession().then(({ data }) => { void loadForUser(data.session?.user.id ?? null); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { void loadForUser(session?.user.id ?? null); });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let scheduled = false;
    const decorate = () => {
      scheduled = false;
      const controls = document.querySelectorAll<HTMLElement>('.document-row, .doc-chip');
      controls.forEach(row => {
        if (row.parentElement?.querySelector(`[data-delete-attachment="${CSS.escape(row.textContent ?? '')}"]`)) return;
        const renderedText = (row.textContent ?? '').trim();
        const matches = documentsRef.current.filter(doc => renderedText.includes(doc.file_name));
        let match = matches.length === 1 ? matches[0] : undefined;
        if (matches.length > 1) {
          const datedMatches = matches.filter(doc => {
            const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(doc.created_at));
            return renderedText.includes(date);
          });
          if (datedMatches.length === 1) match = datedMatches[0];
        }
        if (!match || !row.parentElement) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.deleteAttachment = renderedText;
        button.title = `Excluir anexo ${match.file_name}`;
        button.setAttribute('aria-label', `Excluir anexo ${match.file_name}`);
        button.className = 'attachment-delete-control';
        button.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:30px;height:30px;margin:4px;border:1px solid #fee2e2;border-radius:8px;background:#fff;color:#dc2626;cursor:pointer';
        button.innerHTML = '<span aria-hidden="true">×</span>';
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
      window.requestAnimationFrame(decorate);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    return () => observer.disconnect();
  }, [userId]);

  async function deleteAttachment(doc: DocumentRow) {
    if (!supabase || busyId) return;
    const confirmed = window.confirm(`Excluir o anexo “${doc.file_name}”? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;
    setBusyId(doc.id);
    setMessage('');

    const { error: storageError } = await supabase.storage.from('trip-documents').remove([doc.storage_path]);
    if (storageError) {
      setBusyId(null);
      setMessage(`Não foi possível excluir o arquivo “${doc.file_name}”. Verifique a política de exclusão do bucket e tente novamente.`);
      return;
    }

    const { data, error: rowError } = await supabase.from('documents').delete()
      .eq('id', doc.id).eq('owner_id', userId).select('id').maybeSingle();
    if (rowError || !data) {
      setBusyId(null);
      setMessage('O arquivo foi removido do armazenamento, mas o registro não pôde ser excluído. Atualize a página e confira a política de exclusão de documentos no Supabase.');
      return;
    }

    documentsRef.current = documentsRef.current.filter(item => item.id !== doc.id);
    document.querySelectorAll<HTMLElement>('.document-row, .doc-chip').forEach(row => {
      if ((row.textContent ?? '').includes(doc.file_name)) {
        row.nextElementSibling?.matches('.attachment-delete-control') && row.nextElementSibling.remove();
        row.remove();
      }
    });
    setBusyId(null);
    setMessage(`Anexo “${doc.file_name}” excluído.`);
    window.setTimeout(() => window.location.reload(), 700);
  }

  if (!message) return null;
  return <div role="status" style={{ position: 'fixed', zIndex: 100, right: 20, bottom: 20, maxWidth: 430, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', color: '#334155', boxShadow: '0 12px 35px #0f172a22', fontSize: 13 }}>
    <Trash2 size={16} color={message.startsWith('Anexo') ? '#059669' : '#dc2626'} />
    <span style={{ flex: 1 }}>{busyId ? 'Excluindo anexo…' : message}</span>
    <button type="button" onClick={() => setMessage('')} aria-label="Fechar aviso" style={{ border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer' }}><X size={15}/></button>
  </div>;
}

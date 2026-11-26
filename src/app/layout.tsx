import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Concierge Stabia | Gestão de viagens',
  description: 'Centralize viagens corporativas, tarefas e documentos da sua operação de concierge.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}

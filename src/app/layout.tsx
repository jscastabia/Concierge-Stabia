import type { Metadata } from 'next';
import './globals.css';
import AuthRecoveryShortcut from '@/components/auth-recovery-shortcut';

export const metadata: Metadata = {
  title: 'Concierge Stabia | Gestão de viagens',
  description: 'Centralize viagens corporativas, tarefas e documentos da sua operação de concierge.',
};

const criticalStyles = `
  html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif;color:#172033;background:#f7f8fc}
  button,input,textarea,select{font:inherit}button{cursor:pointer}
  .login-screen{display:flex;min-height:100vh;background:#fff}
  .login-art{position:relative;display:flex;flex:1;align-self:stretch;flex-direction:column;justify-content:center;overflow:hidden;padding:8%;color:#fff;background:linear-gradient(145deg,#2c24bf,#5648ec 54%,#8075ff)}
  .login-art:after{position:absolute;right:-17%;bottom:-34%;width:68vw;height:68vw;border:1px solid #ffffff26;border-radius:50%;content:''}
  .art-orbit{position:absolute;border:1px solid #ffffff25;border-radius:50%}.orbit-one{top:-32%;left:-9%;width:66vw;height:66vw}.orbit-two{top:-22%;left:-2%;width:52vw;height:52vw}
  .travel-globe{position:absolute;top:21%;right:21%;display:grid;width:124px;height:124px;place-items:center;border:1px solid #ffffff55;border-radius:50%;background:#ffffff18;box-shadow:0 16px 70px #1f197c66;font-size:52px}
  .art-copy,.art-foot{position:relative;z-index:1}.art-copy{margin-top:85px}.eyebrow{display:block;color:#8b91a2;font-size:10px;font-weight:800;letter-spacing:.13em}.art-copy .eyebrow{color:#d4d0ff}.art-copy h1{margin:17px 0;font-size:clamp(42px,5vw,68px);line-height:1.02;letter-spacing:-2.7px}.art-copy p{color:#e2e0ff;font-size:16px}.art-foot{margin-top:90px;color:#d4d0ff;font-size:9px;font-weight:700;letter-spacing:.16em}
  .login-panel{display:grid;width:min(47%,680px);min-height:100vh;place-items:center;padding:40px}.login-box{width:min(100%,380px)}.brand-row{display:flex;align-items:center;gap:11px;margin-bottom:48px}.brand-row>b{font-size:16px;letter-spacing:-.4px}.brand-row>b span{color:#5146e5}.brand-mark{display:grid;width:42px;height:42px;flex:0 0 auto;place-items:center;border-radius:14px;background:linear-gradient(140deg,#7669ff,#4033db 75%);box-shadow:0 7px 18px #5044e43a;color:white;font-size:25px;font-weight:800}.login-box>.eyebrow{color:#5146e5}.login-box h2{margin:12px 0 8px;font-size:30px;letter-spacing:-.9px}.login-box>p{margin:0 0 27px;color:#788398}.form-stack{display:grid;gap:17px}.form-stack label{display:grid;gap:8px;color:#475268;font-size:12px;font-weight:700}.form-stack input{width:100%;min-height:43px;padding:11px 12px;border:1px solid #dfe3ec;border-radius:9px;background:#fff;font-size:13px;font-weight:400}.form-stack input:focus{border-color:#8c83fa;outline:0;box-shadow:0 0 0 3px #5146e515}.primary-btn{display:inline-flex;min-height:42px;align-items:center;justify-content:center;gap:8px;padding:0 15px;border:0;border-radius:9px;background:#5146e5;color:#fff;font-size:12px;font-weight:700}.primary-btn:hover{background:#4034cf}.primary-btn.wide{width:100%;min-height:47px}.form-error{color:#d84c62;font-size:12px}.login-secure{display:flex;justify-content:center;align-items:center;gap:7px;margin-top:25px;color:#8a93a5;font-size:11px}
  .auth-recovery-link{position:fixed;z-index:40;right:22px;bottom:18px;padding:10px 14px;border:1px solid #dedbff;border-radius:10px;background:#fff;color:#5146d5;text-decoration:none;font-size:12px;font-weight:700;box-shadow:0 8px 26px #18264a18}.auth-recovery-link:hover{background:#f6f5ff}
  .auth-page{display:grid;min-height:100vh;place-items:center;padding:24px;background:radial-gradient(ellipse at 10% 12%,#e9e7ff,transparent 38%),#f7f8fc}.auth-card{width:min(100%,440px);padding:30px;border:1px solid #e8ebf2;border-radius:20px;background:#fff;box-shadow:0 24px 70px #26325212}.auth-card h1{margin:8px 0;font-size:25px}.auth-card p{color:#788398;font-size:13px;line-height:1.6}.auth-card form{display:grid;gap:14px;margin-top:20px}.auth-card label{display:grid;gap:7px;color:#475268;font-size:12px;font-weight:700}.auth-card input{min-height:42px;padding:10px 12px;border:1px solid #dfe3ec;border-radius:9px}.auth-card a{color:#5146d5;font-size:12px}.auth-notice{margin:14px 0;padding:11px;border-radius:9px;background:#f1fbf5;color:#27744f;font-size:12px;line-height:1.5}.auth-error{margin:14px 0;padding:11px;border-radius:9px;background:#fff1f0;color:#b43c43;font-size:12px;line-height:1.5}
  @media(max-width:700px){.login-art{display:none}.login-panel{width:100%;padding:28px}.travel-globe{right:10%;width:90px;height:90px}}
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><style dangerouslySetInnerHTML={{ __html: criticalStyles }} />{children}<AuthRecoveryShortcut /></body></html>;
}

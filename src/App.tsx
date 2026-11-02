import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Atendimento from "@/pages/Atendimento";
import Comprovantes from "@/pages/Comprovantes";
import Usuarios from "@/pages/Usuarios";
import Unidades from "@/pages/Unidades";
import Simulador from "@/pages/Simulador";
import BoletoTeste from "@/pages/BoletoTeste";
import type { Modulo } from "@/lib/supabase";

function Protegida({ modulo, children }: { modulo?: Modulo; children: JSX.Element }) {
  const { sessao, perfil, carregando, pode } = useAuth();
  if (carregando) return <div className="flex h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  if (!sessao) return <Navigate to="/login" replace />;
  if (!perfil?.ativo) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold">Acesso aguardando liberação</p>
        <p className="text-muted-foreground">Peça ao administrador da sua unidade para ativar seu usuário.</p>
      </div>
    );
  }
  if (modulo && !pode(modulo)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function Inicio() {
  const { pode } = useAuth();
  if (pode("atendimento")) return <Navigate to="/atendimento" replace />;
  if (pode("comprovantes")) return <Navigate to="/comprovantes" replace />;
  return <div className="p-8 text-muted-foreground">Nenhuma tela liberada para o seu usuário.</div>;
}

export default function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <Toaster richColors position="top-right" />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protegida><Inicio /></Protegida>} />
            <Route path="/atendimento" element={<Protegida modulo="atendimento"><Atendimento /></Protegida>} />
            <Route path="/comprovantes" element={<Protegida modulo="comprovantes"><Comprovantes /></Protegida>} />
            <Route path="/usuarios" element={<Protegida modulo="configuracoes"><Usuarios /></Protegida>} />
            <Route path="/simulador" element={<Protegida modulo="configuracoes"><Simulador /></Protegida>} />
            <Route path="/boleto-teste" element={<Protegida><BoletoTeste /></Protegida>} />
            <Route path="/unidades" element={<Protegida modulo="configuracoes"><Unidades /></Protegida>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  );
}

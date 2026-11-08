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
import Financeiro from "@/pages/Financeiro";
import Pedagogico from "@/pages/Pedagogico";
import Encaminhamento from "@/pages/Encaminhamento";
import Pops from "@/pages/Pops";
import Regua from "@/pages/Regua";
import Faltantes from "@/pages/Faltantes";
import Dashboard from "@/pages/Dashboard";
import Agencia from "@/pages/Agencia";
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
  return <Dashboard />;
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
            <Route path="/financeiro" element={<Protegida modulo="financeiro"><Financeiro /></Protegida>} />
            <Route path="/pedagogico" element={<Protegida modulo="pedagogico"><Pedagogico /></Protegida>} />
            <Route path="/encaminhamento" element={<Protegida modulo="encaminhamento"><Encaminhamento /></Protegida>} />
            <Route path="/agencia" element={<Protegida modulo="encaminhamento"><Agencia /></Protegida>} />
            <Route path="/regua" element={<Protegida modulo="financeiro"><Regua /></Protegida>} />
            <Route path="/faltantes" element={<Protegida modulo="pedagogico"><Faltantes /></Protegida>} />
            <Route path="/pops" element={<Protegida><Pops /></Protegida>} />
            <Route path="/boleto-teste" element={<Protegida><BoletoTeste /></Protegida>} />
            <Route path="/unidades" element={<Protegida modulo="configuracoes"><Unidades /></Protegida>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  );
}

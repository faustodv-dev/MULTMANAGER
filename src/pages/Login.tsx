import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { sessao } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (sessao) return <Navigate to="/" replace />;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setEnviando(false);
    if (error) setErro(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <form onSubmit={enviar} className="w-full max-w-sm space-y-5 rounded-2xl bg-card p-8 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold">MULT Profissões</h1>
          <p className="text-sm text-muted-foreground">CRM financeiro e pedagógico</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="senha">Senha</Label>
          <Input id="senha" type="password" autoComplete="current-password" minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </div>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Aguarde…" : "Entrar"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">Sem acesso? Peça ao administrador da sua unidade.</p>
      </form>
    </div>
  );
}

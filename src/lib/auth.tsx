import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, type Modulo, type Perfil, type Unidade } from "./supabase";

interface Ctx {
  sessao: Session | null;
  perfil: Perfil | null;
  unidades: Unidade[];
  carregando: boolean;
  pode: (m: Modulo) => boolean;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;
}

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregarPerfil = async (s: Session | null) => {
    if (!s) {
      setPerfil(null);
      setUnidades([]);
      setCarregando(false);
      return;
    }
    const { data: p } = await supabase.from("profiles").select("*").eq("id", s.user.id).maybeSingle();
    setPerfil((p as Perfil) ?? null);
    const { data: u } = await supabase.from("units").select("*").order("name");
    setUnidades((u as Unidade[]) ?? []);
    setCarregando(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      carregarPerfil(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSessao(s);
      setTimeout(() => carregarPerfil(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const pode = (m: Modulo) => {
    if (!perfil?.ativo) return false;
    if (perfil.papel === "master" || perfil.papel === "admin") return true;
    return perfil.modulos?.includes(m) ?? false;
  };

  return (
    <AuthCtx.Provider
      value={{
        sessao, perfil, unidades, carregando, pode,
        sair: async () => { await supabase.auth.signOut(); },
        recarregar: () => carregarPerfil(sessao),
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth fora do AuthProvider");
  return c;
}

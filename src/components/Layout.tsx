import { NavLink } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { MessageCircle, Receipt, Users, Building2, LogOut, FlaskConical } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const PAPEL: Record<string, string> = { master: "Master geral", admin: "Administrador", colaborador: "Colaborador" };

export default function Layout({ children }: { children: ReactNode }) {
  const { perfil, unidades, pode, sair } = useAuth();
  const [pendencias, setPendencias] = useState(0);

  useEffect(() => {
    const contar = async () => {
      const { count } = await supabase.from("pendencias").select("id", { count: "exact", head: true }).is("resolvido_em", null).eq("simulacao", false);
      setPendencias(count ?? 0);
    };
    contar();
    const canal = supabase
      .channel("layout-pendencias")
      .on("postgres_changes", { event: "*", schema: "public", table: "pendencias" }, contar)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);

  const itens = [
    { to: "/atendimento", rotulo: "Atendimento", icone: MessageCircle, ok: pode("atendimento"), badge: pendencias },
    { to: "/comprovantes", rotulo: "Comprovantes", icone: Receipt, ok: pode("comprovantes") },
    { to: "/simulador", rotulo: "Simulador", icone: FlaskConical, ok: perfil?.papel === "master" || perfil?.papel === "admin" },
    { to: "/usuarios", rotulo: "Usuários", icone: Users, ok: pode("configuracoes") },
    { to: "/unidades", rotulo: "Unidades", icone: Building2, ok: pode("configuracoes") },
  ].filter((i) => i.ok);

  const unidade = unidades.find((u) => u.id === perfil?.unit_id);

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-row items-center gap-1 overflow-x-auto bg-sidebar px-3 py-2 text-sidebar-foreground md:w-60 md:flex-col md:items-stretch md:gap-2 md:px-4 md:py-6">
        <div className="mr-3 md:mb-6 md:mr-0">
          <p className="text-lg font-bold leading-tight">MULT</p>
          <p className="hidden text-xs text-sidebar-foreground/60 md:block">Financeiro &amp; Pedagógico</p>
        </div>
        {itens.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
                isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
              )
            }
          >
            <i.icone className="h-4 w-4" />
            <span>{i.rotulo}</span>
            {!!i.badge && (
              <span className="ml-auto rounded-full bg-destructive px-2 text-xs font-semibold text-destructive-foreground">{i.badge}</span>
            )}
          </NavLink>
        ))}
        <div className="ml-auto md:ml-0 md:mt-auto">
          <div className="hidden border-t border-sidebar-border pt-4 text-xs md:block">
            <p className="truncate font-medium">{perfil?.nome || perfil?.email}</p>
            <p className="text-sidebar-foreground/60">{PAPEL[perfil?.papel ?? "colaborador"]}{unidade ? ` · ${unidade.name}` : ""}</p>
          </div>
          <button onClick={sair} className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" /> <span className="hidden md:inline">Sair</span>
          </button>
        </div>
      </aside>
      <main className="min-h-0 flex-1 overflow-hidden bg-background">{children}</main>
    </div>
  );
}

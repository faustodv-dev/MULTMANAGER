import { Receipt } from "lucide-react";
import Departamento from "./Departamento";

export default function Financeiro() {
  return <Departamento departamento="financeiro" titulo="Tarefas Financeiras" Icone={Receipt} />;
}

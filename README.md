# MULT Connect

Create a modern, collaborative task management dashboard called "MULT Manager", designed for a professional school network. The design should be high-end, clean, and intuitive, similar to tools like Asana, Linear, or Monday.com. Use a professional color palette (Navy Blue, Orange accents, and White/Light Gray backgrounds).

### Tech Stack & Styling:
- React + Vite + Tailwind CSS.
- Use Shadcn/UI components for cards, buttons, avatars, and badges.
- Use Lucide React for icons.
- Font: Inter or system-ui for a clean look.

### Core Layout:
1. **Sidebar Navigation (Left):**
   - Logo "MULT Profissões" at the top.
   - Menu items: "Dashboard", "Minhas Tarefas" (My Tasks), "Financeiro", "Pedagógico", "Agência de Encaminhamento", "Configurações".
   - User profile section at the bottom.

2. **Main Content Area:**
   - A header with a search bar, notifications bell, and date filter.
   - A Metric Cards row at the top: "Tarefas Hoje", "Atrasadas", "Concluídas na Semana", "Produtividade".

3. **Task View (Kanban & List):**
   - Create a Kanban board with columns: "A Fazer" (To Do), "Em Andamento" (In Progress), "Revisão" (Review), "Concluído" (Done).
   - Each task card must show: Task Title, Frequency badge (Daily, Monthly, Weekly), Assignee Avatar (Tiago, Lidia, João, etc.), Priority Flag, and Due Date.

### Specific Data to Pre-populate (Based on internal processes):

Please pre-load the state with these specific tasks organized by Department:

**Dept: AGÊNCIA DE ENCAMINHAMENTO (Color: Green)**
- Task: "Atualizar Mural de Aniversariantes" | Freq: Mensal (Dia 1) | Assignee: Lidia | Status: A Fazer
- Task: "Atualizar Mural de Alunos Encaminhados" | Freq: Mensal (Dia 1) | Assignee: Lidia | Status: A Fazer
- Task: "Ligar para Empresas Parceiras (Vagas)" | Freq: Semanal | Assignee: Lidia | Status: Em Andamento
- Task: "Conferência de Documentos da Agência" | Freq: Mensal | Assignee: Lidia | Status: A Fazer
- Task: "Coletar Testemunho de Alunos" | Freq: Semanal | Assignee: Lidia | Status: Revisão

**Dept: FINANCEIRO (Color: Blue)**
- Task: "Ligar para Alunos Inadimplentes (+5 dias)" | Freq: Diário | Assignee: Tiago | Status: A Fazer
- Task: "Enviar WhatsApp avisando Negativação" | Freq: Mensal | Assignee: Fausto/Tiago | Status: A Fazer
- Task: "Conferir Contratos no ZapSign" | Freq: Mensal | Assignee: Tiago | Status: Concluído
- Task: "Realizar Pós-Venda (Matrículas Mês Anterior)" | Freq: Mensal | Assignee: Tiago | Status: Em Andamento
- Task: "Arquivar Termos de Rescisão" | Freq: Mensal | Assignee: Tiago | Status: A Fazer

**Dept: PEDAGÓGICO (Color: Orange)**
- Task: "Impressão de Certificados" | Freq: Mensal | Assignee: João Vitor | Status: A Fazer
- Task: "Manutenção Máquinas Lab Hardware" | Freq: Mensal | Assignee: José Vitor | Status: Em Andamento
- Task: "Padronização Lab Informática" | Freq: Mensal | Assignee: José Vitor | Status: A Fazer
- Task: "Enviar Msg Grupo (Aulas do Dia)" | Freq: Diário | Assignee: João Vitor | Status: Concluído
- Task: "Enviar Msg Alunos Faltantes" | Freq: Diário | Assignee: João Vitor | Status: A Fazer

### Functionality Requirements:
- Allow filtering tasks by "Responsável" (Tiago, Lidia, Ketlyn, Fausto, José Vitor, Camila, Arthur).
- Allow filtering by "Frequência" (Diário, Semanal, Mensal).
- When a task is clicked, open a side drawer with details: "Procedimento" (Description) and Checklist.
- Make the UI responsive and highly interactive (hover effects, drag and drop simulation).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://multmanager.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9e5a337b-f7fe-485f-812c-3116e9ec8a2e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

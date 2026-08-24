import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLeads } from "@/hooks/useLeads";
import { useSchoolUnits } from "@/hooks/useSchoolUnits";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ExportDropdown } from "@/components/ExportDropdown";
import { 
  DollarSign, 
  CreditCard, 
  Banknote, 
  GraduationCap,
  Shirt,
  Receipt,
  TrendingUp,
  CheckCircle2,
  XCircle,
  CalendarIcon,
  X,
  ArrowLeft,
  School
} from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const FinancialReport = () => {
  const navigate = useNavigate();
  const { data: leads = [] } = useLeads();
  const { data: schoolUnits = [] } = useSchoolUnits();
  const { profile: authProfile, isUnitAdmin, isAdmin } = useAuth();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    isUnitAdmin && authProfile?.unit_id ? authProfile.unit_id : 'all'
  );
  
  // Filter only leads in "matricula" stage and within date range and unit
  const enrolledLeads = useMemo(() => {
    return leads.filter(lead => {
      if (lead.stage !== "finalizado") return false;
      
      // Unit filter (unit_admin can only see their unit)
      if (isUnitAdmin && authProfile?.unit_id) {
        if (lead.unit_id !== authProfile.unit_id) return false;
      } else if (selectedUnitId !== 'all') {
        if (lead.unit_id !== selectedUnitId) return false;
      }
      
      // If no date filter, include all enrolled leads
      if (!startDate && !endDate) return true;
      
      // Use converted_at date for filtering
      const leadDate = lead.converted_at ? new Date(lead.converted_at) : null;
      if (!leadDate) return !startDate && !endDate;
      
      // Apply date range filter
      if (startDate && endDate) {
        return isWithinInterval(leadDate, {
          start: startOfDay(startDate),
          end: endOfDay(endDate)
        });
      }
      
      if (startDate) {
        return leadDate >= startOfDay(startDate);
      }
      
      if (endDate) {
        return leadDate <= endOfDay(endDate);
      }
      
      return true;
    });
  }, [leads, startDate, endDate, selectedUnitId, isUnitAdmin, authProfile?.unit_id]);

  // Calculate totals
  const totals = enrolledLeads.reduce((acc, lead) => {
    const enrollmentFee = lead.enrollment_fee_paid ? (lead.enrollment_fee_value || 0) : 0;
    const firstInstallment = lead.first_installment_paid ? (lead.first_installment_value || 0) : 0;
    const uniform = lead.uniform_paid ? (lead.uniform_value || 0) : 0;
    
    return {
      totalReceived: acc.totalReceived + enrollmentFee + firstInstallment + uniform,
      enrollmentFees: acc.enrollmentFees + enrollmentFee,
      firstInstallments: acc.firstInstallments + firstInstallment,
      uniforms: acc.uniforms + uniform,
      enrollmentPaidCount: acc.enrollmentPaidCount + (lead.enrollment_fee_paid ? 1 : 0),
      firstInstallmentPaidCount: acc.firstInstallmentPaidCount + (lead.first_installment_paid ? 1 : 0),
      uniformPaidCount: acc.uniformPaidCount + (lead.uniform_paid ? 1 : 0),
      cardPayments: acc.cardPayments + (lead.payment_method === "cartao" ? 1 : 0),
      pixPayments: acc.pixPayments + (lead.payment_method === "pix" ? 1 : 0),
      cashPayments: acc.cashPayments + (lead.payment_method === "dinheiro" ? 1 : 0),
    };
  }, {
    totalReceived: 0,
    enrollmentFees: 0,
    firstInstallments: 0,
    uniforms: 0,
    enrollmentPaidCount: 0,
    firstInstallmentPaidCount: 0,
    uniformPaidCount: 0,
    cardPayments: 0,
    pixPayments: 0,
    cashPayments: 0,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getPaymentMethodBadge = (method: string | null) => {
    switch (method) {
      case "cartao":
        return <Badge className="bg-blue-500"><CreditCard className="w-3 h-3 mr-1" /> Cartão</Badge>;
      case "pix":
        return <Badge className="bg-green-500"><Banknote className="w-3 h-3 mr-1" /> PIX</Badge>;
      case "dinheiro":
        return <Badge className="bg-yellow-500 text-black"><DollarSign className="w-3 h-3 mr-1" /> Dinheiro</Badge>;
      default:
        return <Badge variant="outline">Não informado</Badge>;
    }
  };

  const clearDateFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-card border-b sticky top-0 z-10 px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Relatório Financeiro</h1>
              <p className="text-sm text-muted-foreground">
                Leads em fase de matrícula: {enrolledLeads.length}
              </p>
            </div>
            
            {/* Export Button */}
            <ExportDropdown
              data={enrolledLeads}
              columns={[
                { key: 'name', header: 'Nome' },
                { key: 'course_interest', header: 'Curso' },
                { key: 'payment_method', header: 'Forma Pagamento', formatter: (v) => v === 'cartao' ? 'Cartão' : v === 'pix' ? 'PIX' : v === 'dinheiro' ? 'Dinheiro' : 'N/I' },
                { key: 'enrollment_fee_value', header: 'Matrícula (R$)', formatter: (v, r) => r.enrollment_fee_paid ? (v || 0).toFixed(2) : '0.00' },
                { key: 'first_installment_value', header: '1ª Parcela (R$)', formatter: (v, r) => r.first_installment_paid ? (v || 0).toFixed(2) : '0.00' },
                { key: 'uniform_value', header: 'Uniforme (R$)', formatter: (v, r) => r.uniform_paid ? (v || 0).toFixed(2) : '0.00' },
                { key: 'converted_at', header: 'Data Matrícula', formatter: (v) => v ? format(new Date(v), 'dd/MM/yyyy') : '' },
              ]}
              filename="relatorio-financeiro"
              title="Relatório Financeiro - Matrículas"
            />
          </div>
        </header>

        <div className="flex-1 p-6 space-y-6">
          {/* Filters Row */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Unit Filter - only for admins */}
            {isAdmin && (
              <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                <SelectTrigger className="w-[180px]">
                  <School className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Todas as unidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as unidades</SelectItem>
                  {schoolUnits.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Date Range Filter */}
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[160px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Data inicial"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <span className="text-muted-foreground">até</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[160px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Data final"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    locale={ptBR}
                    className="pointer-events-auto"
                    disabled={(date) => startDate ? date < startDate : false}
                  />
                </PopoverContent>
              </Popover>

              {(startDate || endDate) && (
                <Button variant="ghost" size="icon" onClick={clearDateFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(totals.totalReceived)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Matrículas</CardTitle>
                <GraduationCap className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totals.enrollmentFees)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {totals.enrollmentPaidCount} de {enrolledLeads.length} pagas
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">1ª Parcela</CardTitle>
                <Receipt className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(totals.firstInstallments)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {totals.firstInstallmentPaidCount} de {enrolledLeads.length} pagas
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-500/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Uniformes</CardTitle>
                <Shirt className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(totals.uniforms)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {totals.uniformPaidCount} de {enrolledLeads.length} pagos
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Payment Methods Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Formas de Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10">
                  <CreditCard className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{totals.cardPayments}</p>
                    <p className="text-sm text-muted-foreground">Cartão</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10">
                  <Banknote className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{totals.pixPayments}</p>
                    <p className="text-sm text-muted-foreground">PIX</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10">
                  <DollarSign className="h-8 w-8 text-yellow-600" />
                  <div>
                    <p className="text-2xl font-bold">{totals.cashPayments}</p>
                    <p className="text-sm text-muted-foreground">Dinheiro</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leads Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalhamento por Lead</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {enrolledLeads.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum lead em fase de matrícula
                    </p>
                  ) : (
                    enrolledLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{lead.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {lead.course_interest || "Curso não informado"}
                          </p>
                          {lead.converted_at && (
                            <p className="text-xs text-muted-foreground">
                              Matriculado em: {format(new Date(lead.converted_at), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Payment Status Icons */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1" title="Matrícula">
                              <GraduationCap className="h-4 w-4" />
                              {lead.enrollment_fee_paid ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-1" title="1ª Parcela">
                              <Receipt className="h-4 w-4" />
                              {lead.first_installment_paid ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-1" title="Uniforme">
                              <Shirt className="h-4 w-4" />
                              {lead.uniform_paid ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          </div>

                          {/* Payment Method */}
                          {getPaymentMethodBadge(lead.payment_method)}

                          {/* Total Value */}
                          <div className="text-right min-w-[100px]">
                            <p className="font-bold text-green-600">
                              {formatCurrency(
                                (lead.enrollment_fee_paid ? (lead.enrollment_fee_value || 0) : 0) +
                                (lead.first_installment_paid ? (lead.first_installment_value || 0) : 0) +
                                (lead.uniform_paid ? (lead.uniform_value || 0) : 0)
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">recebido</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default FinancialReport;

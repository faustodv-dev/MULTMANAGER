import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, File } from 'lucide-react';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/exportUtils';

interface ExportColumn {
  key: string;
  header: string;
  formatter?: (value: any, row?: any) => string;
}

interface ExportDropdownProps {
  data: any[];
  columns: ExportColumn[];
  filename: string;
  title: string;
}

export function ExportDropdown({ data, columns, filename, title }: ExportDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportToExcel(data, columns, filename)}>
          <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
          Excel (.xls)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToCSV(data, columns, filename)}>
          <FileText className="w-4 h-4 mr-2 text-blue-600" />
          CSV (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToPDF(data, columns, filename, title)}>
          <File className="w-4 h-4 mr-2 text-red-600" />
          PDF (Imprimir)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExportColumn {
  key: string;
  header: string;
  formatter?: (value: any, row?: any) => string;
}

export function exportToCSV(data: any[], columns: ExportColumn[], filename: string) {
  const headers = columns.map(col => col.header).join(',');
  
  const rows = data.map(row => {
    return columns.map(col => {
      let value = row[col.key];
      if (col.formatter) {
        value = col.formatter(value, row);
      }
      // Escape commas and quotes
      if (typeof value === 'string') {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = `"${value.replace(/"/g, '""')}"`;
        }
      }
      return value ?? '';
    }).join(',');
  });

  const csv = [headers, ...rows].join('\n');
  downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

export function exportToExcel(data: any[], columns: ExportColumn[], filename: string) {
  // Create a simple XML-based Excel file (XLS format)
  const headers = columns.map(col => `<th>${escapeXml(col.header)}</th>`).join('');
  
  const rows = data.map(row => {
    const cells = columns.map(col => {
      let value = row[col.key];
      if (col.formatter) {
        value = col.formatter(value, row);
      }
      return `<td>${escapeXml(String(value ?? ''))}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const table = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"></head>
    <body>
      <table border="1">
        <thead><tr>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `;

  downloadFile(table, `${filename}.xls`, 'application/vnd.ms-excel');
}

export function exportToPDF(data: any[], columns: ExportColumn[], filename: string, title: string) {
  // Create a printable HTML that opens in a new window for PDF export
  const headers = columns.map(col => `<th style="border: 1px solid #000; padding: 8px; background: #f0f0f0;">${escapeXml(col.header)}</th>`).join('');
  
  const rows = data.map(row => {
    const cells = columns.map(col => {
      let value = row[col.key];
      if (col.formatter) {
        value = col.formatter(value, row);
      }
      return `<td style="border: 1px solid #000; padding: 8px;">${escapeXml(String(value ?? ''))}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { text-align: center; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${escapeXml(title)}</h1>
      <p style="text-align: center; color: #666; margin-bottom: 20px;">
        Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
      </p>
      <table>
        <thead><tr>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

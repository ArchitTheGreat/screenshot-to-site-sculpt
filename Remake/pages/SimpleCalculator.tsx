import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, ExternalLink } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from '../components/ui/sonner';
import jsPDF from 'jspdf';

interface Transaction {
  type: string;
  amount: number;
  value: number;
  date?: string;
  taxAmount: number;
  taxRate: number;
}

interface Jurisdiction {
  id: string;
  name: string;
  shortTermRate: number;
  longTermRate: number;
  description: string;
}

const jurisdictions: Jurisdiction[] = [
  {
    id: 'us-short',
    name: 'US Short-Term Capital Gains',
    shortTermRate: 37,
    longTermRate: 20,
    description: 'Assets held < 1 year'
  },
  {
    id: 'us-long',
    name: 'US Long-Term Capital Gains',
    shortTermRate: 20,
    longTermRate: 20,
    description: 'Assets held > 1 year'
  },
  {
    id: 'flat-30',
    name: 'Flat Rate 30%',
    shortTermRate: 30,
    longTermRate: 30,
    description: 'Standard flat rate'
  },
  {
    id: 'flat-20',
    name: 'Flat Rate 20%',
    shortTermRate: 20,
    longTermRate: 20,
    description: 'Lower flat rate'
  }
];

const SimpleCalculator = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hasPaid, setHasPaid] = useState(false);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>('us-short');
  
  const [totalBuys, setTotalBuys] = useState(0);
  const [totalSells, setTotalSells] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [totalTax, setTotalTax] = useState(0);
  const [netAfterTax, setNetAfterTax] = useState(0);

  const getCurrentJurisdiction = (): Jurisdiction => {
    return jurisdictions.find(j => j.id === selectedJurisdiction) || jurisdictions[0];
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      // Handle CSV with quoted fields
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  const categorizeTransaction = (type: string): 'buy' | 'sell' | 'swap' | 'unknown' => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('buy') || lowerType.includes('deposit') || lowerType.includes('receive')) {
      return 'buy';
    }
    if (lowerType.includes('sell') || lowerType.includes('withdraw') || lowerType.includes('send')) {
      return 'sell';
    }
    if (lowerType.includes('swap')) {
      return 'swap';
    }
    return 'unknown';
  };

  const parseValue = (value: string): number => {
    // Remove all non-numeric characters except decimal point and minus sign
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : Math.abs(parsed);
  };

  const calculateTaxes = (parsedData: string[][], jurisdiction: Jurisdiction) => {
    if (parsedData.length < 2) return;

    const headers = parsedData[0].map(h => h.toLowerCase());
    
    // Find column indices
    const typeIndex = headers.findIndex(h => 
      h.includes('type') || h.includes('transaction')
    );
    const valueIndex = headers.findIndex(h => 
      h.includes('amount') || h.includes('usd') || h.includes('value')
    );
    const dateIndex = headers.findIndex(h => 
      h.includes('date') || h.includes('time')
    );

    if (typeIndex === -1 || valueIndex === -1) {
      toast.error('Invalid CSV - Could not find required columns (type and value)');
      return;
    }

    const parsedTransactions: Transaction[] = [];
    let buys = 0;
    let sells = 0;

    for (let i = 1; i < parsedData.length; i++) {
      const row = parsedData[i];
      if (row.length <= 1) continue;

      const type = row[typeIndex] || '';
      const value = parseValue(row[valueIndex] || '0');
      const date = dateIndex !== -1 ? row[dateIndex] : undefined;

      const category = categorizeTransaction(type);
      let taxRate = 0;
      let taxAmount = 0;

      if (category === 'sell' || category === 'swap') {
        taxRate = jurisdiction.shortTermRate;
        taxAmount = value * (taxRate / 100);
        sells += value;
      } else if (category === 'buy') {
        buys += value;
      }

      parsedTransactions.push({
        type,
        amount: value,
        value,
        date,
        taxAmount,
        taxRate
      });
    }

    const profit = sells - buys;
    const tax = parsedTransactions.reduce((sum, t) => sum + t.taxAmount, 0);
    const afterTax = profit - tax;

    setTransactions(parsedTransactions);
    setTotalBuys(buys);
    setTotalSells(sells);
    setNetProfit(profit);
    setTotalTax(tax);
    setNetAfterTax(afterTax);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Invalid File - Please upload a CSV file');
      return;
    }

    setCsvFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setCsvData(parsed);
      calculateTaxes(parsed, getCurrentJurisdiction());
      toast.success(`CSV Uploaded - Loaded ${parsed.length - 1} transactions`);
    };
    reader.readAsText(file);
  };

  const handleJurisdictionChange = (value: string) => {
    setSelectedJurisdiction(value);
    if (csvData.length > 0) {
      const jurisdiction = jurisdictions.find(j => j.id === value) || jurisdictions[0];
      calculateTaxes(csvData, jurisdiction);
    }
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const generatePDF = () => {
    if (!csvFile || transactions.length === 0) {
      toast.error('No data to generate PDF');
      return;
    }

    const doc = new jsPDF();
    const margin = 20;
    const pageHeight = 280;
    let yPos = margin;

    const addNewPageIfNeeded = (requiredSpace: number) => {
      if (yPos + requiredSpace > pageHeight) {
        doc.addPage();
        yPos = margin;
      }
    };

    const addText = (text: string, size: number, style: 'normal' | 'bold' = 'normal', color: number[] = [0, 0, 0]) => {
      doc.setFontSize(size);
      doc.setFont('helvetica', style);
      doc.setTextColor(color[0], color[1], color[2]);
      
      const lines = doc.splitTextToSize(text, 170);
      lines.forEach((line: string) => {
        addNewPageIfNeeded(7);
        doc.text(line, margin, yPos);
        yPos += 7;
      });
    };

    // Header
    addText('KryptoGain Tax Report', 20, 'bold');
    addText('─────────────────────────────────', 11);
    yPos += 3;
    
    const now = new Date();
    addText(`File: ${csvFile.name}`, 11);
    addText(`Generated: ${now.toLocaleString('en-US')}`, 11);
    addText(`Tax Jurisdiction: ${getCurrentJurisdiction().name}`, 11);
    addText(`Total Transactions: ${transactions.length}`, 11);
    yPos += 5;

    // Financial Summary
    addText('Financial Summary', 16, 'bold');
    addText('─────────────────────────────────', 11);
    yPos += 3;
    
    addText(`Total Buys/Deposits: ${formatCurrency(totalBuys)}`, 12);
    addText(`Total Sells/Withdrawals: ${formatCurrency(totalSells)}`, 12);
    
    const profitColor = netProfit >= 0 ? [0, 128, 0] : [255, 0, 0];
    addText(`Net Profit/Loss: ${formatCurrency(netProfit)}`, 14, 'bold', profitColor);
    yPos += 3;
    
    addText(`Total Tax Owed: ${formatCurrency(totalTax)}`, 12, 'normal', [255, 69, 0]);
    addText(`Net After Tax: ${formatCurrency(netAfterTax)}`, 14, 'bold', [0, 100, 200]);
    yPos += 8;

    // Detailed Tax Breakdown
    addText('Detailed Tax Breakdown', 16, 'bold');
    addText('─────────────────────────────────', 11);
    yPos += 3;

    // Buys/Deposits
    const buys = transactions.filter(t => categorizeTransaction(t.type) === 'buy');
    if (buys.length > 0) {
      addText('Buys/Deposits (Not Taxable)', 14, 'bold');
      buys.forEach(t => {
        addText(`${t.type.toUpperCase()}: ${formatCurrency(t.value)} | Tax: $0.00`, 9);
      });
      yPos += 3;
    }

    // Sells/Withdrawals
    const sells = transactions.filter(t => {
      const cat = categorizeTransaction(t.type);
      return cat === 'sell';
    });
    if (sells.length > 0) {
      addText('Sells/Withdrawals (Taxable)', 14, 'bold');
      let sellsTax = 0;
      sells.forEach(t => {
        addText(`${t.type.toUpperCase()}: ${formatCurrency(t.value)} | Tax Rate: ${t.taxRate}% | Tax: ${formatCurrency(t.taxAmount)}`, 9, 'normal', [255, 69, 0]);
        sellsTax += t.taxAmount;
      });
      addText(`Subtotal Tax: ${formatCurrency(sellsTax)}`, 11, 'bold', [255, 69, 0]);
      yPos += 3;
    }

    // Swaps
    const swaps = transactions.filter(t => categorizeTransaction(t.type) === 'swap');
    if (swaps.length > 0) {
      addText('Swaps (Taxable)', 14, 'bold');
      let swapsTax = 0;
      swaps.forEach(t => {
        addText(`${t.type.toUpperCase()}: ${formatCurrency(t.value)} | Tax Rate: ${t.taxRate}% | Tax: ${formatCurrency(t.taxAmount)}`, 9, 'normal', [255, 69, 0]);
        swapsTax += t.taxAmount;
      });
      addText(`Subtotal Tax: ${formatCurrency(swapsTax)}`, 11, 'bold', [255, 69, 0]);
      yPos += 3;
    }

    yPos += 5;

    // Complete Transaction List
    addText('Complete Transaction List', 16, 'bold');
    addText('─────────────────────────────────', 11);
    yPos += 3;

    if (csvData.length > 0) {
      // Header row
      const headerRow = csvData[0].join(' | ');
      addText(headerRow, 8, 'bold');
      
      // Data rows
      for (let i = 1; i < csvData.length; i++) {
        if (csvData[i].length <= 1) continue;
        const row = csvData[i].join(' | ');
        addText(row, 8);
      }
    }

    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    doc.save(`kryptogain-tax-report-${timestamp}.pdf`);
    toast.success('PDF Report Generated Successfully!');
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <h1 className="font-serif text-3xl font-bold">KryptoGain</h1>
          
          <div className="w-20"></div>
        </div>
      </div>

      {/* Main Card */}
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Cryptocurrency Tax Calculator</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* CSV Upload */}
          <div className="space-y-2">
            <Label htmlFor="csv-upload">Upload CSV File</Label>
            <div className="flex items-center gap-4">
              <Input
                id="csv-upload"
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              {csvFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{csvFile.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Jurisdiction Selector */}
          <div className="space-y-2">
            <Label htmlFor="jurisdiction">Tax Jurisdiction</Label>
            <Select value={selectedJurisdiction} onValueChange={handleJurisdictionChange}>
              <SelectTrigger id="jurisdiction">
                <SelectValue placeholder="Select jurisdiction" />
              </SelectTrigger>
              <SelectContent>
                {jurisdictions.map(j => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.name} - {j.shortTermRate}% ({j.description})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tax Preview */}
          {transactions.length > 0 && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-lg">Tax Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Net Profit/Loss:</span>
                  <span className={`text-lg font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(netProfit)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Tax Owed:</span>
                  <span className="text-lg font-bold text-orange-600">
                    {formatCurrency(totalTax)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="text-sm font-medium">Net After Tax:</span>
                  <span className="text-lg font-bold text-blue-600">
                    {formatCurrency(netAfterTax)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Gate */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="payment"
                checked={hasPaid}
                onCheckedChange={(checked) => setHasPaid(checked as boolean)}
              />
              <Label
                htmlFor="payment"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I have paid $15
              </Label>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open('https://example.com/payment', '_blank')}
            >
              Pay Now
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>

            {hasPaid && (
              <Button
                className="w-full"
                onClick={generatePDF}
                disabled={!csvFile || transactions.length === 0}
              >
                <FileText className="mr-2 h-4 w-4" />
                Generate PDF Report
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimpleCalculator;
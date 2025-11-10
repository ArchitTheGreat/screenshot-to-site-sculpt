import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

interface Transaction {
  type: string;
  amount: number;
  value: number;
  date?: string;
  taxAmount: number;
  taxRate: number;
}

interface TaxJurisdiction {
  name: string;
  shortTermRate: number;
  longTermRate: number;
  description: string;
}

const SimpleCalculator = () => {
  const navigate = useNavigate();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [hasPaid, setHasPaid] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [netProfit, setNetProfit] = useState<number>(0);
  const [totalBuys, setTotalBuys] = useState<number>(0);
  const [totalSells, setTotalSells] = useState<number>(0);
  const [totalTax, setTotalTax] = useState<number>(0);
  const [jurisdiction, setJurisdiction] = useState<string>('us-short');

  const taxJurisdictions: Record<string, TaxJurisdiction> = {
    'us-short': {
      name: 'US Short-Term Capital Gains',
      shortTermRate: 37,
      longTermRate: 37,
      description: 'Applies to assets held less than 1 year'
    },
    'us-long': {
      name: 'US Long-Term Capital Gains',
      shortTermRate: 20,
      longTermRate: 20,
      description: 'Applies to assets held more than 1 year'
    },
    'flat-30': {
      name: 'Flat Rate 30%',
      shortTermRate: 30,
      longTermRate: 30,
      description: 'Standard flat tax rate'
    },
    'flat-20': {
      name: 'Flat Rate 20%',
      shortTermRate: 20,
      longTermRate: 20,
      description: 'Lower flat tax rate'
    }
  };

  const calculateTransactionTax = (type: string, value: number): { taxAmount: number; taxRate: number } => {
    const currentJurisdiction = taxJurisdictions[jurisdiction];
    let taxRate = currentJurisdiction.shortTermRate;
    
    // For sells and swaps, apply the tax rate
    if (type.includes('sell') || type.includes('swap') || type.includes('withdraw') || type.includes('send')) {
      taxRate = currentJurisdiction.shortTermRate;
      const taxAmount = (value * taxRate) / 100;
      return { taxAmount, taxRate };
    }
    
    // No tax on buys/deposits
    return { taxAmount: 0, taxRate: 0 };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.csv')) {
      setCsvFile(file);
      
      // Read CSV file
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
        setCsvData(rows);
        
        // Calculate profit/loss and taxes
        if (rows.length > 1) {
          const headers = rows[0].map(h => h.toLowerCase());
          const typeIndex = headers.findIndex(h => h.includes('type') || h.includes('transaction'));
          const amountIndex = headers.findIndex(h => h.includes('amount') || h.includes('usd') || h.includes('value'));
          const dateIndex = headers.findIndex(h => h.includes('date') || h.includes('time'));
          
          let buys = 0;
          let sells = 0;
          let totalTaxCalc = 0;
          const parsedTransactions: Transaction[] = [];
          
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length <= 1) continue; // Skip empty rows
            
            const type = row[typeIndex]?.toLowerCase() || '';
            const value = parseFloat(row[amountIndex]?.replace(/[^0-9.-]/g, '') || '0');
            const date = dateIndex >= 0 ? row[dateIndex] : '';
            
            const { taxAmount, taxRate } = calculateTransactionTax(type, value);
            
            const transaction: Transaction = {
              type,
              amount: value,
              value,
              date,
              taxAmount,
              taxRate
            };
            
            parsedTransactions.push(transaction);
            totalTaxCalc += taxAmount;
            
            if (type.includes('buy') || type.includes('deposit') || type.includes('receive')) {
              buys += value;
            } else if (type.includes('sell') || type.includes('withdraw') || type.includes('send') || type.includes('swap')) {
              sells += value;
            }
          }
          
          setTransactions(parsedTransactions);
          setTotalBuys(buys);
          setTotalSells(sells);
          setNetProfit(sells - buys);
          setTotalTax(totalTaxCalc);
        }
        
        toast({
          title: "CSV Uploaded",
          description: `Loaded ${rows.length - 1} transactions`,
        });
      };
      reader.readAsText(file);
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
    }
  };


  const generatePDF = () => {
    if (!csvFile || csvData.length === 0) {
      toast({
        title: "No Data",
        description: "Please upload a CSV file first",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();
    let yPos = 20;
    const pageHeight = 280;
    const margin = 20;
    
    // Header
    doc.setFontSize(20);
    doc.text('KryptoGain Tax Report', margin, yPos);
    yPos += 15;
    
    doc.setFontSize(11);
    doc.text(`File: ${csvFile.name}`, margin, yPos);
    yPos += 7;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 7;
    doc.text(`Tax Jurisdiction: ${taxJurisdictions[jurisdiction].name}`, margin, yPos);
    yPos += 7;
    doc.text(`Total Transactions: ${transactions.length}`, margin, yPos);
    yPos += 15;
    
    // Financial Summary
    doc.setFontSize(16);
    doc.text('Financial Summary', margin, yPos);
    yPos += 10;
    
    doc.setFontSize(12);
    doc.text(`Total Buys/Deposits: $${totalBuys.toFixed(2)}`, margin, yPos);
    yPos += 7;
    doc.text(`Total Sells/Withdrawals: $${totalSells.toFixed(2)}`, margin, yPos);
    yPos += 7;
    doc.setFontSize(14);
    if (netProfit >= 0) {
      doc.setTextColor(0, 128, 0);
    } else {
      doc.setTextColor(255, 0, 0);
    }
    doc.text(`Net Profit/Loss: $${netProfit.toFixed(2)}`, margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 10;
    
    // Tax Calculation Summary
    const netAfterTax = netProfit - totalTax;
    
    doc.setFontSize(12);
    doc.setTextColor(255, 69, 0);
    doc.text(`Total Tax Owed: $${totalTax.toFixed(2)}`, margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 7;
    doc.setFontSize(14);
    doc.setTextColor(0, 100, 200);
    doc.text(`Net After Tax: $${netAfterTax.toFixed(2)}`, margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 15;

    // Transaction Tax Breakdown
    if (yPos > pageHeight - 20) {
      doc.addPage();
      yPos = margin;
    }
    
    doc.setFontSize(16);
    doc.text('Detailed Tax Breakdown', margin, yPos);
    yPos += 10;
    
    // Group transactions by type
    const buyTransactions = transactions.filter(t => t.type.includes('buy') || t.type.includes('deposit') || t.type.includes('receive'));
    const sellTransactions = transactions.filter(t => t.type.includes('sell') || t.type.includes('withdraw') || t.type.includes('send'));
    const swapTransactions = transactions.filter(t => t.type.includes('swap'));
    
    // Buys breakdown
    if (buyTransactions.length > 0) {
      doc.setFontSize(14);
      doc.text('Buys/Deposits (Not Taxable)', margin, yPos);
      yPos += 8;
      doc.setFontSize(9);
      
      for (const tx of buyTransactions) {
        if (yPos > pageHeight - 10) {
          doc.addPage();
          yPos = margin;
        }
        doc.text(`  ${tx.type.toUpperCase()}: $${tx.value.toFixed(2)} | Tax: $${tx.taxAmount.toFixed(2)}`, margin, yPos);
        yPos += 5;
      }
      yPos += 5;
    }
    
    // Sells breakdown
    if (sellTransactions.length > 0) {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = margin;
      }
      doc.setFontSize(14);
      doc.text('Sells/Withdrawals (Taxable)', margin, yPos);
      yPos += 8;
      doc.setFontSize(9);
      
      const sellTax = sellTransactions.reduce((sum, tx) => sum + tx.taxAmount, 0);
      for (const tx of sellTransactions) {
        if (yPos > pageHeight - 10) {
          doc.addPage();
          yPos = margin;
        }
        doc.setTextColor(255, 69, 0);
        doc.text(`  ${tx.type.toUpperCase()}: $${tx.value.toFixed(2)} | Tax Rate: ${tx.taxRate}% | Tax: $${tx.taxAmount.toFixed(2)}`, margin, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 5;
      }
      doc.setFontSize(11);
      doc.setTextColor(255, 69, 0);
      doc.text(`Subtotal Tax: $${sellTax.toFixed(2)}`, margin + 5, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 8;
    }
    
    // Swaps breakdown
    if (swapTransactions.length > 0) {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = margin;
      }
      doc.setFontSize(14);
      doc.text('Swaps (Taxable)', margin, yPos);
      yPos += 8;
      doc.setFontSize(9);
      
      const swapTax = swapTransactions.reduce((sum, tx) => sum + tx.taxAmount, 0);
      for (const tx of swapTransactions) {
        if (yPos > pageHeight - 10) {
          doc.addPage();
          yPos = margin;
        }
        doc.setTextColor(255, 69, 0);
        doc.text(`  ${tx.type.toUpperCase()}: $${tx.value.toFixed(2)} | Tax Rate: ${tx.taxRate}% | Tax: $${tx.taxAmount.toFixed(2)}`, margin, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 5;
      }
      doc.setFontSize(11);
      doc.setTextColor(255, 69, 0);
      doc.text(`Subtotal Tax: $${swapTax.toFixed(2)}`, margin + 5, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 8;
    }

    // All Transactions
    if (yPos > pageHeight - 20) {
      doc.addPage();
      yPos = margin;
    }
    
    doc.setFontSize(16);
    doc.text('Complete Transaction List', margin, yPos);
    yPos += 10;
    
    doc.setFontSize(8);
    for (let i = 0; i < csvData.length; i++) {
      if (yPos > pageHeight) {
        doc.addPage();
        yPos = margin;
      }
      const row = csvData[i].join(' | ');
      const wrappedRow = doc.splitTextToSize(row, 170);
      for (let line of wrappedRow) {
        if (yPos > pageHeight) {
          doc.addPage();
          yPos = margin;
        }
        doc.text(line, margin, yPos);
        yPos += 5;
      }
      yPos += 2;
    }
    
    // Download
    doc.save(`kryptogain-tax-report-${Date.now()}.pdf`);
    
    toast({
      title: "PDF Generated!",
      description: "Your comprehensive tax report has been downloaded.",
    });
  };

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 sm:mb-12">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <h1 className="font-serif text-fluid-3xl sm:text-fluid-4xl font-bold text-center flex-1">
            KryptoGain
          </h1>

          <div className="w-[100px]"></div>
        </div>

        {/* Upload Section */}
        <Card className="p-6 sm:p-8 mb-8">
          <h2 className="font-serif text-fluid-2xl font-semibold mb-6">
            Upload CSV
          </h2>

          <div className="space-y-6">
            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="csv-upload">Transaction CSV File</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="flex-1"
                />
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              {csvFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <FileText className="h-4 w-4" />
                  <span>{csvFile.name}</span>
                </div>
              )}
            </div>

            {/* Tax Jurisdiction */}
            <div className="space-y-2">
              <Label htmlFor="jurisdiction">Tax Jurisdiction</Label>
              <Select value={jurisdiction} onValueChange={setJurisdiction}>
                <SelectTrigger id="jurisdiction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(taxJurisdictions).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value.name} ({value.shortTermRate}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {taxJurisdictions[jurisdiction].description}
              </p>
            </div>

            {/* Tax Summary Preview */}
            {csvFile && transactions.length > 0 && (
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <h3 className="font-semibold text-sm">Tax Preview</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Net Profit/Loss:</span>
                    <span className={netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                      ${netProfit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Tax Owed:</span>
                    <span className="text-orange-600 font-semibold">${totalTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="font-semibold">Net After Tax:</span>
                    <span className="font-semibold text-blue-600">
                      ${(netProfit - totalTax).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Section */}
            <div className="border-t pt-6 space-y-4">
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
                className="w-full gap-2"
                asChild
              >
                <a href="https://payment-link.example.com" target="_blank" rel="noopener noreferrer">
                  Pay Now
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>

            {/* Generate Button */}
            {hasPaid && (
              <Button
                size="lg"
                className="w-full"
                disabled={!csvFile}
                onClick={generatePDF}
              >
                Generate PDF Report
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SimpleCalculator;

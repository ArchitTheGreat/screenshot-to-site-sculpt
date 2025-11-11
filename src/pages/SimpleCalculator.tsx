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
  const [dragActive, setDragActive] = useState(false);
  const [costBasisPerEth, setCostBasisPerEth] = useState<number>(2500);
  const [costBasisInput, setCostBasisInput] = useState<string>('2500');

  const handleCostBasisChange = (value: string) => {
    setCostBasisInput(value);
    const parsedValue = parseFloat(value);
    
    if (isNaN(parsedValue) || parsedValue <= 0) {
      // Invalid input - use default and warn
      console.warn('Invalid cost basis input, using default $2500');
      setCostBasisPerEth(2500);
    } else {
      setCostBasisPerEth(parsedValue);
    }
  };

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

  const processFile = (file: File) => {
    if (file && file.name.toLowerCase().endsWith('.csv')) {
      setCsvFile(file);
      
      // Read CSV file
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
        setCsvData(rows);
        
        // Calculate profit/loss and taxes based on ETH transactions
        if (rows.length > 1) {
          const headers = rows[0].map(h => h.toLowerCase());
          
          // Find column indices - matching the CSV format described
          const methodIndex = headers.findIndex(h => h.includes('method'));
          const amountIndex = headers.findIndex(h => h.includes('amount') && !h.includes('value'));
          const valueIndex = headers.findIndex(h => h.includes('value') && h.includes('usd'));
          const feeIndex = headers.findIndex(h => h.includes('txn fee') || h.includes('fee'));
          const dateIndex = headers.findIndex(h => h.includes('datetime'));
          
          let totalEthSent = 0;
          let totalUsdValue = 0;
          let totalFeesEth = 0;
          let totalGasFeesUsd = 0;
          const parsedTransactions: Transaction[] = [];
          
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length <= 1) continue; // Skip empty rows
            
            // Parse Amount (remove " ETH" suffix)
            const amountStr = row[amountIndex] || '0';
            const ethAmount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
            
            // Parse Value (USD) (remove "$" prefix)
            const valueStr = row[valueIndex] || '0';
            const usdValue = parseFloat(valueStr.replace(/[^0-9.-]/g, ''));
            
            // Parse Txn Fee (remove " ETH" suffix)
            const feeStr = row[feeIndex] || '0';
            const feeEth = parseFloat(feeStr.replace(/[^0-9.-]/g, ''));
            
            // Skip invalid rows
            if (isNaN(ethAmount) || isNaN(usdValue)) continue;
            
            // Calculate gas fee in USD: fee(ETH) × (Value ÷ Amount)
            let gasFeeUsd = 0;
            if (ethAmount !== 0 && !isNaN(feeEth)) {
              const ethPriceEstimate = usdValue / ethAmount;
              gasFeeUsd = feeEth * ethPriceEstimate;
            }
            
            const method = row[methodIndex] || 'unknown';
            const date = dateIndex >= 0 ? row[dateIndex] : '';
            
            // Accumulate totals
            totalEthSent += ethAmount;
            totalUsdValue += usdValue;
            totalFeesEth += feeEth;
            totalGasFeesUsd += gasFeeUsd;
            
            const transaction: Transaction = {
              type: method,
              amount: ethAmount,
              value: usdValue,
              date,
              taxAmount: 0, // Will calculate after
              taxRate: 0
            };
            
            parsedTransactions.push(transaction);
          }
          
          // Use user-provided cost basis per ETH, with validation
          let COST_BASIS_PER_ETH = costBasisPerEth;
          const TAX_RATE = 0.30; // 30%
          
          // Calculate profit/loss
          const costBasisTotal = totalEthSent * COST_BASIS_PER_ETH;
          const gainLossUsd = totalUsdValue - costBasisTotal;
          const taxOwedUsd = Math.max(0, gainLossUsd * TAX_RATE);
          
          // Update transactions with tax info
          const taxPerTransaction = parsedTransactions.length > 0 ? taxOwedUsd / parsedTransactions.length : 0;
          parsedTransactions.forEach(tx => {
            tx.taxAmount = taxPerTransaction;
            tx.taxRate = TAX_RATE * 100;
          });
          
          setTransactions(parsedTransactions);
          setTotalBuys(costBasisTotal);
          setTotalSells(totalUsdValue);
          setNetProfit(gainLossUsd);
          setTotalTax(taxOwedUsd);
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
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
    
    // Calculate totals for display
    const totalEthSent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const totalUsdValue = transactions.reduce((sum, tx) => sum + tx.value, 0);
    const COST_BASIS_PER_ETH = costBasisPerEth;
    const TAX_RATE = 30;
    
    // Header
    doc.setFontSize(20);
    doc.text('KryptoGain Tax Report', margin, yPos);
    yPos += 15;
    
    doc.setFontSize(11);
    doc.text(`File: ${csvFile.name}`, margin, yPos);
    yPos += 7;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 7;
    doc.text(`Total Transactions: ${transactions.length}`, margin, yPos);
    yPos += 15;
    
    // Calculation Summary
    doc.setFontSize(16);
    doc.text('Calculation Summary', margin, yPos);
    yPos += 10;
    
    doc.setFontSize(12);
    doc.text(`Total ETH Sent: ${totalEthSent.toFixed(4)} ETH`, margin, yPos);
    yPos += 7;
    doc.text(`Total USD Value: $${totalUsdValue.toFixed(2)}`, margin, yPos);
    yPos += 7;
    doc.text(`Cost Basis per ETH: $${COST_BASIS_PER_ETH.toFixed(2)}`, margin, yPos);
    yPos += 7;
    doc.text(`Total Cost Basis: $${totalBuys.toFixed(2)}`, margin, yPos);
    yPos += 10;
    
    // Profit/Loss
    doc.setFontSize(14);
    if (netProfit >= 0) {
      doc.setTextColor(0, 128, 0);
      doc.text(`Gain: $${netProfit.toFixed(2)}`, margin, yPos);
    } else {
      doc.setTextColor(255, 0, 0);
      doc.text(`Loss: $${Math.abs(netProfit).toFixed(2)}`, margin, yPos);
    }
    doc.setTextColor(0, 0, 0);
    yPos += 10;
    
    // Tax Calculation
    doc.setFontSize(12);
    doc.text(`Tax Rate: ${TAX_RATE}%`, margin, yPos);
    yPos += 7;
    doc.setTextColor(255, 69, 0);
    doc.setFontSize(14);
    doc.text(`Tax Owed: $${totalTax.toFixed(2)}`, margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 10;
    
    // Net After Tax
    const netAfterTax = netProfit - totalTax;
    doc.setTextColor(0, 100, 200);
    doc.setFontSize(16);
    doc.text(`Net After Tax: $${netAfterTax.toFixed(2)}`, margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 15;

    // Transaction Details
    if (yPos > pageHeight - 20) {
      doc.addPage();
      yPos = margin;
    }
    
    doc.setFontSize(16);
    doc.text('Transaction Details', margin, yPos);
    yPos += 10;
    
    doc.setFontSize(9);
    doc.text('Method | ETH Amount | USD Value | Date', margin, yPos);
    yPos += 7;
    
    for (const tx of transactions) {
      if (yPos > pageHeight - 10) {
        doc.addPage();
        yPos = margin;
      }
      const line = `${tx.type} | ${tx.amount.toFixed(4)} ETH | $${tx.value.toFixed(2)} | ${tx.date || 'N/A'}`;
      doc.text(line, margin, yPos);
      yPos += 5;
    }
    yPos += 10;

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
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                  dragActive
                    ? 'border-primary bg-primary/5 scale-[1.02]'
                    : 'border-border hover:border-primary/50 hover:bg-accent/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-3">
                  <div className={`p-3 rounded-full bg-primary/10 transition-transform ${dragActive ? 'scale-110' : ''}`}>
                    <Upload className={`h-6 w-6 transition-colors ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  {csvFile ? (
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <FileText className="h-4 w-4 text-primary" />
                      <span>{csvFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        {dragActive ? 'Drop your CSV file here' : 'Drag & drop your CSV file here'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        or click to browse
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Average Buy Price Input */}
            <div className="space-y-2">
              <Label htmlFor="cost-basis">Average Buy Price per ETH (USD)</Label>
              <Input
                id="cost-basis"
                type="number"
                value={costBasisInput}
                onChange={(e) => handleCostBasisChange(e.target.value)}
                placeholder="2500"
                min="0"
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">
                Enter your average purchase price per ETH in USD. Invalid inputs will default to $2,500.
              </p>
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

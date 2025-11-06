import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

const SimpleCalculator = () => {
  const navigate = useNavigate();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [hasPaid, setHasPaid] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [netProfit, setNetProfit] = useState<number>(0);
  const [totalBuys, setTotalBuys] = useState<number>(0);
  const [totalSells, setTotalSells] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(30);

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
        
        // Calculate profit/loss
        if (rows.length > 1) {
          const headers = rows[0].map(h => h.toLowerCase());
          const typeIndex = headers.findIndex(h => h.includes('type') || h.includes('transaction'));
          const amountIndex = headers.findIndex(h => h.includes('amount') || h.includes('usd') || h.includes('value'));
          
          let buys = 0;
          let sells = 0;
          
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length <= 1) continue; // Skip empty rows
            
            const type = row[typeIndex]?.toLowerCase() || '';
            const amount = parseFloat(row[amountIndex]?.replace(/[^0-9.-]/g, '') || '0');
            
            if (type.includes('buy') || type.includes('deposit') || type.includes('receive')) {
              buys += amount;
            } else if (type.includes('sell') || type.includes('withdraw') || type.includes('send')) {
              sells += amount;
            }
          }
          
          setTotalBuys(buys);
          setTotalSells(sells);
          setNetProfit(sells - buys);
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
    const lineHeight = 7;
    
    // Header
    doc.setFontSize(20);
    doc.text('KryptoGain Tax Report', margin, yPos);
    yPos += 15;
    
    doc.setFontSize(11);
    doc.text(`File: ${csvFile.name}`, margin, yPos);
    yPos += 7;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 7;
    doc.text(`Total Transactions: ${csvData.length - 1}`, margin, yPos);
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
    
    // Tax Calculation
    const taxAmount = netProfit > 0 ? (netProfit * taxRate) / 100 : 0;
    const netAfterTax = netProfit - taxAmount;
    
    doc.setFontSize(12);
    doc.text(`Tax Rate: ${taxRate}%`, margin, yPos);
    yPos += 7;
    doc.setTextColor(255, 69, 0);
    doc.text(`Tax Amount: $${taxAmount.toFixed(2)}`, margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 7;
    doc.setFontSize(14);
    doc.setTextColor(0, 100, 200);
    doc.text(`Net After Tax: $${netAfterTax.toFixed(2)}`, margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 15;

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

            {/* Tax Rate */}
            <div className="space-y-2">
              <Label htmlFor="tax-rate">Tax Rate (%)</Label>
              <Input
                id="tax-rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="w-full"
              />
            </div>

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

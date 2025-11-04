import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

const SimpleCalculator = () => {
  const navigate = useNavigate();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [hasPaid, setHasPaid] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [userDetails, setUserDetails] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.csv')) {
      setCsvFile(file);
      
      // Read CSV file
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const rows = text.split('\n').map(row => row.split(','));
        setCsvData(rows);
        
        toast({
          title: "CSV Uploaded",
          description: `Loaded ${rows.length} rows`,
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

  const analyzeWithAI = async () => {
    if (!csvFile || csvData.length === 0) {
      toast({
        title: "No Data",
        description: "Please upload a CSV file first",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const systemPrompt = `You are a professional Crypto Tax Analyst AI, specialized in tracking, auditing, and analyzing cryptocurrency wallet transactions. You understand blockchain explorers (like Etherscan, BscScan, Solscan), DEX activity, NFT sales, token swaps, airdrops, staking rewards, and cross-chain transfers. Your goal is to provide precise tax-ready insights and profit/loss reports based on the user's transaction data.

⚙️ Core Responsibilities:

Transaction Categorization:
- Identify each transaction as one of the following: Buy/Sell, Swap, Transfer (incoming/outgoing), Airdrop/Reward/Staking Income, Gas Fee, Internal Contract Interaction
- Auto-detect the chain (ETH, BSC, Polygon, Solana, etc.) and token standards (ERC-20, ERC-721, ERC-1155).

Profit/Loss Calculation:
- Track cost basis for every token purchase.
- Calculate realized profits/losses for each sale or swap.
- Account for gas fees and adjust net profits accordingly.
- Maintain FIFO (first-in-first-out) method.

Tax Reporting:
- Separate short-term vs long-term gains (based on holding period).
- Identify taxable events (sell, trade, convert, reward).
- Provide summary tables: Total taxable income (in INR/USD), Unrealized holdings, Fees paid, Net profit/loss

Error Handling & Optimization:
- Handle large transaction sets by summarizing repetitive actions.
- Suggest potential optimizations.`;

      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const userPrompt = `Analyze these cryptocurrency transactions and provide a comprehensive tax report:\n\nUser Details: ${userDetails || 'Not provided'}\n\nCSV Data:\n${csvContent}`;

      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview:generateContent?key=AIzaSyAOUuAaK2G3rlAF2BKBgrLAPNhlge0_EzM', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}\n\n${userPrompt}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze with AI');
      }

      const data = await response.json();
      const analysis = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis generated';
      setAiAnalysis(analysis);
      
      toast({
        title: "Analysis Complete!",
        description: "AI has analyzed your transactions. Generate PDF to view the report.",
      });
    } catch (error) {
      console.error('AI Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: "Could not analyze transactions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
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

    if (!aiAnalysis) {
      toast({
        title: "No Analysis",
        description: "Please analyze the data first",
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
    doc.text(`Total Transactions: ${csvData.length}`, margin, yPos);
    yPos += 15;

    // AI Analysis Section
    doc.setFontSize(16);
    doc.text('AI Tax Analysis', margin, yPos);
    yPos += 10;
    
    doc.setFontSize(9);
    const analysisLines = doc.splitTextToSize(aiAnalysis, 170);
    for (let line of analysisLines) {
      if (yPos > pageHeight) {
        doc.addPage();
        yPos = margin;
      }
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

            {/* User Details */}
            <div className="space-y-2">
              <Label htmlFor="user-details">Additional Details (Optional)</Label>
              <Textarea
                id="user-details"
                placeholder="Enter any specific details about your transactions, tax method preferences (FIFO/LIFO), holding periods, or questions for the AI analyst..."
                value={userDetails}
                onChange={(e) => setUserDetails(e.target.value)}
                className="min-h-[100px]"
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

            {/* Analyze and Generate Buttons */}
            {hasPaid && (
              <div className="space-y-3">
                <Button
                  size="lg"
                  className="w-full"
                  disabled={!csvFile || isGenerating}
                  onClick={analyzeWithAI}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing with AI...
                    </>
                  ) : (
                    'Analyze Transactions with AI'
                  )}
                </Button>
                
                {aiAnalysis && (
                  <Button
                    size="lg"
                    className="w-full bg-foreground text-background hover:bg-foreground/90"
                    onClick={generatePDF}
                  >
                    Generate PDF Report
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SimpleCalculator;

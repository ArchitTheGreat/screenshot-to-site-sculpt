import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, CalendarIcon, Wallet, Upload, FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Transaction {
  type: string;
  amount: number;
  value: number;
  date: Date;
  taxAmount: number;
  taxRate: number;
}

interface TaxJurisdiction {
  name: string;
  shortTermRate: number;
  longTermRate: number;
  description: string;
}

const Calculator = () => {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [hasPaid, setHasPaid] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [netProfit, setNetProfit] = useState<number>(0);
  const [totalBuys, setTotalBuys] = useState<number>(0);
  const [totalSells, setTotalSells] = useState<number>(0);
  const [totalTax, setTotalTax] = useState<number>(0);
  const [jurisdiction, setJurisdiction] = useState<string>('us-short');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to?: Date | undefined }>({ from: undefined, to: undefined });
  const [loading, setLoading] = useState<boolean>(false);
  const [costBasisPerEth, setCostBasisPerEth] = useState<number>(2500);
  const [costBasisInput, setCostBasisInput] = useState<string>('2500');
  const [dragActive, setDragActive] = useState(false);
  const [inputMethod, setInputMethod] = useState<'wallet' | 'csv'>('wallet');

  useEffect(() => {
    if (isConnected && address) {
      setWalletAddress(address);
    }
  }, [isConnected, address]);

  const handleCostBasisChange = (value: string) => {
    setCostBasisInput(value);
    const parsedValue = parseFloat(value);
    
    if (isNaN(parsedValue) || parsedValue <= 0) {
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

  const calculateTransactionTax = (type: string, sellValueUSD: number, buyValueUSD: number): { taxAmount: number; taxRate: number } => {
    const currentJurisdiction = taxJurisdictions[jurisdiction];
    let taxRate = currentJurisdiction.shortTermRate;
    
    if (type.includes('sell') || type.includes('swap') || type.includes('withdraw') || type.includes('send')) {
      taxRate = currentJurisdiction.shortTermRate;
      const gain = sellValueUSD - buyValueUSD;
      const taxAmount = Math.max(gain, 0) * (taxRate / 100);
      return { taxAmount, taxRate };
    }
    
    return { taxAmount: 0, taxRate: 0 };
  };

  const calculateMetrics = (txs: Transaction[], costBasis: number) => {
    let totalEthSent = 0;
    let totalUsdValue = 0;
    let totalTaxOwed = 0;

    for (const tx of txs) {
      const estimatedEthPrice = costBasis;

      if (tx.type === "sell") {
        totalEthSent -= tx.amount;
        tx.value = tx.amount * estimatedEthPrice;
        totalUsdValue += tx.value;
        const { taxAmount, taxRate } = calculateTransactionTax(tx.type, tx.value, tx.amount * costBasis);
        tx.taxAmount = taxAmount;
        tx.taxRate = taxRate;
        totalTaxOwed += taxAmount;
      } else if (tx.type === "buy") {
        totalEthSent += tx.amount;
        tx.value = tx.amount * estimatedEthPrice;
        totalUsdValue -= tx.value;
      }
    }

    const costBasisTotal = totalEthSent * costBasis;
    const gainLossUsd = totalUsdValue + costBasisTotal;

    setNetProfit(gainLossUsd);
    setTotalBuys(0);
    setTotalSells(totalUsdValue);
    setTotalTax(totalTaxOwed);
  };

  const processFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',');
    
    const parsedTransactions: Transaction[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',');
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header.trim()] = values[index]?.trim() || '';
      });
      
      const amount = parseFloat(row['Amount']?.replace('ETH', '').trim() || '0');
      const usdValue = parseFloat(row['Value (USD)']?.replace('$', '').trim() || '0');
      const method = row['Method']?.toLowerCase() || '';
      
      let type = 'transfer';
      if (method.includes('buy') || method.includes('deposit') || method.includes('receive')) {
        type = 'buy';
      } else if (method.includes('sell') || method.includes('withdraw') || method.includes('send')) {
        type = 'sell';
      }
      
      const txDate = new Date(row['DateTime (UTC)'] || Date.now());
      
      parsedTransactions.push({
        type,
        amount,
        value: usdValue,
        date: txDate,
        taxAmount: 0,
        taxRate: 0
      });
    }
    
    setTransactions(parsedTransactions);
    calculateMetrics(parsedTransactions, costBasisPerEth);
    
    toast({
      title: "CSV Processed",
      description: `Loaded ${parsedTransactions.length} transactions from CSV.`,
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }
    
    await processFile(file);
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }
    
    await processFile(file);
  };

  const generatePDF = () => {
    if (transactions.length === 0) {
      toast({
        title: "No Data",
        description: "No transactions to generate a report for.",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();
    let yPos = 20;
    const pageHeight = 280;
    const margin = 20;
    
    const totalEthSent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const totalUsdValue = transactions.reduce((sum, tx) => sum + tx.value, 0);
    const COST_BASIS_PER_ETH = costBasisPerEth;
    
    doc.setFontSize(20);
    doc.text('KryptoGain Tax Report', margin, yPos);
    yPos += 15;
    
    doc.setFontSize(11);
    yPos += 7;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 7;
    doc.text(`Total Transactions: ${transactions.length}`, margin, yPos);
    yPos += 15;
    
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
    
    doc.setFontSize(12);
    doc.text(`Tax Rate: ${taxJurisdictions[jurisdiction].shortTermRate}%`, margin, yPos);
    yPos += 7;
    doc.setTextColor(255, 69, 0);
    doc.setFontSize(14);
    doc.text(`Tax Owed: $${totalTax.toFixed(2)}`, margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 10;
    
    const netAfterTax = netProfit - totalTax;
    doc.setTextColor(0, 100, 200);
    doc.setFontSize(16);
    doc.text(`Net After Tax: $${netAfterTax.toFixed(2)}`, margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 15;

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

    doc.save(`kryptogain-tax-report-${Date.now()}.pdf`);
    
    toast({
      title: "PDF Generated!",
      description: "Your comprehensive tax report has been downloaded.",
    });
  };

  const ETHERSCAN_API_KEY = import.meta.env.VITE_ETHERSCAN_API_KEY;

  const fetchEtherscanTransactions = async () => {
    const effectiveAddress = walletAddress || address;
    
    if (!effectiveAddress) {
      toast({
        title: "Missing Wallet Address",
        description: "Please connect wallet or enter an address.",
        variant: "destructive",
      });
      return;
    }

    if (!dateRange.from || !dateRange.to) {
      toast({
        title: "Missing Date Range",
        description: "Please select a date range.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setTransactions([]);
    setNetProfit(0);
    setTotalBuys(0);
    setTotalSells(0);
    setTotalTax(0);

    try {
      const allTransactions: Transaction[] = [];
      const start = new Date(dateRange.from);
      const end = new Date(dateRange.to);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const startTimestamp = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).getTime() / 1000);
        const endTimestamp = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).getTime() / 1000);
        const apiUrl = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${effectiveAddress}&startblock=0&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}&starttimestamp=${startTimestamp}&endtimestamp=${endTimestamp}`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.status === "1" && data.result.length > 0) {
          const dayTransactions: Transaction[] = data.result.map((tx: any) => ({
            type: tx.value === "0" ? "transfer" : (tx.to.toLowerCase() === effectiveAddress.toLowerCase() ? "buy" : "sell"),
            amount: parseFloat((parseInt(tx.value) / 1e18).toFixed(6)),
            value: 0,
            date: new Date(parseInt(tx.timeStamp) * 1000),
            taxAmount: 0,
            taxRate: 0,
          }));
          allTransactions.push(...dayTransactions);
        }
      }
      
      setTransactions(allTransactions);
      calculateMetrics(allTransactions, costBasisPerEth);
      
      toast({
        title: "Transactions Fetched",
        description: `Loaded ${allTransactions.length} transactions from Etherscan.`,
      });
    } catch (error) {
      console.error("Error fetching Etherscan transactions:", error);
      toast({
        title: "Error",
        description: "Failed to fetch transactions from Etherscan.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (transactions.length > 0) {
      calculateMetrics(transactions, costBasisPerEth);
    }
  }, [costBasisPerEth, jurisdiction]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 sm:mb-12">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2 hover:bg-primary/10 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <h1 className="font-serif text-fluid-3xl sm:text-fluid-4xl font-bold text-center flex-1 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            KryptoGain
          </h1>

          <div className="w-[100px]"></div>
        </div>

        <Card className="p-6 sm:p-8 mb-8 backdrop-blur-sm bg-card/95 shadow-xl border-primary/10">
          <h2 className="font-serif text-fluid-2xl font-semibold mb-6 text-foreground">
            Generate your Crypto Tax Report
          </h2>

          <Tabs value={inputMethod} onValueChange={(v) => setInputMethod(v as 'wallet' | 'csv')} className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="wallet" className="gap-2">
                <Wallet className="h-4 w-4" />
                Wallet Connection
              </TabsTrigger>
              <TabsTrigger value="csv" className="gap-2">
                <FileText className="h-4 w-4" />
                CSV Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="wallet" className="space-y-6 mt-6">
              {!isConnected ? (
                <div className="space-y-4">
                  <div className="rounded-lg border-2 border-dashed border-primary/20 bg-primary/5 p-6 text-center">
                    <Wallet className="h-12 w-12 mx-auto mb-4 text-primary" />
                    <h3 className="font-semibold mb-2">Connect Your Wallet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Connect your wallet to automatically fetch transactions
                    </p>
                    <div className="flex flex-col gap-2">
                      {connectors.map((connector) => (
                        <Button
                          key={connector.id}
                          onClick={() => connect({ connector })}
                          variant="outline"
                          className="w-full"
                        >
                          Connect {connector.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="text-center text-sm text-muted-foreground">
                    <span>Or enter wallet address manually</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg bg-primary/5 p-4 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Connected Wallet</p>
                        <p className="font-mono text-sm font-semibold">{address}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => disconnect()}>
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="wallet-address">Ethereum Wallet Address</Label>
                <Input
                  id="wallet-address"
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder={address || "0xAbc123..."}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Enter manually or use connected wallet address
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date-range-selector">Select Date Range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from && dateRange.to
                        ? `${format(dateRange.from, "PPP")} - ${format(dateRange.to, "PPP")}`
                        : <span className="font-normal">Pick a date range</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button
                onClick={fetchEtherscanTransactions}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Fetching..." : "Fetch Transactions"}
              </Button>
            </TabsContent>

            <TabsContent value="csv" className="space-y-6 mt-6">
              <div
                className={cn(
                  "relative rounded-lg border-2 border-dashed transition-all duration-200 cursor-pointer",
                  dragActive 
                    ? "border-primary bg-primary/10 scale-[1.02]" 
                    : "border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('csv-upload')?.click()}
              >
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="p-12 text-center">
                  <Upload className={cn(
                    "h-12 w-12 mx-auto mb-4 transition-colors",
                    dragActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  <h3 className="font-semibold mb-2">
                    {dragActive ? "Drop your CSV file here" : "Upload CSV File"}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Drag and drop or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supported format: CSV with transaction data
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-6">
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
                Enter your average purchase price per ETH in USD
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jurisdiction">Tax Jurisdiction</Label>
              <Select value={jurisdiction} onValueChange={setJurisdiction}>
                <SelectTrigger id="jurisdiction" className="bg-background">
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

            {transactions.length > 0 && (
              <div className="rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                  Tax Preview
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-primary/10">
                    <span className="text-muted-foreground">Net Profit/Loss:</span>
                    <span className={cn(
                      "font-semibold text-lg",
                      netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    )}>
                      ${netProfit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-primary/10">
                    <span className="text-muted-foreground">Total Tax Owed:</span>
                    <span className="text-orange-600 dark:text-orange-400 font-semibold text-lg">
                      ${totalTax.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3">
                    <span className="font-semibold text-base">Net After Tax:</span>
                    <span className="font-bold text-xl text-primary">
                      ${(netProfit - totalTax).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-border pt-6 space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-4">
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
                  className="w-full gap-2 border-primary/20 hover:bg-primary/10"
                  asChild
                >
                  <a href="https://nowpayments.io/payment/?iid=4583571841" target="_blank" rel="noopener noreferrer">
                    Pay Now
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            {hasPaid && (
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
                disabled={transactions.length === 0}
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

export default Calculator;

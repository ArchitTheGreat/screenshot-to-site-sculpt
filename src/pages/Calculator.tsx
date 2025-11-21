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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Papa from 'papaparse';
import Decimal from 'decimal.js';

// Configure Decimal.js for precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface ParsedTransaction {
  date: Date;
  type: 'BUY' | 'SELL';
  symbol: string;
  amount: Decimal;
  price: Decimal;
  value: Decimal;
}

interface TaxLot {
  date: Date;
  amount: Decimal;
  costBasis: Decimal;
}

interface TaxableEvent {
  date: Date;
  symbol: string;
  type: 'SHORT_TERM' | 'LONG_TERM';
  sellAmount: Decimal;
  sellPrice: Decimal;
  costBasis: Decimal;
  pnl: Decimal;
  taxAmount: Decimal;
  isTaxable: boolean;
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
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [taxableEvents, setTaxableEvents] = useState<TaxableEvent[]>([]);
  const [totalShortTermGains, setTotalShortTermGains] = useState<Decimal>(new Decimal(0));
  const [totalLongTermGains, setTotalLongTermGains] = useState<Decimal>(new Decimal(0));
  const [totalTax, setTotalTax] = useState<Decimal>(new Decimal(0));
  const [jurisdiction, setJurisdiction] = useState<string>('us-mixed');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to?: Date | undefined }>({ from: undefined, to: undefined });
  const [loading, setLoading] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState(false);
  const [inputMethod, setInputMethod] = useState<'wallet' | 'csv'>('csv');

  useEffect(() => {
    if (isConnected && address) {
      setWalletAddress(address);
    }
  }, [isConnected, address]);

  const taxJurisdictions: Record<string, TaxJurisdiction> = {
    'us-mixed': {
      name: 'US Capital Gains (Mixed)',
      shortTermRate: 37,
      longTermRate: 20,
      description: 'Short-term (≤1 year): 37% | Long-term (>1 year): 20%'
    },
    'us-short': {
      name: 'US Short-Term Only',
      shortTermRate: 37,
      longTermRate: 37,
      description: 'All gains taxed at 37%'
    },
    'us-long': {
      name: 'US Long-Term Only',
      shortTermRate: 20,
      longTermRate: 20,
      description: 'All gains taxed at 20%'
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

  // FIFO matching algorithm
  const calculateTaxWithFIFO = (transactions: ParsedTransaction[]): TaxableEvent[] => {
    const taxEvents: TaxableEvent[] = [];
    const lots: TaxLot[] = [];
    const currentJurisdiction = taxJurisdictions[jurisdiction];

    for (const tx of transactions) {
      if (tx.type === 'BUY') {
        // Add to inventory using FIFO queue
        lots.push({
          date: tx.date,
          amount: tx.amount,
          costBasis: tx.price
        });
      } else if (tx.type === 'SELL') {
        let remainingSell = tx.amount;
        
        while (remainingSell.greaterThan(0) && lots.length > 0) {
          const lot = lots[0];
          const sellAmount = Decimal.min(remainingSell, lot.amount);
          
          // Calculate holding period (in days)
          const holdingPeriodDays = Math.floor((tx.date.getTime() - lot.date.getTime()) / (1000 * 60 * 60 * 24));
          const isLongTerm = holdingPeriodDays > 365;
          
          // Calculate P&L
          const costBasisTotal = sellAmount.times(lot.costBasis);
          const sellTotal = sellAmount.times(tx.price);
          const pnl = sellTotal.minus(costBasisTotal);
          
          // Calculate tax
          const taxRate = isLongTerm ? currentJurisdiction.longTermRate : currentJurisdiction.shortTermRate;
          const taxAmount = pnl.greaterThan(0) ? pnl.times(taxRate).dividedBy(100) : new Decimal(0);
          
          taxEvents.push({
            date: tx.date,
            symbol: tx.symbol,
            type: isLongTerm ? 'LONG_TERM' : 'SHORT_TERM',
            sellAmount,
            sellPrice: tx.price,
            costBasis: lot.costBasis,
            pnl,
            taxAmount,
            isTaxable: pnl.greaterThan(0)
          });
          
          // Update lots
          lot.amount = lot.amount.minus(sellAmount);
          if (lot.amount.lessThanOrEqualTo(0)) {
            lots.shift(); // Remove depleted lot
          }
          
          remainingSell = remainingSell.minus(sellAmount);
        }
      }
    }
    
    return taxEvents;
  };

  const processFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const transactions: ParsedTransaction[] = [];
          
          for (const row of results.data as any[]) {
            // Parse amount (remove "ETH" suffix)
            const amountStr = (row['Amount'] || '').toString().replace(/ETH/gi, '').trim();
            const amount = new Decimal(amountStr || '0');
            
            // Parse USD value (remove "$" prefix)
            const valueStr = (row['Value (USD)'] || '').toString().replace(/\$/g, '').trim();
            const value = new Decimal(valueStr || '0');
            
            // Calculate price per unit
            const price = amount.greaterThan(0) ? value.dividedBy(amount) : new Decimal(0);
            
            // Parse date
            const dateStr = row['DateTime (UTC)'] || row['Date'] || '';
            const date = dateStr ? new Date(dateStr) : new Date();
            
            // Determine transaction type
            const method = (row['Method'] || '').toLowerCase();
            let type: 'BUY' | 'SELL' = 'BUY';
            
            if (method.includes('sell') || method.includes('withdraw') || method.includes('send') || method.includes('swap out')) {
              type = 'SELL';
            } else if (method.includes('buy') || method.includes('deposit') || method.includes('receive') || method.includes('swap in')) {
              type = 'BUY';
            }
            
            if (amount.greaterThan(0)) {
              transactions.push({
                date,
                type,
                symbol: 'ETH',
                amount,
                price,
                value
              });
            }
          }
          
          // Sort by date (oldest first for FIFO)
          transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
          
          setParsedTransactions(transactions);
          
          // Calculate tax events
          const events = calculateTaxWithFIFO(transactions);
          setTaxableEvents(events);
          
          // Calculate totals
          let shortTermTotal = new Decimal(0);
          let longTermTotal = new Decimal(0);
          let totalTaxAmount = new Decimal(0);
          
          for (const event of events) {
            if (event.type === 'SHORT_TERM') {
              shortTermTotal = shortTermTotal.plus(event.pnl);
            } else {
              longTermTotal = longTermTotal.plus(event.pnl);
            }
            totalTaxAmount = totalTaxAmount.plus(event.taxAmount);
          }
          
          setTotalShortTermGains(shortTermTotal);
          setTotalLongTermGains(longTermTotal);
          setTotalTax(totalTaxAmount);
          
          toast({
            title: "CSV Processed",
            description: `Loaded ${transactions.length} transactions. Found ${events.length} taxable events.`,
          });
        } catch (error) {
          console.error('Error processing CSV:', error);
          toast({
            title: "Processing Error",
            description: "Failed to process CSV. Please check the format.",
            variant: "destructive",
          });
        }
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        toast({
          title: "Parse Error",
          description: "Failed to parse CSV file.",
          variant: "destructive",
        });
      }
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
    
    processFile(file);
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
    
    processFile(file);
  };

  const generatePDF = () => {
    if (taxableEvents.length === 0) {
      toast({
        title: "No Data",
        description: "No taxable events to generate a report for.",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();
    let yPos = 20;
    
    doc.setFontSize(20);
    doc.text('KryptoGain Tax Report', 20, yPos);
    yPos += 15;
    
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPos);
    yPos += 7;
    doc.text(`Total Taxable Events: ${taxableEvents.length}`, 20, yPos);
    yPos += 15;
    
    doc.setFontSize(14);
    doc.text('Tax Summary', 20, yPos);
    yPos += 10;
    
    doc.setFontSize(12);
    doc.text(`Short-Term Gains: $${totalShortTermGains.toFixed(2)}`, 20, yPos);
    yPos += 7;
    doc.text(`Long-Term Gains: $${totalLongTermGains.toFixed(2)}`, 20, yPos);
    yPos += 7;
    doc.text(`Total Tax Owed: $${totalTax.toFixed(2)}`, 20, yPos);
    yPos += 7;
    const netGains = totalShortTermGains.plus(totalLongTermGains);
    doc.text(`Net After Tax: $${netGains.minus(totalTax).toFixed(2)}`, 20, yPos);

    doc.save(`kryptogain-tax-report-${Date.now()}.pdf`);
    
    toast({
      title: "PDF Generated!",
      description: "Your tax report has been downloaded.",
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
    setParsedTransactions([]);
    setTaxableEvents([]);

    try {
      const allTransactions: ParsedTransaction[] = [];
      const start = new Date(dateRange.from);
      const end = new Date(dateRange.to);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const startTimestamp = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).getTime() / 1000);
        const endTimestamp = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).getTime() / 1000);
        const apiUrl = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${effectiveAddress}&startblock=0&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}&starttimestamp=${startTimestamp}&endtimestamp=${endTimestamp}`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.status === "1" && data.result.length > 0) {
          for (const tx of data.result) {
            const amount = new Decimal(tx.value).dividedBy(1e18);
            const isSell = tx.from.toLowerCase() === effectiveAddress.toLowerCase();
            
            allTransactions.push({
              type: isSell ? 'SELL' : 'BUY',
              amount,
              price: new Decimal(2500), // Default price, should be fetched from price API
              value: amount.times(2500),
              date: new Date(parseInt(tx.timeStamp) * 1000),
              symbol: 'ETH'
            });
          }
        }
      }
      
      allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());
      setParsedTransactions(allTransactions);
      
      const events = calculateTaxWithFIFO(allTransactions);
      setTaxableEvents(events);
      
      toast({
        title: "Transactions Fetched",
        description: `Loaded ${allTransactions.length} transactions.`,
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

  // Recalculate when jurisdiction changes
  useEffect(() => {
    if (parsedTransactions.length > 0) {
      const events = calculateTaxWithFIFO(parsedTransactions);
      setTaxableEvents(events);
      
      let shortTermTotal = new Decimal(0);
      let longTermTotal = new Decimal(0);
      let totalTaxAmount = new Decimal(0);
      
      for (const event of events) {
        if (event.type === 'SHORT_TERM') {
          shortTermTotal = shortTermTotal.plus(event.pnl);
        } else {
          longTermTotal = longTermTotal.plus(event.pnl);
        }
        totalTaxAmount = totalTaxAmount.plus(event.taxAmount);
      }
      
      setTotalShortTermGains(shortTermTotal);
      setTotalLongTermGains(longTermTotal);
      setTotalTax(totalTaxAmount);
    }
  }, [jurisdiction, parsedTransactions]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16">
      <div className="max-w-6xl mx-auto">
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
            Crypto Tax Calculator
          </h2>

          <Tabs value={inputMethod} onValueChange={(v) => setInputMethod(v as 'wallet' | 'csv')} className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="csv" className="gap-2">
                <FileText className="h-4 w-4" />
                CSV Upload
              </TabsTrigger>
              <TabsTrigger value="wallet" className="gap-2">
                <Wallet className="h-4 w-4" />
                Wallet Connection
              </TabsTrigger>
            </TabsList>

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
                    Expected columns: Date, Method, Amount, Value (USD)
                  </p>
                </div>
              </div>
            </TabsContent>

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
                        : <span>Pick a date range</span>}
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
          </Tabs>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="jurisdiction">Tax Jurisdiction</Label>
              <Select value={jurisdiction} onValueChange={setJurisdiction}>
                <SelectTrigger id="jurisdiction" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(taxJurisdictions).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {taxJurisdictions[jurisdiction].description}
              </p>
            </div>

            {taxableEvents.length > 0 && (
              <>
                <div className="rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                    Tax Summary
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center py-2 border-b border-primary/10">
                      <span className="text-muted-foreground">Short-Term Gains:</span>
                      <span className={cn(
                        "font-semibold",
                        totalShortTermGains.greaterThanOrEqualTo(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      )}>
                        ${totalShortTermGains.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-primary/10">
                      <span className="text-muted-foreground">Long-Term Gains:</span>
                      <span className={cn(
                        "font-semibold",
                        totalLongTermGains.greaterThanOrEqualTo(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      )}>
                        ${totalLongTermGains.toFixed(2)}
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
                        ${totalShortTermGains.plus(totalLongTermGains).minus(totalTax).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Asset</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Cost Basis</TableHead>
                          <TableHead className="text-right">Sell Price</TableHead>
                          <TableHead className="text-right">P&L</TableHead>
                          <TableHead className="text-right">Tax</TableHead>
                          <TableHead className="text-center">Taxable</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {taxableEvents.map((event, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">
                              {format(event.date, "yyyy-MM-dd")}
                            </TableCell>
                            <TableCell className="font-semibold">{event.symbol}</TableCell>
                            <TableCell>
                              <span className={cn(
                                "text-xs px-2 py-1 rounded-full",
                                event.type === 'SHORT_TERM' 
                                  ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                              )}>
                                {event.type === 'SHORT_TERM' ? 'Short-Term' : 'Long-Term'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {event.sellAmount.toFixed(4)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              ${event.costBasis.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              ${event.sellPrice.toFixed(2)}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-mono text-sm font-semibold",
                              event.pnl.greaterThanOrEqualTo(0) 
                                ? "text-green-600 dark:text-green-400" 
                                : "text-red-600 dark:text-red-400"
                            )}>
                              ${event.pnl.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-orange-600 dark:text-orange-400">
                              ${event.taxAmount.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              {event.isTaxable ? (
                                <span className="text-green-600 dark:text-green-400">✓</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
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
                disabled={taxableEvents.length === 0}
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

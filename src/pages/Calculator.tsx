import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, CalendarIcon, Upload, FileText } from 'lucide-react';
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
import type { DateRange } from 'react-day-picker';

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

const Calculator = () => {
  const navigate = useNavigate();
  
  const [hasPaid, setHasPaid] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [taxableEvents, setTaxableEvents] = useState<TaxableEvent[]>([]);
  const [totalShortTermGains, setTotalShortTermGains] = useState<Decimal>(new Decimal(0));
  const [totalLongTermGains, setTotalLongTermGains] = useState<Decimal>(new Decimal(0));
  const [totalTax, setTotalTax] = useState<Decimal>(new Decimal(0));
  const [jurisdiction, setJurisdiction] = useState<string>('us-mixed');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState(false);
  const [inputMethod, setInputMethod] = useState<'wallet' | 'csv'>('csv'); // inputMethod is now effectively always 'csv'

  // FIFO matching algorithm - memoized with useCallback
  const calculateTaxWithFIFO = useCallback((transactions: ParsedTransaction[]): TaxableEvent[] => {
    const taxEvents: TaxableEvent[] = [];
    const lots: TaxLot[] = [];
    const currentJurisdiction = taxJurisdictions[jurisdiction];

    // Sort transactions by date first
    const sortedTx = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const tx of sortedTx) {
      if (tx.type === 'BUY') {
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
          
          const holdingPeriodDays = Math.floor((tx.date.getTime() - lot.date.getTime()) / (1000 * 60 * 60 * 24));
          const isLongTerm = holdingPeriodDays > 365;
          
          const costBasisTotal = sellAmount.times(lot.costBasis);
          const sellTotal = sellAmount.times(tx.price);
          const pnl = sellTotal.minus(costBasisTotal);
          
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
          
          lot.amount = lot.amount.minus(sellAmount);
          if (lot.amount.lessThanOrEqualTo(0)) {
            lots.shift();
          }
          
          remainingSell = remainingSell.minus(sellAmount);
        }

        // Handle sells without matching buys (cost basis = 0)
        if (remainingSell.greaterThan(0)) {
          const sellTotal = remainingSell.times(tx.price);
          const taxRate = currentJurisdiction.shortTermRate;
          const taxAmount = sellTotal.times(taxRate).dividedBy(100);
          
          taxEvents.push({
            date: tx.date,
            symbol: tx.symbol,
            type: 'SHORT_TERM',
            sellAmount: remainingSell,
            sellPrice: tx.price,
            costBasis: new Decimal(0),
            pnl: sellTotal,
            taxAmount,
            isTaxable: true
          });
        }
      }
    }
    
    return taxEvents;
  }, [jurisdiction]);

  // Calculate totals from events
  const calculateTotals = useCallback((events: TaxableEvent[]) => {
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
  }, []);

  // Helper to normalize CSV column names
  const normalizeColumnName = (col: string): string => {
    return col.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  // Find column value with flexible matching
  const getColumnValue = (row: Record<string, any>, possibleNames: string[]): string => {
    for (const key of Object.keys(row)) {
      const normalized = normalizeColumnName(key);
      for (const name of possibleNames) {
        if (normalized.includes(normalizeColumnName(name))) {
          return (row[key] || '').toString();
        }
      }
    }
    return '';
  };

  const processFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      delimitersToGuess: [',', '\t', '|', ';'],
      complete: (results) => {
        try {
          const transactions: ParsedTransaction[] = [];
          
          for (const row of results.data as Record<string, any>[]) {
            // Flexible column matching
            const amountStr = getColumnValue(row, ['amount', 'quantity', 'qty', 'value']);
            const valueStr = getColumnValue(row, ['valueusd', 'usdvalue', 'total', 'price']);
            const dateStr = getColumnValue(row, ['datetime', 'date', 'time', 'timestamp']);
            const methodStr = getColumnValue(row, ['method', 'type', 'action', 'side', 'txtype']);
            const symbolStr = getColumnValue(row, ['symbol', 'asset', 'coin', 'currency']) || 'ETH';

            // Parse amount (remove currency suffixes)
            const cleanAmount = amountStr.replace(/[A-Za-z$,]/g, '').trim();
            const amount = new Decimal(cleanAmount || '0');
            
            // Parse USD value (remove $ and commas)
            const cleanValue = valueStr.replace(/[$,]/g, '').trim();
            const value = new Decimal(cleanValue || '0');
            
            // Calculate price per unit
            const price = amount.greaterThan(0) ? value.dividedBy(amount) : new Decimal(0);
            
            // Parse date with multiple format support
            let date: Date;
            if (dateStr) {
              // Try parsing as timestamp first
              const timestamp = parseInt(dateStr);
              if (!isNaN(timestamp) && timestamp > 1000000000) {
                // Unix timestamp (seconds or milliseconds)
                date = new Date(timestamp > 9999999999 ? timestamp : timestamp * 1000);
              } else {
                date = new Date(dateStr);
              }
            } else {
              date = new Date();
            }

            // Validate date
            if (isNaN(date.getTime())) {
              console.warn('Invalid date, skipping row:', row);
              continue;
            }
            
            // Determine transaction type
            const method = methodStr.toLowerCase();
            let type: 'BUY' | 'SELL' = 'BUY';
            
            const sellKeywords = ['sell', 'sold', 'withdraw', 'send', 'sent', 'swap out', 'out', 'transfer out'];
            const buyKeywords = ['buy', 'bought', 'deposit', 'receive', 'received', 'swap in', 'in', 'transfer in'];
            
            if (sellKeywords.some(k => method.includes(k))) {
              type = 'SELL';
            } else if (buyKeywords.some(k => method.includes(k))) {
              type = 'BUY';
            }
            
            if (amount.greaterThan(0)) {
              transactions.push({
                date,
                type,
                symbol: symbolStr.toUpperCase(),
                amount,
                price,
                value
              });
            }
          }
          
          if (transactions.length === 0) {
            toast({
              title: "No Valid Transactions",
              description: "Could not parse any valid transactions from the CSV. Check the format.",
              variant: "destructive",
            });
            return;
          }

          // Sort by date (oldest first for FIFO)
          transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
          
          setParsedTransactions(transactions);
          
          // Calculate tax events
          const events = calculateTaxWithFIFO(transactions);
          setTaxableEvents(events);
          calculateTotals(events);
          
          toast({
            title: "CSV Processed Successfully",
            description: `Loaded ${transactions.length} transactions. Found ${events.length} taxable events.`,
          });
        } catch (error) {
          console.error('Error processing CSV:', error);
          toast({
            title: "Processing Error",
            description: `Failed to process CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
            variant: "destructive",
          });
        }
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        toast({
          title: "Parse Error",
          description: "Failed to parse CSV file. Ensure it's a valid CSV.",
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
    doc.text(`Jurisdiction: ${taxJurisdictions[jurisdiction].name}`, 20, yPos);
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

  // Recalculate when jurisdiction changes
  useEffect(() => {
    if (parsedTransactions.length > 0) {
      const events = calculateTaxWithFIFO(parsedTransactions);
      setTaxableEvents(events);
      calculateTotals(events);
    }
  }, [jurisdiction, parsedTransactions, calculateTaxWithFIFO, calculateTotals]);

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

          <Tabs value={inputMethod} className="mb-6"> {/* Removed onValueChange */}
            <TabsList className="grid w-full grid-cols-1"> {/* Changed to 1 column */}
              <TabsTrigger value="csv" className="gap-2">
                <FileText className="h-4 w-4" />
                CSV Upload
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
                    Supported columns: Date/DateTime, Type/Method, Amount, Value/Price (USD)
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Wallet connection tab content removed */}
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

            {parsedTransactions.length > 0 && (
              <div className="rounded-lg bg-muted/30 p-4 border border-border">
                <p className="text-sm text-muted-foreground">
                  <strong>{parsedTransactions.length}</strong> transactions loaded • 
                  <strong> {parsedTransactions.filter(t => t.type === 'BUY').length}</strong> buys • 
                  <strong> {parsedTransactions.filter(t => t.type === 'SELL').length}</strong> sells
                </p>
              </div>
            )}

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
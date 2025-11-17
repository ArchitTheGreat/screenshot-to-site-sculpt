import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, CalendarIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface EtherscanTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
  methodId: string;
  functionName: string;
}

interface Transaction {
  type: string; // e.g., 'buy', 'sell', 'transfer'
  amount: number; // ETH amount
  value: number; // USD value at time of transaction
  date: Date; // Transaction date
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

  const calculateMetrics = (transactions: Transaction[], costBasis: number) => {
    let totalEthSent = 0;
    let totalUsdValue = 0;
    let totalTaxOwed = 0;
    const currentJurisdiction = taxJurisdictions[jurisdiction];

    for (const tx of transactions) {
      // Simple heuristic for buy/sell based on 'to' address. Needs refinement for complex scenarios.
      // Assuming 'value' from Etherscan is in Wei and needs conversion to ETH, then USD value estimation

      // For simplicity, let's assume a fixed ETH price for now for USD value calculation from ETH amount
      // In a real app, you'd fetch historical ETH prices for each transaction date.
      const estimatedEthPrice = costBasis; // Using cost basis as a placeholder for ETH price

      if (tx.type === "sell") {
        totalEthSent -= tx.amount;
        tx.value = tx.amount * estimatedEthPrice; // Estimate USD value for sell
        totalUsdValue += tx.value;
        const { taxAmount, taxRate } = calculateTransactionTax(tx.type, tx.value);
        tx.taxAmount = taxAmount;
        tx.taxRate = taxRate;
        totalTaxOwed += taxAmount;
      } else if (tx.type === "buy") {
        totalEthSent += tx.amount;
        tx.value = tx.amount * estimatedEthPrice; // Estimate USD value for buy
        totalUsdValue -= tx.value; // Buys decrease USD value for profit calculation
      }
    }

    const costBasisTotal = totalEthSent * costBasis;
    const gainLossUsd = totalUsdValue + costBasisTotal; // Adjusted for buys/sells
    const taxOwedUsd = totalTaxOwed; // Already accumulated

    setNetProfit(gainLossUsd);
    setTotalBuys(0); // This needs to be re-evaluated based on how we define totalBuys with API data
    setTotalSells(totalUsdValue); // This needs to be re-evaluated based on how we define totalSells with API data
    setTotalTax(taxOwedUsd);
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


    // Download
    doc.save(`kryptogain-tax-report-${Date.now()}.pdf`);
    
    toast({
      title: "PDF Generated!",
      description: "Your comprehensive tax report has been downloaded.",
    });
  };

  // Hardcoded Etherscan API key
  const ETHERSCAN_API_KEY = import.meta.env.VITE_ETHERSCAN_API_KEY;

  const fetchEtherscanTransactions = async () => {
    if (!walletAddress) {
      toast({
        title: "Missing Wallet Address",
        description: "Please enter an Ethereum wallet address.",
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
        const apiUrl = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}&starttimestamp=${startTimestamp}&endtimestamp=${endTimestamp}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (data.status === "1" && data.result.length > 0) {
          const dayTransactions: Transaction[] = data.result.map((tx: EtherscanTransaction) => ({
            type: tx.value === "0" ? "transfer" : (tx.to.toLowerCase() === walletAddress.toLowerCase() ? "buy" : "sell"),
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
        description: "Failed to fetch transactions from Etherscan. Please check your wallet address and API key.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Calculate metrics whenever transactions or costBasisPerEth changes
    if (transactions.length > 0) {
      calculateMetrics(transactions, costBasisPerEth);
    }
  }, [transactions, costBasisPerEth]);

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
            Generate your Crypto Tax Report
          </h2>

          <div className="space-y-6">
            {/* Wallet Address Input */}
            <div className="space-y-2">
              <Label htmlFor="wallet-address">Ethereum Wallet Address</Label>
              <Input
                id="wallet-address"
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0xAbc123..."
              />
              <p className="text-xs text-muted-foreground">
                Enter the Ethereum wallet address to fetch transactions.
              </p>
            </div>

            {/* Date Range Picker */}
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
              <p className="text-xs text-muted-foreground">
                Select a custom date range to fetch transactions.
              </p>
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
            {transactions.length > 0 && (
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
                <a href="https://nowpayments.io/payment/?iid=4583571841" target="_blank" rel="noopener noreferrer">
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
                disabled={transactions.length === 0 || loading}
                onClick={fetchEtherscanTransactions}
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

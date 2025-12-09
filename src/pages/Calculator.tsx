import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, CalendarIcon, Upload, FileText, Info, Loader2 } from 'lucide-react';
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

// Helper to normalize CSV column names
const normalizeColumnName = (col: string): string => {
  return col.toLowerCase().replace(/[^a-z0-9]/g, '');
};

// Auto-detect exchange format based on headers
const detectExchangeFormat = (headers: string[]): string => {
  const normalizedHeaders = headers.map(h => normalizeColumnName(h));
  
  // Check for Coinbase
  if (normalizedHeaders.includes('timestamp') && 
      normalizedHeaders.includes('transactiontype') && 
      normalizedHeaders.includes('asset')) {
    return 'coinbase';
  }
  
  // Check for Binance
  if (normalizedHeaders.includes('utctime') && 
      normalizedHeaders.includes('account') && 
      normalizedHeaders.includes('operation')) {
    return 'binance';
  }
  
  // Check for Kraken
  if (normalizedHeaders.includes('txid') && 
      normalizedHeaders.includes('refid') && 
      normalizedHeaders.includes('time')) {
    return 'kraken';
  }
  
  // Check for Crypto.com
  if (normalizedHeaders.includes('timestamputc') && 
      normalizedHeaders.includes('transactiondescription') && 
      normalizedHeaders.includes('nativeamountinusd')) {
    return 'cryptocom';
  }
  
  // Check for Gemini
  if (normalizedHeaders.includes('date') && 
      normalizedHeaders.includes('timeutc') && 
      normalizedHeaders.includes('usdamountusd')) {
    return 'gemini';
  }
  
  // Default to generic if no match
  return 'generic';
};

// Coinbase parser
const parseCoinbase = (row: Record<string, any>): ParsedTransaction | null => {
  try {
    // Extract date
    const dateStr = row['Timestamp'] || row['timestamp'];
    if (!dateStr) return null;
    
    let date: Date;
    // Try parsing as ISO 8601
    date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    
    // Extract transaction type
    const typeStr = (row['Transaction Type'] || row['transaction type'] || '').toLowerCase();
    if (!['buy', 'sell'].includes(typeStr)) return null;
    
    const isBuy = typeStr === 'buy';
    const type: 'BUY' | 'SELL' = isBuy ? 'BUY' : 'SELL';
    
    // Extract asset
    const symbol = (row['Asset'] || row['asset'] || '').toUpperCase();
    
    // Extract amount
    const amountStr = row['Quantity Transacted'] || row['quantity transacted'] || '';
    const amount = new Decimal(amountStr || '0');
    if (amount.isNaN() || amount.lte(0)) return null;
    
    // Extract USD value
    const usdValueStr = row['Total (inclusive of fees)'] || row['total (inclusive of fees)'] || row['Subtotal'] || row['subtotal'] || '0';
    const usdValue = new Decimal(usdValueStr || '0');
    if (usdValue.isNaN() || usdValue.lte(0)) return null;
    
    // Extract fees
    const feeStr = row['Fees'] || row['fees'] || '0';
    const fee = new Decimal(feeStr || '0');
    
    // Calculate price per unit
    let price: Decimal;
    if (isBuy) {
      // For buys, include fees in cost basis
      price = usdValue.dividedBy(amount);
    } else {
      // For sells, fees reduce the proceeds
      price = usdValue.dividedBy(amount);
    }
    
    return {
      date,
      type,
      symbol,
      amount,
      price,
      value: usdValue
    };
  } catch (error) {
    console.error('Error parsing Coinbase row:', error);
    return null;
  }
};

// Binance parser
const parseBinance = (row: Record<string, any>): ParsedTransaction | null => {
  try {
    // Extract date
    const dateStr = row['UTC_Time'] || row['utc_time'] || '';
    if (!dateStr) return null;
    
    let date: Date;
    // Try parsing as YYYY-MM-DD HH:MM:SS
    date = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(date.getTime())) return null;
    
    // Extract operation type
    const operationStr = (row['Operation'] || row['operation'] || '').toLowerCase();
    if (!['buy', 'sell', 'deposit', 'withdraw'].includes(operationStr)) return null;
    
    const isBuy = operationStr === 'buy' || operationStr === 'deposit';
    const isSell = operationStr === 'sell' || operationStr === 'withdraw';
    if (!isBuy && !isSell) return null;
    
    const type: 'BUY' | 'SELL' = isBuy ? 'BUY' : 'SELL';
    
    // Extract asset
    const symbol = (row['Coin'] || row['coin'] || '').toUpperCase();
    
    // Extract amount (Binance shows negative values for sells)
    const amountStr = row['Change'] || row['change'] || '0';
    let amount = new Decimal(amountStr || '0');
    if (amount.isNaN()) return null;
    
    // For sells, amount is negative - make it positive
    if (amount.isNegative()) {
      amount = amount.abs();
    }
    
    if (amount.lte(0)) return null;
    
    // Extract USD value - Binance doesn't provide this directly in all formats
    // We'll need to calculate it from other data if available
    let usdValue = new Decimal(0);
    const remark = row['Remark'] || row['remark'] || '';
    
    // Try to extract USD value from remark
    const usdMatch = remark.match(/USD\s*([\d,\.]+)/);
    if (usdMatch && usdMatch[1]) {
      usdValue = new Decimal(usdMatch[1].replace(/,/g, ''));
    }
    
    // If we don't have USD value from remark, try other approaches
    if (usdValue.isZero()) {
      // For trades, the remark might contain the pair and price
      const tradeMatch = remark.match(/(\w+)@([\d,\.]+)/);
      if (tradeMatch && tradeMatch[2] && symbol !== 'USD') {
        const price = new Decimal(tradeMatch[2].replace(/,/g, ''));
        usdValue = amount.times(price);
      }
    }
    
    if (usdValue.isZero() || usdValue.isNaN()) return null;
    
    // Calculate price per unit
    const price = usdValue.dividedBy(amount);
    
    return {
      date,
      type,
      symbol,
      amount,
      price,
      value: usdValue
    };
  } catch (error) {
    console.error('Error parsing Binance row:', error);
    return null;
  }
};

// Kraken parser - handles ledger exports with trades
const parseKraken = (row: Record<string, any>): ParsedTransaction | null => {
  try {
    // Extract date - Kraken uses various date formats
    const dateStr = row['time'] || row['Time'] || row['txtime'] || '';
    if (!dateStr) return null;
    
    let date: Date;
    // Try parsing as Unix timestamp first
    const timestamp = parseFloat(dateStr);
    if (!isNaN(timestamp) && timestamp > 1000000000) {
      date = new Date(timestamp > 9999999999 ? timestamp : timestamp * 1000);
    } else {
      // Try ISO format
      date = new Date(dateStr);
    }
    
    if (isNaN(date.getTime())) return null;
    
    // Extract transaction type
    const typeStr = (row['type'] || row['Type'] || '').toLowerCase();
    
    // Kraken uses codes like XETH for ETH, ZUSD for USD
    const normalizeAsset = (code: string): string => {
      if (!code) return '';
      code = code.toUpperCase();
      if (code.startsWith('X') && code.length > 3) return code.substring(1);
      if (code.startsWith('Z') && code.length > 3) return code.substring(1);
      if (code === 'XXBT' || code === 'XBT') return 'BTC';
      return code;
    };
    
    // Extract asset
    const asset = row['asset'] || row['Asset'] || '';
    const symbol = normalizeAsset(asset);
    
    // Skip USD/fiat rows
    if (['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].includes(symbol)) return null;
    
    // Extract amount
    const amountStr = row['amount'] || row['Amount'] || '0';
    let amount = new Decimal(amountStr || '0');
    if (amount.isNaN()) return null;
    
    // Determine type based on amount sign and type field
    const isSell = amount.isNegative() || typeStr === 'sell' || typeStr === 'withdrawal';
    const isBuy = amount.isPositive() || typeStr === 'buy' || typeStr === 'deposit';
    
    if (isSell) amount = amount.abs();
    if (amount.lte(0)) return null;
    
    const type: 'BUY' | 'SELL' = isSell ? 'SELL' : 'BUY';
    
    // Try to get balance or fee to estimate USD value
    const balanceStr = row['balance'] || row['Balance'] || '0';
    const feeStr = row['fee'] || row['Fee'] || '0';
    
    // For trades, try to extract price from pair info
    const pair = row['pair'] || row['Pair'] || '';
    const priceStr = row['price'] || row['Price'] || '';
    
    let usdValue = new Decimal(0);
    
    // If price is available, use it
    if (priceStr) {
      const price = new Decimal(priceStr || '0');
      if (!price.isNaN() && price.gt(0)) {
        usdValue = amount.times(price);
      }
    }
    
    // Try cost field (Kraken trade history)
    const costStr = row['cost'] || row['Cost'] || '';
    if (costStr && usdValue.isZero()) {
      const cost = new Decimal(costStr || '0');
      if (!cost.isNaN() && cost.gt(0)) {
        usdValue = cost.abs();
      }
    }
    
    // If still no USD value, skip this row
    if (usdValue.isZero() || usdValue.isNaN()) return null;
    
    const price = usdValue.dividedBy(amount);
    
    return {
      date,
      type,
      symbol,
      amount,
      price,
      value: usdValue
    };
  } catch (error) {
    console.error('Error parsing Kraken row:', error);
    return null;
  }
};

// Crypto.com parser
const parseCryptoCom = (row: Record<string, any>): ParsedTransaction | null => {
  try {
    // Extract date
    const dateStr = row['Timestamp (UTC)'] || row['timestamp (utc)'] || '';
    if (!dateStr) return null;
    
    let date: Date;
    // Try parsing as ISO 8601
    date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    
    // Extract transaction kind
    const kindStr = (row['Transaction Kind'] || row['transaction kind'] || '').toLowerCase();
    if (!['crypto_purchase', 'crypto_sale'].includes(kindStr)) return null;
    
    const isBuy = kindStr === 'crypto_purchase';
    const type: 'BUY' | 'SELL' = isBuy ? 'BUY' : 'SELL';
    
    // Extract asset
    const symbol = (row['Currency'] || row['currency'] || '').toUpperCase();
    
    // Extract amount
    const amountStr = row['Amount'] || row['amount'] || '0';
    let amount = new Decimal(amountStr || '0');
    if (amount.isNaN()) return null;
    
    // For sells, amount is negative - make it positive
    if (amount.isNegative()) {
      amount = amount.abs();
    }
    
    if (amount.lte(0)) return null;
    
    // Extract USD value
    const usdValueStr = row['Native Amount (in USD)'] || row['native amount (in usd)'] || '0';
    let usdValue = new Decimal(usdValueStr || '0');
    if (usdValue.isNaN() || usdValue.lte(0)) return null;
    
    // Calculate price per unit
    const price = usdValue.dividedBy(amount);
    
    return {
      date,
      type,
      symbol,
      amount,
      price,
      value: usdValue
    };
  } catch (error) {
    console.error('Error parsing Crypto.com row:', error);
    return null;
  }
};

// Gemini parser
const parseGemini = (row: Record<string, any>): ParsedTransaction | null => {
  try {
    // Extract date
    const dateStr = (row['Date'] || row['date'] || '') + ' ' + (row['Time (UTC)'] || row['time (utc)'] || '');
    if (!dateStr.trim()) return null;
    
    let date: Date;
    // Try parsing as YYYY-MM-DD HH:MM:SS
    date = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(date.getTime())) return null;
    
    // Extract transaction type
    const typeStr = (row['Type'] || row['type'] || '').toLowerCase();
    if (!['buy', 'sell'].includes(typeStr)) return null;
    
    const isBuy = typeStr === 'buy';
    const type: 'BUY' | 'SELL' = isBuy ? 'BUY' : 'SELL';
    
    // Gemini has multiple currency columns in one row
    let symbol = '';
    let amount = new Decimal(0);
    let usdValue = new Decimal(0);
    
    // Check for ETH transactions
    const ethAmountStr = row['ETH Amount ETH'] || row['eth amount eth'] || '0';
    const ethAmount = new Decimal(ethAmountStr || '0');
    if (!ethAmount.isNaN() && ethAmount.abs().greaterThan(0)) {
      symbol = 'ETH';
      amount = ethAmount.abs();
      
      // Extract USD value
      const usdAmountStr = row['USD Amount USD'] || row['usd amount usd'] || '0';
      usdValue = new Decimal(usdAmountStr || '0');
    } 
    // Check for BTC transactions
    else if (row['BTC Amount BTC'] || row['btc amount btc']) {
      const btcAmountStr = row['BTC Amount BTC'] || row['btc amount btc'] || '0';
      const btcAmount = new Decimal(btcAmountStr || '0');
      if (!btcAmount.isNaN() && btcAmount.abs().greaterThan(0)) {
        symbol = 'BTC';
        amount = btcAmount.abs();
        
        // Extract USD value
        const usdAmountStr = row['USD Amount USD'] || row['usd amount usd'] || '0';
        usdValue = new Decimal(usdAmountStr || '0');
      }
    }
    
    if (!symbol || amount.lte(0) || usdValue.lte(0)) return null;
    
    // Calculate price per unit
    const price = usdValue.dividedBy(amount);
    
    return {
      date,
      type,
      symbol,
      amount,
      price,
      value: usdValue
    };
  } catch (error) {
    console.error('Error parsing Gemini row:', error);
    return null;
  }
};

const Calculator = () => {
  const navigate = useNavigate();
  
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [taxableEvents, setTaxableEvents] = useState<TaxableEvent[]>([]);
  const [totalShortTermGains, setTotalShortTermGains] = useState<Decimal>(new Decimal(0));
  const [totalLongTermGains, setTotalLongTermGains] = useState<Decimal>(new Decimal(0));
  const [totalTax, setTotalTax] = useState<Decimal>(new Decimal(0));
  const [jurisdiction, setJurisdiction] = useState<string>('us-mixed');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState(false);
  const [inputMethod, setInputMethod] = useState<'wallet' | 'csv'>('csv');

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

  const processFile = (file: File) => {
    setLoading(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      delimitersToGuess: [',', '\t', '|', ';'],
      complete: (results) => {
        try {
          if (!results.data || results.data.length === 0) {
            toast({
              title: "Empty File",
              description: "The CSV file appears to be empty.",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }

          // Get headers for format detection
          const headers = Object.keys(results.data[0] as Record<string, any>);
          const exchangeFormat = detectExchangeFormat(headers);
          
          let exchangeName = 'Generic';
          let parser: (row: Record<string, any>) => ParsedTransaction | null;
          
          switch (exchangeFormat) {
            case 'coinbase':
              parser = parseCoinbase;
              exchangeName = 'Coinbase';
              break;
            case 'binance':
              parser = parseBinance;
              exchangeName = 'Binance';
              break;
            case 'kraken':
              parser = parseKraken;
              exchangeName = 'Kraken';
              break;
            case 'cryptocom':
              parser = parseCryptoCom;
              exchangeName = 'Crypto.com';
              break;
            case 'gemini':
              parser = parseGemini;
              exchangeName = 'Gemini';
              break;
            default:
              // Use the existing generic parser
              parser = (row) => {
                // Flexible column matching
                const amountStr = (row['Amount'] || row['amount'] || row['Quantity'] || row['quantity'] || '').toString();
                const valueStr = (row['Value'] || row['value'] || row['Total'] || row['total'] || '').toString();
                const dateStr = (row['Date'] || row['date'] || row['Timestamp'] || row['timestamp'] || '').toString();
                const typeStr = (row['Type'] || row['type'] || row['Transaction'] || row['transaction'] || '').toString();
                const symbolStr = (row['Symbol'] || row['symbol'] || row['Asset'] || row['asset'] || 'ETH').toString();

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
                  return null;
                }
                
                // Determine transaction type
                const type = typeStr.toLowerCase();
                let txType: 'BUY' | 'SELL' = 'BUY';
                
                const sellKeywords = ['sell', 'sold', 'withdraw', 'send', 'sent', 'swap out', 'out', 'transfer out'];
                const buyKeywords = ['buy', 'bought', 'deposit', 'receive', 'received', 'swap in', 'in', 'transfer in'];
                
                if (sellKeywords.some(k => type.includes(k))) {
                  txType = 'SELL';
                } else if (buyKeywords.some(k => type.includes(k))) {
                  txType = 'BUY';
                }
                
                if (amount.greaterThan(0)) {
                  return {
                    date,
                    type: txType,
                    symbol: symbolStr.toUpperCase(),
                    amount,
                    price,
                    value
                  };
                }
                return null;
              };
              exchangeName = 'Generic';
              break;
          }
          
          toast({
            title: "Format Detected",
            description: `Detected ${exchangeName} CSV format.`,
          });

          const transactions: ParsedTransaction[] = [];
          let skippedRows = 0;
          
          for (const row of results.data as Record<string, any>[]) {
            const tx = parser(row);
            if (tx) {
              transactions.push(tx);
            } else {
              skippedRows++;
            }
          }
          
          if (transactions.length === 0) {
            toast({
              title: "No Valid Transactions",
              description: `Could not parse any valid transactions from the ${exchangeName} CSV. Check the format.`,
              variant: "destructive",
            });
            setLoading(false);
            return;
          }

          if (skippedRows > 0) {
            toast({
              title: "Partial Success",
              description: `Loaded ${transactions.length} transactions, skipped ${skippedRows} rows with incomplete data.`,
            });
          } else {
            toast({
              title: "CSV Processed Successfully",
              description: `Loaded ${transactions.length} transactions from ${exchangeName}.`,
            });
          }

          // Sort by date (oldest first for FIFO)
          transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
          
          setParsedTransactions(transactions);
          
          // Calculate tax events
          const events = calculateTaxWithFIFO(transactions);
          setTaxableEvents(events);
          calculateTotals(events);
        } catch (error) {
          console.error('Error processing CSV:', error);
          toast({
            title: "Processing Error",
            description: `Failed to process CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        toast({
          title: "Parse Error",
          description: "Failed to parse CSV file. Ensure it's a valid CSV.",
          variant: "destructive",
        });
        setLoading(false);
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
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;
    
    // Header with branding
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('KryptoGain', 20, 25);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Cryptocurrency Tax Report', 20, 35);
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    yPos = 60;
    
    // Report info
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPos);
    doc.text(`Jurisdiction: ${taxJurisdictions[jurisdiction].name}`, pageWidth - 20, yPos, { align: 'right' });
    yPos += 15;
    
    // Summary Box
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(15, yPos, pageWidth - 30, 65, 3, 3, 'F');
    yPos += 12;
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Financial Summary', 20, yPos);
    yPos += 12;
    
    const netGains = totalShortTermGains.plus(totalLongTermGains);
    const netAfterTax = netGains.minus(totalTax);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    // Two column layout for summary
    doc.text('Short-Term Gains:', 25, yPos);
    doc.text(`$${totalShortTermGains.toFixed(2)}`, 100, yPos);
    doc.text('Long-Term Gains:', 120, yPos);
    doc.text(`$${totalLongTermGains.toFixed(2)}`, 185, yPos);
    yPos += 10;
    
    doc.text('Total Gains:', 25, yPos);
    doc.text(`$${netGains.toFixed(2)}`, 100, yPos);
    doc.text('Tax Owed:', 120, yPos);
    doc.setTextColor(200, 100, 0);
    doc.text(`$${totalTax.toFixed(2)}`, 185, yPos);
    yPos += 10;
    
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Net After Tax:', 25, yPos);
    doc.setTextColor(netAfterTax.gte(0) ? 0 : 200, netAfterTax.gte(0) ? 150 : 0, 0);
    doc.text(`$${netAfterTax.toFixed(2)}`, 100, yPos);
    
    yPos += 25;
    
    // Tax Breakdown Table
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Taxable Events', 20, yPos);
    yPos += 8;
    
    // Table header
    doc.setFillColor(0, 0, 0);
    doc.rect(15, yPos, pageWidth - 30, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const headers = ['Date', 'Asset', 'Type', 'Amount', 'Cost', 'Price', 'P&L', 'Tax'];
    const colWidths = [25, 18, 25, 25, 25, 25, 25, 20];
    let xPos = 18;
    headers.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5.5);
      xPos += colWidths[i];
    });
    yPos += 10;
    
    // Table rows
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    
    const maxRowsPerPage = 25;
    let rowCount = 0;
    
    for (const event of taxableEvents) {
      if (rowCount > 0 && rowCount % maxRowsPerPage === 0) {
        doc.addPage();
        yPos = 20;
        
        // Add header to new page
        doc.setFillColor(0, 0, 0);
        doc.rect(15, yPos, pageWidth - 30, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        xPos = 18;
        headers.forEach((header, i) => {
          doc.text(header, xPos, yPos + 5.5);
          xPos += colWidths[i];
        });
        yPos += 10;
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
      }
      
      // Alternate row background
      if (rowCount % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(15, yPos - 1, pageWidth - 30, 7, 'F');
      }
      
      xPos = 18;
      doc.setFontSize(7);
      doc.text(format(event.date, 'yyyy-MM-dd'), xPos, yPos + 4);
      xPos += colWidths[0];
      doc.text(event.symbol, xPos, yPos + 4);
      xPos += colWidths[1];
      doc.text(event.type === 'SHORT_TERM' ? 'Short' : 'Long', xPos, yPos + 4);
      xPos += colWidths[2];
      doc.text(event.sellAmount.toFixed(4), xPos, yPos + 4);
      xPos += colWidths[3];
      doc.text(`$${event.costBasis.toFixed(2)}`, xPos, yPos + 4);
      xPos += colWidths[4];
      doc.text(`$${event.sellPrice.toFixed(2)}`, xPos, yPos + 4);
      xPos += colWidths[5];
      
      // Color code P&L
      doc.setTextColor(event.pnl.gte(0) ? 0 : 200, event.pnl.gte(0) ? 150 : 0, 0);
      doc.text(`$${event.pnl.toFixed(2)}`, xPos, yPos + 4);
      xPos += colWidths[6];
      
      doc.setTextColor(200, 100, 0);
      doc.text(`$${event.taxAmount.toFixed(2)}`, xPos, yPos + 4);
      doc.setTextColor(0, 0, 0);
      
      yPos += 7;
      rowCount++;
    }
    
    // Footer on last page
    yPos = pageHeight - 25;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('This report is for informational purposes only and does not constitute tax advice.', pageWidth / 2, yPos, { align: 'center' });
    doc.text('Please consult a tax professional for official guidance.', pageWidth / 2, yPos + 5, { align: 'center' });
    doc.text(`KryptoGain - Page ${doc.internal.pages.length - 1}`, pageWidth / 2, yPos + 12, { align: 'center' });

    doc.save(`kryptogain-tax-report-${Date.now()}.pdf`);
    
    toast({
      title: "PDF Generated!",
      description: "Your detailed tax report has been downloaded.",
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
            onClick={() => navigate('/terms')}
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

          {/* Added exchange support info */}
          <div className="mb-6">
            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold mb-1">Supported Exchanges</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    We support CSV exports from Coinbase, Binance, Kraken, Crypto.com, and Gemini.
                  </p>
                  <Button variant="link" className="p-0 h-auto font-normal text-primary" onClick={() => navigate('/docs')}>
                    View format documentation and examples
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <Tabs value={inputMethod} className="mb-6">
            <TabsList className="grid w-full grid-cols-1">
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
                  {loading ? (
                    <>
                      <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
                      <h3 className="font-semibold mb-2">Processing your file...</h3>
                      <p className="text-sm text-muted-foreground">This may take a moment</p>
                    </>
                  ) : (
                    <>
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
                        Supported exchanges: Coinbase, Binance, Kraken, Crypto.com, Gemini
                      </p>
                    </>
                  )}
                </div>
              </div>
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
                <div className="text-sm text-muted-foreground">
                  This application is completely free to use. No payment required.
                </div>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
              disabled={taxableEvents.length === 0}
              onClick={generatePDF}
            >
              Generate PDF Report
            </Button>
          </div>
        </Card>

        {/* Footer */}
        <footer className="mt-12 py-6 border-t border-border/50">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
            <span>© {new Date().getFullYear()} KryptoGain</span>
            <span className="hidden sm:inline">•</span>
            <button onClick={() => window.open('https://cdn.jsdelivr.net/gh/ArchitTheGreat/bug-free-happiness@main/ToS_Kryptogain.pdf', '_blank')} className="hover:text-primary transition-colors">
              Terms of Service
            </button>
            <span className="hidden sm:inline">•</span>
            <button onClick={() => navigate('/docs')} className="hover:text-primary transition-colors">
              Documentation
            </button>
            <span className="hidden sm:inline">•</span>
            <button onClick={() => navigate('/')} className="hover:text-primary transition-colors">
              Home
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-4 max-w-2xl mx-auto">
            All outputs are automated estimates for personal use and do not constitute tax, legal, or financial advice.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Calculator;
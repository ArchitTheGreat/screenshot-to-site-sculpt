# KryptoGain - Cryptocurrency Tax Calculator

A full-stack cryptocurrency tax calculator web application that allows users to upload CSV files containing cryptocurrency transaction data, automatically calculates taxes based on different jurisdictions, and generates professional PDF tax reports.

## Features

### 🏠 Landing Page
- Clean, modern hero section with KryptoGain branding
- Serif font logo with decorative accent line
- Clear call-to-action button to start tax calculation
- Responsive design for all devices

### 📊 Tax Calculator
- **CSV Upload System**: Upload transaction data via CSV files
- **Automatic Parsing**: Intelligent column detection for transaction types, amounts, and dates
- **Transaction Categorization**: 
  - Non-taxable: Buys, Deposits, Receives
  - Taxable: Sells, Withdrawals, Sends, Swaps
- **Multiple Tax Jurisdictions**:
  - US Short-Term Capital Gains (37%)
  - US Long-Term Capital Gains (20%)
  - Flat Rate 30%
  - Flat Rate 20%
- **Real-Time Calculations**: Live tax preview with profit/loss analysis
- **Payment Gate**: $15 payment verification before PDF generation

### 📄 PDF Report Generation
- Comprehensive tax report with:
  - File information and generation timestamp
  - Financial summary (buys, sells, profit/loss)
  - Detailed tax breakdown by category
  - Complete transaction list
  - Professional formatting with color-coded values
  - Automatic pagination for large datasets

## Tech Stack

- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Routing**: React Router v6
- **PDF Generation**: jsPDF
- **Icons**: Lucide React
- **Notifications**: Sonner (toast notifications)

## Project Structure

```
Remake/
├── App.tsx                 # Main app with routing
├── main.tsx               # Entry point
├── index.css              # Global styles with Tailwind
├── components/
│   └── ui/                # Reusable UI components
│       ├── button.tsx
│       ├── card.tsx
│       ├── checkbox.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       └── sonner.tsx
├── lib/
│   └── utils.ts           # Utility functions
├── pages/
│   ├── Index.tsx          # Landing page
│   ├── SimpleCalculator.tsx  # Main calculator page
│   └── NotFound.tsx       # 404 page
└── sample-transactions.csv   # Sample data for testing
```

## Getting Started

### Prerequisites
- Node.js 18+ or Bun
- npm, yarn, or bun package manager

### Installation

1. Navigate to the Remake directory:
```bash
cd Remake
```

2. Install dependencies (from parent directory):
```bash
npm install
# or
bun install
```

3. Start the development server:
```bash
npm run dev
# or
bun run dev
```

4. Open your browser to `http://localhost:5173`

## Usage

1. **Upload CSV**: Click "Generate my Tax Report!" on the landing page
2. **Select File**: Upload a CSV file with your cryptocurrency transactions
3. **Choose Jurisdiction**: Select your tax jurisdiction from the dropdown
4. **Review Preview**: Check the live tax calculations
5. **Payment**: Check the payment confirmation box
6. **Generate PDF**: Click "Generate PDF Report" to download your tax report

## CSV Format

Your CSV file should include the following columns (case-insensitive):
- **Type/Transaction**: Transaction type (buy, sell, swap, deposit, withdraw, etc.)
- **Amount/USD/Value**: USD value of the transaction
- **Date/Time**: (Optional) Transaction timestamp

Example:
```csv
Type,Amount,USD Value,Date
BUY,1.5,5000.00,2024-01-15
SELL,1.0,4500.00,2024-03-10
SWAP,0.3,1200.00,2024-04-05
```

## Tax Calculation Logic

### Non-Taxable Events
- **Buy**: Purchasing cryptocurrency
- **Deposit**: Depositing funds
- **Receive**: Receiving cryptocurrency
- Tax Rate: 0%

### Taxable Events
- **Sell**: Selling cryptocurrency
- **Withdraw**: Withdrawing funds
- **Send**: Sending cryptocurrency
- **Swap**: Exchanging one cryptocurrency for another
- Tax Rate: Based on selected jurisdiction

### Calculations
- **Net Profit/Loss** = Total Sells - Total Buys
- **Total Tax** = Sum of all individual transaction taxes
- **Net After Tax** = Net Profit - Total Tax

## Color Coding

- 🟢 **Green**: Profit
- 🔴 **Red**: Loss
- 🟠 **Orange**: Tax amounts
- 🔵 **Blue**: Net after tax

## Features Implemented

✅ CSV file upload and validation  
✅ Automatic transaction categorization  
✅ Multiple tax jurisdiction support  
✅ Real-time tax calculations  
✅ Live tax preview card  
✅ Payment gate system  
✅ Professional PDF report generation  
✅ Responsive design  
✅ Toast notifications  
✅ Error handling  
✅ Automatic pagination in PDF  

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

This project is part of the KryptoGain cryptocurrency tax calculator application.
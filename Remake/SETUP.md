# KryptoGain - Setup Instructions

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** 18.x or higher (or **Bun** runtime)
- **npm**, **yarn**, or **bun** package manager

## Installation Steps

### Option 1: Using the Parent Project Dependencies

Since this is in the `Remake` folder of a larger project, you can use the parent project's dependencies:

1. Navigate to the parent directory:
```bash
cd ..
```

2. Install dependencies (if not already installed):
```bash
npm install
# or
bun install
```

3. The parent project should have all required dependencies in its `package.json`

### Option 2: Standalone Installation

If you want to run the Remake folder as a standalone project:

1. Navigate to the Remake directory:
```bash
cd Remake
```

2. Install dependencies:
```bash
npm install
# or
bun install
```

## Running the Application

### Development Mode

From the **parent directory**:
```bash
npm run dev
# or
bun run dev
```

The application will start at `http://localhost:5173`

### Building for Production

```bash
npm run build
# or
bun run build
```

The built files will be in the `dist` folder.

### Preview Production Build

```bash
npm run preview
# or
bun run preview
```

## Project Structure

```
Remake/
├── components/          # Reusable UI components
│   └── ui/             # shadcn/ui components
├── lib/                # Utility functions
├── pages/              # Application pages
│   ├── Index.tsx       # Landing page
│   ├── SimpleCalculator.tsx  # Tax calculator
│   └── NotFound.tsx    # 404 page
├── App.tsx             # Main app with routing
├── main.tsx            # Entry point
├── index.html          # HTML template
├── index.css           # Global styles
└── sample-transactions.csv  # Test data
```

## Testing the Application

1. **Start the dev server** (see above)

2. **Navigate to the landing page** at `http://localhost:5173`

3. **Click "Generate my Tax Report!"** to go to the calculator

4. **Upload the sample CSV**:
   - Use the provided `sample-transactions.csv` file
   - Or create your own CSV with columns: Type, Amount, USD Value, Date

5. **Select a tax jurisdiction** from the dropdown

6. **Review the tax preview** showing calculations

7. **Check the payment checkbox** and click "Generate PDF Report"

## CSV File Format

Your CSV should have these columns (case-insensitive):
- **Type/Transaction**: buy, sell, swap, deposit, withdraw, send, receive
- **Amount/USD/Value**: Numeric value in USD
- **Date/Time**: (Optional) Transaction date

Example:
```csv
Type,Amount,USD Value,Date
BUY,1.5,5000.00,2024-01-15
SELL,1.0,4500.00,2024-03-10
SWAP,0.3,1200.00,2024-04-05
```

## Troubleshooting

### TypeScript Errors

If you see TypeScript errors about missing modules:
1. Ensure all dependencies are installed: `npm install`
2. Restart your IDE/editor
3. Clear TypeScript cache: Delete `node_modules/.cache` and restart

### Module Not Found Errors

If you get "Cannot find module" errors:
1. Check that you're running from the correct directory
2. Verify `node_modules` exists and is populated
3. Try deleting `node_modules` and `package-lock.json`, then run `npm install` again

### Vite Configuration Issues

If Vite fails to start:
1. Ensure you have the correct Node.js version (18+)
2. Check that `vite.config.ts` is properly configured
3. Try clearing Vite cache: `rm -rf node_modules/.vite`

### PDF Generation Issues

If PDF generation fails:
1. Ensure jsPDF is installed: `npm list jspdf`
2. Check browser console for errors
3. Verify CSV data is properly loaded before generating PDF

### Styling Issues

If styles don't appear:
1. Ensure Tailwind CSS is properly configured
2. Check that `index.css` is imported in `main.tsx`
3. Verify PostCSS is processing Tailwind directives

## Dependencies

### Core Dependencies
- react ^18.3.1
- react-dom ^18.3.1
- react-router-dom ^6.30.1
- jspdf ^3.0.3

### UI Components
- @radix-ui/react-checkbox ^1.3.2
- @radix-ui/react-label ^2.1.1
- @radix-ui/react-select ^2.2.5
- @radix-ui/react-slot ^1.1.1
- lucide-react ^0.462.0
- sonner ^1.7.4

### Styling
- tailwindcss ^3.4.17
- tailwindcss-animate ^1.0.7
- class-variance-authority ^0.7.1
- clsx ^2.1.1
- tailwind-merge ^2.6.0

### Dev Dependencies
- @types/node ^22.10.1
- @types/react ^18.3.1
- @types/react-dom ^18.3.1
- @vitejs/plugin-react ^4.3.4
- typescript ^5.7.3
- vite ^6.0.7
- autoprefixer ^10.4.20
- postcss ^8.4.49

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Known Issues

1. **TypeScript errors in IDE**: These are expected before running `npm install`. They will resolve once dependencies are installed.

2. **Path alias warnings**: The `@/` path alias is configured but may show warnings in some IDEs. This is cosmetic and doesn't affect functionality.

## Support

For issues or questions:
1. Check this SETUP.md file
2. Review the main README.md
3. Check the browser console for errors
4. Verify all dependencies are correctly installed

## License

This project is part of the KryptoGain cryptocurrency tax calculator application.
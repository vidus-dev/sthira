# Finance Tracking Application

A comprehensive finance tracking application with analytics, budgeting, and investment management features built with React, TypeScript, and Tailwind CSS.

## Features

- 📊 **Dashboard**: Overview of financial health with charts and metrics
- 💳 **Bank Accounts**: Manage multiple bank accounts and track balances
- 📝 **Transactions**: Record and categorize income and expenses
- 🎯 **Budgets**: Set and monitor spending limits by category
- 📈 **Investments**: Track mutual funds and investment portfolios
- 📊 **Analytics**: Detailed financial reports and insights
- 🌙 **Dark/Light Mode**: Toggle between themes
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile

## Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (version 16.0 or higher)
- **npm** (version 7.0 or higher) or **yarn**
- **Git** (for cloning the repository)

### Check your versions:
```bash
node --version
npm --version
git --version
```

## Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd "Finance Tracking Application (1)"
```

### 2. Install dependencies
```bash
npm install
```

This will install all the required packages including:
- React 18.2.0
- TypeScript 5.0.2
- Tailwind CSS 3.3.3
- Framer Motion 12.23.12
- Radix UI components
- Recharts for data visualization
- And other dependencies

### 3. Verify installation
After installation, you should see a `node_modules` folder in your project directory.

## Running the Application

### Development Mode
```bash
npm run dev
```

This command will:
- Start the Vite development server
- Compile TypeScript and process CSS
- Enable hot module replacement (HMR)
- Open the application in your default browser

The application will be available at:
- **Local**: http://localhost:5173
- **Network**: Available on your local network

### Build for Production
```bash
npm run build
```

This will:
- Compile and optimize the application
- Create a `dist` folder with production-ready files
- Minify JavaScript and CSS
- Optimize assets

### Preview Production Build
```bash
npm run preview
```

This serves the production build locally for testing.

### Linting
```bash
npm run lint
```

This will check your code for linting errors and warnings.

## Project Structure

```
Finance Tracking Application (1)/
├── public/                 # Static assets
├── src/
│   ├── app/               # Main application components
│   │   ├── routes/        # Page components
│   │   │   ├── landing/   # Landing page
│   │   │   ├── dashboard/ # Dashboard page
│   │   │   ├── accounts/  # Bank accounts page
│   │   │   ├── transactions/ # Transactions page
│   │   │   ├── budgets/   # Budgets page
│   │   │   ├── investments/ # Investments page
│   │   │   ├── analytics/ # Analytics page
│   │   │   └── settings/  # Settings page
│   │   └── App.tsx        # Main app component
│   ├── components/        # Reusable components
│   │   ├── ui/           # UI components (buttons, cards, etc.)
│   │   ├── layout/       # Layout components
│   │   └── common/       # Common components
│   ├── lib/              # Utility functions and configurations
│   ├── styles/           # Global styles
│   └── main.tsx          # Application entry point
├── index.html            # HTML template
├── package.json          # Dependencies and scripts
├── tailwind.config.js    # Tailwind CSS configuration
├── postcss.config.js     # PostCSS configuration
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite configuration
└── README.md            # This file
```

## Configuration Files

### Tailwind CSS
The application uses Tailwind CSS for styling. Configuration is in `tailwind.config.js`:
- Custom color scheme
- Dark mode support
- Custom animations
- Responsive breakpoints

### TypeScript
TypeScript configuration is in `tsconfig.json`:
- Strict type checking
- Path aliases for imports
- React JSX support

### Vite
Build configuration is in `vite.config.ts`:
- React plugin
- Path aliases (@components, @lib, @features, @app)
- Development server settings

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Troubleshooting

### Common Issues

#### 1. Port already in use
If you get a "port already in use" error:
```bash
# Kill processes on port 5173
npx kill-port 5173

# Or use a different port
npm run dev -- --port 3000
```

#### 2. Node modules issues
If you encounter dependency issues:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 3. TypeScript errors
If you see TypeScript compilation errors:
```bash
# Check TypeScript version
npx tsc --version

# Restart the development server
npm run dev
```

#### 4. Tailwind CSS not working
If styles are not applying:
```bash
# Check if Tailwind is properly installed
npm list tailwindcss

# Rebuild the project
npm run build
```

### Browser Compatibility

The application supports:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Development

### Adding New Features

1. Create components in the appropriate directory
2. Use TypeScript for type safety
3. Follow the existing code structure
4. Add proper imports using path aliases
5. Test in both light and dark modes

### Code Style

- Use TypeScript for all components
- Follow React best practices
- Use Tailwind CSS for styling
- Implement responsive design
- Add proper error handling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

If you encounter any issues or have questions:
1. Check the troubleshooting section
2. Review the project structure
3. Check the browser console for errors
4. Ensure all dependencies are installed correctly

## Technology Stack

- **Frontend**: React 18.2.0
- **Language**: TypeScript 5.0.2
- **Styling**: Tailwind CSS 3.3.3
- **Build Tool**: Vite 4.4.5
- **Animations**: Framer Motion 12.23.12
- **Charts**: Recharts 2.7.2
- **UI Components**: Radix UI
- **Icons**: Lucide React
- **Forms**: React Hook Form

---

**Happy coding! 🚀**
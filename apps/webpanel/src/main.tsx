import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fxmanager/ui/globals.css';
import { App } from './App.tsx';
import { ThemeProvider } from '@/components/theme-provider.tsx';
import { BrowserRouter } from 'react-router-dom';
import SetupApp from './SetupApp.tsx';
import { TooltipProvider } from '@fxmanager/ui/components/tooltip';
import { AuthProvider } from './context/AuthContext.tsx';

declare global {
  interface Window { __SETUP_REQUIRED__?: boolean; }
}

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<BrowserRouter>
			<ThemeProvider>
				<TooltipProvider>
					{window.__SETUP_REQUIRED__
						? <SetupApp />
						: (
							<AuthProvider>
								<App />
							</AuthProvider>
						)
					}
				</TooltipProvider>
			</ThemeProvider>
		</BrowserRouter>
	</StrictMode>,
);

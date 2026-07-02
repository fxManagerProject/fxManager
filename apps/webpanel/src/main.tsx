import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fxmanager/ui/globals.css';
import { App } from './App.tsx';
import { SetupApp } from './pages/setup/index.tsx';
import { ThemeProvider } from '@/components/theme-provider.tsx';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@fxmanager/ui/components/tooltip';
import { AuthProvider } from './context/AuthContext.tsx';
import { WSProvider } from './context/WsContext.tsx';
import { Toaster } from 'sonner';

declare global {
	interface Window {
		__SETUP_REQUIRED__?: boolean;
	}
}

// biome-ignore lint/style/noNonNullAssertion: conventional method
createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<BrowserRouter>
			<ThemeProvider>
				<TooltipProvider>
					{window.__SETUP_REQUIRED__ ? (
						<SetupApp />
					) : (
						<AuthProvider>
							<WSProvider>
								<App />
							</WSProvider>
						</AuthProvider>
					)}
					<Toaster />
				</TooltipProvider>
			</ThemeProvider>
		</BrowserRouter>
	</StrictMode>,
);

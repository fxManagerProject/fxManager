import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@fxmanager/ui/components/button';
import { ArrowLeft, Home, LogIn, Terminal } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export default function NotFound() {
	const { user } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();

	return (
		<div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
			<div className="flex flex-col items-start max-w-lg w-full gap-8">
				<div className="w-full rounded-lg border border-border bg-card font-mono text-sm overflow-hidden">
					<div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
						<Terminal className="h-3.5 w-3.5 text-muted-foreground" />
						<span className="text-xs text-muted-foreground">system</span>
					</div>
					<div className="px-4 py-4 space-y-1.5">
						<p>
							<span className="text-muted-foreground">$ </span>
							<span className="text-foreground">GET </span>
							<span className="text-primary">{location.pathname}</span>
						</p>
						<p>
							<span className="text-muted-foreground">→ </span>
							<span className="text-destructive">404 Not Found</span>
						</p>
						<p className="text-muted-foreground text-xs pt-1">
							The requested resource does not exist or has been removed.
						</p>
					</div>
				</div>

				<div className="w-full flex justify-around items-center gap-3">
					<Button
						variant="outline"
						className="w-30"
						onClick={() => navigate(-1)}
					>
						<ArrowLeft className="h-4 w-4" />
						Go back
					</Button>
					<Button
						variant="default"
						className="w-30"
						onClick={() => navigate(user ? '/' : '/login')}
					>
						{user ? (
							<Home className="h-4 w-4" />
						) : (
							<LogIn className="h-4 w-4" />
						)}
						{user ? 'Dashboard' : 'Login'}
					</Button>
				</div>
			</div>
		</div>
	);
}

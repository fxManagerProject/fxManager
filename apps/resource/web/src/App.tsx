import { useState } from 'react';
import { isEnvBrowser } from './utils/misc';
import { useNuiEvent } from './hooks/useNuiEvent';
import { fetchNui } from './utils/fetchNui';
import { Button } from '@fxmanager/ui/components/button';

function App() {
	const [visible, setVisible] = useState(isEnvBrowser());
	const [count, setCount] = useState(0);

	useNuiEvent('setVisible', (data: { visible?: boolean }) => {
		setVisible(data.visible || false);
	});

	function handleHideModal() {
		setVisible(false);
		void fetchNui('exit');
	}

	return (
		<>
			{visible && (
				<div className="h-screen flex flex-col items-center justify-center bg-transparent">
					<div className="bg-secondary p-6 text-primary-foreground w-xl">
						<h3 className="font-bold text-lg">Boilerplate Modal</h3>
						<p>Count: {count}</p>

						<div className='space-x-4 mt-4'>
							<Button onClick={() => setCount((prev) => ++prev)}>
								Increment
							</Button>
							<Button
								onClick={() => setCount((prev) => --prev)}
								variant="destructive"
							>
								Decrement
							</Button>
							<Button onClick={() => handleHideModal()} variant="outline">
								Hide modal
							</Button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

export default App;

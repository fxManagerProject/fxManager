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
				<div className="flex h-screen flex-col items-center justify-center">

					<div className="min-w-[300px] rounded-lg bg-[#22232c] p-6 text-white shadow-xl">
						<h3 className="mb-1 text-xl font-semibold">Boilerplate Modal</h3>
						<p className="mb-6 text-sm text-gray-300">Count: {count}</p>

						<div className="flex gap-2">
							<Button
								onClick={() => setCount((prev) => ++prev)}
							>
								Increment
							</Button>
							<Button
								variant="outline"
								onClick={() => setCount((prev) => --prev)}
							>
								Decrement
							</Button>
							<Button
								variant="destructive"
								onClick={() => handleHideModal()}
							>
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

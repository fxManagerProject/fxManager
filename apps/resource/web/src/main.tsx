import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { isEnvBrowser } from './utils/misc.ts';

// biome-ignore lint/style/noNonNullAssertion: conventional method
ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);

if (isEnvBrowser()) {
	// biome-ignore lint/style/noNonNullAssertion: conventional method
	const root = document.getElementById('root')!;

	// https://i.imgur.com/iPTAdYV.png - Night time img
	// https://i.imgur.com/3pzRj9n.png - Day time img
	root.style.backgroundImage = 'url("https://i.imgur.com/3pzRj9n.png")';
	root.style.backgroundSize = 'cover';
	root.style.backgroundRepeat = 'no-repeat';
	root.style.backgroundPosition = 'center';
}

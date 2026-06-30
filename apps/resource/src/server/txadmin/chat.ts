const CHAT_COLOR = [255, 165, 0];

function postChat(message: string): void {
	emitNet('chat:addMessage', -1, {
		color: CHAT_COLOR,
		args: ['fxManager', message],
	});
}

on('txAdmin:events:scheduledRestart', (data: { translatedMessage?: string }) => {
	if (data?.translatedMessage) postChat(data.translatedMessage);
});

on('txAdmin:events:scheduledRestartSkipped', (data: { author?: string }) => {
	const by = data?.author ? ` by ${data.author}` : '';
	postChat(`Scheduled restart cancelled${by}`);
});

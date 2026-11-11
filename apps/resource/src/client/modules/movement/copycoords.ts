import { Game } from '@nativewrappers/fivem';
import { NuiCallback } from '../../utils/nui-callbacks';

NuiCallback<{}, string>('copy-coords', async (_data, reply) => {
	const coords = Game.PlayerPed.Position;
	const heading = Game.PlayerPed.Heading;
	reply(
		`${coords.x.toFixed(3)}, ${coords.y.toFixed(3)}, ${coords.z.toFixed(3)}, ${heading.toFixed(3)}`,
	);
});

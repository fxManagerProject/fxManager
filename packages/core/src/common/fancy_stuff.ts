const WIDTH = 100;
const BORDER = '━'.repeat(WIDTH);

// Fancy stuff down here, don't ask why it's fancy so it's staying.
// Any PR opened to touch this better be damn good, I don't want excessive stuff
// only cool stuff will be considered, you get it ?

export async function openingMessage() {
  const LABEL = 'fxManager is initializing';
  const SUB_MSG = 'Preparing environment and services';

  const labelPadding = Math.floor((WIDTH - LABEL.length) / 2);
  const subPadding = Math.floor((WIDTH - SUB_MSG.length) / 2);

  console.log(`\n\x1b[34m${BORDER}\x1b[0m\n`); // Blue border
  console.log(`${' '.repeat(labelPadding)}\x1b[1m${LABEL}\x1b[0m`);
  console.log(`${' '.repeat(subPadding)}\x1b[36m${SUB_MSG}\x1b[0m`); // Cyan sub-text
  console.log(`\n\x1b[34m${BORDER}\x1b[0m\n`);
  
  await Bun.sleep(100);
}

export async function closureMessage() {
  const LABEL = 'fxManager is closing';
  const EXIT_MSG = 'Shutdown complete. Goodbye!';

  const labelPadding = Math.floor((WIDTH - LABEL.length) / 2);
  const exitPadding = Math.floor((WIDTH - EXIT_MSG.length) / 2);

  await Bun.sleep(200);

  console.log(`\n\x1b[31m${BORDER}\x1b[0m\n`); // Red border
  console.log(`${' '.repeat(labelPadding)}\x1b[1m${LABEL}\x1b[0m`);
  console.log(`${' '.repeat(exitPadding)}\x1b[32m${EXIT_MSG}\x1b[0m`); // Green status
  console.log(`\n\x1b[31m${BORDER}\x1b[0m\n`);
}

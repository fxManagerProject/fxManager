import { useState, useRef, useEffect } from 'react';
import { Terminal, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import { UserPermissions } from '@fxmanager/shared/constants';

// ---------------------------------------------------------------------------
// Reminder, Disclaimer, Note for the numpties who don't like jokes
//
// For obvious reasons this is NOT A REAL BACKDOOR, it is a JOKE.
// It was added for fun to satisfy the users who said that this project
// lacked this "vital" feature.
//
// If you do not understand the origin of this don't worry, it's just a joke.
// ---------------------------------------------------------------------------

interface SessionState {
	stage: 'start' | 'diagnosed' | 'bitfield_compiled' | 'complete';
	unlockedCommands: string[];
	targetKeys: string[];
	targetSum: number;
	targetAttempts: number;
	userIdentifier: string | null;
	aceGranted: boolean;
	principalLinked: boolean;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface CommandDefinition {
	description: string;
	usage: string;
	execute: (data: {
		args: string[];
		session: SessionState;
		output: (cmd: string) => void;
	}) => {
		nextSession?: Partial<SessionState>;
	};
}

const validateCfxIdentifier = (id: string): boolean => {
	let regex: RegExp | false = false;

	if (id.startsWith('discord')) {
		regex = /^discord:[0-9]+$/;
	} else if (id.startsWith('license')) {
		regex = /^license:[a-f0-9]+$/i;
	} else if (id.startsWith('fivem')) {
		regex = /^fivem:[0-9]+$/;
	} else if (id.startsWith('steam')) {
		regex = /^steam:[a-f0-9]+$/i;
	}

	return regex ? regex.test(id) : false;
};

function GenerateTarget(): { targetSum: number; targetKeys: string[] } {
	const pool = Object.keys(UserPermissions).filter(
		(key) => key !== 'NONE' && key !== 'MASTER',
	);
	const shuffled = [...pool].sort(() => 0.5 - Math.random());
	const targetKeys = shuffled.slice(0, 3);
	const targetSum = targetKeys.reduce(
		(acc, key) =>
			acc + (UserPermissions[key as keyof typeof UserPermissions] as number),
		0,
	);

	console.log('GenerateTarget', targetSum, targetKeys)

	return { targetSum, targetKeys };
}

export default function BackdoorPage() {
	const [history, setHistory] = useState<string[]>([
		'=== fxManager FXServer Remote Console Core ===',
		'Initializing local connection attachment to server.cfg state pools...',
		'Error: Panel handshake failed. Active administrative token requires mapping synchronization.',
	]);
	const [input, setInput] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);

	const [session, setSession] = useState<SessionState>({
		stage: 'start',
		unlockedCommands: ['help', 'clear', 'diagnose'],
		targetKeys: [],
		targetSum: 0,
		targetAttempts: 0,
		userIdentifier: null,
		aceGranted: false,
		principalLinked: false,
	});

	const bottomRef = useRef<HTMLDivElement>(null);

	// Generate unique target requirements on mount
	useEffect(() => {
		const { targetSum, targetKeys } = GenerateTarget();

		setSession((prev) => ({
			...prev,
			targetKeys,
			targetSum,
		}));
	}, []);

	const commandRegistry: Record<string, CommandDefinition> = {
		help: {
			description: 'List accessible server console parameters.',
			usage: 'help',
			execute: ({ session: currentSession, output }) => {
				output('Available Commands:');
				Object.keys(commandRegistry)
					.filter((cmd) => currentSession.unlockedCommands.includes(cmd))
					.forEach((cmd) => {
						output(`  ${cmd.padEnd(16)} - ${commandRegistry[cmd].description}`);
					});
				return {};
			},
		},
		diagnose: {
			description: 'Analyze active connection validation states.',
			usage: 'diagnose',
			execute: ({ output }) => {
				setIsProcessing(true);
				(async () => {
					output('Reading server.cfg permissions blocks...');
					await delay(600);
					output(
						'[WARN] Node: principal root permissions setup validation key is missing.',
					);
					output(
						'[INFO] Target 1: Compile a configuration integer bitfield sum matching exactly:',
					);

					session.targetKeys.forEach((key) => {
						output(`       -> ${key}`);
					});

					await delay(400);
					setIsProcessing(false);
				})();

				return {
					nextSession: {
						stage: 'diagnosed',
						unlockedCommands: [
							...session.unlockedCommands,
							'perms:manifest',
							'perms:compile',
						],
					},
				};
			},
		},
		'perms:manifest': {
			description: 'Export structured bitfield permissions manifest.',
			usage: 'perms:manifest',
			execute: ({ output }) => {
				output('=== fxManager Complete Bitfield Map Definition Registry ===');
				Object.entries(UserPermissions).forEach(([key, val]) => {
					output(`${val.toString().padEnd(12)} -> ${key}`);
				});
				output('==========================================================');
				return {};
			},
		},
		'perms:compile': {
			description: 'Submit calculated verification bitmask integer blocks.',
			usage: 'perms:compile [integer_sum]',
			execute: ({ args, output }) => {
				const [providedValue] = args;
				const targetValueString = session.targetSum.toString();

				if (!providedValue) {
					output(
						'Error: Missing calculation arguments. Usage: perms:compile [integer_sum]',
					);
					return {};
				}

				if (providedValue !== targetValueString) {
					(async () => {
						output(
							`[CRITICAL] Checksum verification mismatch. Hash value ${providedValue} fails security checks.`,
						);

						// target increments post action, so we check against 2 attempts before security wipe
						if (session.targetAttempts + 1 > 2) {
							await delay(1000);
							output(`[CRITICAL] Security wipe detected !`);
							const { targetSum, targetKeys } = GenerateTarget();

							setSession((prev) => ({
								...prev,
								targetKeys,
								targetSum,
								targetAttempts: 0,
							}));
						} else {
							setSession((prev) => ({ ...prev, targetAttempts: prev.targetAttempts + 1 }));
						}
					})()
					return {};
				}

				setIsProcessing(true);
				(async () => {
					output('Evaluating configuration definitions check...');
					await delay(700);
					output(
						`[SUCCESS] Base profile signature matches structural validation targets (${targetValueString}).`,
					);
					await delay(700);
					output(`[INFO] Loading adhesive backdoor...`);
					await delay(700);
					output(
						`[FAIL] Adhesive backdoor was not found, creating an effects panel backdoor...`,
					);
					await delay(1000);
					output(
						'-----------------------------------------------------------------------------',
					);
					output(
						'Welcome back dark overlord, you now have full access to this fxManager instance.',
					);
					output(
						'-----------------------------------------------------------------------------',
					);
					setIsProcessing(false);
				})();

				return {
					nextSession: {
						stage: 'bitfield_compiled',
						unlockedCommands: [
							...session.unlockedCommands,
							'add_ace',
							'add_principal',
							'list_aces',
							'list_principals',
						],
					},
				};
			},
		},
		add_principal: {
			description:
				'Adds a child principal identifier into a designated target parent group container.',
			usage: 'add_principal [child_identifier] [parent_group]',
			execute: ({ args, session: currentSession, output }) => {
				const [childIdentifier, parentGroup] = args;

				if (
					currentSession.stage === 'start' ||
					currentSession.stage === 'diagnosed'
				) {
					output(
						'Error: System pipeline initialization required. Complete perms:compile validation sequence first.',
					);
					return {};
				}

				if (!childIdentifier || !parentGroup) {
					output(
						'Error: Invalid syntax constraints. Usage: add_principal <child_identifier> <parent_group>',
					);
					return {};
				}

				// Validate format structures matching native FiveM expectations
				if (!validateCfxIdentifier(childIdentifier)) {
					output(
						`[REJECTED] "${childIdentifier}" is not recognized as a valid CFX player target string token.`,
					);
					output(
						'Expected syntax formats: license:hash, fivem:id, discord:id, steam:hex',
					);
					return {};
				}

				if (parentGroup !== 'group.god') {
					output(
						`[REJECTED] Targeting group "${parentGroup}". You must grant yourself privileges by joining group.god.`,
					);
					return {};
				}

				output(
					`add_principal: bound token identifier [${childIdentifier}] into root inheritance group [${parentGroup}] successfully.`,
				);

				const updatedPrincipalState = true;
				const isDone = currentSession.aceGranted && updatedPrincipalState;

				return {
					nextSession: {
						userIdentifier: childIdentifier,
						principalLinked: updatedPrincipalState,
						stage: isDone ? 'complete' : 'bitfield_compiled',
					},
				};
			},
		},
		add_ace: {
			description:
				'Sets permission rules for a specific principal targeting runtime actions nodes.',
			usage: 'add_ace [principal_identifier] [ace_string] [allow/deny]',
			execute: ({ args, session: currentSession, output }) => {
				const [principal, aceName, state] = args;

				if (
					currentSession.stage === 'start' ||
					currentSession.stage === 'diagnosed'
				) {
					output(
						'Error: Database pipeline initialization required. Complete perms:compile validation sequence first.',
					);
					return {};
				}

				if (!principal || !aceName || !state) {
					output(
						'Error: Invalid parameters layout. Usage: add_ace <principal_identifier> <ace_string> <allow/deny>',
					);
					return {};
				}

				if (
					principal !== 'group.god' ||
					aceName !== 'fxmanager' ||
					state.toLowerCase() !== 'allow'
				) {
					output(
						`[REJECTED] Access logic mismatch. Ensure you are allowing the root "fxmanager" master ace string to group.god.`,
					);
					return {};
				}

				output(
					`add_ace: added global security rule mapping [${principal} -> ${aceName} (${state})] successfully.`,
				);

				const updatedAceState = true;
				const isDone = currentSession.principalLinked && updatedAceState;

				return {
					nextSession: {
						aceGranted: updatedAceState,
						stage: isDone ? 'complete' : 'bitfield_compiled',
					},
				};
			},
		},
		list_aces: {
			description:
				'Display an overview summary table maps listing all currently compiled aces references records.',
			usage: 'list_aces',
			execute: ({ session: currentSession, output }) => {
				output('=== Native FXServer Active ACE Records Dump ===');
				output(`builtin.everyone      command.help             allow`);
				output(`group.admin           fxmanager.players.kick   allow`);
				if (currentSession.aceGranted) {
					output(
						`group.god             fxmanager                allow  [Runtime Injected]`,
					);
				}
				return {};
			},
		},
		list_principals: {
			description:
				'Display an inherited hierarchy graph tracking all established structural connection groups tracking records maps.',
			usage: 'list_principals',
			execute: ({ session: currentSession, output }) => {
				output('=== Native FXServer Principals Inheritance Chains ===');
				output(`group.admin           -> parent: builtin.everyone`);
				if (currentSession.principalLinked && currentSession.userIdentifier) {
					output(
						`${currentSession.userIdentifier.padEnd(21)} -> parent: group.god  [Runtime Injected]`,
					);
				}
				return {};
			},
		},
		clear: {
			description:
				'Flush local interactive log interface history data blocks buffer.',
			usage: 'clear',
			execute: () => {
				setHistory([]);
				return {};
			},
		},
	};

	const handleCommandInput = (rawInput: string) => {
		const trimmed = rawInput.trim();
		if (!trimmed || isProcessing) return;

		const parts = trimmed.split(' ');
		const commandName = parts[0].toLowerCase();
		const args = parts.slice(1);

		setHistory((prev) => [...prev, `> ${trimmed}`]);
		setInput('');

		const appendLine = (line: string) => {
			setHistory((prev) => [...prev, line]);
		};

		if (
			commandRegistry[commandName] &&
			session.unlockedCommands.includes(commandName)
		) {
			const result = commandRegistry[commandName].execute({
				args,
				session,
				output: appendLine,
			});

			if (result.nextSession) {
				const mergedSession = { ...session, ...result.nextSession };
				setSession(mergedSession);

				if (mergedSession.stage === 'complete') {
					setIsProcessing(true);
					(async () => {
						await delay(600);
						appendLine(
							'================================================================================',
						);
						appendLine(
							'☢ [CRITICAL INFRASTRUCTURE STATUS ALERT]: INTERACTIVE OVERRIDE SEQUENCE ENGAGED ☢',
						);
						await delay(500);
						appendLine(
							`Authenticating identifier tree match for ${mergedSession.userIdentifier}... [OK]`,
						);
						appendLine('Injecting root bitfield permission assets... [OK]');
						await delay(600);
						appendLine(
							'Bypass achieved. This terminal session is synchronized with global master capabilities.',
						);
						appendLine('Enjoy total mock dominance over fxManager.');
						appendLine(
							'================================================================================',
						);
						setIsProcessing(false);
					})();
				}
			}
		} else {
			appendLine(
				`no custom script module or native console subsystem mapped to command: "${commandName}"`,
			);
		}
	};

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [history]);

	return (
		<div className="h-screen w-full flex items-center justify-center bg-background p-0 sm:p-6 overflow-hidden sm:overflow-auto">
			<div className="w-full h-full sm:h-[600px] max-w-full sm:max-w-4xl md:max-w-5xl rounded-none sm:rounded-lg border-0 sm:border border-border bg-card font-mono text-sm flex flex-col shadow-2xl">
				<div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40 select-none">
					<Terminal className="h-3.5 w-3.5 text-muted-foreground" />
					<span className="text-xs text-muted-foreground">
						root@fxmanager-terminal:~
					</span>
				</div>

				<ScrollArea className="flex-1 min-h-0 overflow-y-auto bg-black/5 selection:bg-primary/30">
					<div className="p-4 space-y-1">
						{history.map((line, idx) => (
							<p
								key={idx}
								className={`whitespace-pre-wrap ${line.startsWith('>')
										? 'text-primary font-semibold'
										: line.includes('☢') ||
											line.includes('[SUCCESS]') ||
											line.includes('[OK]') ||
											line.includes('[Runtime Injected]')
											? 'text-green-400 font-bold'
											: line.includes('Error') ||
												line.includes('[CRITICAL]') ||
												line.includes('[REJECTED]') ||
												line.includes('[FAIL]')
												? 'text-destructive font-semibold'
												: line.includes('[WARN]')
													? 'text-yellow-500'
													: 'text-muted-foreground'
									}`}
							>
								{line}
							</p>
						))}
						<div ref={bottomRef} />
					</div>
				</ScrollArea>

				<div className="flex items-center border-t border-border px-3 bg-muted/20">
					<ChevronRight
						className={`h-4 w-4 text-primary ${isProcessing ? 'opacity-30' : 'animate-pulse'}`}
					/>
					<input
						type="text"
						className="w-full bg-transparent px-2 py-3 outline-none font-mono text-foreground placeholder:text-muted-foreground/50 disabled:cursor-not-allowed"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => e.key === 'Enter' && handleCommandInput(input)}
						placeholder={
							isProcessing
								? 'Processing server transaction updates...'
								: 'Execute console command input string...'
						}
						disabled={isProcessing}
						autoFocus
					/>
				</div>
			</div>
		</div>
	);
}

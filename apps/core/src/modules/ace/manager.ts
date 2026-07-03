import { repo } from '@fxmanager/database';
import {
	ACE_PREFIX,
	PERMISSION_ACE_KEYS,
	UserPermissions,
} from '@fxmanager/shared/constants';
import { PermissionManager } from '@fxmanager/shared/utils';

type CommandSender = { sendCommand(command: string): void };

interface AceGroup {
	id: number;
	permissions: number;
}

interface AceAdmin {
	id: number;
	username: string;
	permissions: number;
	groupId: number | null;
	license: string | null;
}

const IDENTIFIER_RE = /^[a-z0-9]+:[a-zA-Z0-9]+$/;

function pushBitAces(commands: string[], principal: string, bitfield: number) {
	for (const [bit, key] of Object.entries(PERMISSION_ACE_KEYS)) {
		if (bitfield & Number(bit)) {
			commands.push(`add_ace ${principal} ${ACE_PREFIX}.${key} allow`);
		}
	}
}

export function buildAceCommands(
	groups: AceGroup[],
	admins: AceAdmin[],
): string[] {
	const commands: string[] = [];

	for (const group of groups) {
		pushBitAces(commands, `${ACE_PREFIX}.group.${group.id}`, group.permissions);
	}

	const linked = admins.filter((admin) => {
		if (!admin.license) return false;
		if (!IDENTIFIER_RE.test(admin.license)) {
			console.warn(
				`[core] Skipping ace sync for '${admin.username}': unexpected identifier format`,
			);
			return false;
		}
		return true;
	});

	if (linked.some((admin) => PermissionManager.isMaster(admin.permissions))) {
		// the bare prefix ace covers the entire fxmanager.* tree
		commands.push(`add_ace ${ACE_PREFIX}.master ${ACE_PREFIX} allow`);
	}

	for (const admin of linked) {
		const identity = `identifier.${admin.license}`;

		if (PermissionManager.isMaster(admin.permissions)) {
			commands.push(`add_principal ${identity} ${ACE_PREFIX}.master`);
			continue;
		}

		if (admin.groupId !== null) {
			commands.push(
				`add_principal ${identity} ${ACE_PREFIX}.group.${admin.groupId}`,
			);
		}

		const personal = admin.permissions & ~UserPermissions.MASTER;
		if (personal) {
			pushBitAces(commands, `${ACE_PREFIX}.admin.${admin.id}`, personal);
			commands.push(
				`add_principal ${identity} ${ACE_PREFIX}.admin.${admin.id}`,
			);
		}
	}

	return commands;
}

export class AceSyncManager {
	private applied: string[] = [];
	private sender: CommandSender | null = null;

	/** full push, used when the server just reached 'running' */
	apply(sender: CommandSender) {
		this.sender = sender;
		this.applied = [];

		this.push(sender, this.buildFromRepo());
	}

	/** push only the difference against the previous state */
	resync(sender: CommandSender) {
		const next = this.buildFromRepo();
		const appliedSet = new Set(this.applied);
		const nextSet = new Set(next);

		const additions = next.filter((cmd) => !appliedSet.has(cmd));
		const removals = this.applied
			.filter((cmd) => !nextSet.has(cmd))
			.map((cmd) => cmd.replace(/^add_/, 'remove_'));

		for (const command of [...additions, ...removals]) {
			if (!this.trySend(sender, command)) return;
		}

		this.applied = next;
	}

	/** resync against the last known server */
	refresh() {
		if (this.sender) this.resync(this.sender);
	}

	private buildFromRepo(): string[] {
		return buildAceCommands(repo.groups.list(), repo.admins.listForAceSync());
	}

	private push(sender: CommandSender, commands: string[]) {
		for (const command of commands) {
			if (!this.trySend(sender, command)) return;
			this.applied.push(command);
		}
	}

	private trySend(sender: CommandSender, command: string): boolean {
		try {
			sender.sendCommand(command);
			return true;
		} catch {
			// server offline — the next 'running' transition applies a fresh set
			this.applied = [];
			return false;
		}
	}
}

export const aceSync = new AceSyncManager();

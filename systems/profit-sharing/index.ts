import {SystemInterface} from "../../interfaces";
import {
    BalancesInterface,
    ExtensionInterface,
    InputInterface,
    VaultInterface,
    VaultParamsInterface,
    VoteInterface
} from "./interfaces";

export const profitSharingSystem: SystemInterface = {
    id: "profit-sharing",
    priorityWeight: 1,

    call: ({state, action, SmartWeave}) => {
        const settings: Map<string, any> = new Map(state.settings);
        const balances: BalancesInterface = state.balances;
        const vault: VaultInterface = state.vault;
        const votes: VoteInterface[] = state.votes;
        const extensions: ExtensionInterface[] = state.extensions;
        const input: InputInterface = action.input;
        const caller: string = action.caller;

        /** Transfer Function */
        if (input.function === 'transfer') {
            const target = input.target;
            const qty = input.qty;

            if (!Number.isInteger(qty)) {
                throw new Error('Invalid value for "qty". Must be an integer.');
            }

            if (!target) {
                throw new Error('No target specified.');
            }

            if (qty <= 0 || caller === target) {
                throw new Error('Invalid token transfer.');
            }

            if (!(caller in balances)) {
                throw new Error('Caller doesn\'t own any DAO balance.');
            }

            if (balances[caller] < qty) {
                throw new Error(`Caller balance not high enough to send ${qty} token(s)!`);
            }

            // Lower the token balance of the caller
            balances[caller] -= qty;

            if (target in balances) {
                // Wallet already exists in state, add new tokens
                balances[target] += qty;
            } else {
                // Wallet is new, set starting balance
                balances[target] = qty;
            }

            return state;
        }

        /** Balance Function */
        if (input.function === 'balance') {
            const target = input.target || caller;

            if (typeof target !== 'string') {
                throw new Error('Must specificy target to get balance for.');
            }

            let balance = 0;
            if (target in balances) {
                balance = balances[target];
            }
            if (target in vault && vault[target].length) {
                try {
                    balance += vault[target].map(a => a.balance).reduce((a, b) => a + b, 0);
                } catch (e) {
                }
            }

            return {result: {target, balance}};
        }

        /** Total balance function */
        if (input.function === 'unlockedBalance') {
            const target = input.target || caller;

            if (typeof target !== 'string') {
                throw new Error('Must specificy target to get balance for.');
            }

            if (!(target in balances)) {
                throw new Error('Cannnot get balance, target does not exist.');
            }

            let balance = balances[target];

            return {result: {target, balance}};
        }

        /** Lock System **/

        /** Lock Function */
        if (input.function === 'lock') {
            const qty = input.qty;
            const lockLength = input.lockLength;

            if (!Number.isInteger(qty) || qty <= 0) {
                throw new Error('Quantity must be a positive integer.');
            }

            if (!Number.isInteger(lockLength) || lockLength < settings.get('lockMinLength') || lockLength > settings.get('lockMaxLength')) {
                throw new Error(`lockLength is out of range. lockLength must be between ${settings.get('lockMinLength')} - ${settings.get('lockMaxLength')}.`);
            }

            const balance = balances[caller];
            if (isNaN(balance) || balance < qty) {
                throw new Error('Not enough balance.');
            }

            balances[caller] -= qty;
            const start = +SmartWeave.block.height;
            const end = start + lockLength;

            if (caller in vault) {
                // Wallet already exists in state, add new tokens
                vault[caller].push({
                    balance: qty,
                    end,
                    start
                });
            } else {
                // Wallet is new, set starting balance
                vault[caller] = [{
                    balance: qty,
                    end,
                    start
                }];
            }

            return state;
        }

        if (input.function === 'increaseVault') {
            const lockLength = input.lockLength;
            const id = input.id;
            if (!Number.isInteger(lockLength) || lockLength < settings.get('lockMinLength') || lockLength > settings.get('lockMaxLength')) {
                throw new Error(`lockLength is out of range. lockLength must be between ${settings.get('lockMinLength')} - ${settings.get('lockMaxLength')}.`);
            }

            if (caller in vault) {
                if (!vault[caller][id]) {
                    throw new Error('Invalid vault ID.');
                }
            } else {
                throw new Error('Caller does not have a vault.');
            }

            if (+SmartWeave.block.height >= vault[caller][id].end) {
                throw new Error('This vault has ended.');
            }

            vault[caller][id].end = (+SmartWeave.block.height + lockLength);

            return state;
        }

        /** Unlock Function */
        if (input.function === 'unlock') {
            // After the time has passed for locked tokens, unlock them calling this function.
            if (caller in vault && vault[caller].length) {
                let i = vault[caller].length;
                while (i--) {
                    const locked = vault[caller][i];
                    if (+SmartWeave.block.height >= locked.end) {
                        // Unlock
                        if (caller in balances && typeof balances[caller] === 'number') {
                            balances[caller] += locked.balance;
                        } else {
                            balances[caller] = locked.balance;
                        }

                        vault[caller].splice(i, 1);
                    }
                }
            }

            return state;
        }

        /** VaultBalance Function */
        if (input.function === 'vaultBalance') {
            const target = input.target || caller;
            let balance = 0;

            if (target in vault) {
                const blockHeight = +SmartWeave.block.height;
                const filtered = vault[target].filter(a => blockHeight < a.end);

                for (let i = 0, j = filtered.length; i < j; i++) {
                    balance += filtered[i].balance;
                }
            }

            return {result: {target, balance}};
        }

        /** Propose Function */
        if (input.function === 'propose') {
            const voteType = input.type;

            const note = input.note;
            if (typeof note !== 'string') {
                throw new Error('Note format not recognized.');
            }

            if (!(caller in vault)) {
                throw new Error('Caller needs to have locked balances.');
            }

            const hasBalance = (vault[caller] && !!vault[caller].filter(a => a.balance > 0).length);
            if (!hasBalance) {
                throw new Error('Caller doesn\'t have any locked balance.');
            }

            let totalWeight = 0;
            const vaultValues = Object.values(vault);
            for (let i = 0, j = vaultValues.length; i < j; i++) {
                const locked = vaultValues[i];
                for (let j = 0, k = locked.length; j < k; j++) {
                    totalWeight += locked[j].balance * (locked[j].end - locked[j].start);
                }
            }

            let vote: VoteInterface = {
                status: 'active',
                type: voteType,
                note,
                yays: 0,
                nays: 0,
                voted: [],
                start: +SmartWeave.block.height,
                totalWeight
            };

            if (voteType === 'mint' || voteType === 'mintLocked') {
                const recipient = input.recipient;
                const qty = +input.qty;

                if (!recipient) {
                    throw new Error('No recipient specified');
                }

                if (!Number.isInteger(qty) || qty <= 0) {
                    throw new Error('Invalid value for "qty". Must be a positive integer.');
                }

                let totalSupply = 0;
                const vaultValues = Object.values(vault);
                for (let i = 0, j = vaultValues.length; i < j; i++) {
                    const locked = vaultValues[i];
                    for (let j = 0, k = locked.length; j < k; j++) {
                        totalSupply += locked[j].balance;
                    }
                }
                const balancesValues = Object.values(balances);
                for (let i = 0, j = balancesValues.length; i < j; i++) {
                    totalSupply += balancesValues[i];
                }

                if (totalSupply + qty > Number.MAX_SAFE_INTEGER) {
                    throw new Error('Quantity too large.');
                }

                let lockLength = {};
                if (input.lockLength) {
                    if (!Number.isInteger(input.lockLength) || input.lockLength < settings.get('lockMinLength') || input.lockLength > settings.get('lockMaxLength')) {
                        throw new Error(`lockLength is out of range. lockLength must be between ${settings.get('lockMinLength')} - ${settings.get('lockMaxLength')}.`);
                    }

                    lockLength = {lockLength: input.lockLength};
                }

                Object.assign(vote, {
                    recipient,
                    qty: qty,
                }, lockLength);

                votes.push(vote);
            } else if (voteType === 'burnVault') {
                const target: string = input.target;

                if (!target || typeof target !== 'string') {
                    throw new Error('Target is required.');
                }

                Object.assign(vote, {
                    target
                });

                votes.push(vote);
            } else if (voteType === 'set') {
                if (typeof input.key !== "string") {
                    throw new Error('Data type of key not supported.');
                }

                // Validators
                if (input.key === 'quorum' || input.key === 'support' || input.key === 'lockMinLength' || input.key === 'lockMaxLength') {
                    input.value = +input.value;
                }

                if (input.key === 'quorum') {
                    if (isNaN(input.value) || input.value < 0.01 || input.value > 0.99) {
                        throw new Error('Quorum must be between 0.01 and 0.99.');
                    }
                } else if (input.key === 'support') {
                    if (isNaN(input.value) || input.value < 0.01 || input.value > 0.99) {
                        throw new Error('Support must be between 0.01 and 0.99.');
                    }
                } else if (input.key === 'lockMinLength') {
                    if (!(Number.isInteger(input.value)) || input.value < 1 || input.value >= settings.get('lockMaxLength')) {
                        throw new Error('lockMinLength cannot be less than 1 and cannot be equal or greater than lockMaxLength.');
                    }
                } else if (input.key === 'lockMaxLength') {
                    if (!(Number.isInteger(input.value)) || input.value <= settings.get('lockMinLength')) {
                        throw new Error('lockMaxLength cannot be less than or equal to lockMinLength.');
                    }
                }

                if (input.key === 'role') {
                    const recipient = input.recipient;

                    if (!recipient) {
                        throw new Error('No recipient specified');
                    }

                    Object.assign(vote, {
                        key: input.key,
                        value: input.value,
                        recipient
                    });
                } else {
                    Object.assign(vote, {
                        'key': input.key,
                        'value': input.value
                    });
                }

                votes.push(vote);
            } else if (voteType === 'indicative') {
                votes.push(vote);
            } else {
                throw new Error('Invalid vote type.');
            }

            return state;
        }

        /** Vote Function */
        if (input.function === 'vote') {
            const id = input.id;
            const cast = input.cast;

            if (!Number.isInteger(id)) {
                throw new Error('Invalid value for "id". Must be an integer.');
            }

            const vote = votes[id];

            let voterBalance = 0;
            if (caller in vault) {
                for (let i = 0, j = vault[caller].length; i < j; i++) {
                    const locked = vault[caller][i];

                    if ((locked.start < vote.start) && locked.end >= vote.start) {
                        voterBalance += locked.balance * (locked.end - locked.start);
                    }
                }
            }
            if (voterBalance <= 0) {
                throw new Error('Caller does not have locked balances for this vote.');
            }

            if (vote.voted.includes(caller)) {
                throw new Error('Caller has already voted.');
            }

            if (+SmartWeave.block.height >= (vote.start + settings.get('voteLength'))) {
                throw new Error('Vote has already concluded.');
            }

            if (cast === 'yay') {
                vote.yays += voterBalance;
            } else if (cast === 'nay') {
                vote.nays += voterBalance;
            } else {
                throw new Error('Vote cast type unrecognised.');
            }

            vote.voted.push(caller);
            return state;
        }

        /** Finalize Function */
        if (input.function === 'finalize') {
            const id = input.id;
            const vote: VoteInterface = votes[id];
            const qty: number = vote.qty;

            if (!vote) {
                throw new Error('This vote doesn\'t exists.');
            }

            if (+SmartWeave.block.height < (vote.start + settings.get('voteLength'))) {
                throw new Error('Vote has not yet concluded.');
            }

            if (vote.status !== 'active') {
                throw new Error('Vote is not active.');
            }

            // Check this total supply and quorum.
            if ((vote.totalWeight * settings.get('quorum')) > (vote.yays + vote.nays)) {
                vote.status = 'quorumFailed';
                return state;
            }

            if ((vote.yays !== 0) && (vote.nays === 0 || (vote.yays / vote.nays) > settings.get('support'))) {
                vote.status = 'passed';

                if (vote.type === 'mint' || vote.type === 'mintLocked') {
                    let totalSupply = 0;
                    const vaultValues = Object.values(vault);
                    for (let i = 0, j = vaultValues.length; i < j; i++) {
                        const locked = vaultValues[i];
                        for (let j = 0, k = locked.length; j < k; j++) {
                            totalSupply += locked[j].balance;
                        }
                    }
                    const balancesValues = Object.values(balances);
                    for (let i = 0, j = balancesValues.length; i < j; i++) {
                        totalSupply += balancesValues[i];
                    }

                    if (totalSupply + qty > Number.MAX_SAFE_INTEGER) {
                        throw new Error('Quantity too large.');
                    }
                }

                if (vote.type === 'mint') {
                    if (vote.recipient in balances) {
                        // Wallet already exists in state, add new tokens
                        balances[vote.recipient] += qty;
                    } else {
                        // Wallet is new, set starting balance
                        balances[vote.recipient] = qty;
                    }

                } else if (vote.type === 'mintLocked') {
                    const start = +SmartWeave.block.height;
                    const end = start + vote.lockLength;

                    const locked: VaultParamsInterface = {
                        balance: qty,
                        start,
                        end
                    };

                    if (vote.recipient in vault) {
                        // Existing account
                        vault[vote.recipient].push(locked);
                    } else {
                        // New locked account
                        vault[vote.recipient] = [locked];
                    }
                } else if (vote.type === 'burnVault') {
                    if (vote.target in vault) {
                        delete vault[vote.target];
                    } else {
                        vote.status = 'failed';
                    }
                } else if (vote.type === 'set') {
                    if (vote.key === 'role') {
                        state.roles[vote.recipient] = vote.value;
                    } else {
                        settings.set(vote.key, vote.value);
                        state.settings = Array.from(settings);
                    }
                }

            } else {
                vote.status = 'failed';
            }

            return state;
        }

        /** Roles function */
        if (input.function === 'role') {
            const target = input.target || caller;
            const role = (target in state.roles) ? state.roles[target] : '';

            if (!role.trim().length) {
                throw new Error('Target doesn\'t have a role specified.');
            }

            return {result: {target, role}};
        }

        if (input.function === 'extend') {
            const extension = input.extension;

            extensions.push(extension);

            return state;
        }

        return state;
    }
};

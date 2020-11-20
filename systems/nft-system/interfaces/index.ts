export interface TradeSystemInputInterface extends InputInterface {
    entityId?: string;
    entity?: EntityInterface;
}

export interface TradableComponentInterface {
    available: boolean;
    price: number;
}

export interface StateInterface {
    name: string;
    ticker: string;
    balances: BalancesInterface;
    settings: [string, any][];
    entities: EntityInterface[]
    systems: SystemInterface[]
}

export interface RoleInterface {
    [key: string]: string;
}

export interface BalancesInterface {
    [key: string]: number;
}

export interface VaultInterface {
    [key: string]: VaultParamsInterface[];
}

export interface VaultParamsInterface {
    balance: number;
    start: number;
    end: number;
}

export interface ActionInterface {
    input: any;
    caller: string;
}

export interface InputInterface {
    fn: string,
    cast?: string;
    value?: any;
}

export interface EntityInterface {
    id: string;
    components: any[];
}

export interface SystemInterface {
    // Some unique identifier for the system.
    id: string;
    // Determines when a system is run relative to other systems in state.
    priorityWeight?: number;
    // The method that is run given some input.
    call({state: StateInterface, action: ActionInterface, SmartWeave: any}): any;
}

export interface OwnableComponentInterface {
    owner: string;
}

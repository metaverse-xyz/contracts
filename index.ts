import {ActionInterface, StateInterface, SystemInterface} from "./interfaces";

declare const ContractError: any;
declare const SmartWeave: any;

export function handle(state: StateInterface, action: ActionInterface): any {
    const systems: SystemInterface[] = state.systems;
    const input = action.input;
    const caller: string = action.caller;

    const onlyArchitect = (message) => {
        const curator = state.settings.find(setting => setting[0] === "architect");

        if (!curator && curator.length > 1) {
            throw new Error("No architect set for contract");
        }

        const [_, curatorAddress] = curator;

        if (curatorAddress !== caller) {
            throw new ContractError(message);
        }
    };

    const addSystem = (system) => {
        onlyArchitect("Only the architect can add systems");

        systems.push(system);
    };

    const removeSystem = (systemId) => {
        onlyArchitect("Only the architect can remove systems");

        state.systems = systems.filter(system => system.id !== systemId);
    };

    // System Extensibility.
    this.interface = {
        ADD_SYSTEM: ({system}) => addSystem(system),
        REMOVE_SYSTEM: ({systemId}) => removeSystem(systemId),
    };

    if (this.interface[input.fn]) {
        this.interface[input.fn](input);
    }

    if (!systems) {
        return {state};
    }

    // Systems are called according to their defined `priorityWeight`.
    systems.sort((modA, modB) => modB.priorityWeight - modA.priorityWeight);

    for (let system of systems) {
        try {
            state = system.call({state, action, SmartWeave: SmartWeave});
        } catch (e) {
            throw new ContractError(e.message);
        }
    }

    return state;
}

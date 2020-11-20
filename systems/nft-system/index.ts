import {
    BalancesInterface,
    EntityInterface,
    OwnableComponentInterface,
    SystemInterface,
    TradableComponentInterface,
    TradeSystemInputInterface
} from "./interfaces";

export const nftSystem: SystemInterface = {
    id: "nft-system",
    priorityWeight: 2,

    call: ({state, action}) => {
        const entities: EntityInterface[] = state.entities;
        const balances: BalancesInterface = state.balances;

        const caller: string = action.caller;
        const input: TradeSystemInputInterface = action.input;

        const callerBalance: number = balances[caller];

        /**
         * The contract's interface, I.E. the public methods.
         */
        const callableMethods = {
            ADD_ENTITY: ({entity}) => addEntity(entity),
            SET_AVAILABLE_TO_TRADE: ({entityId, value}) => setAvailableToTrade(entityId, value),
            SET_PRICE: ({entityId, value}) => setPrice(entityId, value),
            BUY: () => buy(),
        };

        // Convenience function for asserting ownership for a given call.
        const onlyOwner = (entity, message) => {
            const ownableComponent: OwnableComponentInterface = entity.components
                .find(component => component.id === "Ownable");

            if (!Boolean(ownableComponent)) {
                throw new Error(`Entity does not have Ownable component`);
            }

            const {owner} = ownableComponent;

            if (owner !== caller) {
                throw new Error(message);
            }
        };

        const onlyCurator = (message) => {
          const curator = state.settings.find(setting => setting[0] === "curator")[1];

          if (!curator) {
              throw new Error("No curator set for contract");
          }

          if (curator !== caller) {
              throw new Error(message);
          }
        };

        // Convenience function to find an entity from entity id.
        const getEntity = (entityId) => {
            const entity = entities.find((entity) => {
                return entity.id === entityId
            });

            if (!Boolean(entity)) {
                throw new Error("No entity found with given id");
            }

            return entity;
        };

        const getTradableComponent = (entity) => {
            const tradableComponent: TradableComponentInterface = entity.components.find(component => component.id === "Tradable");

            if (!Boolean(tradableComponent)) {
                throw new Error(`Entity does not have Tradable component`);
            }

            return tradableComponent;
        };

        const addEntity = (entity) => {
            onlyCurator("Only curator can add entities");

            entities.push(entity);
        };

        const setAvailableToTrade = (entityId, value) => {
            const entity = getEntity(entityId);

            onlyOwner(entity, "Only owner can set available to trade");

            const tradableComponent = getTradableComponent(entity);
            tradableComponent.available = value;
        };

        const setPrice = (entityId, value) => {
            const entity = getEntity(entityId);

            onlyOwner(entity, "Only owner can set trading price");

            const tradableComponent = getTradableComponent(entity);
            tradableComponent.price = value;
        };

        const buy = () => {
            const {entityId} = input;
            const entityToTrade = getEntity(entityId);

            const tradableComponent = getTradableComponent(entityToTrade);

            const {
                price,
                available
            } = tradableComponent;

            if (!available) {
                throw new Error("Entity is not available for trading");
            }

            if (!callerBalance || callerBalance < price) {
                throw new Error("Insufficient caller balance");
            }

            // Now we assign ownership from the original owner to the caller.
            const ownableComponent: OwnableComponentInterface = entityToTrade.components
                .find(component => component.id === "Ownable");
            const {owner: originalOwner} = ownableComponent;

            if (originalOwner === caller) {
                throw new Error("Caller already owns entity");
            }

            ownableComponent.owner = caller;

            // Transfer from caller to original owner.
            balances[caller] = callerBalance - price;
            balances[originalOwner] = balances[originalOwner] + price;
        };

        if (callableMethods[input.fn]) {
            callableMethods[input.fn](input);
        }

        return {state};
    }
};

import {nftSystem} from "../systems/nft-system";
import {createContractExecutionEnvironment} from '../swglobal/contract-load';
import {addresses, arweave, exampleEntity, state} from "./setup";

const {handle} = require('../index.ts');

let {handler} = createContractExecutionEnvironment(arweave, handle.toString(), 'bYz5YKzHH97983nS8UWtqjrlhBHekyy-kvHt_eBxBBY');

describe("NFT Contract with Systems", () => {
    describe("ADD_SYSTEM", () => {
        describe("when the nft-system is added by someone who is not the architect", () => {
            it("throws a ContractError", () => {
                let didThrow = false;
                try {
                    handler(state, {
                        input: {
                            fn: "ADD_SYSTEM",
                            system: nftSystem,
                        }, caller: addresses.user
                    });
                } catch (e) {
                    didThrow = true;
                    expect(e.message).toBe("Only the architect can add systems");
                    expect(e.name).toBe("ContractError");
                }

                expect(didThrow).toBe(true);
                expect(state.systems.length).toBe(0);
            });
        });

        describe("when the nft-system is added by the architect", () => {
            it("contains the expected value of a system", () => {
                handler(state, {
                    input: {
                        fn: "ADD_SYSTEM",
                        system: nftSystem,
                    }, caller: addresses.admin
                });

                expect(state.systems.length).toBe(1);

                const nftSystemInstance = state.systems.find(system => system.id === "nft-system");

                expect(Boolean(nftSystemInstance)).toBe(true);
                expect(typeof state.systems[0].call).toBe("function");
            });
        });
    });

    describe("REMOVE_SYSTEM", () => {
        describe("when the nft-system is removed by someone who is not the architect", () => {
            it("throws a ContractError", () => {
                let didThrow = false;
                try {
                    handler(state, {
                        input: {
                            fn: "REMOVE_SYSTEM",
                            systemId: nftSystem.id,
                        }, caller: addresses.user
                    });
                } catch (e) {
                    didThrow = true;
                    expect(e.message).toBe("Only the architect can remove systems");
                    expect(e.name).toBe("ContractError");
                }

                expect(didThrow).toBe(true);
                expect(state.systems.length).toBe(1);
            });
        });

        describe("when the nft-system is removed by the architect", () => {
            it("removes the system", () => {
                handler(state, {
                    input: {
                        fn: "REMOVE_SYSTEM",
                        systemId: nftSystem.id,
                    }, caller: addresses.admin
                });

                expect(state.systems.length).toBe(0);
            });
        });
    });

    describe("Trading", () => {
        beforeAll(() => {
            // Add the NFT system to allow for trading.
            state.systems.push(nftSystem);
        });

        describe("ADD_ENTITY", () => {
            describe("when an entity is added by someone who is not the curator", () => {
                it("throws a ContractError", () => {
                    let didThrow = false;
                    try {
                        handler(state, {
                            input: {
                                fn: "ADD_ENTITY",
                                entity: exampleEntity,
                            }, caller: addresses.user
                        });
                    } catch (e) {
                        didThrow = true;
                        expect(e.message).toBe("Only curator can add entities");
                        expect(e.name).toBe("ContractError");
                    }

                    expect(didThrow).toBe(true);
                });
            });

            describe("when an entity is added by the curator", () => {
                it("stores that entity", () => {
                    handler(state, {
                        input: {
                            fn: "ADD_ENTITY",
                            entity: exampleEntity,
                        }, caller: addresses.admin
                    });

                    expect(state.entities.length).toBe(1);
                    expect(state.entities[0].id).toBe("clara");
                    expect(state.entities[0].components.length > 0).toBe(true)
                });
            });
        });

        describe("BUY", () => {
            describe("when the specified entity does not exist", () => {
                const nonEntityId = "not-clara";

                it("throws a ContractError", () => {
                    let didThrow = false;
                    try {
                        handler(state, {
                            input: {
                                fn: "BUY",
                                entityId: nonEntityId,
                            }, caller: addresses.admin
                        });
                    } catch (e) {
                        didThrow = true;
                        expect(e.message).toBe("No entity found with given id");
                        expect(e.name).toBe("ContractError");
                    }

                    expect(didThrow).toBe(true);
                });
            });

            describe("when the specified entity exists", () => {
                const entityId = "clara";

                describe("and the entity is not available to trade", () => {
                    beforeAll(() => {
                        const entity = state.entities[0];
                        const tradableComponent = entity.components.find(c => c.id === "Tradable");
                        tradableComponent.available = false;
                    });

                    afterAll(() => {
                        // Reset state.
                        const entity = state.entities[0];
                        const tradableComponent = entity.components.find(c => c.id === "Tradable");
                        tradableComponent.available = true;
                    });

                    it("throws a ContractError", () => {
                        let didThrow = false;

                        try {
                            handler(state, {
                                input: {
                                    fn: "BUY",
                                    entityId,
                                }, caller: addresses.admin
                            });
                        } catch (e) {
                            didThrow = true;
                            expect(e.message).toBe("Entity is not available for trading");
                            expect(e.name).toBe("ContractError");
                        }

                        expect(didThrow).toBe(true);
                    });
                });

                describe("and the entity is available to trade", () => {
                    describe("and the caller already owns the entity", () => {
                        beforeAll(() => {
                            const entity = state.entities[0];
                            const ownableComponent = entity.components.find(c => c.id === "Ownable");
                            ownableComponent.owner = addresses.admin;
                        });

                        it("throws a ContractError", () => {
                            let didThrow = false;

                            try {
                                handler(state, {
                                    input: {
                                        fn: "BUY",
                                        entityId,
                                    }, caller: addresses.admin
                                });
                            } catch (e) {
                                didThrow = true;
                                expect(e.message).toBe("Caller already owns entity");
                                expect(e.name).toBe("ContractError");
                            }

                            expect(didThrow).toBe(true);
                        });
                    });

                    describe("and the caller has undefined balance", () => {
                        beforeAll(() => {
                            const entity = state.entities[0];
                            const tradableComponent = entity.components.find(c => c.id === "Tradable");
                            tradableComponent.price = 1000;
                        });

                        it("throws a ContractError", () => {
                            let didThrow = false;

                            try {
                                handler(state, {
                                    input: {
                                        fn: "BUY",
                                        entityId,
                                    }, caller: addresses.nonuser
                                });
                            } catch (e) {
                                didThrow = true;
                                expect(e.message).toBe("Insufficient caller balance");
                                expect(e.name).toBe("ContractError");
                            }

                            expect(didThrow).toBe(true);
                        });

                        it("does not update the entity's owner", () => {
                            const entity = state.entities[0];
                            const ownableComponent = entity.components.find(c => c.id === "Ownable");
                            expect(ownableComponent.owner).toBe(addresses.admin);
                        });
                    });

                    describe("and the caller has insufficient balance", () => {
                        beforeAll(() => {
                            const entity = state.entities[0];
                            const tradableComponent = entity.components.find(c => c.id === "Tradable");
                            tradableComponent.price = 1000;

                            state.balances[addresses.user] = 999;
                        });

                        afterAll(() => {
                            // Reset ownership state.
                            const entity = state.entities[0];
                            const ownableComponent = entity.components.find(c => c.id === "Ownable");
                            ownableComponent.owner = addresses.admin;
                        });

                        it("throws a ContractError", () => {
                            let didThrow = false;

                            try {
                                handler(state, {
                                    input: {
                                        fn: "BUY",
                                        entityId,
                                    }, caller: addresses.user
                                });
                            } catch (e) {
                                didThrow = true;
                                expect(e.message).toBe("Insufficient caller balance");
                                expect(e.name).toBe("ContractError");
                            }

                            expect(didThrow).toBe(true);
                        });

                        it("does not update the entity's owner", () => {
                            const entity = state.entities[0];
                            const ownableComponent = entity.components.find(c => c.id === "Ownable");
                            expect(ownableComponent.owner).toBe(addresses.admin);
                        });
                    });

                    describe("and the caller has sufficient balance", () => {
                        let originalAdminBalance = 10000000;
                        let originalUserBalance = 1001;
                        let entityPrice = 1000;
                        let expectedNewAdminBalance = originalAdminBalance + entityPrice;
                        let expectedNewUserBalance = originalUserBalance - entityPrice;

                        beforeAll(() => {
                            const entity = state.entities[0];
                            const tradableComponent = entity.components.find(c => c.id === "Tradable");
                            tradableComponent.price = entityPrice;

                            state.balances[addresses.user] = originalUserBalance;
                            state.balances[addresses.admin] = originalAdminBalance;
                        });

                        afterAll(() => {
                            // Reset ownership state.
                            const entity = state.entities[0];
                            const ownableComponent = entity.components.find(c => c.id === "Ownable");
                            ownableComponent.owner = addresses.admin;
                        });

                        it("it updates the entity's owner", () => {
                            handler(state, {
                                input: {
                                    fn: "BUY",
                                    entityId,
                                }, caller: addresses.user
                            });

                            const entity = state.entities[0];
                            const ownableComponent = entity.components.find(c => c.id === "Ownable");
                            expect(ownableComponent.owner).toBe(addresses.user);
                        });

                        it("transfers balances from previous owner to new owner", () => {
                            expect(state.balances[addresses.admin]).toBe(expectedNewAdminBalance);
                            expect(state.balances[addresses.user]).toBe(expectedNewUserBalance);
                        });
                    });
                });
            });
        });

        describe("SET_AVAILABLE_TO_TRADE", () => {
            describe("when called by a non-owner account", () => {
                it("throws a ContractError", () => {
                    const entityId = "clara";
                    let didThrow = false;
                    try {
                        handler(state, {
                            input: {
                                fn: "SET_AVAILABLE_TO_TRADE",
                                entityId,
                                value: false,
                            }, caller: addresses.user
                        });
                    } catch (e) {
                        didThrow = true;
                        expect(e.message).toBe(`Only owner can set available to trade`);
                        expect(e.name).toBe("ContractError");
                    }

                    expect(didThrow).toBe(true);
                });
            });

            describe("SET_PRICE", () => {
                describe("when called by a non-owner account", () => {
                    beforeAll(() => {
                        const entity = state.entities[0];
                        const ownableComponent = entity.components.find(c => c.id === "Ownable");
                        ownableComponent.owner = addresses.user;
                    });

                    afterAll(() => {
                        // Reset state.
                        const entity = state.entities[0];
                        const ownableComponent = entity.components.find(c => c.id === "Ownable");
                        ownableComponent.owner = addresses.admin;
                    });

                    it("throws a ContractError", () => {
                        const entityId = "clara";
                        let didThrow = false;
                        try {
                            handler(state, {
                                input: {
                                    fn: "SET_PRICE",
                                    entityId,
                                    value: false,
                                }, caller: addresses.nonuser
                            });
                        } catch (e) {
                            didThrow = true;
                            expect(e.message).toBe(`Only owner can set trading price`);
                            expect(e.name).toBe("ContractError");
                        }

                        expect(didThrow).toBe(true);
                    });
                });

                describe("when called by a owner account", () => {
                    beforeAll(() => {
                        const entity = state.entities[0];
                        const ownableComponent = entity.components.find(c => c.id === "Ownable");
                        ownableComponent.owner = addresses.user;
                    });

                    afterAll(() => {
                        // Reset state.
                        const entity = state.entities[0];
                        const ownableComponent = entity.components.find(c => c.id === "Ownable");
                        ownableComponent.owner = addresses.admin;
                    });

                    it("updates the price", () => {
                        const entityId = "clara";
                        const newPrice = 321;

                        handler(state, {
                            input: {
                                fn: "SET_PRICE",
                                entityId,
                                value: newPrice,
                            }, caller: addresses.user
                        });

                        const entity = state.entities[0];
                        const tradableComponent = entity.components.find(c => c.id === "Tradable");
                        expect(tradableComponent.price).toBe(newPrice);
                    });
                });
            });

            describe("when called by the entity's owner account", () => {
                describe("and the new value is `false`", () => {
                    it("sets availability to trade to false", () => {
                        const entityId = "clara";

                        let entity = state.entities[0];
                        let tradableComponent = entity.components.find(c => c.id === "Tradable");

                        handler(state, {
                            input: {
                                fn: "SET_AVAILABLE_TO_TRADE",
                                entityId,
                                value: false,
                            }, caller: addresses.admin
                        });

                        entity = state.entities[0];
                        tradableComponent = entity.components.find(c => c.id === "Tradable");
                        expect(tradableComponent.available).toBe(false);
                    });
                });
            });
        });
    });
});

# Metaverse Contracts

## Problem We're Solving

- Arweave *Profit-Sharing Token* (PST) contracts have tradable governance tokens, but there is no way to extend this with other functionality.
- Specifically, the PST pattern includes no way to add tradable, non-fungible tokens (NFTs).
- NFTs are particularly useful in Arweave, since they can store rich data and therefore imported into games.
- **Thesis**: If a community could curate data-rich NFTs that are tradable for their token, then the community's governance token would have value. The community could build engaging digital spaces for using these NFTs, such as games.

## Goals

- The community **can source and curate new NFTs**, which can be integrated into the contract
- A **user can purchase a data-rich NFT** on Arweave, using a community's token
- Future **Arweave devs** can use this as a pattern for any extensible PST contracts

## What Success Looks Like

- **Community members** own governance tokens that appreciate as they curate and add NFTs
- **Artists** create new NFTs for the community and are rewarded for their creativity
- **Users** purchase NFTs and make use of them in worlds that develop

## Specification

The model for extending the Arweave PST contract is based a gaming pattern called **Entities, Components, Systems**.

**entity**: unique object with attached components
**components**: traits like hit points; ownership
**systems**: do work to modify component data

Using this pattern, the PST contract has been refactored into a *system*, which can exist alongside other systems. *NFT* can be added as another system, thereby extending the contract.

This repo also introduces the concept of **architect** and **curator**, which are two *settings* (therefore voted in by governance) that control curation of **entities** (by the curator) and **systems** (by the architect).

## Implementation

There is an entry-point called `index.ts` that takes arguments as `input`. The most primitive callable methods are `ADD_SYSTEM` and `REMOVE_SYSTEM`, which can be called successfully from the architect.

### Adding Systems

Systems can be added easily by calling the function `ADD_SYSTEM` and providing a system with the following interface:

```tsx
interface SystemInterface {
		// Some unique identifier for the system.
    id: string;
		// Determines when a system is run relative to other systems in state.
    priorityWeight?: number;
		// The method that is run given some input.
    call({state: StateInterface, action: ActionInterface, SmartWeave?: any}): any;
}
```

```jsx
// Add the system to the contract's state.
handler(state, {
    input: {
        fn: "ADD_SYSTEM",
        system: nftSystem,
    }, caller: addresses.admin
});
```

All other input is passed to the systems held in the contract's state, in order of the system's priority weight.

```jsx
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
```

This repo implements two systems, `nft-system` and `profit-sharing-system`

```markdown
systems/
  nft/
		index.ts
  profit-sharing/
		index.ts 
```

### Tests

Running the tests in this repo with verbose enabled is instructive as to the general capabilities.

```markdown
yarn test --verbose
```

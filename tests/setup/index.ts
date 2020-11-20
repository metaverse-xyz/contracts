import Arweave from "arweave/node";
import * as fs from "fs";

export const arweave = Arweave.init({
    host: 'arweave.net',
    protocol: 'https',
    port: 443
});

export let state = JSON.parse(fs.readFileSync(__dirname + '/../../fixtures/contract-state.json', 'utf8'));

export let exampleEntity = JSON.parse(fs.readFileSync(__dirname + '/../fixtures/entity.json', 'utf8'));

export const addresses = {
    admin: 'Ky1c1Kkt-jZ9sY1hvLF5nCf6WWdBhIU5Un_BMYh-t3c',
    user: 'VAg65x9jNSfO9KQHdd3tfx1vQa8qyCyJ_uj7QcxNLDk',
    nonuser: 'DiFv0MDBxKEFkJEy_KNgJXNG6mxxSTcxgV0h4gzAgsc'
};

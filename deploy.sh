#!/bin/bash

# smartweave create [SRC LOCATION] [INITIAL STATE FILE] --key-file [YOUR KEYFILE]
smartweave create "./dist/index.js" "./contracts/nft/fixtures/contract-state.json" --key-file "./wallet/keyfile.json"

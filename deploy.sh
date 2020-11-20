#!/bin/bash

# smartweave create [SRC LOCATION] [INITIAL STATE FILE] --key-file [YOUR KEYFILE]
smartweave create "./dist/index.js" "./fixtures/contract-state.json" --key-file "./wallet/keyfile.json"

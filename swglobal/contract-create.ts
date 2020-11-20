
import Arweave from 'arweave/node'
import { JWKInterface } from 'arweave/node/lib/wallet'

/**
 * Create a new contract from a contract source file and an initial state. 
 * Returns the contract id.
 *  
 * @param arweave       an Arweave client instance
 * @param wallet        a wallet private or public key
 * @param contractSrc   the contract source as string.  
 * @param initState     the contract initial state, as a JSON string.
 */
export async function createContract(arweave: Arweave, wallet: JWKInterface, contractSrc: string, initState: string, minFee?: number): Promise<string> {
  let srcTx = await arweave.createTransaction({ data: contractSrc }, wallet)
  
  srcTx.addTag('App-Name', 'SmartWeaveContractSource')
  srcTx.addTag('App-Version', '0.3.0')
  srcTx.addTag('Content-Type', 'application/javascript');
  
  await arweave.transactions.sign(srcTx, wallet)

  const response = await arweave.transactions.post(srcTx)

  if((response.status == 200) || (response.status == 208))
      return createContractFromTx(arweave, wallet, srcTx.id, initState, minFee)
  else
      throw new Error(`Unable to write Contract Source.`)
}
/**
 * Create a new conntract from an existing contract source tx, with an initial state. 
 * Returns the contract id.
 * 
 * @param arweave   an Arweave client instance
 * @param wallet    a wallet private or public key
 * @param srcTxId   the contract source Tx id.
 * @param state     the initial state, as a JSON string.  
 */
export async function createContractFromTx(arweave: Arweave, wallet: JWKInterface, srcTxId: string, state: string, minFee?: number) {
  // Create a contract from a stored source TXID, setting the default state.
  let contractTX = await arweave.createTransaction({ data: state }, wallet)
  contractTX.addTag('App-Name', 'SmartWeaveContract')
  contractTX.addTag('App-Version', '0.3.0')
  contractTX.addTag('Contract-Src', srcTxId)
  contractTX.addTag('Content-Type', 'application/json')
  if (minFee) {
      contractTX.addTag('Min-Fee', minFee.toString())
  }

  await arweave.transactions.sign(contractTX, wallet)

  const response = await arweave.transactions.post(contractTX)
  if((response.status == 200) || (response.status == 208))
      return contractTX.id
  else
      throw new Error(`Unable to write Contract Initial State`)
}





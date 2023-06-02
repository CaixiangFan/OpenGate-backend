import { Injectable } from '@nestjs/common';
// const { getDecodedResultLog, getRequestConfig } = require("../../FunctionsSandboxLibrary");
import { ethers } from "ethers";
import * as DONconsumerABI from "abi/DONconsumer.json";
import * as OracleABI from "abi/FunctionsOracle.json";
import * as RegistryABI from "abi/FunctionsBillingRegistry.json";
import * as ora from "ora";
import { Console } from "console";
import { Transform } from "stream";

function table(input) {
  // @see https://stackoverflow.com/a/67859384
  const ts = new Transform({
    transform(chunk, enc, cb) {
      cb(null, chunk)
    },
  })
  const logger = new Console({ stdout: ts })
  logger.table(input)
  const table = (ts.read() || "").toString()
  let result = ""
  for (let row of table.split(/[\r\n]+/)) {
    let r = row.replace(/[^┬]*┬/, "┌")
    r = r.replace(/^├─*┼/, "├")
    r = r.replace(/│[^│]*/, "")
    r = r.replace(/^└─*┴/, "└")
    r = r.replace(/'/g, " ")
    result += `${r}\n`
  }
  console.log(result)
}

const logger = { table }

function spin(config = {}) {
  const spinner = ora({ spinner: "dots2", ...config })
  spinner.start()
  return spinner
}

@Injectable()
export class ExecuteService {
  private response = '0x';
  private txHash = '0x';

  async executeRequest(source: string, args: [string], secrets: Object): Promise<Object> {
    const network = {
      name: "polygonMumbai",
      url: process.env.MUMBAI_RPC_URL ?? "UNSET",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      chainId: 80001,
      nativeCurrencySymbol: "MATIC",
      nativeCurrencyDecimals: 18,
      nativePriceFeed: "0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada",
      mainnet: false,
    };
  
    const taskArgs = {
      contract: process.env.DON_CONSUMER_CONTRACT ?? "",
      subid: process.env.SUB_ID ?? 655,
      simulate: true,
      gaslimit: 100000,
      requestgas: 1_500_000
    }
  
    const request = {
      source: source,
      secrets: '0x',
      args: args,
      secretsURLs: []
    }
  
  
    // A manual gas limit is required as the gas limit estimated by Ethers is not always accurate
    const overrides = {
      gasLimit: taskArgs.requestgas,
    }
  
    const provider = new ethers.providers.JsonRpcProvider(process.env.MUMBAI_RPC_URL);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY ?? "", provider);
  
    // Get the required parameters
    const contractAddr = process.env.DON_CONSUMER_CONTRACT ?? "";
    const subscriptionId = process.env.SUB_ID ?? 655;
    const gasLimit = 100000;
  
    const clientContract = new ethers.Contract(contractAddr, DONconsumerABI.abi, signer);
  
    const functionsOracleProxy = process.env.FUNC_ORACLE_PROXY ?? "";
    const oracle = new ethers.Contract(functionsOracleProxy, OracleABI.abi, signer)
    
    const registryAddress = await oracle.getRegistry()
    const registry = new ethers.Contract(registryAddress, RegistryABI.abi, signer);
  
    const requestConfig = {
      codeLocation: 0,
      codeLanguage: 0,
      source: request.source,
      secrets: request.secrets,
      perNodeSecrets: [],
      args: request.args,
      expectedReturnType: "uint256",
      DONPublicKey: await oracle.getDONPublicKey()
    }
    
    // Check that the subscription is valid
    let subInfo
    try {
      subInfo = await registry.getSubscription(subscriptionId)
    } catch (error) {
      if (error.errorName === "InvalidSubscription") {
        throw Error(`Subscription ID "${subscriptionId}" is invalid or does not exist`)
      }
      throw error
    }
    // Validate the client contract has been authorized to use the subscription
    const existingConsumers = subInfo[2].map((addr) => addr.toLowerCase())
    if (!existingConsumers.includes(contractAddr.toLowerCase())) {
      throw Error(`Consumer contract ${contractAddr} is not registered to use subscription ${subscriptionId}`)
    }
  
  
    const simulatedSecretsURLBytes = `0x${Buffer.from(
      "https://exampleSecretsURL.com/f09fa0db8d1c8fab8861ec97b1d7fdf1/raw/d49bbd20dc562f035bdf8832399886baefa970c9/encrypted-functions-request-data-1679941580875.json"
    ).toString("hex")}`
  
   
    // const store = new RequestStore(network.chainId, network.name, "consumer")
  
    const spinner = spin({
      text: `Submitting transaction for FunctionsConsumer contract ${contractAddr} on network ${network.name}`,
    })
  
    // Use a promise to wait & listen for the fulfillment event before returning
    await new Promise(async (resolve, reject) => {
      let requestId

      let cleanupInProgress = false
      let doGistCleanup = true
      const cleanup = async () => {
        spinner.stop()
        if (doGistCleanup) {
          if (!cleanupInProgress) {
            cleanupInProgress = true
            const success = true
            if (success) {
              console.log("Success!")
            }
            return resolve("success")
          }
          return
        }
        return resolve("success")
      }

      let billingEndEventReceived = false
      let ocrResponseEventReceived = false
      clientContract.once("OCRResponse", async (eventRequestId, result, err) => {
        // Ensure the fulfilled requestId matches the initiated requestId to prevent logging a response for an unrelated requestId
        if (eventRequestId !== requestId) {
          return
        }
  
        spinner.succeed(`Request ${requestId} fulfilled! Data has been written on-chain.\n`)
        if (result !== "0x") {
          console.log(
            `Response returned to client contract represented as a hex string: ${result}}`
          )
          this.response = result;
        }
        if (err !== "0x") {
          console.log({err});
          console.log(`Error message returned to client contract: "${Buffer.from(err.slice(2), "hex")}"\n`)
        }
        ocrResponseEventReceived = true
        // await store.update(requestId, { status: "complete", result })
  
        if (billingEndEventReceived) {
          await cleanup()
        }
      })
      // Listen for the BillingEnd event, log cost breakdown & resolve
      registry.once(
        "BillingEnd",
        async (
          eventRequestId,
          eventSubscriptionId,
          eventSignerPayment,
          eventTransmitterPayment,
          eventTotalCost,
          eventSuccess
        ) => {
          if (requestId == eventRequestId) {
            const baseFee = eventTotalCost.sub(eventTransmitterPayment)
            spinner.stop()
            console.log(`Actual amount billed to subscription #${subscriptionId}:`)
            const costBreakdownData = [
              {
                Type: "Transmission cost:",
                Amount: `${ethers.utils.formatUnits(eventTransmitterPayment, 18)} LINK`,
              },
              { Type: "Base fee:", Amount: `${ethers.utils.formatUnits(baseFee, 18)} LINK` },
              { Type: "", Amount: "" },
              { Type: "Total cost:", Amount: `${ethers.utils.formatUnits(eventTotalCost, 18)} LINK` },
            ]
            logger.table(costBreakdownData)
  
            // Check for a successful request
            billingEndEventReceived = true
            if (ocrResponseEventReceived) {
              await cleanup()
            }
          }
        }
      )
  
      // Initiate the on-chain request after all listeners are initialized
      const requestTx = await clientContract.executeRequest(
        request.source,
        request.secrets ?? [],
        request.args ?? [],
        subscriptionId,
        gasLimit,
        overrides
      )
  
      spinner.start("Waiting 2 blocks for transaction to be confirmed...")
      const requestTxReceipt = await requestTx.wait(2);

      requestId = requestTxReceipt.events[2].args.id
      this.txHash = requestTx.hash;
    })
    
    return {data: this.response, txHash: this.txHash};
  }
}

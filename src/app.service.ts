import { Injectable } from '@nestjs/common';
import { Polybase } from "@polybase/client";
import { ethers } from "ethers";
import * as DONconsumerABI from "abi/DONconsumer.json";
@Injectable()
export class AppService {
  private db = new Polybase({
    defaultNamespace: process.env.POLYBASE_NAME_SPACE ?? '',
  });

  getHello(): string {
    return 'Hello World!';
  }

  // Polybase operations
  async searchHistoricalfunctions(myAccount: string) {
    // query my Functions
    try {
      const functionRecords = await this.db
        .collection('Function')
        .where("account", "==", myAccount)
        .get();

      const functions = functionRecords.data;
      return functions;
    } catch(error) {
      console.log(error)
    }
  }

  // Chainlink function contract operations
  async estimateCost(source: string, args: [string], secrets: Object): Promise<number> {
    const provider = new ethers.providers.JsonRpcProvider(process.env.MUMBAI_RPC_URL);
    const requestConfig = {
      // source: fs.readFileSync("./calculation-example.js").toString(),
      source: source,
      // args: ["1", "bitcoin", "btc-bitcoin", "btc", "1000000", "450"],
      args: args,
      // secrets: { apiKey: process.env.COINMARKETCAP_API_KEY ?? "" },
      secrets: secrets,
      subId: process.env.SUB_ID ?? 0,
      gasLimit: process.env.GAS_LIMIT ?? 1000000,
      gasPrice: (await provider.getFeeData()).gasPrice
    }
    const DONconsumerAddress = process.env.DON_CONSUMER_CONTRACT ?? ''; 
    const consumerContract = new ethers.Contract(DONconsumerAddress, DONconsumerABI.abi, provider);
    const simulatedSecretsURLBytes = `0x${Buffer.from(process.env.BUFFER_URL ?? "").toString("hex")}`;
  
    // cost with 8 decimals precision; actual value in USD should be devided by 1e8
    const estimatedCost = await consumerContract.getCostEstimate(
      requestConfig.source,
      requestConfig.secrets && Object.keys(requestConfig.secrets).length > 0 ? simulatedSecretsURLBytes : [],
      requestConfig.args ?? [],
      requestConfig.subId,
      requestConfig.gasLimit,
      requestConfig.gasPrice
    );
    return estimatedCost.toNumber()/1e8;
  }
}

import { Injectable } from '@nestjs/common';
import { Polybase } from "@polybase/client";

@Injectable()
export class AppService {
  private db = new Polybase({
    defaultNamespace: process.env.POLYBASE_NAME_SPACE ?? '',
  });

  getHello(): string {
    return 'Hello World!';
  }

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
}

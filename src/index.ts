export { ModelDataBase } from "./model"
export { AllSymbol } from "./model_definitions";

import { MongoClient, MongoClientOptions, Db } from "mongodb";
import { ModelDefinition } from "./model_definitions";
import Model, { ModelDataBase } from "./model";

export default class SafeMongo {
   private client: MongoClient;
   public db: Db;
   private waiting: (() => void)[] = [];
   constructor(uri: string, private database_name: string, options?: MongoClientOptions) {
      options = {
         useNewUrlParser: true,
         ...options
      }
      this.client = new MongoClient(uri, options);
   }

   public addModel<T extends ModelDataBase>(definition: ModelDefinition) {
      return new Model<T>(this, definition);
   }

   public async awaitConnected() {
      if (this.db) return;
      return new Promise((yes) => this.waiting.push(() => yes()));
   }

   public connect() {
      return this.client.connect().then(() => this.db = this.client.db(this.database_name)).then(() => {
         this.waiting.forEach(e => e());
      })
   }

   public disconnect() {
      return this.client.close();
   }
}
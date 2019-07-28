import SafeMongo from ".";

import * as chai from "chai";
import chaiap from "chai-as-promised"
chai.use(chaiap);
const { expect } = chai;
import { ModelDefinition, VersionNode, AllSymbol } from "./model_definitions";
import Model, { ModelDataBase, recursiveDeepCopy, InvalidObjectError } from "./model";
import { Db, ObjectID } from "mongodb";

const config = {
   database: "test",
   collection: "test_model",
   model: {
      default_name: "NONAME",
      default_age: -1,
      default_val: "DefVal"
   }
}
interface TestModel extends ModelDataBase {
   username: string;
   val: number;
   name: string;
   tags: string[];
   is_male?: boolean;
   created: Date;
   nested: { val: string };
   nested_arr: { val: string }[];
   nested_opt?: { val: string };
   age: number;
   type: string;
}

const model_definition: ModelDefinition = {
   name: config.collection,
   versions: [
      {
         migration: async (doc) => { },
         schema: {
            username: {
               type: String
            },
            val: {
               type: Number,
               default: 0
            },
            name: {
               type: String,
               default: config.model.default_name
            },
            tags: {
               type: String,
               array: true
            },
            type: {
               type: String,
               default: "test",
               validate: (t) => t === "test" ? undefined : "Type has to be test!"
            },
            is_male: {
               type: Boolean,
               optional: true
            },
            created: {
               type: Date,
               default: () => new Date()
            },
            nested: {
               model: true,
               type: {
                  val: {
                     type: String,
                     default: config.model.default_val
                  }
               }
            },
            nested_arr: {
               model: true,
               array: true,
               type: {
                  val: {
                     type: String
                  }
               }
            },
            nested_opt: {
               model: true,
               optional: true,
               type: {
                  val: {
                     type: String,
                     default: config.model.default_val
                  }
               }
            }
         }
      }
   ]
}

const new_version: VersionNode = {
   migration: async <TestModel>(doc) => {
      doc.age = -1;
   },
   schema: {
      username: {
         type: String
      },
      val: {
         type: Number,
         default: 0
      },
      name: {
         type: String,
         default: config.model.default_name
      },
      tags: {
         type: String,
         array: true
      },
      type: {
         type: String,
         default: "test",
         validate: (t) => t === "test" ? undefined : "Type has to be test!"
      },
      is_male: {
         type: Boolean,
         optional: true
      },
      created: {
         type: Date,
         default: () => new Date()
      },
      nested: {
         model: true,
         type: {
            val: {
               type: String,
               default: config.model.default_val
            }
         }
      },
      nested_arr: {
         model: true,
         array: true,
         type: {
            val: {
               type: String
            }
         }
      },
      nested_opt: {
         model: true,
         optional: true,
         type: {
            val: {
               type: String,
               default: config.model.default_val
            }
         }
      },
      age: {
         type: Number,
         default: config.model.default_age
      }
   }
}

describe("Database", () => {
   it("connect", async () => {
      let c = new SafeMongo("mongodb://localhost", config.database);
      await c.connect()
      expect(c.db).to.exist;
   }).timeout(10000)

   it("await_connection", async () => {
      let c = new SafeMongo("mongodb://localhost", config.database);
      c.connect()
      await c.awaitConnected();
      expect(c.db).to.exist;
   });
})

describe("Model", () => {
   let safemongo: SafeMongo;
   const dropC = () => safemongo.db.collection(config.collection).drop().catch(() => { });
   before(async () => {
      safemongo = new SafeMongo("mongodb://localhost", config.database);
      await safemongo.connect()
      await dropC()
   })

   it("constructor", () => {
      let model = safemongo.addModel(model_definition);
      expect(model.version).to.equal(0);
   })

   describe("Model functions", () => {
      let model: Model<TestModel>;
      before(() => {
         model = safemongo.addModel(model_definition);
      })

      describe("new", () => {
         it("empty parameter", () => {
            let nd = model.new();
            expect(nd).to.exist;
            expect(nd.username).to.not.exist;
            expect(nd.name).to.equal(config.model.default_name);
            expect(nd.tags).to.eql([]);
            expect(nd.age).to.not.exist;
            expect(nd.is_male).to.not.exist;
            expect(nd.created).to.be.instanceof(Date);
            expect(nd.nested).to.exist;
            expect(nd.nested.val).to.equal(config.model.default_val);
         })

         it("correct parameter", () => {
            let nd = model.new({ username: "testun", nested: { val: "teeest" }, tags: ["test1", "test2"] });
            expect(nd).to.exist;
            expect(nd.username).to.equal("testun");
            expect(nd.name).to.equal(config.model.default_name);
            expect(nd.tags).to.eql(["test1", "test2"]);
            expect(nd.age).to.not.exist;
            expect(nd.is_male).to.not.exist;
            expect(nd.created).to.be.instanceof(Date);
            expect(nd.nested).to.exist;
            expect(nd.nested.val).to.equal("teeest");
         })


         it("invalid property in parameter", () => {
            const t = () => model.new(<any>{ username: "testun", invalid_prop: "asd" })
            expect(t).to.throw();
         })

         it("invalid type in parameter", () => {
            const t = () => model.new(<any>{ username: 15 })
            expect(t).to.throw();
         })

         it("invalid type in array", () => {
            const t = () => model.new(<any>{ tags: ["test1", 1, "test2"] });
            expect(t).to.throw();
         })

         describe("nested proprty in parameter", () => {
            it("invalid property", () => {
               const t = () => model.new(<any>{ username: "testun", nested: { invalid_prop: "asd" } })
               expect(t).to.throw();
            })

            it("invalid type", () => {
               const t = () => model.new(<any>{ nested: { val: 16 } })
               expect(t).to.throw();
            })

            it("invalid property arr", () => {
               const t = () => model.new(<any>{ username: "testun", nested_arr: { invalid_prop: "asd" } })
               expect(t).to.throw();
            })
         })
         it("nested - optional", () => {
            let nd = model.new();
            expect(nd.nested_opt).to.not.exist;
         })
      })

      describe("save - new", () => {
         it("valid", async () => {
            let md = model.new({
               is_male: true,
               name: "Name One",
               nested: {
                  val: "Test"
               },
               username: "username_1"
            });
            await model.save(md);
         });

         it("invalid", async () => {
            let md = model.new(<any>{
               is_male: true,
               name: "Name One",
               nested: {
                  val: "Test"
               }
            });
            md.username = <any>12;
            await expect(model.save(md)).to.eventually.be.rejected;
         })

         it("invalid - validate function", async () => {
            let md = model.new(<any>{
               is_male: true,
               name: "Name One",
               nested: {
                  val: "Test"
               },
               username: "username_1"
            });
            md.type = "nottest";
            await expect(model.save(md)).to.eventually.be.rejected;
         })
      })

      describe("find", () => {
         before(async () => {
            await dropC()
            for (let i = 1; i < 11; i++) {
               let m = model.new({
                  is_male: true,
                  name: "Name One",
                  nested: {
                     val: "Test"
                  },
                  username: "username_" + i
               })
               await model.save(m);
            }
         })
         let oneid: ObjectID;

         it("find one", async () => {
            let doc = await model.findOne({ username: "username_1" });
            expect(doc).to.exist;
            expect(doc._id).to.exist;
            expect(doc._id).to.be.instanceof(ObjectID);
            oneid = doc._id;
         });

         it("find one - not exists", async () => {
            let doc = await model.findOne({ username: "qoiwgbfoiasbg" });
            expect(doc).to.be.null;
         });

         it("find all", async () => {
            let docs = await model.find({});
            expect(docs).has.lengthOf(10);
         })

         it("find all - not exists", async () => {
            let docs = await model.find({ username: "qoiwgbfoiasbg" });
            expect(docs).has.lengthOf(0);
         })

         it("find by id - ObjectID", async () => {
            let doc = await model.findById(oneid);
            expect(doc).to.exist;
         })

         it("find by id - string", async () => {
            let doc = await model.findById(oneid.toHexString());
            expect(doc).to.exist;
         })

         it("find by id - not exists", async () => {
            let doc = await model.findById("5be005a453b8d873d4b8cdd1");
            expect(doc).to.be.null;
         })
      })

      describe("save - change", () => {
         let test_entry: ObjectID;
         beforeEach(async () => {
            await dropC();
            for (let i = 1; i < 11; i++) {
               let m = model.new({
                  is_male: true,
                  name: "Name One",
                  nested: {
                     val: "Test"
                  },
                  username: "username_" + i
               })
               await model.save(m);
               test_entry = m._id;
            }
         })

         it("change property", async () => {
            let entry = await model.findById(test_entry);
            entry.name = "Name Two"
            await model.save(entry);
            entry = await model.findById(test_entry);
            expect(entry.name).to.equal("Name Two");
         });

         it("change invalid", async () => {
            let entry = await model.findById(test_entry);
            entry.name = <any>12;
            await expect(model.save(entry)).to.eventually.be.rejected;
            entry = await model.findById(test_entry);
            expect(entry.name).to.equal("Name One");
         });

         it("change invalid - validate function", async () => {
            let entry = await model.findById(test_entry);
            entry.type = "nottest"
            await expect(model.save(entry)).to.eventually.be.rejected;
            entry = await model.findById(test_entry);
            expect(entry.name).to.equal("Name One");
         })

         it("increment id", async () => {
            let entry = await model.findById(test_entry);
            let oldval = entry.val;
            await model.incement(test_entry, "val", 1);
            entry = await model.findById(test_entry);
            expect(entry.val).to.be.equal(oldval + 1);
         })

         it("increment element", async () => {
            let entry = await model.findById(test_entry);
            let oldval = entry.val;
            await model.incement(entry, "val", 1);
            expect(entry.val).to.be.equal(oldval + 1);
            entry = await model.findById(test_entry);
            expect(entry.val).to.be.equal(oldval + 1);
         })

         it("increment element - invalid", async () => {
            let entry = await model.findById(test_entry);
            let oldval = entry.val;
            expect(model.incement(<any>{ val: 12 }, "val", 1)).to.eventually.be.rejected;
         })
      })

      describe("delete", () => {
         let doc: TestModel;
         beforeEach(async () => {
            await dropC()
            let m = model.new({
               is_male: true,
               name: "Name One",
               nested: {
                  val: "Test"
               },
               username: "username"
            })
            await model.save(m);
            doc = m;
         })

         it("with id", async () => {
            await model.delete(doc._id)
            let d = await model.findById(doc._id);
            expect(d).to.be.null;
         })

         it("with id string", async () => {
            await model.delete(doc._id.toHexString())
            let d = await model.findById(doc._id);
            expect(d).to.be.null;
         })

         it("with doc", async () => {
            await model.delete(doc)
            let d = await model.findById(doc._id);
            expect(d).to.be.null;
         })

         it("with filter", async () => {
            await model.deleteFilter({ username: doc.username })
            let d = await model.findById(doc._id);
            expect(d).to.be.null;
         })

      })

      it("migration", async () => {
         await dropC()
         let old_doc = model.new({
            is_male: true,
            name: "Name One",
            nested: {
               val: "Test"
            },
            username: "username"
         });
         await model.save(old_doc);

         let nmd = recursiveDeepCopy(model_definition);
         nmd.versions.push(new_version);

         let new_model = safemongo.addModel<TestModel>(nmd);
         expect(new_model.version).to.be.equal(1);

         let new_doc = await new_model.findById(old_doc._id);
         expect(new_doc.username).to.be.equal(old_doc.username);
         expect(new_doc.name).to.be.equal(old_doc.name);
         expect(new_doc.is_male).to.be.equal(old_doc.is_male);
         expect(new_doc.age).to.exist;
         expect(new_doc.age).to.be.equal(config.model.default_age);
      })
   })

   describe("additional", () => {
      describe("AllSymbol", () => {
         const schema = {
            name: config.collection,
            versions: [
               {
                  migration: async (doc) => { },
                  schema: {
                     [AllSymbol]: {
                        type: String
                     }
                  }
               }
            ]
         }
         it("correct", () => {
            let m = safemongo.addModel<any>(schema);
            m.validate({
               name: "hallo"
            })
         })

         it("incorrect", () => {
            let m = safemongo.addModel<any>(schema);
            let err = false;
            try {
               m.validate({
                  name: 1
               })
            } catch (e) {
               err = true;
            }
            expect(err).to.be.true;
         })
      })
   })

   after(() => safemongo.disconnect())
})
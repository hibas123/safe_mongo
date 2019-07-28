import { ModelDefinition, validate, SchemaNodeObject, ModelPropery, AllSymbol, AnyType } from "./model_definitions";
import { Collection, ObjectID, FilterQuery } from "mongodb";
import SafeMongo from ".";

export interface ModelDataBase {
   _id: ObjectID;
   _v: number;
}

type FilterProperties<T, U> = { [key in keyof T]: T[key] extends U ? key : never };
type AllowedNames<T, U> = FilterProperties<T, U>[keyof T];

export class InvalidObjectError extends Error {
   constructor() {
      super("This object was not initialized by using Model.new or prevoiously fetched!");
   }
}

export default class Model<T extends ModelDataBase> {
   private _collection: Promise<Collection<T>>;
   private _version: number;
   private _new = new WeakSet<T>();
   private _fetched = new WeakMap<T, T>();

   public get version() {
      return this._version;
   }

   constructor(private _sm: SafeMongo, private _definition: ModelDefinition) {
      validate(_definition);
      this._version = _definition.versions.length - 1;
      this._collection = _sm.awaitConnected().then(() => _sm.db.collection(_definition.name));
   }

   new(data?: Partial<T>) {
      if (data)
         this._validate(<any>data, false, false, true);
      let res: T = <any>{
         _v: this._version
      };

      this._validate(res, false, true, true);
      if (data) {
         for (let key in data) {
            res[key] = data[key];
         }
      }
      this._new.add(res);
      return res;
   }

   validate(data: T) {
      this._validate(data, false);
   }

   async save(data: T) {
      let old: T = undefined;
      if (!this._new.has(data) && !(old = this._fetched.get(data))) {
         throw new InvalidObjectError();
      }
      this._validate(data, !!old);
      data._v = this._version;
      await this._sm.awaitConnected()
      if (!old) { // Is new
         data._id = undefined; //make shure no invalid IDs are passed
         await (await this._collection).insertOne(data).then(inserted => {
            this._new.delete(data);
            data._id = inserted.insertedId;
            this._fetched.set(data, recursiveDeepCopy(data))
            return data;
         })
      } else {
         await (await this._collection).replaceOne({ _id: data._id }, data).then(replace => data);
      }
   }

   async findById(id: ObjectID | string): Promise<T | null> {
      if (typeof id === "string") id = new ObjectID(id);
      let res = await (await this._collection).findOne<T>({ _id: id });
      if (!res) return null;
      this._add_fetched(res);
      await this._upgrade(res);
      return res;
   }

   async findOne(filter: FilterQuery<T>): Promise<T | null> {
      let res = await (await this._collection).findOne(filter);
      if (!res) return null;
      this._add_fetched(res);
      await this._upgrade(res);
      return res;
   }

   async find(filter: FilterQuery<T>): Promise<T[]> {
      let res = await (await this._collection).find(filter);
      let elms = await res.toArray();
      elms.forEach(e => this._add_fetched(e))
      await Promise.all(elms.map(e => this._upgrade(e)));
      return elms;
   }

   async delete(doc: T | ObjectID | string) {
      if (typeof doc === "string") doc = new ObjectID(doc);
      if (!ObjectID.isValid(<any>doc)) doc = (<any>doc)._id;

      await (await this._collection).deleteOne({ _id: doc });
   }

   async deleteFilter(filter: FilterQuery<T>) {
      await (await this._collection).deleteMany(filter);
   }

   async incement(elm: ObjectID | string | T, field: AllowedNames<T, number>, amount = 1) {
      if (typeof elm === "string") elm = new ObjectID(elm);
      let id: ObjectID;
      if (elm instanceof ObjectID) {
         id = elm;
      } else {
         if (!this._new.has(elm)) {
            if (this._fetched.has(elm)) {
               id = elm._id;
            } else {
               throw new InvalidObjectError();
            }
         }
      }

      if (id)
         await this._collection.then(c => c.findOneAndUpdate({ _id: id }, { $inc: { [field]: amount } }));

      if (!(elm instanceof ObjectID)) {
         (<any>elm[field]) += amount;
      }
   }

   private _add_fetched(data: T) {
      this._fetched.set(data, recursiveDeepCopy(data));
   }

   private async _upgrade(data: T) {
      if (data._v != this._version) {
         if (data._v > this._version) throw new Error("Object version is larger, than this application supports. Please upgrade!");
         let versions = this._definition.versions.slice(data._v, this._definition.versions.length);
         for (let version of versions) {
            if (version.migration) {
               await version.migration(data); //await don't cares if it is a promise or not
            }
         }
      }
      data._v = this._version;
      await this.save(data)
   }

   private _validate(data: T, check_id = true, add_default = false, all_optional = false) {
      if (check_id) {
         if (!ObjectID.isValid(data._id)) throw new Error("Invalid _id");
      }

      let version = getLast(this._definition.versions);

      const checkObj = (obj: any, schema: SchemaNodeObject) => {
         if (process.env.asdw === "asdeq")
            console.log(Object.keys(obj), Object.keys(schema))

         let additional = Object.keys(obj).filter(v => !schema[v] && v !== "_id" && v !== "_v")
         if (additional.length > 0 && !schema[AllSymbol])
            throw new Error("Invalid properties set: [" + additional.join(", ") + "]");

         let keys = [...Object.keys(schema), ...additional];
         for (let key of keys) {
            if (key === "_id" || key === "_v") continue;
            let should = schema[key] || schema[AllSymbol];
            let value = obj[key];

            if (value !== undefined && (value !== null || should.allow_null)) {
               if (!(should.allow_null && value === null)) {
                  if ((<ModelPropery>should).model) {
                     if (should.array) {
                        value.forEach(e => checkObj(e, <SchemaNodeObject>should.type))
                     } else
                        checkObj(value, <SchemaNodeObject>should.type);
                  } else {
                     const check = (val) => {
                        switch (should.type) {
                           case String:
                              if (typeof val !== "string") throw new Error(key + " should be of type string");
                              break;
                           case Number:
                              if (typeof val !== "number") throw new Error(key + " should be of type number");
                              break;
                           case Boolean:
                              if (typeof val !== "boolean") throw new Error(key + " should be of type boolean");
                              break;
                           case Date:
                           case Array:
                              if (!(val instanceof should.type)) throw new Error(key + " should be of type " + should.type.name);
                              break;
                           case ObjectID:
                              if (!ObjectID.isValid(val)) throw new Error(key + " should be of type " + should.type.name);
                              break;
                           case Object:
                              if (typeof val !== "object") throw new Error(key + " should be of type " + should.type.name);
                              break;
                           case "any": //Just accept all type of values
                              break;
                           default:
                              throw new Error(key + " invalid datatype!")
                        }
                        if (should.validate) {
                           let err = (<any>should.validate)(value);
                           if (err) throw new Error(err);
                        }
                     }
                     if (should.array) {
                        if (!Array.isArray(value)) {
                           throw new Error(key + " should be an Array");
                        } else {
                           value.forEach(val => check(val));
                        }
                     } else {
                        check(value);
                     }
                  }
               }
            } else {
               if (should.array) {
                  if (!obj[key] && !should.optional)
                     obj[key] = [];
               } else if ((<ModelPropery>should).model) {
                  if (!obj[key] && !should.optional)
                     obj[key] = {};
                  if (!should.optional || obj[key])
                     checkObj(obj[key], <SchemaNodeObject>should.type);
               } else if (add_default && should.default !== undefined) {
                  let def: typeof should.default;
                  if (typeof should.default === "function") def = should.default.apply(obj);
                  else def = should.default;
                  obj[key] = def;
               } else if (!should.optional && !all_optional)
                  throw new Error(key + " should be defined");
            }
         }
      }
      checkObj(data, version.schema);
   }
}

function checkType() {

}


function getLast<T = any>(arr: T[]) {
   return arr[arr.length - 1];
}

export function recursiveDeepCopy<T = any | any[]>(o: T): T {
   var newO,
      i;

   if (typeof o !== 'object') {
      return o;
   }
   if (!o) {
      return o;
   }

   if (Array.isArray(o)) {
      newO = [];
      for (i = 0; i < o.length; i += 1) {
         newO[i] = recursiveDeepCopy(o[i]);
      }
      return newO;
   }

   newO = {};
   for (i in o) {
      if (o.hasOwnProperty(i)) {
         newO[i] = recursiveDeepCopy(o[i]);
      }
   }
   return newO;
}
import { ObjectID } from "mongodb";
import Model from "./model";

export interface SchemaNodeObject {
   [K: string]: PropertyNode;
   [K: number]: PropertyNode;
}

export interface RootSchemaNode extends SchemaNodeObject {
   _id?: undefined;
   _v?: undefined;
}

export interface Property<T, V> {
   /**
    * Type of property
    */
   type: T;

   /**
    * Default value of property. 
    * If function, function is called and return value used!
    * 
    * @returns Default value
    */
   default?: V | (() => V);

   /**
    * Marks property as optional, wich will stop checking for availablility.
    * The value is checked according to type and validate function if set and 
    * will return error on mismatch.
    */
   optional?: boolean;

   /**
    * Validates record before save
    * @returns Error message or undefined or null
    */
   validate?: (value: V) => string | undefined | null;
}

export interface ModelPropery extends Property<SchemaNodeObject, {}> {
   model: true;
   array?: boolean;
}

export type PropertyNode =
   Property<StringConstructor, string> |
   Property<NumberConstructor, number> |
   Property<BooleanConstructor, boolean> |
   Property<DateConstructor, Date> |
   Property<ArrayConstructor, any[]> |
   ModelPropery |
   // Property<typeof Model, Model<any>[]> |
   Property<typeof ObjectID, ObjectID>


export type Migration = (old: any) => void | Promise<void>;

export interface VersionNode {
   schema: RootSchemaNode;
   migration: Migration
}

export interface ModelDefinition {
   name: string;
   versions: VersionNode[];
}

export function validate(definition: ModelDefinition): void { }
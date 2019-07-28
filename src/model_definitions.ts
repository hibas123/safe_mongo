import { ObjectID } from "mongodb";

/**
 * This symbol can be used to address all root properties of an model deginition. 
 * It can be used together with special definitions and then acts as "backup".
 */
export const AllSymbol = Symbol("AllAttributes");
export type AnyType = "any";

export interface SchemaNodeObject {
   [AllSymbol]?: PropertyNode;
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
    * Allows null as valid value.
    */
   allow_null?: boolean;

   /**
    * Validates record before save
    * @returns Error message or undefined or null
    */
   validate?: (value: V) => string | undefined | null;

   /**
    * This field should ba a array of the type type
    */
   array?: boolean;
}

export interface ModelPropery extends Property<SchemaNodeObject, {}> {
   model: true;
}

export type PropertyNode =
   Property<StringConstructor, string> |
   Property<NumberConstructor, number> |
   Property<BooleanConstructor, boolean> |
   Property<DateConstructor, Date> |
   Property<ArrayConstructor, any[]> |
   ModelPropery |
   // Property<typeof Model, Model<any>[]> |
   Property<typeof ObjectID, ObjectID> |
   Property<ObjectConstructor, Object> |
   Property<AnyType, any>


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
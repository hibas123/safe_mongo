import { ObjectID } from "mongodb";

export interface SchemaNodeObject {
   [K: string]: PropertyNode;
   [K: number]: PropertyNode;
}

export interface RootSchemaNode extends SchemaNodeObject {
   _id?: undefined;
   _v?: undefined;
}

export interface Property<T, V> {
   type: T;
   default?: V | (() => V);
   optional?: boolean;
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
   Property<typeof ObjectID, ObjectID>


export type Migration = <T>(old: T) => void | Promise<void>;

export interface VersionNode {
   schema: RootSchemaNode;
   migration: Migration
}

export interface ModelDefinition {
   name: string;
   versions: VersionNode[];
}

export function validate(definition: ModelDefinition): void { }
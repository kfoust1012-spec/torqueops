export type UUID = string;
export type ISODateString = string;
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface TimestampFields {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface DbTimestampFields {
  created_at: ISODateString;
  updated_at: ISODateString;
}

import { Response } from "express";
import { Error } from "mongoose";

export interface AdvanceResponse extends Response {
    advanceFetch?: any
    advanceDelete?: any
}

export interface ValidationError extends Error {
    kind: string
    value: string
    path: string
}

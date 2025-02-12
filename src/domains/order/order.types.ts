import {Types} from "mongoose";


export interface IOrderFromAPI {
    OrderNumber: number;
    Destination: string;
}

export interface IOrder {
    orderNumber: number;
    destination: string;
    loaded: boolean;
    transportId: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}
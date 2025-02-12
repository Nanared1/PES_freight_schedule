export interface IFreightScheduleFromAPI {
    DepartingLocation: string;
    ArrivalLocation: string;
    Day: number;
}

export interface IFreightSchedule {
    departingLocation: string;
    arrivalLocation: string;
    day: number;
    createdAt?: Date;
    updatedAt?: Date;
}
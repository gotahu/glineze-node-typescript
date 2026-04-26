export type SesameHistory = {
  type: number;
  timeStamp: number;
  historyTag?: string;
  recordID: number;
  parameter: string;
};

export type SesameAPIResponse = {
  histories: SesameHistory[];
  cursor: number;
};

export enum SesameLockStatus {
  Locked = 1,
  Unlocked = 2,
  Error = 3,
}

export type SesameDeviceStatus = {
  lockStatus: SesameLockStatus;
  latestType: number;
  timestamp: Date;
};

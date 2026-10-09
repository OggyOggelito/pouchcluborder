/**
 * Hand-written TooEasy payloads. Fake names and fake ids throughout — no
 * recorded live data, so these are safe to commit.
 */
export const EMPLOYEE_A = "EMP-0001";
export const EMPLOYEE_B = "EMP-0002";
export const STORE_MAPPED = "SE-100";
export const STORE_UNMAPPED = "SE-999";

/** A shift payload that also carries every payroll field, as the real API does. */
export const shiftsWithPayroll = {
  stores: [
    {
      StoreNumber: STORE_MAPPED,
      StoreName: "Testbutiken",
      employees: [
        {
          EmployeeId: EMPLOYEE_A,
          Firstname: "Testa",
          Lastname: "Testsson",
          days: [
            {
              Date: "2026-10-15T00:00:00",
              actions: [
                {
                  ActionId: 1,
                  StartTime: "2026-10-15T07:30:00",
                  EndTime: "2026-10-15T16:00:00",
                  DepartmentName: "Butik",
                  TotalCost: 2345.5,
                  OBCost: 120.25,
                  PayrollTaxes: 540.1,
                  CostExPayrollTax: 1805.4,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

/** Two stores: one mapped, one not. Shifts from the unmapped one must vanish. */
export const shiftsAcrossStores = {
  stores: [
    {
      StoreNumber: STORE_MAPPED,
      StoreName: "Testbutiken",
      employees: [
        {
          EmployeeId: EMPLOYEE_A,
          days: [
            {
              Date: "2026-10-15T00:00:00",
              actions: [{ StartTime: "2026-10-15T09:00:00", EndTime: "2026-10-15T17:00:00" }],
            },
          ],
        },
      ],
    },
    {
      StoreNumber: STORE_UNMAPPED,
      StoreName: "Okänd butik",
      employees: [
        {
          EmployeeId: EMPLOYEE_A,
          days: [
            {
              Date: "2026-10-16T00:00:00",
              actions: [{ StartTime: "2026-10-16T09:00:00", EndTime: "2026-10-16T17:00:00" }],
            },
          ],
        },
      ],
    },
  ],
};

/** An employee we have no mapping for. */
export const shiftsUnknownEmployee = {
  stores: [
    {
      StoreNumber: STORE_MAPPED,
      employees: [
        {
          EmployeeId: EMPLOYEE_B,
          days: [
            {
              Date: "2026-10-15T00:00:00",
              actions: [{ StartTime: "2026-10-15T08:00:00", EndTime: "2026-10-15T12:00:00" }],
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Either side of the Swedish DST change on 2026-10-25 (CEST -> CET).
 * Both are 07:30 local on the clock; if anything converts to an instant and
 * back, one of them moves.
 */
export const shiftsAcrossDst = {
  stores: [
    {
      StoreNumber: STORE_MAPPED,
      employees: [
        {
          EmployeeId: EMPLOYEE_A,
          days: [
            {
              Date: "2026-10-24T00:00:00",
              actions: [{ StartTime: "2026-10-24T07:30:00", EndTime: "2026-10-24T16:00:00" }],
            },
            {
              Date: "2026-10-26T00:00:00",
              actions: [{ StartTime: "2026-10-26T07:30:00", EndTime: "2026-10-26T16:00:00" }],
            },
          ],
        },
      ],
    },
  ],
};

/** Same shift expressed as UTC instants — must be rejected, not mis-sliced. */
export const shiftsWithUtcOffset = {
  stores: [
    {
      StoreNumber: STORE_MAPPED,
      employees: [
        {
          EmployeeId: EMPLOYEE_A,
          days: [
            {
              Date: "2026-10-15T00:00:00",
              actions: [{ StartTime: "2026-10-15T05:30:00Z", EndTime: "2026-10-15T14:00:00Z" }],
            },
          ],
        },
      ],
    },
  ],
};

export const OUR_USER_A = "user-aaa";
export const OUR_STORE = "store-111";

export function maps() {
  return {
    userByEmployeeId: new Map([[EMPLOYEE_A, OUR_USER_A]]),
    storeByNumber: new Map([[STORE_MAPPED, OUR_STORE]]),
  };
}

export interface Employee {
  id?: number;
  userId: string;
  password?: string;
  nickname: string;
  firstName: string;
  lastName?: string;
  address?: string;
  phone: string;
  branch?: string;
  position?: string;
  salary?: number;
  employmentType?: string;
  status?: boolean;
  mustChangePassword?: boolean;
}

export type EmployeeSession = Pick<
  Employee,
  "userId" | "nickname" | "firstName" | "employmentType" | "mustChangePassword"
>;

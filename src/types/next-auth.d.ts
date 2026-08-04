import { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      canSendWithoutApproval: boolean;
    };
  }

  interface User {
    role: Role;
    canSendWithoutApproval?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    canSendWithoutApproval?: boolean;
  }
}

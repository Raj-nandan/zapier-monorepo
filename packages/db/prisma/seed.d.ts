import { PrismaClient } from "@prisma/client";
export declare const TRIGGERS: {
    slug: string;
    name: string;
}[];
export declare const ACTIONS: {
    slug: string;
    name: string;
}[];
export declare function seed(prisma: PrismaClient): Promise<{
    triggers: number;
    actions: number;
}>;
//# sourceMappingURL=seed.d.ts.map
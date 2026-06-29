import { Inngest } from "inngest";
import { prisma } from "../config/prisma.js";

export const inngest = new Inngest({ id: "projify" });

const getPrimaryEmail = (data) => data?.email_addresses?.[0]?.email_address;
const getFullName = (data) =>
  [data?.first_name, data?.last_name].filter(Boolean).join(" ") || getPrimaryEmail(data) || "User";

const getUserData = (data) => ({
  email: getPrimaryEmail(data),
  name: getFullName(data),
  image: data?.image_url || "",
});

const syncUserCreation = inngest.createFunction(
  { id: "sync-user-from-clerk", triggers: [{ event: "clerk/user.created" }] },
  async ({ event }) => {
    const { data } = event;

    await prisma.user.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        ...getUserData(data),
      },
      update: getUserData(data),
    });
  }
);

const syncUserDeletion = inngest.createFunction(
  { id: "delete-user-with-clerk", triggers: [{ event: "clerk/user.deleted" }] },
  async ({ event }) => {
    const { data } = event;

    await prisma.user.deleteMany({
      where: { id: data.id },
    });
  }
);

const syncUserUpdate = inngest.createFunction(
  { id: "update-user-from-clerk", triggers: [{ event: "clerk/user.updated" }] },
  async ({ event }) => {
    const { data } = event;

    await prisma.user.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        ...getUserData(data),
      },
      update: getUserData(data),
    });
  }
);

export const functions = [syncUserCreation, syncUserDeletion, syncUserUpdate];

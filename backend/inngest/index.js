import { Inngest } from "inngest";
import { prisma } from "../config/prisma.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "projify" });

const getUserData = (data) => ({
  email: data?.email_addresses?.[0]?.email_address,
  name: [data?.first_name, data?.last_name].filter(Boolean).join(" ") || "User",
  image: data?.image_url || ""
});

// Inngest function to create a user
const syncUserCreation = inngest.createFunction(
  { id: 'sync-user-from-clerk', triggers: [{ event: "clerk/user.created" }] },
  async ({ event }) => {
    const { data } = event;

    await prisma.user.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        ...getUserData(data)
      },
      update: getUserData(data)
    })
  }
);

// Inngest function to delete a user
const syncUserDeletion = inngest.createFunction(
  { id: 'delete-user-with-clerk', triggers: [{ event: "clerk/user.deleted" }] },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.deleteMany({
      where: { id: data.id }
    });
  }
);

// Inngest function to update user  

const syncUserUpdatation = inngest.createFunction(
  { id: 'update-user-from-clerk', triggers: [{ event: "clerk/user.updated" }] },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.upsert({
      where: {
        id: data.id,
      },
      create: {
        id: data.id,
        ...getUserData(data)
      },
      update: getUserData(data)
    })
  }
);

// Inngest function to save workspace data to a database
const syncWorkspaceCreation = inngest.createFunction(
  { id: 'sync-workspace-to-clerk', triggers: [{ event: "clerk/organization.created" }] },
  async ({ event }) => {
    const { data } = event;

    await prisma.workspace.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        ownerId: data.created_by,
        image_url: data?.image_url || "",
      }
    })

    // Add creator as admin
    await prisma.workspaceMember.create({
      data:{
        userId: data.created_by,
        workspaceId: data.id,
        role: "ADMIN"
      }
    })
  }
);

// Inngest function to update workspace in database
const syncWorkspaceUpdatation = inngest.createFunction(
    {id: 'update-workspace-from-clerk', triggers: [{ event: "clerk/organization.updated" }]},
    async({event})=>{
        const {data} = event;

        await prisma.workspace.update({
            where: {
                id: data.id,
            },
            data: {
                name: data.name,
                slug: data.slug,
                image_url: data?.image_url || "",
            }
        })
    }
);

// Inngest function to delete workspace from database
const syncWorkspaceDeletion = inngest.createFunction(
    {id: 'delete-workspace-with-clerk', triggers: [{ event: "clerk/organization.deleted" }]},
    async({event})=>{
        const {data} = event;

        await prisma.workspace.delete({
            where: {
                id: data.id,
            }
        })
    }
);

// Inngest function to save workspace member data to a database
const syncWorkspaceMemberCreation = inngest.createFunction(
    {id: 'sync-workspace-member-from-clerk', triggers: [{ event: "clerk/organizationInvitation.accepted" }]},
    async({event})=>{
        const {data} = event;

        await prisma.workspaceMember.create({
            data: {
                userId: data.user_id,
                workspaceId: data.organization_id,
                role: String(data?.role_name).toUpperCase() || "MEMBER"
            }
        })
    }
);

// Create an empty array where we'll export future Inngest functions
export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdatation,
    syncWorkspaceCreation,
    syncWorkspaceUpdatation,
    syncWorkspaceDeletion,
    syncWorkspaceMemberCreation
];

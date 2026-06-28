import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "projify" });

// Inngest function to create a user
const syncUserCreation = inngest.createFunction(
    {id: 'sync-user-from-clerk'},
    {event: 'clerk/user.created'},
    async({event})=>{
        const {data} = event;
        await prisma.user.create({
            data:{
                id: data?.id,
                email: data?.email_address[0]?.email_addres,
                name: data?.first_name+ " " + data?.last_name,
                image: data?.image_url
            }
        })
    }
)

// Inngest function to delete a user
const syncUserDeletion = inngest.createFunction(
    {id: 'delete-user-with-clerk'},
    {event: 'clerk/user.deleted'},
    async({event})=>{
        const {data} = event;
        await prisma.user.delete({
            where:{
                id: data?.id,
            }
        })
    }
)

// Inngest function to update user
const syncUserUpdatation = inngest.createFunction(
    {id: 'update-user-from-clerk'},
    {event: 'clerk/user.updated'},
    async({event})=>{
        const {data} = event;
        await prisma.user.update({
            where:{
                id: data?.id,
            },
            data:{
                email: data?.email_address[0]?.email_addres,
                name: data?.first_name+ " " + data?.last_name,
                image: data?.image_url
            }
        })
    }
)

// Create an empty array where we'll export future Inngest functions
export const functions = [syncUserCreation, syncUserDeletion, syncUserUpdatation];

import { Inngest } from "inngest";
import { prisma } from "../config/prisma.js";
import sendEmail from "../config/nodemailer.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "projify" });

// Inngest function to create a user
const syncUserCreation = inngest.createFunction(
    {id: 'sync-user-from-clerk', triggers: [{ event: "clerk/user.created" }] },
    async({event})=>{
        const {data} = event;
        await prisma.user.create({
            data:{
                id: data?.id,
                email: data?.email_addresses[0]?.email_address,
                name: data?.first_name+ " " + data?.last_name,
                image: data?.image_url,
            }
        })
    }
)

// Inngest function to delete user from database
const syncUserDeletion = inngest.createFunction(
  { id: 'delete-user-with-clerk', triggers: [{ event: "clerk/user.deleted" }] },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.delete({
      where: { id: data.id }
    });
  }
);

// Inngest function to update user  
const syncUserUpdatation = inngest.createFunction(
    {id: 'update-user-from-clerk', triggers: [{ event: "clerk/user.updated" }]},
    async({event})=>{
        const {data} = event;
        await prisma.user.update({
            where:{
                id: data?.id,
            },
            data:{
                email: data?.email_addresses[0]?.email_address,
                name: data?.first_name+ " " + data?.last_name,
                image: data?.image_url
            }
        })
    }
);

// Inngest function to save workspace data to a database
const syncWorkspaceCreation = inngest.createFunction(
  { id: 'sync-workspace-from-clerk', triggers: [{ event: "clerk/organization.created" }] },
  async ({ event }) => {
    const { data } = event;

    await prisma.workspace.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        ownerId: data.created_by,
        image_url: data.image_url,
      }
    })

    // Add creator as admin
    await prisma.workspaceMember.create({
      data: {
        userId: data.created_by,
        workspaceId: data.id,
        role: "ADMIN"
      }
    })
  }
);

// Inngest function to update workspace in database
const syncWorkspaceUpdatation = inngest.createFunction(
  { id: 'update-workspace-from-clerk', triggers: [{ event: "clerk/organization.updated" }] },
  async ({ event }) => {
    const { data } = event;

    await prisma.workspace.update({
      where: {
        id: data.id,
      },
      data: {
        name: data.name,
        slug: data.slug,
        image_url: data.image_url,
      }
    })
  }
);

// Inngest function to delete workspace from database
const syncWorkspaceDeletion = inngest.createFunction(
  { id: 'delete-workspace-with-clerk', triggers: [{ event: "clerk/organization.deleted" }] },
  async ({ event }) => {
    const { data } = event;

    await prisma.workspace.delete({
      where: {
        id: data.id,
      }
    })
  }
);

// Inngest function to save workspace member data to a database
const syncWorkspaceMemberCreation = inngest.createFunction(
  { id: 'sync-workspace-member-from-clerk', triggers: [{ event: "clerk/organizationInvitation.accepted" }] },
  async ({ event }) => {
    const { data } = event;

    await prisma.workspaceMember.create({
      data: {
        userId: data.user_id,
        workspaceId: data.organization_id,
        role: String(data.role_name).toUpperCase() || "MEMBER"
      }
    })
  }
);

// Inngest function to send Email on task creation
const sendTaskAssignmentEmail = inngest.createFunction(
  { id: 'send-task-assignment-email', triggers: [{ event: "app/task.assigned" }] },
  async ({ event, step }) => {
    const { taskId, origin } = event.data;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: true, project: true }
    })

    await sendEmail({
      to: task.assignee.email,
      subject: `New task assignment in ${task.project.name}`,
      body: `
      <div style="max-width: 600px;">
  <h2>Hi ${task.assignee.name}, 👋</h2>

  <p style="font-size: 16px;">You've been assigned a new task:</p>
  <p style="font-size: 18px; font-weight: bold; color: #007bff; margin: 8px 0;">${task.title}</p>

  <div style="border: 1px solid #ddd; padding: 12px 16px; border-radius: 6px; margin-bottom: 30px;">
    <p style="margin: 6px 0;"><strong>Description:</strong> ${task.description}</p>
    <p style="margin: 6px 0;"><strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}</p>
  </div>

  <a href="${origin}" style="background-color: #007bff; padding: 12px 24px; border-radius: 5px; color: #fff; font-weight: 600; font-size: 16px; text-decoration: none;">
    View Task
  </a>
</div>
      `,
    })

    if (new Date(task.due_date).toLocaleDateString() !== new Date().toDateString()) {
      await step.sleepUntil('wait-for-the-due-date', new Date(task.due_date));
      await step.run('check-if-task-is-completed', async () => {
        const task = await prisma.task.findUnique({
          where: { id: taskId },
          include: { assignee: true, project: true }
        })

        if (!task) return;
        if (task.status !== "DONE") {
          await step.run('send-task-reminder-mail', async () => {
            await sendEmail({
              to: task.assignee.email,
              subject: `Remider for ${task.project.name}`,
              body: `<div style="max-width: 600px;">
              <h2>Hi ${task.assignee.name}, ⏰</h2>
 
              <p style="font-size: 16px;">This is a reminder that the following task was due today and is still marked as incomplete:</p>
              <p style="font-size: 18px; font-weight: bold; color: #d9534f; margin: 8px 0;">${task.title}</p>
 
              <div style="border: 1px solid #ddd; padding: 12px 16px; border-radius: 6px; margin-bottom: 30px;">
                <p style="margin: 6px 0;"><strong>Project:</strong> ${task.project.name}</p>
                <p style="margin: 6px 0;"><strong>Description:</strong> ${task.description}</p>
                <p style="margin: 6px 0;"><strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}</p>
                <p style="margin: 6px 0;"><strong>Status:</strong> ${task.status}</p>
              </div>
 
              <a href="${origin}" style="background-color: #d9534f; padding: 12px 24px; border-radius: 5px; color: #fff; font-weight: 600; font-size: 16px; text-decoration: none;">
                Complete Task
              </a>
            </div>`
            })
          })
        }
      })
    }
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
  syncWorkspaceMemberCreation,
  sendTaskAssignmentEmail
];





// // import { Inngest } from "inngest";
// // import { prisma } from "../config/prisma.js";
// // import sendEmail from "../config/nodemailer.js"; // ← FIXED: uncommented

// // export const inngest = new Inngest({ id: "projify" });

// // const syncUserCreation = inngest.createFunction(
// //     { id: 'sync-user-from-clerk', triggers: [{ event: "clerk/user.created" }] },
// //     async ({ event }) => {
// //         const { data } = event;
// //         await prisma.user.create({
// //             data: {
// //                 id: data?.id,
// //                 email: data?.email_addresses[0]?.email_address,
// //                 name: data?.first_name + " " + data?.last_name,
// //                 image: data?.image_url,
// //             }
// //         })
// //     }
// // )

// // const syncUserDeletion = inngest.createFunction(
// //     { id: 'delete-user-with-clerk', triggers: [{ event: "clerk/user.deleted" }] },
// //     async ({ event }) => {
// //         const { data } = event;
// //         await prisma.user.delete({
// //             where: { id: data.id }
// //         });
// //     }
// // );

// // const syncUserUpdatation = inngest.createFunction(
// //     { id: 'update-user-from-clerk', triggers: [{ event: "clerk/user.updated" }] },
// //     async ({ event }) => {
// //         const { data } = event;
// //         await prisma.user.update({
// //             where: { id: data?.id },
// //             data: {
// //                 email: data?.email_addresses[0]?.email_address,
// //                 name: data?.first_name + " " + data?.last_name,
// //                 image: data?.image_url
// //             }
// //         })
// //     }
// // );

// // const syncWorkspaceCreation = inngest.createFunction(
// //     { id: 'sync-workspace-from-clerk', triggers: [{ event: "clerk/organization.created" }] },
// //     async ({ event }) => {
// //         const { data } = event;
// //         await prisma.workspace.create({
// //             data: {
// //                 id: data.id,
// //                 name: data.name,
// //                 slug: data.slug,
// //                 ownerId: data.created_by,
// //                 image_url: data.image_url,
// //             }
// //         })
// //         await prisma.workspaceMember.create({
// //             data: {
// //                 userId: data.created_by,
// //                 workspaceId: data.id,
// //                 role: "ADMIN"
// //             }
// //         })
// //     }
// // );

// // const syncWorkspaceUpdatation = inngest.createFunction(
// //     { id: 'update-workspace-from-clerk', triggers: [{ event: "clerk/organization.updated" }] },
// //     async ({ event }) => {
// //         const { data } = event;
// //         await prisma.workspace.update({
// //             where: { id: data.id },
// //             data: {
// //                 name: data.name,
// //                 slug: data.slug,
// //                 image_url: data.image_url,
// //             }
// //         })
// //     }
// // );

// // const syncWorkspaceDeletion = inngest.createFunction(
// //     { id: 'delete-workspace-with-clerk', triggers: [{ event: "clerk/organization.deleted" }] },
// //     async ({ event }) => {
// //         const { data } = event;
// //         await prisma.workspace.delete({
// //             where: { id: data.id }
// //         })
// //     }
// // );

// // const syncWorkspaceMemberCreation = inngest.createFunction(
// //     { id: 'sync-workspace-member-from-clerk', triggers: [{ event: "clerk/organizationInvitation.accepted" }] },
// //     async ({ event }) => {
// //         const { data } = event;
// //         await prisma.workspaceMember.create({
// //             data: {
// //                 userId: data.user_id,
// //                 workspaceId: data.organization_id,
// //                 role: String(data.role_name).toUpperCase() || "MEMBER"
// //             }
// //         })
// //     }
// // );

// // const sendTaskAssignmentEmail = inngest.createFunction(
// //     { id: 'send-task-assignment-email', triggers: [{ event: "app/task.assigned" }] },
// //     async ({ event, step }) => {
// //         const { taskId, origin } = event.data;

// //         // FIXED Bug 2: wrap DB fetch in step.run so it's retryable and won't re-run on replay
// //         const task = await step.run('fetch-task', async () => {
// //             return await prisma.task.findUnique({
// //                 where: { id: taskId },
// //                 include: { assignee: true, project: true }
// //             })
// //         })

// //         if (!task) return;

// //         // FIXED Bug 2: wrap first email in step.run
// //         await step.run('send-assignment-email', async () => {
// //             await sendEmail({
// //                 to: task.assignee.email,
// //                 subject: `New task assignment in ${task.project.name}`,
// //                 body: `
// //                 <div style="max-width: 600px;">
// //                     <h2>Hi ${task.assignee.name}, 👋</h2>
// //                     <p style="font-size: 16px;">You've been assigned a new task:</p>
// //                     <p style="font-size: 18px; font-weight: bold; color: #007bff; margin: 8px 0;">${task.title}</p>
// //                     <div style="border: 1px solid #ddd; padding: 12px 16px; border-radius: 6px; margin-bottom: 30px;">
// //                         <p style="margin: 6px 0;"><strong>Description:</strong> ${task.description}</p>
// //                         <p style="margin: 6px 0;"><strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}</p>
// //                     </div>
// //                     <a href="${origin}" style="background-color: #007bff; padding: 12px 24px; border-radius: 5px; color: #fff; font-weight: 600; font-size: 16px; text-decoration: none;">
// //                         View Task
// //                     </a>
// //                 </div>`,
// //             })
// //         })

// //         // FIXED Bug 4: compare both dates using the same method
// //         const dueDate = new Date(task.due_date);
// //         const today = new Date();
// //         dueDate.setHours(0, 0, 0, 0);
// //         today.setHours(0, 0, 0, 0);

// //         if (dueDate > today) {
// //             await step.sleepUntil('wait-for-the-due-date', new Date(task.due_date));

// //             // FIXED Bug 3: fetch task again OUTSIDE step.run, then send email in a separate step.run
// //             const updatedTask = await step.run('fetch-task-after-due-date', async () => {
// //                 return await prisma.task.findUnique({
// //                     where: { id: taskId },
// //                     include: { assignee: true, project: true }
// //                 })
// //             })

// //             if (!updatedTask || updatedTask.status === "DONE") return;

// //             // FIXED Bug 3: reminder email in its own separate step.run (not nested)
// //             await step.run('send-reminder-email', async () => {
// //                 await sendEmail({
// //                     to: updatedTask.assignee.email,
// //                     subject: `Reminder for ${updatedTask.project.name}`,
// //                     body: `
// //                     <div style="max-width: 600px;">
// //                         <h2>Hi ${updatedTask.assignee.name}, ⏰</h2>
// //                         <p style="font-size: 16px;">This is a reminder that the following task was due today and is still incomplete:</p>
// //                         <p style="font-size: 18px; font-weight: bold; color: #d9534f; margin: 8px 0;">${updatedTask.title}</p>
// //                         <div style="border: 1px solid #ddd; padding: 12px 16px; border-radius: 6px; margin-bottom: 30px;">
// //                             <p style="margin: 6px 0;"><strong>Project:</strong> ${updatedTask.project.name}</p>
// //                             <p style="margin: 6px 0;"><strong>Description:</strong> ${updatedTask.description}</p>
// //                             <p style="margin: 6px 0;"><strong>Due Date:</strong> ${new Date(updatedTask.due_date).toLocaleDateString()}</p>
// //                             <p style="margin: 6px 0;"><strong>Status:</strong> ${updatedTask.status}</p>
// //                         </div>
// //                         <a href="${origin}" style="background-color: #d9534f; padding: 12px 24px; border-radius: 5px; color: #fff; font-weight: 600; font-size: 16px; text-decoration: none;">
// //                             Complete Task
// //                         </a>
// //                     </div>`,
// //                 })
// //             })
// //         }
// //     }
// // );

// // export const functions = [
// //     syncUserCreation,
// //     syncUserDeletion,
// //     syncUserUpdatation,
// //     syncWorkspaceCreation,
// //     syncWorkspaceUpdatation,
// //     syncWorkspaceDeletion,
// //     syncWorkspaceMemberCreation,
// //     sendTaskAssignmentEmail
// // ];













// import { Inngest } from "inngest";
// import { prisma } from "../config/prisma.js";
// import sendEmail from "../config/nodemailer.js";

// export const inngest = new Inngest({ id: "projify" });

// const syncUserCreation = inngest.createFunction(
//     { id: 'sync-user-from-clerk', triggers: [{ event: "clerk/user.created" }] },
//     async ({ event }) => {
//         const { data } = event;
//         await prisma.user.create({
//             data: {
//                 id: data?.id,
//                 email: data?.email_addresses[0]?.email_address,
//                 name: data?.first_name + " " + data?.last_name,
//                 image: data?.image_url,
//             }
//         })
//     }
// )

// const syncUserDeletion = inngest.createFunction(
//     { id: 'delete-user-with-clerk', triggers: [{ event: "clerk/user.deleted" }] },
//     async ({ event }) => {
//         const { data } = event;
//         await prisma.user.delete({ where: { id: data.id } });
//     }
// );

// const syncUserUpdatation = inngest.createFunction(
//     { id: 'update-user-from-clerk', triggers: [{ event: "clerk/user.updated" }] },
//     async ({ event }) => {
//         const { data } = event;
//         await prisma.user.update({
//             where: { id: data?.id },
//             data: {
//                 email: data?.email_addresses[0]?.email_address,
//                 name: data?.first_name + " " + data?.last_name,
//                 image: data?.image_url
//             }
//         })
//     }
// );

// const syncWorkspaceCreation = inngest.createFunction(
//     { id: 'sync-workspace-from-clerk', triggers: [{ event: "clerk/organization.created" }] },
//     async ({ event }) => {
//         const { data } = event;
//         await prisma.workspace.create({
//             data: {
//                 id: data.id,
//                 name: data.name,
//                 slug: data.slug,
//                 ownerId: data.created_by,
//                 image_url: data.image_url,
//             }
//         })
//         await prisma.workspaceMember.create({
//             data: {
//                 userId: data.created_by,
//                 workspaceId: data.id,
//                 role: "ADMIN"
//             }
//         })
//     }
// );

// const syncWorkspaceUpdatation = inngest.createFunction(
//     { id: 'update-workspace-from-clerk', triggers: [{ event: "clerk/organization.updated" }] },
//     async ({ event }) => {
//         const { data } = event;
//         await prisma.workspace.update({
//             where: { id: data.id },
//             data: {
//                 name: data.name,
//                 slug: data.slug,
//                 image_url: data.image_url,
//             }
//         })
//     }
// );

// const syncWorkspaceDeletion = inngest.createFunction(
//     { id: 'delete-workspace-with-clerk', triggers: [{ event: "clerk/organization.deleted" }] },
//     async ({ event }) => {
//         const { data } = event;
//         await prisma.workspace.delete({ where: { id: data.id } })
//     }
// );

// const syncWorkspaceMemberCreation = inngest.createFunction(
//     { id: 'sync-workspace-member-from-clerk', triggers: [{ event: "clerk/organizationInvitation.accepted" }] },
//     async ({ event }) => {
//         const { data } = event;
//         await prisma.workspaceMember.create({
//             data: {
//                 userId: data.user_id,
//                 workspaceId: data.organization_id,
//                 role: String(data.role_name).toUpperCase() || "MEMBER"
//             }
//         })
//     }
// );

// const sendTaskAssignmentEmail = inngest.createFunction(
//     { id: 'send-task-assignment-email', triggers: [{ event: "app/task.assigned" }] },
//     async ({ event, step }) => {
//         const { taskId, origin } = event.data;

//         const task = await step.run('fetch-task', async () => {
//             return await prisma.task.findUnique({
//                 where: { id: taskId },
//                 include: { assignee: true, project: true }
//             })
//         })

//         if (!task) return;

//         await step.run('send-assignment-email', async () => {
//             await sendEmail({
//                 to: task.assignee.email,
//                 subject: `New task assignment in ${task.project.name}`,
//                 body: `
//                 <div style="max-width: 600px;">
//                     <h2>Hi ${task.assignee.name}, 👋</h2>
//                     <p style="font-size: 16px;">You've been assigned a new task:</p>
//                     <p style="font-size: 18px; font-weight: bold; color: #007bff; margin: 8px 0;">${task.title}</p>
//                     <div style="border: 1px solid #ddd; padding: 12px 16px; border-radius: 6px; margin-bottom: 30px;">
//                         <p style="margin: 6px 0;"><strong>Description:</strong> ${task.description}</p>
//                         <p style="margin: 6px 0;"><strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}</p>
//                     </div>
//                     <a href="${origin}" style="background-color: #007bff; padding: 12px 24px; border-radius: 5px; color: #fff; font-weight: 600; font-size: 16px; text-decoration: none;">
//                         View Task
//                     </a>
//                 </div>`,
//             })
//         })

//         const dueDate = new Date(task.due_date);
//         const today = new Date();
//         dueDate.setHours(0, 0, 0, 0);
//         today.setHours(0, 0, 0, 0);

//         if (dueDate > today) {
//             await step.sleepUntil('wait-for-the-due-date', new Date(task.due_date));

//             const updatedTask = await step.run('fetch-task-after-due-date', async () => {
//                 return await prisma.task.findUnique({
//                     where: { id: taskId },
//                     include: { assignee: true, project: true }
//                 })
//             })

//             if (!updatedTask || updatedTask.status === "DONE") return;

//             await step.run('send-reminder-email', async () => {
//                 await sendEmail({
//                     to: updatedTask.assignee.email,
//                     subject: `Reminder for ${updatedTask.project.name}`,
//                     body: `
//                     <div style="max-width: 600px;">
//                         <h2>Hi ${updatedTask.assignee.name}, ⏰</h2>
//                         <p style="font-size: 16px;">This is a reminder that the following task was due today and is still incomplete:</p>
//                         <p style="font-size: 18px; font-weight: bold; color: #d9534f; margin: 8px 0;">${updatedTask.title}</p>
//                         <div style="border: 1px solid #ddd; padding: 12px 16px; border-radius: 6px; margin-bottom: 30px;">
//                             <p style="margin: 6px 0;"><strong>Project:</strong> ${updatedTask.project.name}</p>
//                             <p style="margin: 6px 0;"><strong>Description:</strong> ${updatedTask.description}</p>
//                             <p style="margin: 6px 0;"><strong>Due Date:</strong> ${new Date(updatedTask.due_date).toLocaleDateString()}</p>
//                             <p style="margin: 6px 0;"><strong>Status:</strong> ${updatedTask.status}</p>
//                         </div>
//                         <a href="${origin}" style="background-color: #d9534f; padding: 12px 24px; border-radius: 5px; color: #fff; font-weight: 600; font-size: 16px; text-decoration: none;">
//                             Complete Task
//                         </a>
//                     </div>`,
//                 })
//             })
//         }
//     }
// );

// export const functions = [
//     syncUserCreation,
//     syncUserDeletion,
//     syncUserUpdatation,
//     syncWorkspaceCreation,
//     syncWorkspaceUpdatation,
//     syncWorkspaceDeletion,
//     syncWorkspaceMemberCreation,
//     sendTaskAssignmentEmail
// ];
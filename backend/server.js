import express from 'express';
import 'dotenv/config.js'
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express'
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js"
import { protect } from './middleware/auth.js';
import workspaceRouter from './routes/workspace.js';
import projectRouter from './routes/project.js';
import taskRouter from './routes/task.js';
import commentRouter from './routes/comment.js';

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());
app.use(clerkMiddleware())
app.use("/api/inngest", serve({ client: inngest, functions }));

// Routes
app.use('/api/workspaces', protect, workspaceRouter);
app.use('/api/projects', protect, projectRouter);
app.use('/api/tasks', protect, taskRouter);
app.use('/api/comments', protect, commentRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=>console.log(`Server is running on port ${PORT}`));
import express from 'express';
import { addMember, getUserWorkspaces } from '../controller/workspace.js';

const workspaceRouter = express.Router();

workspaceRouter.get('/', getUserWorkspaces);
workspaceRouter.post('/addMember', addMember);

export default workspaceRouter;
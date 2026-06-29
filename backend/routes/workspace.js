import express from 'express';
import { addMember, getUserWorkspaces } from '../controller/workspace.js'

const workspaceRouter = express.Router();

workspaceRouter.get('/', getUserWorkspaces);
workspaceRouter.get('/add-member', addMember);

export default workspaceRouter;
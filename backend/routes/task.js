import express from 'express';
import { createTask, deleteTask, updateTask } from '../controller/task.js';

const taskRouter = express.Router();

taskRouter.post('/', createTask);
taskRouter.put('/:id', updateTask);
taskRouter.post('/delete', deleteTask);

export default taskRouter;
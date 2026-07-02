import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../middleware/validate.js';
import { list, read, create, update, remove, suggestions } from '../controllers/income.controller.js';

export const incomeRouter = Router();
incomeRouter.use(authenticate);

// Must be registered before /:id so "suggestions" isn't swallowed as an id.
incomeRouter.get('/suggestions', asyncHandler(suggestions));

incomeRouter.get('/', asyncHandler(list));
incomeRouter.post('/', asyncHandler(create));
incomeRouter.get('/:id', asyncHandler(read));
incomeRouter.patch('/:id', asyncHandler(update));
incomeRouter.delete('/:id', asyncHandler(remove));

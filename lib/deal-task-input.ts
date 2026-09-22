import {z} from 'zod';
export const dealTaskInput=z.object({
 title:z.string().trim().min(1).max(300),
 opportunity_key:z.string().trim().max(100).transform(v=>v||null),
 due_date:z.string().transform(v=>v||null).pipe(z.string().date().nullable()),
 priority:z.enum(['low','medium','high']),
});
export const dealTaskUpdate=z.object({id:z.string().uuid(),status:z.enum(['open','complete'])});

import {z} from 'zod';

export const brokerProfileSchema=z.object({
 display_name:z.string().trim().min(2).max(100),
 brokerage:z.string().trim().max(160),
 biography:z.string().trim().max(2000),
 service_areas:z.string().trim().max(500),
 specialties:z.string().trim().max(500),
 languages:z.string().trim().max(200),
 buyer_approach:z.string().trim().max(1000),
 welcomes_preparing_buyers:z.boolean(),
 published:z.boolean(),
}).refine(p=>!p.published||p.biography.length>=40,{path:['biography'],message:'Add at least 40 characters before publishing.'});
export const brokerProfileFields=['display_name','brokerage','biography','service_areas','specialties','languages','buyer_approach'] as const;
export const brokerProfileSelect='user_id,display_name,brokerage,biography,service_areas,specialties,languages,buyer_approach,welcomes_preparing_buyers,published,updated_at';

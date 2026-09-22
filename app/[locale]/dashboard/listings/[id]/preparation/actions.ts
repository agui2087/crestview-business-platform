"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sellerPreparationSchema } from "@/lib/seller-preparation";
import { listingFinancialContextSchema } from "@/lib/listing-financial-context";
export async function saveListingFinancialContext(form: FormData) {
 const locale=String(form.get('locale'));if(!isLocale(locale))redirect('/en/sign-in');
 const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect(`/${locale}/sign-in`);
 const parsed=listingFinancialContextSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success)redirect(`/${locale}/dashboard/listings?error=financial_context`);
 const {listing_id,...facts}=parsed.data;
 const {data,error}=await db.from('marketplace_listings').update(facts).eq('id',listing_id).eq('broker_id',user.id).select('id').maybeSingle();
 if(error||!data)redirect(`/${locale}/dashboard/listings/${listing_id}/preparation?error=context`);
 revalidatePath(`/${locale}/listings`);revalidatePath(`/${locale}/dashboard/marketplace`);revalidatePath(`/${locale}/dashboard/listings/${listing_id}/preparation`);
 redirect(`/${locale}/dashboard/listings/${listing_id}/preparation?saved=1`);
}
export async function saveSellerPreparation(form: FormData) {
 const locale=String(form.get("locale")); if(!isLocale(locale)) redirect('/en/sign-in');
 const db=await createSupabaseServerClient(); const {data:{user}}=await db.auth.getUser(); if(!user) redirect(`/${locale}/sign-in`);
 const parsed=sellerPreparationSchema.safeParse({listing_id:form.get('listing_id'),completed_steps:form.getAll('completed_steps')});
 if(!parsed.success) redirect(`/${locale}/dashboard/listings?error=preparation`);
 const {data,error}=await db.from('seller_preparation').upsert({...parsed.data,updated_at:new Date().toISOString()},{onConflict:'listing_id'}).select('listing_id').maybeSingle();
 if(error||!data) redirect(`/${locale}/dashboard/listings/${parsed.data.listing_id}/preparation?error=save`);
 revalidatePath(`/${locale}/dashboard/listings/${parsed.data.listing_id}/preparation`);
 redirect(`/${locale}/dashboard/listings/${parsed.data.listing_id}/preparation?saved=1`);
}
